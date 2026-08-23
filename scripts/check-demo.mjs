import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const body = readFileSync('/home/user/Dog/artifacts/coincide-demo.html', 'utf8');
// El visor envuelve el fichero en un esqueleto; aquí se reproduce para
// comprobar exactamente lo que se va a publicar.
const page_html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const problems = [];

for (const [name, scheme, width] of [
  ['claro', 'light', 1280],
  ['oscuro', 'dark', 1280],
  ['movil', 'light', 390],
]) {
  const context = await browser.newContext({
    colorScheme: scheme,
    viewport: { width, height: 900 },
    locale: 'es-ES',
  });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${name}: ${e.message}`));
  await page.setContent(page_html, { waitUntil: 'networkidle' });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 1) problems.push(`${name}: desborda ${overflow}px`);

  // Se conduce el control: 34 grados tiene que vaciar la lista.
  if (width > 900) {
    await page.getByRole('button', { name: '34°' }).click();
    const cards = await page.locator('#screen .card').count();
    const stop = await page.locator('.v-stop').count();
    if (stop === 0) problems.push(`${name}: a 34° no aparece ningún veredicto de parada`);
    await page.getByRole('button', { name: '18°' }).click();
    const back = await page.locator('#screen .card').count();
    if (back <= 0) problems.push(`${name}: a 18° la lista sigue vacía`);
    console.log(`${name}: tarjetas a 34° = ${cards}, a 18° = ${back}`);
  }

  // Pulsar un control lo desplaza a la vista, así que se vuelve arriba antes de
  // capturar: si no, la primera imagen sale a media página.
  await page.evaluate(() => window.scrollTo(0, 0));

  // Sin `fullPage`: con una cabecera pegajosa, la captura de página completa la
  // pinta en la posición del scroll y produce un solapamiento que no existe en
  // el navegador. Se capturan dos alturas concretas en su lugar.
  // La misma auditoría que pasa la web pública. Un prototipo que se comparte se
  // abre en los mismos navegadores y con los mismos lectores de pantalla.
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  for (const violation of audit.violations) {
    problems.push(`${name}: axe ${violation.id} (${violation.nodes.length}) — ${violation.help}`);
  }

  await page.screenshot({ path: `/home/user/Dog/artifacts/screenshots/demo-${name}.png` });
  if (width > 900) {
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.screenshot({ path: `/home/user/Dog/artifacts/screenshots/demo-${name}-2.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await context.close();
}

await browser.close();
if (problems.length) {
  console.error('✗ problemas:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exitCode = 1;
} else {
  console.log('✓ sin errores de consola, sin desbordamiento, controles funcionando');
}
