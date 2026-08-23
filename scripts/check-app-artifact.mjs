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

const PATH = new URL('../artifacts/coincide-app.html', import.meta.url).pathname;
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
  problems.push('arrancó en la pantalla de «no encontrado» en vez de en el feed');
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
  const mapTab = page.getByRole('tab', { name: /Explorar/i }).first();
  if (await mapTab.count()) {
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
