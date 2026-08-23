/**
 * Capturas de la web en los dos anchos de referencia y en los tres temas.
 *
 * Existen para poder revisar el resultado sin abrir un navegador, y para dejar
 * constancia de que se miró de verdad. `system` se captura además con
 * `prefers-color-scheme: dark`, que es lo que ve la mayoría de la gente que
 * nunca toca el conmutador.
 */

import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const OUT = new URL('../artifacts/screenshots/', import.meta.url).pathname;

const PAGES = [
  { path: '/', name: 'portada' },
  { path: '/quedada/paseo-manana-central', name: 'quedada' },
  { path: '/spot/patio-chamberi', name: 'spot' },
  { path: '/parques', name: 'parques' },
  { path: '/especies', name: 'especies' },
];

const VIEWPORTS = [
  { name: 'movil', width: 375, height: 812 },
  { name: 'escritorio', width: 1440, height: 900 },
];

const THEMES = [
  { name: 'claro', attribute: 'light', colorScheme: 'light' },
  { name: 'oscuro', attribute: 'dark', colorScheme: 'dark' },
  { name: 'sistema-oscuro', attribute: null, colorScheme: 'dark' },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

let count = 0;
for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: theme.colorScheme,
      deviceScaleFactor: 2,
      locale: 'es-ES',
    });

    for (const target of PAGES) {
      const page = await context.newPage();

      // El tema se estampa antes de cargar, para no capturar el destello de la
      // transición.
      if (theme.attribute) {
        await page.addInitScript((value) => {
          try {
            localStorage.setItem('coincide-theme', value);
          } catch {
            /* sin almacenamiento se cae al tema del sistema */
          }
        }, theme.attribute);
      }

      await page.goto(`${BASE}${target.path}`, { waitUntil: 'networkidle' });
      // Las fuentes tienen que estar listas o la captura sale con la de reserva.
      await page.evaluate(() => document.fonts.ready);

      const file = `${OUT}${target.name}-${viewport.name}-${theme.name}.png`;
      await page.screenshot({ path: file, fullPage: true });
      count += 1;
      await page.close();
    }

    await context.close();
  }
}

await browser.close();
console.log(`✓ ${count} capturas en artifacts/screenshots/`);
