/**
 * Audita la app empaquetada antes de publicarla, a tamaño de teléfono.
 *
 * Lo que se comprueba es lo que se rompe al sacar una SPA de su servidor: que
 * arranque en el feed y no en «no encontrado» —la ruta inicial la lee del
 * navegador—, que las cinco pestañas naveguen, que no salga ni una petición
 * fuera del fichero, y que las trece tipografías que se dejaron sin incrustar
 * sigan sin pedirse. Esto último es la mitad del ahorro de peso: si alguna se
 * pidiera, el fichero no sería autocontenido y además faltaría.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const PATH = new URL('../artifacts/petnav-app.html', import.meta.url).pathname;
const TABS = ['Feed', 'Explorar', 'SOS', 'Mensajes', 'Perfil'];

/* Se sirve por HTTP en vez de abrirlo como fichero. No es un capricho: en
   `file://` el navegador prohíbe reescribir la ruta con `history.replaceState`,
   y esa llamada es justo la que hace que la app arranque en el feed. Auditarlo
   como fichero suelto comprobaría un entorno más hostil que el real y daría un
   fallo que no existe una vez publicado. */
const html = await readFile(PATH, 'utf8');
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const FILE = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

const problems = [];
const requests = [];
page.on('request', (request) => requests.push(request.url()));

/*
 * Un servidor de teselas de mentira, montado **antes de navegar**.
 *
 * El orden importa y costó una vuelta: instalarlo después del recorrido por las
 * pestañas no servía de nada, porque para entonces el mapa ya había pedido sus
 * imágenes, habían fallado contra el proxy, y el contador salía a cero mientras
 * la consola se llenaba de peticiones rotas. La regla nueva decía «no pidió
 * ninguna tesela» justo cuando había pedido seis.
 */
const tileRequests = [];
await page.route('https://tile.openstreetmap.org/**', async (route) => {
  const match = route
    .request()
    .url()
    .match(/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (!match) return route.abort();
  tileRequests.push(match[0]);
  await route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dde"/></svg>',
  });
});
/*
 * El almacén provisional de las ocho fotos del feed (`lib/photos.ts`,
 * `REMOTE_PHOTOS`). Es el tercer dominio previsto, con el del tiempo y el de
 * las calles: aquí tampoco llega —el mismo proxy—, y lo que se comprueba es que
 * al caerse la foto la tarjeta dibuja su escena en vez de dejar un hueco, que
 * ya lo hace `PostImage`. El día que las fotos se empaqueten, esta constante
 * sobra y la regla de terceros vuelve a ser de dos dominios.
 */
const PHOTO_HOST = 'd8j0ntlcm91z4.cloudfront.net';

page.on('requestfailed', (request) => {
  /* La del tiempo falla siempre en este contenedor, por el proxy de salida.
     Que falle no es el defecto; que no se intente, sí. Se comprueba abajo. */
  if (request.url().includes('api.open-meteo.com')) return;
  if (request.url().includes(PHOTO_HOST)) return;
  // Las teselas se sirven desde el servidor de mentira de arriba; si alguna
  // falla de verdad, la regla de teselas lo dirá con más contexto que esto.
  if (request.url().includes('tile.openstreetmap.org')) return;
  problems.push(`petición fallida: ${request.url().slice(0, 120)}`);
});
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const text = message.text();
  /* Mismo caso: el navegador reporta el bloqueo del proxy como error de red. */
  if (text.includes('ERR_TUNNEL_CONNECTION_FAILED') || text.includes('open-meteo')) return;
  problems.push(`consola: ${text.slice(0, 200)}`);
});
page.on('pageerror', (error) => problems.push(`error de página: ${error.message.slice(0, 200)}`));

await page.goto(FILE, { waitUntil: 'load' });
await page.waitForSelector('#root > *', { timeout: 30_000 });
await page.waitForTimeout(1500);

const booted = await page.evaluate(() => document.getElementById('arranque') === null);
if (!booted) problems.push('el aviso de carga sigue encima: React no llegó a pintar');

const body = await page.locator('#root').innerText();
if (/no encontr|unmatched|not found/i.test(body.slice(0, 400))) {
  problems.push('arrancó en la pantalla de «no encontrado» en vez de en el alta');
}

/*
 * La puerta: sin animal dado de alta no hay aplicación.
 *
 * Se comprueba aquí y antes que nada porque es la primera pantalla y porque es
 * una promesa fácil de romper sin enterarse: basta con que alguien deje una
 * ruta accesible o que el estado inicial se dé por registrado. Y no se mira el
 * texto solamente —un cartel se puede dejar puesto con la aplicación detrás—,
 * sino que **no exista la barra de pestañas**: si hay pestañas, hay aplicación.
 */
if (!/Petnav/i.test(body) || !/Aquí se entra con tu perro/i.test(body)) {
  problems.push('la aplicación no arrancó en la bienvenida: la puerta no está puesta');
}
if (await page.getByRole('tab', { name: /Explorar/i }).count()) {
  problems.push('hay barra de pestañas antes de dar de alta a ningún animal');
}
for (const label of ['Comenzar ahora', 'Ya tengo cuenta']) {
  if (!(await page.getByRole('button', { name: label, exact: true }).count())) {
    problems.push(`la bienvenida no ofrece «${label}»`);
  }
}

/*
 * Entrar, comprobado sin entrar.
 *
 * Se mira lo único que esta pantalla puede prometer sin servidor: que no deja
 * seguir con un correo que no tiene forma de correo, y que sí deja con uno que
 * la tiene. Lo que no se hace es entrar de verdad, porque entonces la auditoría
 * se quedaría dentro de la cuenta de demostración y no podría recorrer el alta,
 * que es lo que hay que comprobar entero.
 */
{
  await page.getByRole('button', { name: 'Ya tengo cuenta', exact: true }).first().click();
  await page.waitForTimeout(600);

  await page.getByLabel('Correo', { exact: true }).fill('ana');
  await page.getByLabel('Contraseña', { exact: true }).fill('loquesea');
  await page.waitForTimeout(300);
  const blockedLogin = await page
    .getByRole('button', { name: 'Entrar', exact: true })
    .first()
    .getAttribute('aria-disabled');
  if (blockedLogin !== 'true') {
    problems.push('entrar acepta un correo que no tiene forma de correo');
  }

  await page.getByLabel('Correo', { exact: true }).fill('ana@correo.com');
  await page.waitForTimeout(300);
  const okLogin = await page
    .getByRole('button', { name: 'Entrar', exact: true })
    .first()
    .getAttribute('aria-disabled');
  if (okLogin === 'true') {
    problems.push('entrar no deja seguir con un correo y una contraseña puestos');
  }

  /* Y el ojo de ver la contraseña, que es lo que hace viable pedir longitud en
     vez de símbolos: sin él, una frase larga se escribe a ciegas. */
  if (!(await page.getByRole('button', { name: /Ver la contraseña/i }).count())) {
    problems.push('la contraseña no se puede ver mientras se escribe');
  }

  await page.getByRole('button', { name: 'Volver', exact: true }).first().click();
  await page.waitForTimeout(600);
}

await page.getByRole('button', { name: 'Comenzar ahora', exact: true }).first().click();
await page.waitForTimeout(600);

if (!(await page.getByRole('button', { name: 'Rescate', exact: true }).count())) {
  problems.push('falta la segunda puerta: quien rescata y no tiene animal propio');
}

/*
 * El alta, paso a paso y como la haría alguien.
 *
 * Tiene la forma de un registro de Instagram —una pregunta por pantalla, barra
 * de progreso, botón fijo abajo—, así que la auditoría **avanza**: rellena, da a
 * Siguiente, y comprueba de paso lo que un formulario de una sola pantalla no
 * podía comprobar, que es que el botón no se enciende hasta que el paso está.
 */
const next = async (label = 'Siguiente') => {
  const button = page.getByRole('button', { name: label, exact: true }).first();
  if (!(await button.count())) {
    problems.push(`el alta no tiene botón «${label}»`);
    return false;
  }
  await button.click();
  await page.waitForTimeout(450);
  return true;
};

const chip = async (label) => {
  const target = page.getByRole('button', { name: label, exact: true }).first();
  if (!(await target.count())) {
    problems.push(`el alta no ofrece «${label}»`);
    return;
  }
  await target.click();
  await page.waitForTimeout(150);
};

await page.getByRole('button', { name: 'Tutor', exact: true }).first().click();
await page.waitForTimeout(600);

/* El botón no se enciende con el paso a medias. Es la promesa que sustituye a
   la lista de «falta por rellenar» del formulario anterior, así que se mira. */
const blocked = await page
  .getByRole('button', { name: 'Siguiente', exact: true })
  .first()
  .getAttribute('aria-disabled');
if (blocked !== 'true') {
  problems.push('el primer paso del alta deja seguir sin cuenta');
}

/*
 * La cuenta, y el medidor de la contraseña.
 *
 * Se escribe primero una de las que prueba cualquiera para comprobar que **no
 * deja seguir** y que lo dice, y después una frase larga: la regla de esta
 * pantalla es longitud por encima de composición —lo que recomienda el NIST
 * desde 2017— y sin esta comprobación es una frase en un comentario.
 */
await page.getByLabel('Correo', { exact: true }).fill('ana@correo.com');
await page.getByLabel('Contraseña', { exact: true }).fill('password');
await page.waitForTimeout(400);
const weak = (await page.locator('#root').innerText()).trim();
if (!/muy usada/i.test(weak)) {
  problems.push('el alta acepta una contraseña de las que se prueban primero');
}
const blockedWeak = await page
  .getByRole('button', { name: 'Siguiente', exact: true })
  .first()
  .getAttribute('aria-disabled');
if (blockedWeak !== 'true') {
  problems.push('el alta deja seguir con una contraseña de las más usadas');
}

await page.getByLabel('Contraseña', { exact: true }).fill('el perro come pasto');
await page.waitForTimeout(400);
const strong = (await page.locator('#root').innerText()).trim();
if (!/Muy buena/i.test(strong)) {
  problems.push('una frase larga sin símbolos no se reconoce como buena contraseña');
}
await next();

/*
 * La raza, que es el paso que hace corto el resto.
 *
 * Se elige un bulldog francés a propósito: es la raza con la que se puede
 * comprobar lo único que hace que preguntar la raza no sea decorativo —que
 * rellena la talla y marca el hocico chato, que le baja cuatro grados el techo
 * de calor—. Con un mestizo a secas no habría nada que verificar.
 */
await page.getByLabel('Buscar una raza').fill('bulldog fran');
await page.waitForTimeout(400);
await chip('Bulldog francés');
await next();

await page.getByLabel('Nombre de tu perro').fill('Toby');
await next();

/* De aquí en adelante los pasos de una sola respuesta avanzan solos: tocar la
   respuesta pasa al siguiente. Si dejaran de hacerlo, los `chip()` de abajo se
   quedarían buscando fichas que ya no están en pantalla y la auditoría lo
   diría con «el alta no ofrece …». */
await chip('3 años');
await page.waitForTimeout(450);
await chip('Hembra');
await page.waitForTimeout(450);

const prefilled = (await page.locator('#root').innerText()).trim();
if (!/Puesto por la raza/i.test(prefilled)) {
  problems.push('la raza no rellenó la talla: el alta no se acorta con ella');
}
await next();
await page.waitForTimeout(450);
await next();

await chip('Persecución');
await next();

/*
 * La clase del perro, y la promesa que va con ella.
 *
 * Al marcar «Perro de asistencia» aparece la pregunta de para qué asiste, y con
 * ella la única frase que hace que se pueda contestar: que eso no se publica.
 * Es justo el texto que se cae de una pantalla en el primer rediseño, así que
 * se comprueba aquí y no en un test de interfaz.
 */
await chip('De asistencia');
await page.waitForTimeout(400);
const roleStep = (await page.locator('#root').innerText()).trim();
if (!/no se publica nunca/i.test(roleStep)) {
  problems.push('el alta pregunta para qué asiste sin decir que no se publica');
}
if (!/Alerta médica/i.test(roleStep)) {
  problems.push('no salieron los tipos de asistencia al marcar perro de asistencia');
}
/* Se vuelve a compañía: lo que sigue comprueba el camino normal. */
await chip('Compañía');
await page.waitForTimeout(300);
await next();

/*
 * Los acomodos de la persona.
 *
 * Se enciende «soy autista» y se comprueba que **marca acomodos** en vez de
 * poner una insignia: es la diferencia entre una etiqueta y algo que cambia
 * cómo se comporta la aplicación. Después se sigue con ellos puestos, así que
 * el resto de la auditoría recorre la aplicación con el orden por sitios
 * tranquilos encendido.
 */
const autistic = page.getByRole('switch', { name: /Soy autista/i }).first();
if (!(await autistic.count())) {
  problems.push('el alta no ofrece decir «soy autista»');
} else {
  await autistic.click();
  await page.waitForTimeout(400);
}
const quiet = page.getByRole('switch', { name: /Sitios tranquilos/i }).first();
if (!(await quiet.count())) {
  problems.push('el alta no ofrece los acomodos de la persona');
} else if ((await quiet.getAttribute('aria-checked')) !== 'true') {
  problems.push('decir «soy autista» no marcó ningún acomodo: es una etiqueta y no un acomodo');
}
await next();

/* «Con quién se lleva» es opcional y se omite, que es el camino más corto. */
await next('Omitir');

for (const day of ['L', 'X', 'V']) await chip(day);
await chip('Mañana');
await page.waitForTimeout(400);

/*
 * Lo que el alta devuelve mientras se rellena.
 *
 * Al elegir días y franja se calcula, con `scheduleOverlap` y contra los perros
 * del barrio, con quién coincidirías. Es la mitad del producto enseñada antes de
 * registrarse, y es lo primero que se cae si alguien toca esta pantalla sin
 * mirar de dónde salían los números: quedaría una lista de nombres inventada o
 * una sección vacía, y las dos se ven igual de bien en una captura.
 */
const preview = (await page.locator('#root').innerText()).trim();
if (!/coincides con \d+ perros?|no coincides con nadie/i.test(preview)) {
  problems.push('el paso del horario no enseña con quién coincidirías');
}
if (!/Coincidís/.test(preview)) {
  problems.push('la vista previa del horario no dice cuántos días ni a qué hora');
}

await next();
/* El chip es opcional y el paso lo dice con «Omitir». Se omite a propósito: así
   la auditoría entra con una cuenta recién hecha, que es el estado en el que
   hay que comprobar que el mapa de gente sigue cerrado. */
await next('Omitir');

const summary = (await page.locator('#root').innerText()).trim();
if (!/Toby/.test(summary) || !/Bulldog franc/i.test(summary)) {
  problems.push('el resumen del alta no enseña lo que se acaba de rellenar');
}
if (!/Hocico chato/i.test(summary)) {
  /* Lo que de verdad hace la raza. Sin esta señal, la capa de bienestar trata a
     un bulldog francés como a un labrador pequeño y le propone salir a treinta
     grados. */
  problems.push('la raza de hocico chato no llegó a marcar la señal de salud');
}
/*
 * El alta no entra en la aplicación: enseña el barrio.
 *
 * Es el momento en que las once respuestas se convierten en algo, y lo que
 * hay que comprobar es que **los números son de verdad** —salen del mismo
 * solapamiento horario que el descubrimiento— y que ahí se dice qué queda
 * cerrado. Una pantalla de bienvenida que solo felicita no necesita
 * comprobación; esta sí, porque afirma cosas.
 */
await next('Entrar');
await page.waitForTimeout(900);

const barrio = (await page.locator('#root').innerText()).trim();
if (!/coincide con \d+ perros?|todavía no coincides con nadie/i.test(barrio)) {
  problems.push(`el final del alta no enseña con quién coincides: ${barrio.slice(0, 120)}`);
}
if (!/Lo que se abre hoy/i.test(barrio)) {
  problems.push('el final del alta no dice qué se abre y qué no');
}
if (!/Quién pasea ahora/i.test(barrio)) {
  problems.push('el final del alta no nombra la puerta que queda cerrada');
}
console.log(
  `fin del alta: ${/coincide con (\d+) perros?/i.exec(barrio)?.[0] ?? 'sin coincidencias'}`,
);

await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
await page.waitForTimeout(1200);

if (!(await page.getByRole('tab', { name: /Explorar/i }).count())) {
  problems.push('tras dar de alta al animal la aplicación no se abrió');
}

for (const tab of TABS) {
  const control = page.getByRole('tab', { name: new RegExp(tab, 'i') }).first();
  const fallback = page.getByRole('button', { name: new RegExp(tab, 'i') }).first();
  const target = (await control.count()) ? control : fallback;
  if (!(await target.count())) {
    problems.push(`no se encontró la pestaña ${tab}`);
    continue;
  }
  await target.click();
  await page.waitForTimeout(600);
  const text = (await page.locator('#root').innerText()).trim();
  console.log(`${tab.padEnd(10)} caracteres=${text.length}`);
  if (text.length < 80) problems.push(`${tab}: la pantalla quedó vacía`);

  /*
   * Filas de enlace que se han desmontado en columna.
   *
   * Es el fallo de `Link asChild` de expo-router en web: el `<a>` que genera se
   * queda con el estilo del `Pressable` que envuelve —sobre todo si el estilo
   * es una función de `pressed`— y sale con `flex-direction: column`. Una fila
   * de icono, título y flecha se convierte en cuatro renglones apilados a todo
   * lo ancho.
   *
   * No lo ve el tipado, no lo ve ningún test unitario y no se nota en una
   * captura si la fila cae por debajo del pliegue, que es exactamente lo que
   * pasó: llevaba puesto en el feed, en mensajes y en el mapa sin que nadie lo
   * viera. La firma es inconfundible —un enlace en columna que contiene a la
   * vez un icono y texto— y se puede buscar en el DOM, así que se busca.
   */
  const collapsed = await page.evaluate(() =>
    [...document.querySelectorAll('a')]
      .filter((link) => {
        if (getComputedStyle(link).flexDirection !== 'column') return false;
        const hasIcon = link.querySelector('svg') !== null;
        const hasText = (link.innerText ?? '').trim().length > 0;
        if (!hasIcon || !hasText) return false;
        /* El ancho es lo que separa el fallo de lo correcto, y hubo que
           añadirlo: la primera versión de esta regla marcó las cinco pestañas
           de abajo, que son columnas **a propósito** —icono encima, rótulo
           debajo— y miden setenta y ocho píxeles. Una fila que se ha
           desmontado ocupa el ancho entero, porque venía de serlo. */
        return link.getBoundingClientRect().width > 200;
      })
      .map((link) => (link.getAttribute('aria-label') ?? link.innerText).slice(0, 60)),
  );
  for (const label of collapsed) {
    problems.push(`${tab}: la fila «${label}» se ha desmontado en columna`);
  }
}

/*
 * Bloquear, comprobado como se rompe: mirando si de verdad desaparece.
 *
 * Es la comprobación que separa un bloqueo de un «silenciar»: no basta con que
 * la publicación se vaya del feed. Se cuenta cuántas publicaciones hay antes y
 * después, y se comprueba que la persona bloqueada ya no aparece por su nombre
 * en ninguna parte de la pantalla.
 */
{
  await page.getByRole('tab', { name: /Feed/i }).first().click();
  await page.waitForTimeout(1000);

  const options = page.getByRole('button', { name: /Opciones de la publicación/i }).first();
  if (!(await options.count())) {
    problems.push('las publicaciones del feed no ofrecen opciones');
  } else {
    const label = (await options.getAttribute('aria-label')) ?? '';
    const before = (await page.locator('#root').innerText()).trim();
    await options.click();
    await page.waitForTimeout(500);

    const block = page.getByRole('button', { name: /^Bloquear a / }).first();
    const report = page.getByRole('button', { name: 'Denunciar', exact: true }).first();
    if (!(await block.count()) || !(await report.count())) {
      problems.push('el menú de una publicación no ofrece bloquear ni denunciar');
    } else {
      /* El menú tenía tres opciones que no hacían nada. Que estén las dos que
         sí hacen algo es la mitad; la otra mitad es que hagan algo. */
      const owner = (await block.getAttribute('aria-label'))?.replace('Bloquear a ', '') ?? '';
      await block.click();
      await page.waitForTimeout(800);

      const after = (await page.locator('#root').innerText()).trim();
      if (owner && after.includes(owner) && !after.includes('Has bloqueado')) {
        problems.push(`bloquear a ${owner} no lo quitó del feed`);
      }
      if (after.length >= before.length) {
        problems.push('el feed no cambió al bloquear a alguien');
      }
      console.log(`bloqueo: ${label.slice(0, 40)} · feed ${before.length} → ${after.length}`);

      /*
       * El contador rueda, y se comprueba a media animación.
       *
       * Es la parte de «cómo se siente» que sí se puede medir. Un contador que
       * cambia por sustitución y otro que rueda **acaban en el mismo número**, así
       * que mirar el resultado no distingue uno de otro: los dos ponen 3 donde ponía
       * 2. Lo que los distingue es el medio segundo de en medio, y ahí el que rueda
       * tiene los dos números a la vez dentro de una caja recortada, uno saliendo y
       * otro entrando.
       *
       * Así que se pulsa, se espera 120 ms —dentro del muelle, no después— y se
       * busca esa caja. Si no hay dos números apilados, el número no está rodando.
       */
      {
        const reaction = page.getByRole('button', { name: /\d+ en total$/ }).first();
        if (!(await reaction.count())) {
          problems.push('el feed no ofrece ninguna reacción con contador');
        } else {
          const beforeLabel = (await reaction.getAttribute('aria-label')) ?? '';
          await reaction.click();
          await page.waitForTimeout(120);

          const rolling = await page.evaluate(() => {
            const found = [];
            for (const element of document.querySelectorAll('#root *')) {
              if (getComputedStyle(element).overflow !== 'hidden') continue;
              if (element.children.length !== 2) continue;
              const numbers = [...element.children].map((child) => child.textContent.trim());
              if (numbers.every((text) => /^\d+$/.test(text))) found.push(numbers.join('→'));
            }
            return found;
          });

          await page.waitForTimeout(700);
          const afterLabel = (await reaction.getAttribute('aria-label')) ?? '';
          console.log(
            `contador: ${rolling.join(', ') || 'no rueda'} · ${beforeLabel} → ${afterLabel}`,
          );

          if (rolling.length === 0) {
            problems.push('el contador de reacciones cambia de golpe en vez de rodar');
          }
          if (beforeLabel === afterLabel) {
            problems.push('reaccionar no cambió el contador');
          }

          /* Y se deja como estaba: lo que venga después cuenta reacciones. */
          await reaction.click();
          await page.waitForTimeout(500);
        }
      }
    }
  }
}

/*
 * El acomodo, comprobado donde cambia algo.
 *
 * El alta se hizo con «soy autista» encendido, que marca «prefiero sitios
 * tranquilos». Ese acomodo promete una cosa concreta —que la lista del mapa se
 * ordene por cuánta gente hay ahora en vez de por distancia— y esto lo mira. Sin
 * esta comprobación, el interruptor sería exactamente lo que la pantalla promete
 * que no es: una etiqueta.
 */
{
  const mapTab = page.getByRole('tab', { name: /Explorar/i }).first();
  if (await mapTab.count()) {
    await mapTab.click();
    await page.waitForTimeout(1200);
    const sheetText = (await page.locator('#root').innerText()).trim();
    if (!/tranquilos ahora/i.test(sheetText)) {
      problems.push('la lista del mapa no dice que está ordenada por lo tranquilo');
    }

    /*
     * Y el orden de verdad, no solo el rótulo.
     *
     * La primera versión de esta comprobación miraba el subtítulo —«los más
     * tranquilos ahora, primero»— y pasaba en verde con el orden roto a mano:
     * el rótulo lo pinta el acomodo, no la ordenación. Lo que se mira ahora es
     * la lista: los sitios sin nadie tienen que ir **antes** que los que tienen
     * gente, y para eso cada fila dice cuántos hay.
     */
    const rows = await page
      .getByRole('button', { name: /, a \d|, tranquilo ahora|, \d+ ahora/ })
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''));
    const withCrowd = rows
      .map((label) => {
        const busy = /, (\d+) ahora$/.exec(label);
        if (busy) return Number(busy[1]);
        return /tranquilo ahora$/.test(label) ? 0 : null;
      })
      .filter((count) => count !== null);

    if (withCrowd.length < 2) {
      problems.push('la lista del mapa no dice cuánta gente hay en cada sitio');
    } else {
      const outOfOrder = withCrowd.some(
        (count, index) => index > 0 && count < withCrowd[index - 1],
      );
      console.log(`sitios por gente ahora: ${withCrowd.join(', ')}`);
      if (outOfOrder) {
        problems.push(
          `el acomodo de sitios tranquilos no ordenó la lista: ${withCrowd.join(', ')}`,
        );
      }
    }
  }
}

/*
 * Las teselas del mapa: qué pide, cuántas veces y adónde las pone.
 *
 * Aquí no llegan —el proxy bloquea a los cinco proveedores probados—, así que
 * lo que se verifica es lo mismo que con el tiempo: **qué emite la aplicación**.
 * Se le sirve un mapa de mentira y se comprueban tres cosas que ninguna captura
 * enseña:
 *
 *  1. Que las direcciones son del esquema XYZ y de un nivel con sentido.
 *  2. Que **no pide más de las que se ven**. Esta es la importante: la primera
 *     versión pedía mil doscientas imágenes en ocho segundos y subiendo, por un
 *     bucle entre `onLoad` y el render, y el mapa se veía perfecto. Contra el
 *     servidor comunitario de OpenStreetMap eso es el abuso que su política
 *     prohíbe, y no hay pantalla donde mirarlo: hay que contarlo.
 *  3. Que las imágenes acaban colocadas en el DOM, que es lo que separa
 *     «las pidió» de «dibujó un mapa».
 */
{
  const mapTab = page.getByRole('tab', { name: /Explorar/i }).first();
  if (await mapTab.count()) {
    await mapTab.click();
    await page.waitForTimeout(2500);
    const settled = tileRequests.length;
    await page.waitForTimeout(2500);

    const unique = new Set(tileRequests).size;
    console.log(`teselas: ${unique} distintas · ${tileRequests.length} peticiones`);

    if (unique === 0) {
      problems.push('el mapa no llegó a pedir ninguna tesela');
    } else {
      if (tileRequests.length > settled) {
        problems.push(
          `el mapa sigue pidiendo teselas cuando ya no cambia nada: ${settled} → ${tileRequests.length}`,
        );
      }
      /* Holgura de dos por tesela, no de tres.
         Con la tesela memorizada la cuenta real es **una por tesela**, medida:
         ocho peticiones para ocho teselas en una auditoría entera. Se deja el
         doble de margen por si un encuadre se mide dos veces, y ni un punto
         más: el margen de tres dejaba pasar un factor de re-render que se
         comió doscientas peticiones sin que saltara nada. */
      if (tileRequests.length > unique * 2) {
        problems.push(
          `${tileRequests.length} peticiones para ${unique} teselas: se están repitiendo`,
        );
      }
      for (const level of new Set(tileRequests.map((ref) => Number(ref.split('/')[0])))) {
        if (level < 1 || level > 19) problems.push(`nivel de tesela absurdo: ${level}`);
      }
      const drawn = await page.evaluate(
        () => document.querySelectorAll('img[src*="tile.openstreetmap.org"]').length,
      );
      if (drawn === 0) problems.push('las teselas se piden pero no se colocan en la pantalla');
    }
  }
}

/*
 * La hoja del mapa tiene tres posiciones y las tres se alcanzan con un toque.
 *
 * Es la regla que `lib/interface-rules.test.ts` comprueba leyendo el código,
 * comprobada aquí ejecutándolo: el asa es un botón que dice a dónde va —«Ver
 * la lista», «Ver la lista entera», «Ver el mapa entero»— y cada toque mueve
 * la hoja a una altura **distinta**. Se mide la posición del asa, no si el
 * botón cambió de nombre: un botón que cambia de rótulo sin mover nada es
 * exactamente el fallo que una lectura del código no ve.
 */
{
  /* El muelle de la hoja tarda en asentarse y Playwright no toca lo que se
     mueve: antes de cada toque se espera a que el asa lleve dos lecturas
     seguidas en el mismo sitio. */
  const still = async () => {
    let last = null;
    for (let i = 0; i < 30; i++) {
      const box = await page
        .getByRole('button', { name: /^Ver (la lista|la lista entera|el mapa entero)$/ })
        .first()
        .boundingBox();
      const y = box ? Math.round(box.y) : null;
      if (y !== null && y === last) return;
      last = y;
      await page.waitForTimeout(120);
    }
  };
  const handleY = async () => {
    await still();
    const handle = page
      .getByRole('button', { name: /^Ver (la lista|la lista entera|el mapa entero)$/ })
      .first();
    return (await handle.boundingBox())?.y ?? null;
  };
  const peek = await handleY();
  if (peek === null) {
    problems.push('el mapa no tiene el asa de la hoja');
  } else {
    await page.getByRole('button', { name: 'Ver la lista' }).first().click();
    await page.waitForTimeout(900);
    const mid = await handleY();
    await page.getByRole('button', { name: 'Ver la lista entera' }).first().click();
    await page.waitForTimeout(900);
    const full = await handleY();
    console.log(
      `hoja: asa a ${Math.round(peek)} → ${Math.round(mid ?? -1)} → ${Math.round(full ?? -1)}`,
    );
    if (mid === null || full === null || !(full < mid && mid < peek)) {
      problems.push(`la hoja no pasa por tres alturas distintas: ${peek} → ${mid} → ${full}`);
    }
    /* Entera, la lista tiene su salida con nombre: «Mapa». Y devuelve la hoja
       a la posición baja, que es donde se vive. */
    const toMap = page.getByRole('button', { name: 'Ver el mapa', exact: true }).first();
    if (!(await toMap.count())) {
      problems.push('con la hoja entera no hay una píldora que se llame «Mapa»');
      await page.getByRole('button', { name: 'Ver el mapa entero' }).first().click();
    } else {
      await toMap.click();
    }
    await page.waitForTimeout(900);
    const back = await handleY();
    if (back === null || Math.abs(back - peek) > 4) {
      problems.push(`la hoja no volvió a la posición baja: ${peek} → ${back}`);
    }

    /* Y con el dedo, desde el cuerpo: la hoja sube al arrastrarla. Se
       arrastra desde debajo del asa —la tira de caras o la cabecera— porque
       es donde cae el pulgar, y se mide que el asa haya subido de verdad. */
    if (back !== null) {
      await page.mouse.move(100, back + 70);
      await page.mouse.down();
      await page.mouse.move(100, back + 50);
      await page.mouse.move(100, back - 260, { steps: 18 });
      await page.mouse.up();
      await page.waitForTimeout(1100);
      const dragged = await handleY();
      console.log(
        `hoja arrastrada desde el cuerpo: asa ${Math.round(back)} → ${Math.round(dragged ?? -1)}`,
      );
      if (dragged === null || dragged > back - 100) {
        problems.push(`arrastrar la hoja desde el cuerpo no la sube: ${back} → ${dragged}`);
      }
      /* De vuelta abajo por el camino con nombre, para lo que viene después. */
      const toMapAgain = page.getByRole('button', { name: 'Ver el mapa', exact: true }).first();
      if (await toMapAgain.count()) await toMapAgain.click();
      else
        await page
          .getByRole('button', { name: 'Ver la lista entera' })
          .first()
          .click()
          .then(() =>
            page.getByRole('button', { name: 'Ver el mapa', exact: true }).first().click(),
          )
          .catch(() => {});
      await page.waitForTimeout(900);
    }
  }
}

/*
 * Tocar un sitio abre su ficha, y la ficha ofrece salir sólo cuando conviene.
 *
 * Aquí no se sabe qué tiempo hace —la consulta no sale del contenedor—, así
 * que la ficha **no puede** ofrecer «Salir aquí ahora»: tiene que decir por
 * qué. Es el mismo principio que el radar sin duraciones, comprobado en la
 * otra puerta que ahora existe para salir. Lo que sí tiene que estar siempre
 * es cómo llegar, y el aspa para volver a la lista.
 */
{
  await page.getByRole('button', { name: 'Ver la lista' }).first().click();
  await page.waitForTimeout(700);
  const row = page.getByRole('button', { name: /^Parque Central, a / }).first();
  if (!(await row.count())) {
    problems.push('la lista del mapa no tiene la fila del Parque Central');
  } else {
    await row.click();
    await page.waitForTimeout(900);
    const card = (await page.locator('#root').innerText()).trim();
    if (!(await page.getByRole('button', { name: 'Cerrar y volver a la lista' }).count())) {
      problems.push('tocar un sitio no abrió su ficha');
    }
    if (!(await page.getByRole('button', { name: /Cómo llegar/ }).count())) {
      problems.push('la ficha del sitio no ofrece cómo llegar');
    }
    const offers = (await page.getByRole('button', { name: /Salir aquí ahora/ }).count()) > 0;
    const explains =
      /no se propone salir|no le conviene|no puedes encender|modo fantasma|Ya estás fuera/i.test(
        card,
      );
    console.log(
      `ficha del sitio: ${offers ? 'ofrece salir' : explains ? 'explica por qué no' : 'ni ofrece ni explica'}`,
    );
    if (!offers && !explains) {
      problems.push('la ficha del sitio ni ofrece salir ni dice por qué no');
    }
    if (offers && /No sabemos qué tiempo hace/i.test(card)) {
      problems.push('la ficha ofrece salir sin saber qué tiempo hace');
    }
    await page.getByRole('button', { name: 'Cerrar y volver a la lista' }).first().click();
    await page.waitForTimeout(500);
    /* De vuelta a la posición baja por el camino con nombre: el asa sube a
       entera y la píldora «Mapa» baja del todo. Un `.or()` entre dos rótulos
       del asa elegía el que hubiera —y a media altura el que hay sube—, así
       que la hoja se quedaba tapando los botones del mapa. */
    await page.getByRole('button', { name: 'Ver la lista entera' }).first().click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Ver el mapa', exact: true }).first().click();
    await page.waitForTimeout(800);
  }
}

/*
 * El mapa se arrastra, y arrastrarlo mueve el mundo y pide las teselas nuevas.
 *
 * Se miden las dos cosas, porque fallan por separado: un marcador que no se
 * mueve es un gesto que no llegó al mapa —la primera versión de esta prueba
 * arrastraba desde la hoja sin saberlo—, y un marcador que se mueve sin
 * teselas nuevas es un lienzo que se desplazó en la pantalla y no en el mundo.
 * El arrastre empieza en una zona del mapa sin marcadores ni hoja, y va lo
 * bastante lejos —más de una tesela— para que tenga que pedir alguna. Y el
 * botón de volver a donde estás tiene que existir aunque el gesto funcione:
 * un gesto nunca es el único camino.
 */
{
  const anchor = page.getByRole('button', { name: /Cebos envenenados/ }).first();
  /* La referencia es el encuadre de «donde estás», no el que dejó la ficha
     de antes: volver a donde estás devuelve a la persona, no a la última
     vista. Se pulsa primero para partir de ahí. */
  const locate = page.getByRole('button', { name: 'Volver a donde estás' }).first();
  if (!(await locate.count())) problems.push('el mapa no tiene el botón de volver a donde estás');
  else {
    await locate.click();
    await page.waitForTimeout(900);
  }
  const before = await anchor.boundingBox();
  /* Lo que hay dibujado, no lo que se ha pedido: las peticiones se cuentan
     para toda la auditoría y a esta altura el encuadre nuevo puede caer en
     teselas ya pedidas antes. Las imágenes del lienzo sí cambian siempre que
     el mundo se mueve. */
  const drawnTiles = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('img[src*="tile.openstreetmap.org"]')]
        .map((img) => img.getAttribute('src'))
        .sort()
        .join('|'),
    );
  const tilesBefore = await drawnTiles();
  await page.mouse.move(300, 300);
  await page.mouse.down();
  await page.mouse.move(280, 280);
  await page.mouse.move(120, 40, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1600);
  const after = await anchor.boundingBox();
  const tilesAfter = await drawnTiles();
  const moved =
    before && after
      ? { x: Math.round(after.x - before.x), y: Math.round(after.y - before.y) }
      : null;
  console.log(
    `arrastre del mapa: marcador ${moved ? `${moved.x},${moved.y}` : 'sin medir'} · teselas dibujadas ${tilesAfter === tilesBefore ? 'iguales' : 'distintas'}`,
  );
  if (!moved || moved.x > -80 || moved.y > -120) {
    problems.push(
      `arrastrar el mapa no movió los marcadores con el dedo: ${JSON.stringify(moved)}`,
    );
  }
  if (tilesAfter === tilesBefore) {
    problems.push('arrastrar el mapa dejó las mismas teselas dibujadas: el mundo no se movió');
  }
  if (await locate.count()) {
    await locate.click();
    await page.waitForTimeout(900);
    const back = await anchor.boundingBox();
    if (before && back && (Math.abs(back.y - before.y) > 4 || Math.abs(back.x - before.x) > 4)) {
      problems.push('volver a donde estás no devolvió el mapa a su sitio');
    }
  }
}

/*
 * Cerrar lo que está abierto encima, con el teclado.
 *
 * Tres capas se abren sobre el mapa —buscador, aviso y lista de capas— y hasta
 * ahora ninguna atendía al gesto de «deshaz esto»: en Android el botón atrás
 * sacaba de la pestaña entera en vez de cerrar la capa, y en web Escape no
 * hacía nada.
 *
 * **Aquí sólo se puede comprobar la mitad, y conviene decir cuál.** Este
 * contenedor no tiene emulador de Android, así que el botón físico no se toca
 * en ninguna prueba; lo que sí se ejecuta es la rama de web —Escape— que es el
 * mismo gancho, la misma condición y el mismo cierre. Que el atajo de teclado
 * cierre el buscador no demuestra que el botón atrás lo cierre en un teléfono;
 * demuestra que el gancho está montado, conectado al estado correcto y que
 * cerrar no rompe la pantalla. Lo otro necesita un teléfono.
 */
{
  /* El punto de partida se exige en vez de darse por hecho. Una comprobación
     que no encuentra su pestaña y sigue callando reporta «sin problemas» sin
     haber mirado nada, y eso ya pasó aquí: al añadir el recorrido del
     historial —que deja la aplicación fuera de las pestañas— esta prueba dejó
     de ejecutarse y nadie se enteró. */
  const mapTab = page.getByRole('tab', { name: /Explorar/i }).first();
  if (!(await mapTab.count())) {
    problems.push('no se encontró la pestaña del mapa al probar Escape');
  } else {
    await mapTab.click();
    await page.waitForTimeout(600);

    const bar = page.getByLabel(/Buscar un sitio en el mapa/i).first();
    if (!(await bar.count())) {
      problems.push('no se encontró la barra de búsqueda del mapa');
    } else {
      await bar.click();
      await page.waitForTimeout(500);
      const field = page.getByPlaceholder(/Buscar parques/i).first();
      if (!(await field.count())) {
        problems.push('la barra de búsqueda no llegó a abrir el buscador');
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const stillOpen = await page.getByPlaceholder(/Buscar parques/i).count();
        if (stillOpen) problems.push('Escape no cerró el buscador del mapa');
        const after = (await page.locator('#root').innerText()).trim();
        if (after.length < 80) problems.push('cerrar el buscador dejó la pantalla vacía');
        console.log(`Escape cierra el buscador del mapa: ${stillOpen ? 'NO' : 'sí'}`);
      }
    }
  }
}

/*
 * El resumen de paseo y el historial, que viven fuera de las pestañas.
 *
 * Se comprueban navegando, no por URL: el artefacto reescribe la ruta al
 * arrancar para abrir siempre en el feed, así que entrar por `/historial`
 * devuelve al feed y el test pasaría mirando la pantalla equivocada — que es
 * exactamente lo que pasó al escribir esta comprobación.
 *
 * Lo que se verifica es la cadena entera, que es donde se rompen estas cosas:
 * que el historial tiene contenido, que la lista de paseos existe de verdad y
 * no es un estado vacío con buena letra, y que una fila abre su resumen con el
 * titular del tiempo puesto.
 */
/*
 * La escalera de acceso, comprobada donde se nota: en la pantalla.
 *
 * El núcleo ya tiene sus tests —qué abre cada peldaño— pero eso no dice nada
 * sobre si la aplicación lo respeta al dibujar. Es justo el fallo que no se ve:
 * la regla existe, la pantalla la ignora, y la lista de quién pasea y a qué
 * hora sigue ahí para una cuenta recién hecha.
 *
 * Se comprueban los dos lados, que es lo que hace que la comprobación valga:
 * primero que el radar **no** liste a nadie, y después —tras verificar el chip
 * por el atajo de demostración— que sí. Sin el segundo, un radar roto pasaría
 * por privado.
 */
{
  const goRadar = async () => {
    const mapTab = page.getByRole('tab', { name: /Explorar/i }).first();
    if (!(await mapTab.count())) return false;
    await mapTab.click();
    await page.waitForTimeout(900);
    const toRadar = page
      .getByRole('link', { name: /Radar/i })
      .or(page.getByRole('button', { name: /^Radar/i }))
      .first();
    if (!(await toRadar.count())) return false;
    await toRadar.click();
    await page.waitForTimeout(1200);
    return true;
  };

  if (!(await goRadar())) {
    problems.push('no se pudo llegar al radar para comprobar la escalera de acceso');
  } else {
    const closed = (await page.locator('#root').innerText()).trim();
    if (!/chip verificado/i.test(closed)) {
      problems.push('el radar no explica por qué no se ve quién está fuera');
    }
    if (/Le quedan \d+ min/.test(closed)) {
      problems.push('el radar lista quién está paseando sin el chip verificado');
    }

    /*
     * El radar sin duraciones que ofrecer.
     *
     * Aquí no hay conexión, así que no se sabe qué tiempo hace y no se ofrece
     * ningún check-in: es deliberado. Lo que no puede pasar es que la tarjeta
     * diga «elige hasta cuándo» sin nada que elegir, ni que el texto de abajo se
     * quede a medias porque contaba con al menos una duración. Salió en una
     * captura y por eso está aquí.
     */
    const noDurations = (await page.getByRole('button', { name: /Estamos fuera/ }).count()) === 0;
    if (noDurations) {
      const card = (await page.locator('#root').innerText()).trim();
      if (!/No sabemos qué tiempo hace/i.test(card)) {
        problems.push('el radar no ofrece ninguna duración y no dice por qué');
      }
      if (/aguanta bien\s{2,}y a partir/.test(card)) {
        problems.push('el radar escribe una frase con el hueco de la duración vacío');
      }
    }

    /* El atajo de demostración, por el camino real: perfil → menú → ajustes. */
    await page
      .getByRole('tab', { name: /Perfil/i })
      .first()
      .click();
    await page.waitForTimeout(700);
    const menu = page.getByRole('button', { name: /Menú del perfil/i }).first();
    if (!(await menu.count())) {
      problems.push('el perfil no tiene el menú de configuración');
    } else {
      await menu.click();
      await page.waitForTimeout(500);
      await page
        .getByRole('button', { name: /^Configuración$/ })
        .first()
        .click();
      await page.waitForTimeout(900);

      /*
       * Las tres direcciones visuales, comprobadas cambiándolas.
       *
       * Un selector de tema es el sitio más fácil del mundo para poner tres
       * botones que no hacen nada, así que aquí no se mira que existan: se
       * pulsan las tres y se lee **lo que hay pintado en la pantalla** después
       * de cada una. Dos medidas, porque una dirección es dos cosas:
       *
       *  - el fondo de mayor superficie —el color—, y
       *  - la familia tipográfica de un rótulo del propio panel —la letra—.
       *
       * Si las tres dieran lo mismo en cualquiera de las dos, el selector sería
       * decorado. Se mide un rótulo del panel y no el nombre de la opción a
       * propósito: cada opción se dibuja con su tipografía siempre, así que
       * mirarla ahí no demostraría nada.
       */
      /*
       * El color de marca, leído del rótulo de la opción puesta.
       *
       * La primera versión medía «el fondo de mayor superficie» y las tres
       * daban lo mismo: en claro, dos de las tres direcciones tienen el fondo
       * blanco puro a propósito. Medir el fondo no distingue una dirección; el
       * color de marca sí, y es además el que se ve en cada icono activo, cada
       * botón principal y cada anillo.
       */
      const brand = (name) =>
        page.evaluate((label) => {
          for (const element of document.querySelectorAll('#root *')) {
            if (element.children.length === 0 && element.textContent.trim() === label) {
              return getComputedStyle(element).color;
            }
          }
          return null;
        }, name);

      const pageGround = () =>
        page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

      const titleFamily = () =>
        page.evaluate(() => {
          for (const element of document.querySelectorAll('#root *')) {
            if (element.children.length === 0 && element.textContent.trim() === 'Privacidad') {
              return getComputedStyle(element).fontFamily;
            }
          }
          return null;
        });

      const grounds = [];
      const families = [];
      for (const name of ['Nocturno', 'Papel', 'Señal']) {
        const option = page.getByRole('radio', { name: new RegExp(`^${name}\\.`) }).first();
        if (!(await option.count())) {
          problems.push(`configuración no ofrece la dirección ${name}`);
          continue;
        }
        await option.scrollIntoViewIfNeeded().catch(() => {});
        await option.click();
        await page.waitForTimeout(550);
        grounds.push(await brand(name));
        families.push(await titleFamily());
      }

      console.log(`direcciones: ${grounds.join(' · ')}`);
      console.log(`tipografías: ${families.map((f) => String(f).split(',')[0]).join(' · ')}`);
      if (new Set(grounds).size !== 3) {
        problems.push(`las tres direcciones no cambian el color de marca: ${grounds.join(', ')}`);
      }
      /* Y el fondo del documento, que es lo que asoma por las zonas seguras:
         tiene que ser un color del tema y no el que trae el empaquetado. */
      const ground = await pageGround();
      if (!ground || ground === 'rgba(0, 0, 0, 0)') {
        problems.push('el documento no hereda el fondo del tema');
      }
      console.log(`fondo del documento: ${ground}`);
      if (new Set(families).size !== 3) {
        problems.push(`las tres direcciones no cambian la tipografía: ${families.join(', ')}`);
      }

      /* Se deja como estaba para que lo que venga después no herede otra
         dirección: una auditoría que se cambia el decorado a sí misma mide otra
         aplicación a partir de aquí. */
      await page
        .getByRole('radio', { name: /^Nocturno\./ })
        .first()
        .click();
      await page.waitForTimeout(450);

      const chipSwitch = page.getByRole('switch', { name: /Chip verificado/i }).first();
      if (!(await chipSwitch.count())) {
        problems.push('configuración no ofrece verificar el chip');
      } else {
        await chipSwitch.scrollIntoViewIfNeeded().catch(() => {});
        await chipSwitch.click();
        await page.waitForTimeout(600);

        await page
          .getByRole('button', { name: /^Volver$/ })
          .first()
          .click();
        await page.waitForTimeout(700);

        if (!(await goRadar())) {
          problems.push('no se pudo volver al radar tras verificar el chip');
        } else {
          const open = (await page.locator('#root').innerText()).trim();
          /* Con la puerta abierta el radar enseña las fichas de quien está
             fuera —cada una con su «Vamos»— o dice que no hay ninguno. Antes
             el texto era «Le quedan N min»; la ficha agrupada lo dice con una
             insignia y un botón, así que se mira eso. */
          const shows = /\bVamos\b/.test(open) || /Ningún .+ fuera ahora/i.test(open);
          console.log(`radar tras verificar el chip: ${shows ? 'abre' : 'sigue cerrado'}`);
          if (!shows) {
            problems.push('con el chip verificado el radar sigue sin enseñar quién está fuera');
          }
          if (/chip verificado/i.test(open) && !shows) {
            problems.push('la puerta del radar no se abrió al verificar el chip');
          }
        }
      }
    }
  }
}

/*
 * Las caras se agrupan al alejar el mapa, y el globo acerca.
 *
 * Con el chip ya verificado hay caras en el mapa, en su parque. A nivel de
 * barrio van sueltas; un nivel más lejos, dos en el mismo sitio son un globo
 * con la cifra, y tocarlo acerca hasta que se vuelven a separar. Es la regla
 * de anclar al sitio dibujada a otra escala, y se comprueba con el botón de
 * alejar, que es el camino sin gesto.
 */
{
  const mapTab = page.getByRole('tab', { name: /Explorar/i }).first();
  if (await mapTab.count()) {
    await mapTab.click();
    await page.waitForTimeout(1200);
    const clusters = page.getByRole('button', { name: /^\d+ perros en / });
    if (await clusters.count()) {
      problems.push('a nivel de barrio las caras ya salen agrupadas');
    }
    await page.getByRole('button', { name: 'Alejar' }).first().click();
    await page.waitForTimeout(1200);
    const grouped = await clusters.count();
    console.log(`globos al alejar: ${grouped}`);
    if (grouped === 0) {
      problems.push('al alejar el mapa las caras no se agrupan en globos');
    } else {
      await clusters.first().click();
      await page.waitForTimeout(1200);
      if (await clusters.count()) {
        problems.push('tocar un globo no acerca lo bastante para abrirlo');
      }
    }
    await page.getByRole('button', { name: 'Volver a donde estás' }).first().click();
    await page.waitForTimeout(600);
  }
}

/*
 * La presencia es una sola cosa: la píldora del feed lleva al radar.
 *
 * «Salir ahora» está en la cabecera del feed y en la fila de estados, y las
 * dos leen el mismo almacén que el radar. Aquí se comprueba el camino: tocar
 * la píldora abre el radar, que es la única puerta para salir.
 */
{
  const feedTab = page.getByRole('tab', { name: /^Feed$/ }).first();
  if (await feedTab.count()) {
    await feedTab.click();
    await page.waitForTimeout(900);
    const chip = page.getByRole('button', { name: /^Salir ahora$/ }).first();
    if (!(await chip.count())) {
      problems.push('el feed no tiene la píldora de «Salir ahora»');
    } else {
      await chip.click();
      await page.waitForTimeout(1200);
      const radar = (await page.locator('#root').innerText()).trim();
      if (!/Fuera ahora/.test(radar)) {
        problems.push('la píldora de «Salir ahora» no abre el radar');
      }
    }
  }
}

{
  const mapTab = page.getByRole('tab', { name: /Explorar/i }).first();
  if (!(await mapTab.count())) {
    problems.push('no se encontró la pestaña del mapa al buscar el historial');
  } else {
    await mapTab.click();
    await page.waitForTimeout(900);

    const toRadar = page
      .getByRole('link', { name: /Radar/i })
      .or(page.getByRole('button', { name: /^Radar/i }))
      .first();

    if (!(await toRadar.count())) {
      problems.push('no se encontró el acceso al radar desde el mapa');
    } else {
      await toRadar.click();
      await page.waitForTimeout(1200);

      const toHistory = page.getByRole('button', { name: /Ver vuestros paseos/i }).first();
      if (!(await toHistory.count())) {
        problems.push('no se encontró el acceso al historial desde el radar');
      } else {
        await toHistory.scrollIntoViewIfNeeded().catch(() => {});
        await toHistory.click();
        await page.waitForTimeout(1400);

        const history = (await page.locator('#root').innerText()).trim();
        if (!/Vuestros paseos/i.test(history)) {
          problems.push('el historial no llegó a abrirse');
        }

        const rows = page.getByRole('button', { name: /^Paseo del/ });
        const count = await rows.count();
        console.log(`historial: ${count} paseos listados`);
        if (count === 0) {
          problems.push('el historial abrió vacío: no hay ningún paseo en la lista');
        } else {
          await rows.first().click();
          await page.waitForTimeout(1200);
          const summary = (await page.locator('#root').innerText()).trim();
          /* El titular del resumen es la duración en grande, y la frase
             «Estuvisteis fuera …» va en su etiqueta accesible, no en el texto
             pintado: se pregunta por el encabezado, que es lo que oye quien
             lee con voz. */
          const headline = page.getByRole('heading', { name: /Estuvisteis fuera/i });
          if ((await headline.count()) === 0) {
            problems.push('la fila del historial no abrió el resumen del paseo');
          }
          if (!/min|h /.test(summary)) {
            problems.push('el resumen no enseña cuánto duró el paseo');
          }
        }
      }
    }
  }
}

/*
 * «Voy a buscar» tiene que verse desde el otro lado.
 *
 * Es la comprobación que separa un botón que cambia de color de un estado que
 * existe: la alerta de la semilla trae dos vecinos ya buscando, así que al
 * apuntarse la cuenta el texto tiene que pasar de «2 personas buscando» a
 * decir que vas tú **y** las otras dos. Un botón que solo se encendiera dejaría
 * el mismo número, y esto lo cazaría.
 */
{
  /* Venimos del resumen de un paseo, que es una pantalla entera y tapa la barra
     de pestañas. Se sale de ella antes de buscar nada: preguntar por una
     pestaña que no está en pantalla y anotar «no existe» es un fallo del
     guion, no de la aplicación. */
  for (let i = 0; i < 3; i += 1) {
    const back = page.getByRole('button', { name: /^Volver$/ }).first();
    if (!(await back.count())) break;
    await back.click();
    await page.waitForTimeout(600);
  }

  const sosTab = page.getByRole('tab', { name: /SOS/i }).first();
  if (!(await sosTab.count())) {
    problems.push('no se encontró la pestaña de SOS');
  } else {
    await sosTab.click();
    await page.waitForTimeout(1000);

    const before = (await page.locator('#root').innerText()).trim();
    const join = page.getByRole('button', { name: /^Voy a buscar$/ }).first();

    if (!(await join.count())) {
      problems.push('la ficha de una alerta no ofrece apuntarse a buscar');
    } else {
      if (!/2 personas buscando/.test(before)) {
        problems.push(
          `la alerta no dice cuánta gente busca antes de apuntarse: ${before.slice(0, 120)}`,
        );
      }
      await join.scrollIntoViewIfNeeded().catch(() => {});
      await join.click();
      await page.waitForTimeout(700);

      const after = (await page.locator('#root').innerText()).trim();
      console.log(`buscando tras apuntarse: ${/Vas tú[^\n]*/.exec(after)?.[0] ?? 'nada'}`);
      if (!/Vas tú y 2 personas más/.test(after)) {
        problems.push('apuntarse a buscar no cambió la cuenta de quién está buscando');
      }
      if (!(await page.getByRole('button', { name: /^Ya no voy a buscar$/ }).count())) {
        problems.push('no se puede dejar de buscar: el botón no cambia');
      }

      /* Y se deshace, porque una cuenta que solo sube deja de significar nada.
         Además esto devuelve la alerta a su estado de partida para lo que venga
         después. */
      await page
        .getByRole('button', { name: /^Ya no voy a buscar$/ })
        .first()
        .click();
      await page.waitForTimeout(600);
      const undone = (await page.locator('#root').innerText()).trim();
      if (!/2 personas buscando/.test(undone)) {
        problems.push('dejar de buscar no devolvió la cuenta a su sitio');
      }
    }
  }
}

/*
 * Tocar la pestaña que ya está abierta devuelve el feed arriba.
 *
 * Es de las cosas que nadie sabe que sabe hasta que faltan, y es invisible en
 * una captura: hay que bajar, tocar y mirar si volvió. Se comprueba con la
 * fila de historias, que solo existe al principio del feed.
 */
{
  const feedTab = page.getByRole('tab', { name: /^Feed$/ }).first();
  if (!(await feedTab.count())) {
    problems.push('no se encontró la pestaña del feed');
  } else {
    await feedTab.click();
    await page.waitForTimeout(800);

    const rail = page.getByRole('button', { name: /Añadir estado/i }).first();
    if (!(await rail.count())) {
      problems.push('el feed no tiene la fila de historias con la que se mide el desplazamiento');
    } else {
      /* Se mide la **posición** de la fila, no si está en el documento:
         `isVisible()` de Playwright dice si el elemento está pintado, y una
         fila desplazada fuera de la pantalla lo sigue estando. */
      const top = async () => (await rail.boundingBox())?.y ?? 0;

      const before = await top();
      await page.mouse.move(195, 500);
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(700);

      const away = await top();
      if (away > before - 200) {
        problems.push(`el feed no se desplazó: la fila de historias sigue en ${Math.round(away)}`);
      }

      await feedTab.click();
      await page.waitForTimeout(900);

      const back = await top();
      console.log(`volver arriba tocando la pestaña: ${Math.round(away)} → ${Math.round(back)}`);
      if (back < before - 40) {
        problems.push('tocar la pestaña del feed estando en el feed no lo devuelve arriba');
      }

      /*
       * Y el mismo camino desde el nombre de la aplicación, que es el que queda
       * en el navegador: ahí no existe el gesto de tirar hacia abajo, así que
       * sin esto refrescar no tendría forma de llamarse fuera del teléfono.
       */
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(600);
      const wordmark = page.getByRole('button', { name: /Petnav\. Volver arriba/i }).first();
      if (!(await wordmark.count())) {
        problems.push('el nombre de la aplicación no sirve para volver arriba ni actualizar');
      } else {
        await wordmark.click();
        await page.waitForTimeout(1200);
        const afterTitle = await top();
        console.log(`volver arriba desde el nombre: ${Math.round(afterTitle)}`);
        if (afterTitle < before - 40) {
          problems.push('tocar el nombre de la aplicación no devuelve el feed arriba');
        }
        const note = (await page.locator('#root').innerText()).trim();
        if (!/Al día/i.test(note)) {
          problems.push('actualizar no dice qué ha actualizado');
        }
      }
    }
  }
}

/*
 * La dirección de un espacio no existe hasta que hay reserva confirmada.
 *
 * Es la regla de privacidad más fácil de romper sin enterarse: basta con que
 * alguien pinte la ficha entera «para que se vea completa». Por eso no se mira
 * si hay un aviso que lo promete —un aviso se deja puesto con la calle debajo—
 * sino **si la calle está en la pantalla**, antes y después.
 *
 * La cadena que se busca es un trozo de la dirección de la semilla. Si mañana
 * cambia la semilla, esta comprobación falla y hay que actualizarla: es
 * preferible a que pase en silencio.
 */
{
  const CALLE = 'Fernández de los Ríos';

  const mapTab = page.getByRole('tab', { name: /Explorar/i }).first();
  if (!(await mapTab.count())) {
    problems.push('no se encontró el mapa para entrar a los espacios');
  } else {
    await mapTab.click();
    await page.waitForTimeout(900);

    /* Con tres posiciones, los destinos del final de la lista viven en la
       hoja entera: se sube por el asa, con nombre, antes de buscarlos. En la
       posición baja el enlace existe pero queda por debajo de la pantalla, y
       un toque a ciegas ahí es el toque que se queda esperando. */
    for (const label of ['Ver la lista', 'Ver la lista entera']) {
      const handle = page.getByRole('button', { name: label }).first();
      if (await handle.count()) {
        await handle.click();
        await page.waitForTimeout(900);
      }
    }

    const toSpots = page
      .getByRole('link', { name: /Espacios privados/i })
      .or(page.getByRole('button', { name: /Espacios privados/i }))
      .first();

    if (!(await toSpots.count())) {
      problems.push('no se encontró el acceso a los espacios desde el mapa');
    } else {
      await toSpots.click();
      await page.waitForTimeout(1400);

      const before = (await page.locator('#root').innerText()).trim();
      if (!/200 m²/.test(before) || !/Valla de 2 m/.test(before)) {
        problems.push('la ficha del espacio no enseña los datos duros');
      }
      if (!/Sin sombra/.test(before)) {
        problems.push('la ficha solo enseña lo que el sitio tiene: lo que le falta no sale');
      }
      if (before.includes(CALLE)) {
        problems.push('la dirección del espacio se ve sin haber reservado');
      }

      const propose = page.getByRole('button', { name: /^Proponer reserva/ }).first();
      if (!(await propose.count())) {
        problems.push('no se puede proponer una reserva');
      } else {
        await propose.scrollIntoViewIfNeeded().catch(() => {});
        await propose.click();
        await page.waitForTimeout(700);

        const proposed = (await page.locator('#root').innerText()).trim();
        if (proposed.includes(CALLE)) {
          problems.push('proponer una reserva ya enseña la dirección: proponer no es entrar');
        }
        if (!/Propuesta enviada/i.test(proposed)) {
          problems.push('proponer una reserva no cambia nada en la ficha');
        }

        const simulate = page
          .getByRole('button', { name: /Simular que el anfitrión acepta/i })
          .first();
        if (!(await simulate.count())) {
          problems.push('no hay forma de ver una reserva confirmada en la demo');
        } else {
          await simulate.scrollIntoViewIfNeeded().catch(() => {});
          await simulate.click();
          await page.waitForTimeout(800);

          const confirmed = (await page.locator('#root').innerText()).trim();
          console.log(
            `dirección tras confirmar: ${confirmed.includes(CALLE) ? 'aparece' : 'no aparece'}`,
          );
          if (!confirmed.includes(CALLE)) {
            problems.push('con la reserva confirmada la dirección sigue sin aparecer');
          }
          if (!/deja de verse si se cancela/i.test(confirmed)) {
            problems.push('la dirección aparece sin decir quién la tiene ni hasta cuándo');
          }
        }
      }
    }
  }
}

/*
 * La única petición que sale del fichero es la del tiempo, y tiene que salir.
 *
 * Esta comprobación cambió de signo cuando el clima pasó a ser automático:
 * antes cualquier petición externa era un fallo de empaquetado, y ahora su
 * ausencia sería un fallo de la funcionalidad. Se comprueba además cómo sale,
 * porque es la única forma de verificar de verdad que la coordenada se
 * redondea antes de salir del dispositivo: los tests unitarios comprueban la
 * función, y esto comprueba lo que el navegador manda.
 *
 * En este contenedor la petición no llega —el proxy de salida bloquea el
 * dominio— y da igual: lo que se audita es que se emita y con qué.
 */
const external = [
  ...new Set(
    requests.filter(
      (url) => !url.startsWith(FILE) && !url.startsWith('data:') && !url.startsWith('blob:'),
    ),
  ),
];
const weatherCalls = external.filter((url) => url.includes('api.open-meteo.com'));
/* Tres dominios previstos, y sólo tres: el del tiempo, el de las calles y el
   almacén provisional de las fotos. Que la lista sea corta y explícita es el
   punto — cualquier otra cosa que aparezca es algo que se coló en el
   empaquetado. */
const strangers = external.filter(
  (url) =>
    !url.includes('api.open-meteo.com') &&
    !url.includes('tile.openstreetmap.org') &&
    !url.includes(PHOTO_HOST),
);

if (weatherCalls.length === 0) problems.push('la app no llegó a consultar el tiempo');
if (strangers.length)
  problems.push(`peticiones a terceros no previstos: ${strangers.slice(0, 5).join(', ')}`);

for (const call of weatherCalls) {
  const query = new URL(call).searchParams;
  for (const key of ['latitude', 'longitude']) {
    const decimals = (query.get(key) ?? '').split('.')[1]?.length ?? 0;
    if (decimals > 2) problems.push(`${key} sale con ${decimals} decimales: no se redondeó`);
  }
  if (!query.get('hourly')?.includes('shortwave_radiation')) {
    problems.push('no se pide la radiación solar, así que no habría estimación del suelo');
  }
}
console.log(`consultas de tiempo: ${weatherCalls.length}`);

/* Y el fallo de esa consulta no puede llevarse la aplicación por delante: aquí
   siempre falla, así que este es el sitio donde eso se comprueba gratis. */
const alive = await page.locator('#root').innerText();
if (alive.trim().length < 80)
  problems.push('la app se quedó vacía tras fallar la consulta del tiempo');

/*
 * La barra tiene cinco pestañas, ni una más.
 *
 * Esta regla existe porque se rompió: al escribir la barra a mano, el filtro de
 * rutas ocultas miraba `href`, que el enrutador ya se había comido, y la barra
 * salió con catorce —radar, quedadas, publicar, citas…—. La comprobación
 * anterior solo preguntaba si estaba «Rescate», así que pasó en verde con nueve
 * pestañas de más. Contar es lo que la habría cazado.
 */
{
  /* Se cuentan las de **la barra**, no las del documento: el conmutador de
     mascota también son pestañas, y con tres animales el total daba ocho. */
  const bar = page.getByRole('tablist', { name: 'Navegación principal' });
  const count = await bar.getByRole('tab').count();
  console.log(`pestañas en la barra: ${count}`);
  if (count !== 5) {
    const names = await bar
      .getByRole('tab')
      .evaluateAll((nodes) =>
        nodes.map((node) => (node.getAttribute('aria-label') || node.textContent || '').trim()),
      );
    problems.push(`la barra tiene ${count} pestañas y no 5: ${names.join(', ')}`);
  }
}

const loadedFonts = await page.evaluate(
  () => [...document.fonts].filter((font) => font.status === 'loaded').length,
);
console.log(`tipografías cargadas: ${loadedFonts}`);
if (loadedFonts === 0) problems.push('no cargó ninguna tipografía incrustada');

/*
 * La otra puerta, en una pestaña nueva.
 *
 * Una cuenta de protectora ve un tablero de rescate donde el tutor ve el feed
 * social, y esa es la decisión que la define. Se comprueba entrando de verdad
 * —no se puede reutilizar la sesión anterior, que ya es de un tutor— y mirando
 * las dos caras: que **está** lo que tiene que estar y que **no está** lo que
 * no.
 */
{
  const shelter = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await shelter.goto(FILE, { waitUntil: 'load' });
  await shelter.waitForSelector('#root > *', { timeout: 30_000 });
  await shelter.waitForTimeout(1500);

  const step = async (label) => {
    const button = shelter.getByRole('button', { name: label, exact: true }).first();
    if (!(await button.count())) {
      problems.push(`el alta de protectora no ofrece «${label}»`);
      return false;
    }
    await button.click();
    await shelter.waitForTimeout(600);
    return true;
  };

  await step('Comenzar ahora');
  await step('Rescate');
  await shelter.getByLabel('Correo', { exact: true }).fill('patitas@protectora.org');
  await shelter.getByLabel('Contraseña', { exact: true }).fill('el perro come pasto');
  await step('Siguiente');
  await shelter.getByLabel('Nombre del colectivo').fill('Patitas del Sur');
  await step('Siguiente');
  await shelter.getByLabel('Enlace al perfil del colectivo').fill('instagram.com/patitasdelsur');
  await step('Siguiente');
  await step('Casas de acogida');
  await step('Siguiente');
  await step('Enviar a revisión');
  await shelter.waitForTimeout(1200);

  const home = (await shelter.locator('#root').innerText()).trim();
  /*
   * El nombre de una pestaña se lee **por su papel**, no por `aria-label`.
   *
   * Primero se leyó el atributo y salieron cinco cadenas vacías: React Native
   * Web pone el nombre accesible de la pestaña en el texto de dentro, y solo
   * escribe `aria-label` cuando se le pasa uno a mano —como en SOS, que era la
   * única que devolvía algo—. Preguntar por el papel y el nombre deja que
   * Playwright calcule el nombre accesible igual que lo hace un lector de
   * pantalla, que es lo que aquí se quiere comprobar.
   */
  const tabs = await shelter
    .getByRole('tab')
    .evaluateAll((nodes) =>
      nodes.map((node) => (node.getAttribute('aria-label') || node.textContent || '').trim()),
    );

  if (!(await shelter.getByRole('tab', { name: /Rescate/i }).count())) {
    problems.push(`la cuenta de protectora no abre en Rescate: ${tabs.join(', ')}`);
  }
  if (/Añadir estado|Reels|Cerca de mí/i.test(home)) {
    problems.push('la cuenta de protectora ve el feed social');
  }
  if (!/Rescate/i.test(home)) {
    problems.push('el tablero de rescate no llegó a dibujarse');
  }
  if (!/revisión/i.test(home)) {
    problems.push('la cuenta en revisión no lo dice en su tablero');
  }
  /*
   * Las tres acciones de una tarjeta hacen tres cosas distintas.
   *
   * Antes las tres llevaban a la misma pantalla, y una interfaz así se audita
   * sola en verde: los botones estaban, se podían pulsar y no pasaba nada
   * comprobable. Aquí se pulsan dos y se mira **el efecto**, que es lo único
   * que distingue un botón de un dibujo de un botón.
   */
  const search = shelter.getByRole('button', { name: /^Vas a buscar a / }).first();
  if (!(await search.count())) {
    problems.push('el tablero de rescate no ofrece apuntarse a buscar');
  } else {
    await search.click();
    await shelter.waitForTimeout(600);
    const joined = (await shelter.locator('#root').innerText()).trim();
    if (!/Vas tú/.test(joined)) {
      problems.push('apuntarse a buscar desde el tablero no cambia nada en la tarjeta');
    }
    if (!(await shelter.getByRole('button', { name: /^Ya no vas a buscar a / }).count())) {
      problems.push('desde el tablero no se puede dejar de buscar');
    }
  }

  const save = shelter.getByRole('button', { name: /^Guardar el aviso de / }).first();
  if (!(await save.count())) {
    problems.push('el tablero de rescate no ofrece guardar un aviso');
  } else {
    await save.click();
    await shelter.waitForTimeout(700);
    const withSaved = (await shelter.locator('#root').innerText()).trim();
    if (!/Guardados/.test(withSaved)) {
      problems.push('guardar un aviso no lo lleva a ningún sitio donde volver a verlo');
    }
    if (
      !(await shelter.getByRole('button', { name: /^Quitar de guardados el aviso de / }).count())
    ) {
      problems.push('un aviso guardado no se puede desguardar');
    }
  }

  /* Y el perfil de la cuenta cuenta lo mismo que el tablero: si aquí dijera
     otro número, uno de los dos estaría inventado. */
  const shelterProfileTab = shelter.getByRole('tab', { name: /Perfil/i }).first();
  if (await shelterProfileTab.count()) {
    await shelterProfileTab.click();
    await shelter.waitForTimeout(1000);
    const profile = (await shelter.locator('#root').innerText()).trim();
    if (!/Estáis en 1 búsqueda/.test(profile)) {
      problems.push(`el perfil de la protectora no refleja la búsqueda: ${profile.slice(0, 160)}`);
    }
    if (!/1 aviso guardado/.test(profile)) {
      problems.push('el perfil de la protectora no refleja el aviso guardado');
    }
    if (/Ficha médica|Modo Paseo/i.test(profile)) {
      problems.push('la cuenta de protectora ve un perfil de perro');
    }
  }

  console.log(`protectora: pestañas ${tabs.filter(Boolean).join(', ')}`);
  await shelter.close();
}

/*
 * La adaptación al teléfono: la muesca, medida.
 *
 * Es la comprobación que faltaba y la que explica por qué el fallo duró tanto.
 * En un navegador no hay isla dinámica ni indicador de inicio, así que
 * `env(safe-area-inset-*)` vale cero: una aplicación que respeta las zonas
 * seguras y otra que se las salta **se ven exactamente igual aquí**, y todas
 * las capturas salían bien con el marco olvidado.
 *
 * Así que se simulan. La página admite `?zonasegura=59` —los márgenes de un
 * iPhone con isla dinámica— y se abre dos veces: sin muesca y con ella. Lo que
 * se mide es dónde empieza la cabecera. Si el marco no aplicara las zonas
 * seguras, las dos medidas serían la misma.
 */
{
  const notch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  /* Se mide el hueco reservado y no dónde cae un rótulo: la primera pantalla es
     el alta —sin animal no se entra— y ahí no hay cabecera que buscar. Lo que
     tiene que existir con muesca y no existir sin ella es un contenedor que
     reserve exactamente esos puntos arriba. */
  const reserved = async (url) => {
    await notch.goto(url, { waitUntil: 'load' });
    await notch.waitForSelector('#root > *', { timeout: 30_000 });
    await notch.waitForTimeout(1400);
    return notch.evaluate(() => {
      const tops = new Set();
      for (const element of document.querySelectorAll('#root *')) {
        const top = getComputedStyle(element).paddingTop;
        if (top && top !== '0px') tops.add(top);
      }
      return [...tops];
    });
  };

  const plain = await reserved(FILE);
  const withNotch = await reserved(`${FILE}?zonasegura=59`);

  /*
   * Se compara el hueco reservado, no un número exacto.
   *
   * La primera versión buscaba literalmente «59px» y se puso roja en cuanto la
   * portada pasó a ser a sangre: allí el margen es la muesca **más** el respiro
   * de la pantalla —75 px—, que es lo correcto. Una aserción que exige el
   * número pelado comprueba una implementación concreta, no la promesa.
   *
   * Lo que hay que afirmar es la diferencia: con muesca tiene que aparecer un
   * hueco que sin muesca no existe, y del tamaño de la muesca.
   */
  const biggest = (values) =>
    Math.max(0, ...values.map((value) => Number.parseFloat(value)).filter(Number.isFinite));
  const sinMuesca = biggest(plain);
  const conMuesca = biggest(withNotch);

  console.log(`zona segura reservada: sin muesca ${sinMuesca}px · con muesca ${conMuesca}px`);

  if (conMuesca - sinMuesca < 50) {
    problems.push(
      `la pantalla no aparta la isla dinámica: reserva ${conMuesca}px con muesca y ${sinMuesca}px sin ella`,
    );
  }

  await notch.close();
}

await browser.close();
server.close();

if (problems.length) {
  console.error(`\n${problems.length} problema(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\n✓ sin problemas');
