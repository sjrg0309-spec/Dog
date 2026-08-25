/**
 * Las tres direcciones visuales, en las dos luces.
 *
 * Seis capturas de **la misma pantalla**: el feed, con la misma publicación y
 * el mismo perro. Es la única forma de comparar una dirección con otra —dos
 * capturas de pantallas distintas comparan las pantallas, no las direcciones—.
 *
 * Se hace sobre el fichero publicado y no sobre el servidor de desarrollo,
 * porque lo que hay que mirar es lo que le llega a alguien. Y la cuenta se da
 * de alta de verdad en cada luz: sin animal no se entra, y eso no tiene atajo.
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

for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
  });

  /* Teselas de mentira: el proxy de este contenedor bloquea el servidor de
     mapas, y sin esto sale el aviso de «sin las calles» en cada captura. */
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) }),
  );

  /* Con la muesca simulada: en un navegador `env(safe-area-inset-*)` vale cero,
     así que sin esto la captura no enseña lo único que hay que mirar aquí —que
     la cabecera esquiva la isla dinámica y la barra el indicador de inicio—. */
  await page.goto(`${URL_}?zonasegura=59`, { waitUntil: 'load' });
  await page.waitForSelector('#root > *', { timeout: 30_000 });
  await page.waitForTimeout(1200);

  const tap = async (name, exact = true) => {
    await page.getByRole('button', { name, exact }).first().click();
    await page.waitForTimeout(420);
  };

  /* El alta entera, que es la única puerta. */
  await tap('Comenzar ahora');
  await tap('Tutor');
  await page.getByLabel('Correo', { exact: true }).fill('ana@correo.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('el perro come pasto');
  await page.waitForTimeout(300);
  await tap('Siguiente');
  await page.getByLabel('Buscar una raza').fill('bulldog fran');
  await page.waitForTimeout(400);
  await tap('Bulldog francés');
  await tap('Siguiente');
  await page.getByLabel('Nombre de tu perro').fill('Toby');
  await tap('Siguiente');
  await tap('3 años');
  await tap('Hembra');
  await tap('Siguiente');
  await tap('Siguiente');
  await tap('Persecución');
  await tap('Siguiente');
  await tap('Compañía');
  await tap('Siguiente');
  await tap('Siguiente');
  await tap('Omitir');
  for (const day of ['L', 'X', 'V']) await tap(day);
  await tap('Mañana');
  await tap('Siguiente');
  await tap('Omitir');
  await tap('Entrar');
  await page.waitForTimeout(500);
  await tap('Entrar');
  await page.waitForTimeout(1400);

  for (const direction of ['Nocturno', 'Papel', 'Señal']) {
    /* La primera ya viene puesta de fábrica; las otras dos se eligen por el
       camino real: perfil → menú → configuración. */
    if (direction !== 'Nocturno') {
      await page.getByRole('tab', { name: /Perfil/i }).first().click();
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: /Menú del perfil/i }).first().click();
      await page.waitForTimeout(450);
      await page.getByRole('button', { name: /^Configuración$/ }).first().click();
      await page.waitForTimeout(900);

      if (direction === 'Papel') {
        await page.screenshot({ path: `${OUT}direccion-selector-${scheme}.png` });
      }

      const option = page.getByRole('radio', { name: new RegExp(`^${direction}\\.`) }).first();
      await option.scrollIntoViewIfNeeded().catch(() => {});
      await option.click();
      await page.waitForTimeout(600);
      await page.getByRole('button', { name: /^Volver$/ }).first().click();
      await page.waitForTimeout(700);
    }

    await page.getByRole('tab', { name: /Feed/i }).first().click();
    await page.waitForTimeout(1300);
    const slug = direction.toLowerCase().replace('ñ', 'n');
    await page.screenshot({ path: `${OUT}direccion-${slug}-${scheme}.png` });
  }

  await page.close();
}

console.log('capturas de las tres direcciones listas');
await browser.close();
server.close();
