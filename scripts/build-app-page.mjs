/**
 * La aplicación móvil en un solo fichero que se abre con doble clic.
 *
 * El export web de Expo son tres cosas —`index.html`, un paquete de cuatro
 * megas y una carpeta de fuentes e iconos—, y las tres se piden por HTTP. Eso
 * significa que para **enseñar** la aplicación hace falta levantar un servidor,
 * y que mandársela a alguien es mandarle una carpeta y unas instrucciones.
 *
 * Este script la deja en una página sola: el paquete en línea y cada recurso
 * convertido en `data:`. Pesa lo que pesan las dos cosas juntas —unos siete
 * megas— y a cambio se abre en cualquier sitio: un doble clic, un adjunto, un
 * panel que renderiza HTML.
 *
 * Se usa así, desde la raíz del repositorio:
 *
 *     pnpm build                                        # los paquetes del workspace
 *     cd apps/mobile && npx expo export --platform web  # deja apps/mobile/dist
 *     node scripts/build-app-page.mjs                   # deja artifacts/petnav-app-demo.html
 *
 * Dos cosas que el fichero lleva de más y no son adorno: sin la etiqueta
 * `viewport` el navegador de un teléfono compone en un lienzo de novecientos
 * ochenta puntos y encoge la aplicación entera hasta que la letra no se lee; y
 * sin reescribir la ruta a «/», Expo Router —que decide la pantalla mirando
 * `location.pathname`— pinta «Unmatched Route» en cuanto la página no se sirve
 * en la raíz de su dominio, que es lo que pasa al abrirla por su nombre de
 * fichero.
 *
 * **Lo que sale es la aplicación de verdad, con su puerta puesta**: sin cuenta
 * no se entra, así que la primera pantalla es el alta. Para una demostración
 * que aterrice directamente en el feed hay que tocar el estado de la cuenta
 * antes de exportar, y eso es un cambio en el código de la aplicación, no algo
 * que este script deba hacer a escondidas de quien lo lea.
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/mobile/dist');
const OUT = join(ROOT, 'artifacts/petnav-app-demo.html');

/** El tipo de cada recurso. Una fuente servida como `octet-stream` no carga. */
const MIME = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/** El paquete, que Expo nombra con un hash distinto en cada export. */
async function bundlePath() {
  const dir = join(DIST, '_expo/static/js/web');
  const entries = await readdir(dir);
  const found = entries.find((entry) => entry.endsWith('.js'));
  if (!found) throw new Error(`No hay ningún paquete en ${dir}. ¿Se ha exportado?`);
  return join(dir, found);
}

const PREAMBLE = `<title>Petnav</title>

<!-- El export web de la aplicación, en un solo fichero: el paquete y los
     recursos van en línea porque esta página no puede pedir nada a otro
     servidor. Los colores, la tipografía y la forma los pinta la aplicación con
     sus propios tokens; aquí abajo solo está lo que necesita para ocupar la
     ventana y no heredar el fondo de quien la enseñe. -->
<style>
  html,
  body {
    height: 100%;
  }
  body {
    /* La aplicación tiene sus propios \`ScrollView\`: si además se desplaza el
       documento, se desplazan los dos y la barra de pestañas se va de la
       pantalla. */
    overflow: hidden;
    margin: 0;
    /* El fondo de la aplicación, en sus dos temas y con el mismo valor que
       emiten los tokens. Sin esto la página compone sobre el fondo de quien la
       enseñe, que puede ser el contrario al del contenido. */
    background: oklch(97.7% 0.007 81);
  }
  :root:not([data-theme='light']) body {
    background: oklch(16.5% 0.028 282);
  }
  :root[data-theme='dark'] body {
    background: oklch(16.5% 0.028 282);
  }
  :root[data-theme='light'] body {
    background: oklch(97.7% 0.007 81);
  }
  #root {
    display: flex;
    height: 100%;
    flex: 1;
  }
</style>

<div id="root"></div>

<script>
  /*
    El «viewport».

    Sin él, el navegador de un teléfono compone la página en un lienzo virtual
    de novecientos ochenta puntos y luego la encoge: la aplicación se ve entera
    y en miniatura, con la letra por debajo del mínimo legible. La etiqueta va
    en la cabecera del documento, que esta página no escribe, así que se añade
    desde aquí antes de que arranque nada.
  */
  try {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1, shrink-to-fit=no';
    document.head.appendChild(viewport);
  } catch (error) {
    /* Sin cabecera a la que añadir: se compone como pueda. */
  }

  /*
    La ruta de arranque.

    Expo Router lee \`location.pathname\` para decidir qué pantalla abre, y esta
    página no se sirve necesariamente en la raíz de su dominio: con cualquier
    otra ruta —el nombre del fichero— el enrutador no encuentra nada y pinta
    «Unmatched Route». Se reescribe a «/» antes de cargar el paquete; a partir
    de ahí la navegación es de la propia aplicación y no vuelve a pedir nada.

    Va en \`try\` porque \`replaceState\` lanza en un origen opaco —abrir el
    fichero con doble clic, sin servidor—; ahí el enrutador se queda como estaba
    y la aplicación se sigue viendo desde su primera pantalla.
  */
  try {
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/' + window.location.search + window.location.hash);
    }
  } catch (error) {
    /* Origen opaco: se sigue sin reescribir. */
  }
</script>
`;

const bundle = await bundlePath();
let js = await readFile(bundle, 'utf8');

/* Cada recurso, buscado por la ruta con la que el paquete lo pide. Se
   reemplaza la cadena entera —con sus comillas— para no tocar un fragmento que
   se parezca por casualidad. */
const refs = [...new Set([...js.matchAll(/"(\/assets\/[^"]+)"/g)].map((match) => match[1]))].sort();

let inlined = 0;
const missing = [];
for (const ref of refs) {
  const local = join(DIST, ref.replace(/^\//, ''));
  try {
    await stat(local);
  } catch {
    missing.push(ref);
    continue;
  }
  const data = await readFile(local);
  const mime = MIME[extname(local).toLowerCase()] ?? 'application/octet-stream';
  js = js.split(`"${ref}"`).join(`"data:${mime};base64,${data.toString('base64')}"`);
  inlined += 1;
}

/* Un `</script>` dentro del paquete cerraría la etiqueta antes de tiempo y
   partiría la página por la mitad. Hoy no aparece ninguno; si algún día
   aparece, esto lo dice en vez de generar un fichero roto en silencio. */
if (/<\/script/i.test(js)) {
  throw new Error(
    'El paquete contiene «</script»: habría que escaparlo antes de meterlo en línea.',
  );
}

await writeFile(OUT, `${PREAMBLE}<script>\n${js}\n</script>\n`, 'utf8');

const { size } = await stat(OUT);
console.log(
  `✓ ${OUT} · ${(size / 1e6).toFixed(2)} MB · ${inlined}/${refs.length} recursos en línea`,
);
if (missing.length > 0) {
  console.error(`✗ ${missing.length} recursos que el paquete pide y no están en el export:`);
  for (const ref of missing) console.error(`  - ${ref}`);
  process.exitCode = 1;
}
