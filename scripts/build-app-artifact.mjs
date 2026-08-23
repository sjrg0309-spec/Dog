/**
 * Empaqueta la aplicación de Expo en una sola página que se abre en un móvil.
 *
 * `expo export --platform web` deja un `index.html` que pide el bundle y los
 * assets por rutas relativas. Eso vale servido; no vale como fichero suelto.
 * Aquí se mete todo dentro: el bundle como texto —no hace falta base64 para
 * JavaScript, y evitarlo ahorra un tercio del peso— y las tipografías como
 * data URI.
 *
 * De las dieciocho tipografías que copia el exportador solo se incrustan las
 * cinco que `lib/fonts.ts` carga de verdad. Las otras trece entran en el grafo
 * por el barril del paquete y no se piden nunca; incrustarlas serían dos megas
 * que alguien descarga con datos móviles para nada. El auditor comprueba que
 * efectivamente no se piden.
 *
 * Esto no es la app nativa: es la misma base de código corriendo en
 * react-native-web. No hay háptica ni cámara del sistema, y lo que en un
 * teléfono sería un gesto nativo aquí lo mueve el navegador.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = new URL('../apps/mobile/dist-web/', import.meta.url).pathname;
const OUT = new URL('../artifacts/coincide-app.html', import.meta.url).pathname;

/** Las que `lib/fonts.ts` pasa a `useFonts`. El resto no se pide nunca. */
const USED_FONTS = [
  'AtkinsonHyperlegible_400Regular.',
  'AtkinsonHyperlegible_700Bold.',
  'PlusJakartaSans_600SemiBold.',
  'PlusJakartaSans_700Bold.',
  'PlusJakartaSans_800ExtraBold.',
];

const walk = async (dir, base = '') => {
  const entries = await readdir(join(DIST, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(join(dir, entry.name), rel)));
    else files.push(rel);
  }
  return files;
};

const indexHtml = await readFile(join(DIST, 'index.html'), 'utf8');
const bundlePath = indexHtml.match(/src="\/(_expo\/[^"]+\.js)"/)?.[1];
if (!bundlePath) throw new Error('no se encontró el bundle en el index.html exportado');

let bundle = await readFile(join(DIST, bundlePath), 'utf8');

const assets = (await walk('assets', 'assets')).filter((file) => /\.(ttf|otf|woff2?|png|jpg|svg)$/.test(file));

let inlined = 0;
let skipped = 0;
for (const asset of assets) {
  const isFont = /\.(ttf|otf|woff2?)$/.test(asset);
  if (isFont && !USED_FONTS.some((name) => asset.includes(name))) {
    skipped += 1;
    continue;
  }
  const bytes = await readFile(join(DIST, asset));
  const extension = asset.slice(asset.lastIndexOf('.') + 1);
  const mime = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml' }[extension];
  const uri = `data:${mime};base64,${bytes.toString('base64')}`;
  /* El bundle guarda la ruta con y sin barra inicial según quién la escriba. */
  const before = bundle.length;
  bundle = bundle.split(`/${asset}`).join(uri).split(`"${asset}"`).join(`"${uri}"`);
  if (bundle.length !== before) inlined += 1;
}

/* El bundle va comprimido y se descomprime en el navegador.
 *
 * No es una optimización cosmética: en claro son tres megas y pico que alguien
 * abre con datos móviles, que es exactamente el sitio donde se va a abrir esto.
 * `DecompressionStream` lo hace el propio navegador, sin librería, y está en
 * Chrome y en Safari desde hace varias versiones. La descompresión sale a
 * texto y se ejecuta con eval indirecto —`(0, eval)`— para que el bundle
 * corra en ámbito global: dentro de una función sus declaraciones de nivel
 * superior no llegarían a `window` y el registro de módulos no se encontraría
 * a sí mismo.
 */
const packed = gzipSync(Buffer.from(bundle, 'utf8'), { level: 9 }).toString('base64');

const reset = indexHtml.slice(indexHtml.indexOf('<style id="expo-reset">'), indexHtml.indexOf('</style>') + '</style>'.length);

const document_ = `<meta charset="utf-8">
<title>Coincide en el móvil</title>
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover">
${reset}
<style>
  /* El exportador cuenta con servir la página en la raíz de un dominio y con
     que el elemento raíz ocupe la ventana. Aquí vive dentro de otra página, así
     que el alto se fija a la ventana visible —\`dvh\` para que la barra del
     navegador del móvil no recorte la barra de pestañas—. Y el fondo son los
     tokens del producto, no un gris a ojo: en un móvil este color asoma por las
     zonas seguras y por el rebote del scroll, así que uno que no sea el del
     tema se ve como un borde equivocado. */
  :root { --arranque-fondo: oklch(97.7% 0.007 81); --arranque-texto: oklch(45.5% 0.022 281); }
  @media (prefers-color-scheme: dark) {
    :root { --arranque-fondo: oklch(16.5% 0.028 282); --arranque-texto: oklch(72.5% 0.018 281); }
  }
  html, body { height: 100dvh; margin: 0; background: var(--arranque-fondo); }
  #root { height: 100dvh; }
  #arranque {
    position: fixed; inset: 0; display: grid; place-items: center;
    font: 500 0.85rem/1.5 system-ui, sans-serif; color: var(--arranque-texto);
    background: var(--arranque-fondo); text-align: center; padding: 2rem;
  }
  /* La tira del sandbox va arriba del todo y encima de la app: explica algo
     que la app está diciendo mal en este entorno, así que tiene que leerse
     antes que ella. */
  #sandbox {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    padding: 0.6rem 0.9rem;
    font: 400 0.72rem/1.45 system-ui, sans-serif;
    color: var(--arranque-texto); background: var(--arranque-fondo);
    border-bottom: 1px solid currentColor;
  }
  #sandbox[hidden] { display: none; }
</style>

<div id="root"></div>
<div id="arranque">Cargando Coincide…</div>

<script>
/* expo-router resuelve la ruta inicial leyendo \`location.pathname\`. Publicada,
   esta página puede colgar de una ruta que no es ninguna del app, y entonces
   arrancaría en la pantalla de «no encontrado» en vez de en el feed. */
try { if (location.pathname !== '/') history.replaceState(null, '', '/'); } catch (error) {}
</script>

<div id="sandbox" hidden></div>

<script>
/* El visor de artifacts sirve la página con una CSP que bloquea cualquier
   petición a otro dominio. La app consulta el tiempo a Open-Meteo, así que
   aquí esa llamada no sale, y el navegador la reporta como un fallo de red
   corriente: la app diría «sin conexión» en un teléfono que tiene datos.
   Mentira involuntaria, pero mentira.

   Esto no se arregla dentro de la app —allí no hay nada roto— sino aquí, que
   es donde se conoce el entorno. Se escucha la violación de CSP, que es el
   único aviso fiable de que la petición murió por política y no por red. */
document.addEventListener('securitypolicyviolation', (event) => {
  if (!String(event.blockedURI || '').includes('open-meteo')) return;
  const strip = document.getElementById('sandbox');
  if (!strip || !strip.hidden) return;
  strip.hidden = false;
  strip.textContent =
    'Esta copia se sirve en un visor que bloquea las peticiones a otros dominios, así que la ' +
    'consulta del tiempo no sale y la app cae a su modo manual. No es un fallo de tu conexión: ' +
    'instalada, o servida desde su propio dominio, pregunta a Open-Meteo de verdad.';
}, { once: false });
</script>

<script id="bundle" type="application/gzip-base64">${packed}</script>

<script>
(async () => {
  const splash = document.getElementById('arranque');
  const fail = (motivo) => {
    if (splash) splash.textContent = motivo;
  };
  if (typeof DecompressionStream !== 'function') {
    fail('Este navegador no puede descomprimir la aplicación. Ábrela en una versión reciente de Chrome, Safari o Firefox.');
    return;
  }
  try {
    const base64 = document.getElementById('bundle').textContent.trim();
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
    const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const codigo = await new Response(flujo).text();
    (0, eval)(codigo);
  } catch (error) {
    fail('No se pudo arrancar la aplicación: ' + error.message);
  }
})();
</script>

<script>
/* El aviso de carga se quita cuando React ha pintado algo, no con un temporizador:
   un retardo fijo tapa el arranque o deja el aviso encima de la app ya montada. */
(() => {
  const splash = document.getElementById('arranque');
  const root = document.getElementById('root');
  if (!splash || !root) return;
  const done = () => { splash.remove(); observer.disconnect(); };
  const observer = new MutationObserver(() => { if (root.childElementCount > 0) done(); });
  if (root.childElementCount > 0) done();
  else observer.observe(root, { childList: true, subtree: true });
})();
</script>`;

await writeFile(OUT, document_, 'utf8');

const mb = (Buffer.byteLength(document_) / 1024 / 1024).toFixed(2);
const antes = (Buffer.byteLength(bundle) / 1024 / 1024).toFixed(2);
console.log(`✓ ${inlined} assets incrustados, ${skipped} tipografías sin usar omitidas`);
console.log(`  bundle ${antes} MB → ${mb} MB en total tras comprimir → artifacts/coincide-app.html`);
