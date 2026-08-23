/**
 * Audita la copia estática de la web antes de publicarla.
 *
 * Lo que comprueba no es que se vea bien —para eso están las capturas— sino que
 * lo que se reimplementó al sacarla del servidor siga funcionando: que cada
 * ruta muestre su panel y solo el suyo, que el conmutador de tema mueva de
 * verdad `data-theme`, y que el fichero sea autocontenido. Esto último importa
 * más de lo que parece: una tipografía que se quedara apuntando al servidor
 * cargaría aquí y fallaría en el navegador de cualquier otro.
 */

import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const FILE = 'file://' + new URL('../artifacts/coincide-web.html', import.meta.url).pathname;

const ROUTES = [
  ['portada', 'Portada'],
  ['parques', 'Parques'],
  ['quedada', 'Quedada pública'],
  ['spot', 'Espacio privado'],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const problems = [];
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`consola: ${message.text()}`);
});
page.on('pageerror', (error) => problems.push(`error de página: ${error.message}`));

await page.goto(FILE, { waitUntil: 'load' });

/* Los acentos van primero porque un fallo de codificación no rompe nada: la
   página se ve entera y solo el texto sale mal. «Ã» es la firma de UTF-8 leído
   como Latin-1, y aquí aparece si el navegador tiene que adivinar el juego de
   caracteres en vez de encontrarlo declarado. */
const mojibake = await page.evaluate(() => (document.body.innerText.match(/Ã.|Â./g) ?? []).slice(0, 5));
if (mojibake.length) problems.push(`texto mal codificado: ${mojibake.join(' ')}`);

for (const [id, label] of ROUTES) {
  await page.getByRole('button', { name: label }).click();
  const visible = await page.locator(`#panel-${id}`).isVisible();
  const openPanels = await page.locator('.ruta-panel:visible').count();
  const text = (await page.locator(`#panel-${id}`).innerText()).trim();

  console.log(`${label.padEnd(18)} visible=${visible} paneles=${openPanels} caracteres=${text.length}`);

  if (!visible) problems.push(`${id}: su panel no se muestra`);
  if (openPanels !== 1) problems.push(`${id}: hay ${openPanels} paneles visibles a la vez`);
  if (text.length < 200) problems.push(`${id}: el panel está prácticamente vacío`);

  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflows) problems.push(`${id}: desborda a lo ancho`);
}

const toggle = page.getByRole('button', { name: 'Cambiar tema' });
await toggle.click();
const first = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await toggle.click();
const second = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
console.log(`tema: sistema → ${first} → ${second}`);
if (first !== 'light' || second !== 'dark') problems.push('el conmutador no mueve data-theme');

/* Autocontenido: ni una petición que salga del fichero. */
const external = await page.evaluate(() =>
  performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('file:') && !name.startsWith('data:')),
);
if (external.length) problems.push(`peticiones externas: ${external.join(', ')}`);

/* Una referencia a `/_next/` que sobreviva no da error visible al mirar la
   página: el navegador cae a una tipografía del sistema y el texto sigue ahí.
   Por eso se comprueba sobre el fichero y no solo sobre lo que falló al cargar. */
const source = await readFile(new URL('../artifacts/coincide-web.html', import.meta.url), 'utf8');
const leftovers = [...new Set([...source.matchAll(/\/_next\/[^"')\s]+/g)].map((match) => match[0]))];
if (leftovers.length) problems.push(`referencias sin incrustar: ${leftovers.join(', ')}`);

const loadedFonts = await page.evaluate(() => [...document.fonts].filter((font) => font.status === 'loaded').length);
console.log(`tipografías cargadas: ${loadedFonts}`);
if (loadedFonts === 0) problems.push('no cargó ninguna tipografía incrustada');

await page.setViewportSize({ width: 320, height: 800 });
const narrow = await page.evaluate(() => document.documentElement.scrollWidth > 321);
if (narrow) problems.push('desborda a 320 px');

await browser.close();

if (problems.length) {
  console.error(`\n${problems.length} problema(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\n✓ sin problemas');
