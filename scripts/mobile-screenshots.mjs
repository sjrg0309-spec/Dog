/**
 * Capturas de la aplicación móvil.
 *
 * Se toman sobre el export web servido en local y a tamaño de teléfono. Es una
 * aproximación, no una prueba en dispositivo: en este entorno no hay simulador
 * de iOS ni de Android, así que lo que se verifica aquí es que las pantallas
 * componen, que los datos reales del algoritmo llegan a la interfaz y que no hay
 * errores de consola. Cómo se ve exactamente en un iPhone queda sin comprobar.
 */

import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.env.MOBILE_URL ?? 'http://127.0.0.1:8081';
const OUT = new URL('../artifacts/screenshots/', import.meta.url).pathname;

const ROUTES = [
  { path: '/', name: 'app-descubrir' },
  { path: '/radar', name: 'app-radar' },
  { path: '/quedadas', name: 'app-quedadas' },
  { path: '/espacios', name: 'app-espacios' },
];

const THEMES = [
  { name: 'claro', colorScheme: 'light' },
  { name: 'oscuro', colorScheme: 'dark' },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

const problems = [];
let count = 0;

for (const theme of THEMES) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    colorScheme: theme.colorScheme,
    locale: 'es-ES',
    isMobile: true,
    hasTouch: true,
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`${route.path} · ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`${route.path} · ${error.message}`));

    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle' });
    // La aplicación es una SPA: hay que esperar a que React pinte algo.
    await page.waitForSelector('text=/Coincide|Descubrir|Radar|Quedadas|Espacios|Con quién/i', {
      timeout: 15_000,
    });

    await page.screenshot({ path: `${OUT}${route.name}-${theme.name}.png`, fullPage: true });
    count += 1;
    await page.close();
  }

  await context.close();
}

await browser.close();

console.log(`✓ ${count} capturas de la aplicación móvil`);
if (problems.length > 0) {
  console.error(`✗ ${problems.length} problemas de consola:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log('✓ sin errores de consola');
}
