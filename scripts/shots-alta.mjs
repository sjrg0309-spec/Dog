/**
 * Capturas del alta, paso a paso.
 *
 * El alta es la única pantalla que **todo el mundo ve entera** y la única que
 * se lee de una en una: una pregunta por pantalla. Por eso se captura paso a
 * paso y no de un tirón — el tono de una pregunta no se juzga en una lista de
 * cadenas, se juzga viéndola sola en la pantalla, que es como llega.
 */

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const PATH = new URL('../artifacts/petnav-app.html', import.meta.url).pathname;
const OUT = new URL('../artifacts/screenshots/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const html = await readFile(PATH, 'utf8');
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const URL_ = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

await page.goto(URL_, { waitUntil: 'load' });
await page.waitForSelector('#root > *', { timeout: 30_000 });
await page.waitForTimeout(1200);

const shot = (name) => page.screenshot({ path: `${OUT}alta-${name}.png` });
const tap = async (name) => {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.waitForTimeout(500);
};

await shot('01-bienvenida');
await tap('Comenzar ahora');
await shot('02-puertas');
await tap('Dar de alta a mi perro');
await shot('03-cuenta');

await page.getByLabel('Correo', { exact: true }).fill('ana@correo.com');
await page.getByLabel('Contraseña', { exact: true }).fill('el perro come pasto');
await page.waitForTimeout(400);
await shot('04-cuenta-llena');
await tap('Siguiente');

await page.getByLabel('Buscar una raza').fill('bulldog fran');
await page.waitForTimeout(400);
await tap('Bulldog francés');
await shot('05-raza');
await tap('Siguiente');

await page.getByLabel('Nombre de tu perro').fill('Toby');
await shot('06-nombre');
await tap('Siguiente');

await shot('07-edad');
await tap('3 años');
await shot('08-sexo');
await tap('Hembra');
await shot('09-tamano');
await tap('Siguiente');
await shot('10-energia');
await tap('Siguiente');
await shot('11-juego');
await tap('Persecución');
await tap('Siguiente');
await shot('12-trabajo');
await tap('Compañía');
await tap('Siguiente');
await shot('13-sobre-ti');
await tap('Siguiente');
await shot('14-con-quien');
await tap('Omitir');
await shot('15-horario');
for (const day of ['L', 'X', 'V']) await tap(day);
await tap('Mañana');
await page.waitForTimeout(500);
await shot('16-horario-lleno');
await tap('Siguiente');
await shot('17-chip');
await tap('Omitir');
await shot('18-resumen');

console.log('capturas del alta listas');
await browser.close();
server.close();
