/**
 * Capturas del cromo: barra de pestañas, cabecera y lo que cambia al desplazar.
 *
 * Se toman sobre el fichero publicado y no sobre el servidor de desarrollo,
 * porque lo que hay que mirar es lo que le llega a alguien: el mismo HTML que
 * se comparte. La cuenta se da de alta de verdad —no hay atajo, y no debería
 * haberlo: sin animal no se entra.
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

/* Teselas de mentira: el proxy de este contenedor bloquea el servidor de mapas,
   y sin esto el mapa sale con su aviso de «sin las calles» en cada captura. */
await page.route('https://tile.openstreetmap.org/**', (route) =>
  route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) }),
);

await page.goto(URL_, { waitUntil: 'load' });
await page.waitForSelector('#root > *', { timeout: 30_000 });
await page.waitForTimeout(1200);

const tap = async (name, exact = true) => {
  await page.getByRole('button', { name, exact }).first().click();
  await page.waitForTimeout(450);
};
const next = (label = 'Siguiente') => tap(label);
const chip = async (name) => {
  await page.getByRole('button', { name, exact: true }).first().click();
  await page.waitForTimeout(350);
};

await tap('Comenzar ahora');
await tap('Tutor');
await page.getByLabel('Correo', { exact: true }).fill('ana@correo.com');
await page.getByLabel('Contraseña', { exact: true }).fill('el perro come pasto');
await page.waitForTimeout(350);
await next();

await page.getByLabel('Buscar una raza').fill('bulldog fran');
await page.waitForTimeout(400);
await chip('Bulldog francés');
await next();
await page.getByLabel('Nombre de tu perro').fill('Toby');
await next();
await chip('3 años');
await chip('Hembra');
await next();
await next();
await chip('Persecución');
await next();
await chip('Compañía');
await next();
await next();
await next('Omitir');
for (const day of ['L', 'X', 'V']) await chip(day);
await chip('Mañana');
await next();
await next('Omitir');
await next('Entrar');
await page.waitForTimeout(1400);

await page.screenshot({ path: `${OUT}chrome-feed.png` });

/* Y desplazado: la barra condensada, la cabecera con su línea. Se hace con la
   rueda y no con `scrollIntoView` porque lo que se está mirando es la reacción
   al gesto, no dónde acaba la lista. */
await page.mouse.move(195, 500);
await page.mouse.wheel(0, 700);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}chrome-feed-scroll.png` });

await page.mouse.wheel(0, -700);
await page.waitForTimeout(900);

/* El carrusel y la hoja de comentarios, que son lo nuevo de la tarjeta. */
await page.mouse.wheel(0, 300);
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}chrome-carrusel.png` });

const comments = page.getByRole('button', { name: /Ver los \d+ comentarios/ }).first();
if (await comments.count()) {
  await comments.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}chrome-comentarios.png` });
  await page.keyboard.press('Escape').catch(() => {});
  await page.getByRole('button', { name: /Cerrar comentarios/i }).first().click().catch(() => {});
  await page.waitForTimeout(700);
}

await page.getByRole('tab', { name: /Explorar/i }).first().click();
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}chrome-explorar.png` });

await page.getByRole('tab', { name: /Perfil/i }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}chrome-perfil.png` });

console.log('capturas del cromo listas');
await browser.close();
server.close();
