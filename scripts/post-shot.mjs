/**
 * Captura una publicación entera.
 *
 * Las capturas de pantalla completa cortan la tarjeta por abajo: el teléfono
 * mide 844 y una publicación con foto, barra de acciones, resumen y pie no cabe.
 * Esto abre el feed, busca la tarjeta y la fotografía sola, con su alto real.
 */

import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.env.MOBILE_URL ?? 'http://127.0.0.1:8081';
const OUT = new URL('../artifacts/screenshots/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

for (const theme of [
  { name: 'claro', colorScheme: 'light' },
  { name: 'oscuro', colorScheme: 'dark' },
]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 1600 },
    deviceScaleFactor: 3,
    colorScheme: theme.colorScheme,
    locale: 'es-ES',
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=/Coincide/i', { timeout: 15_000 });

  // Abre los comentarios de la primera publicación: una tarjeta con la
  // conversación desplegada es la que enseña de verdad de qué va el feed.
  await page.getByRole('button', { name: /Ver los .* comentarios|Ver el comentario/ }).first().click();
  await page.waitForTimeout(400);

  // La tarjeta empieza en la cabecera del autor y termina en el pie.
  const card = page.locator('div').filter({ hasText: /^Nina/ }).first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  await page.screenshot({
    path: `${OUT}post-completo-${theme.name}.png`,
    clip: await (async () => {
      const box = await card.boundingBox();
      if (!box) throw new Error('no se encontró la tarjeta');
      return { x: 0, y: Math.max(0, box.y - 8), width: 390, height: Math.min(1200, box.height + 16) };
    })(),
  });

  await context.close();
}

await browser.close();
console.log('✓ publicación completa capturada');
