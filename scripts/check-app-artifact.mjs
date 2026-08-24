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
  const match = route.request().url().match(/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (!match) return route.abort();
  tileRequests.push(match[0]);
  await route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dde"/></svg>',
  });
});
page.on('requestfailed', (request) => {
  /* La del tiempo falla siempre en este contenedor, por el proxy de salida.
     Que falle no es el defecto; que no se intente, sí. Se comprueba abajo. */
  if (request.url().includes('api.open-meteo.com')) return;
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
if (!/Petnav/i.test(body) || !/dar de alta a tu mascota/i.test(body)) {
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

if (!(await page.getByRole('button', { name: /Rescato y no tengo perro/i }).count())) {
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

await page.getByRole('button', { name: /Dar de alta a mi perro/i }).first().click();
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
await next('Entrar');
await page.waitForTimeout(900);

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
      // Holgura de tres por tesela: el primer encuadre y el definitivo pueden
      // pedir dos veces mientras se mide la pantalla. Un bucle da cientos.
      if (tileRequests.length > unique * 3) {
        problems.push(`${tileRequests.length} peticiones para ${unique} teselas: se están repitiendo`);
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
    await page.getByRole('tab', { name: /Perfil/i }).first().click();
    await page.waitForTimeout(700);
    const menu = page.getByRole('button', { name: /Menú del perfil/i }).first();
    if (!(await menu.count())) {
      problems.push('el perfil no tiene el menú de configuración');
    } else {
      await menu.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /^Configuración$/ }).first().click();
      await page.waitForTimeout(900);

      const chipSwitch = page.getByRole('switch', { name: /Chip verificado/i }).first();
      if (!(await chipSwitch.count())) {
        problems.push('configuración no ofrece verificar el chip');
      } else {
        await chipSwitch.scrollIntoViewIfNeeded().catch(() => {});
        await chipSwitch.click();
        await page.waitForTimeout(600);

        await page.getByRole('button', { name: /^Volver$/ }).first().click();
        await page.waitForTimeout(700);

        if (!(await goRadar())) {
          problems.push('no se pudo volver al radar tras verificar el chip');
        } else {
          const open = (await page.locator('#root').innerText()).trim();
          const shows = /Le quedan \d+ min/.test(open) || /no hay ning/i.test(open);
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
          if (!/Estuvisteis fuera/i.test(summary)) {
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
const external = [...new Set(requests.filter((url) => !url.startsWith(FILE) && !url.startsWith('data:') && !url.startsWith('blob:')))];
const weatherCalls = external.filter((url) => url.includes('api.open-meteo.com'));
/* Dos dominios previstos, y sólo dos: el del tiempo y el de las calles. Que la
   lista sea corta y explícita es el punto — cualquier otra cosa que aparezca es
   algo que se coló en el empaquetado. */
const strangers = external.filter(
  (url) => !url.includes('api.open-meteo.com') && !url.includes('tile.openstreetmap.org'),
);

if (weatherCalls.length === 0) problems.push('la app no llegó a consultar el tiempo');
if (strangers.length) problems.push(`peticiones a terceros no previstos: ${strangers.slice(0, 5).join(', ')}`);

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
if (alive.trim().length < 80) problems.push('la app se quedó vacía tras fallar la consulta del tiempo');

const loadedFonts = await page.evaluate(() => [...document.fonts].filter((font) => font.status === 'loaded').length);
console.log(`tipografías cargadas: ${loadedFonts}`);
if (loadedFonts === 0) problems.push('no cargó ninguna tipografía incrustada');

await browser.close();
server.close();

if (problems.length) {
  console.error(`\n${problems.length} problema(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\n✓ sin problemas');
