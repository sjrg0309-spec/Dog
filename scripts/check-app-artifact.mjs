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
page.on('requestfailed', (request) => {
  /* La del tiempo falla siempre en este contenedor, por el proxy de salida.
     Que falle no es el defecto; que no se intente, sí. Se comprueba abajo. */
  if (request.url().includes('api.open-meteo.com')) return;
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
const strangers = external.filter((url) => !url.includes('api.open-meteo.com'));

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
