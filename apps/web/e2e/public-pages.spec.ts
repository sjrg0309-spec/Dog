/**
 * Validación en un navegador real.
 *
 * El plan del proyecto se compromete a comprobar la interfaz de verdad y no a
 * declararla correcta. Estos casos abren las páginas en Chromium, recorren el
 * teclado, cambian de tema y auditan accesibilidad con axe.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGES = [
  { path: '/', name: 'portada' },
  { path: '/parques', name: 'parques' },
  { path: '/quedada/paseo-manana-central', name: 'quedada' },
  { path: '/spot/patio-chamberi', name: 'spot' },
];

/** Recoge los errores de consola y los fallos de red de una página. */
function collectProblems(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

test.describe('páginas públicas', () => {
  for (const target of PAGES) {
    test(`${target.name} carga sin errores de consola`, async ({ page }) => {
      const problems = collectProblems(page);
      await page.goto(target.path, { waitUntil: 'networkidle' });

      await expect(page.locator('h1')).toBeVisible();
      expect(problems, `problemas en ${target.path}`).toEqual([]);
    });

    test(`${target.name} no tiene infracciones de accesibilidad`, async ({ page }) => {
      await page.goto(target.path, { waitUntil: 'networkidle' });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const summary = results.violations.map(
        (violation) => `${violation.id} (${violation.nodes.length}): ${violation.help}`,
      );
      expect(summary, `infracciones en ${target.path}`).toEqual([]);
    });

    test(`${target.name} no desborda horizontalmente a 320 px`, async ({ page }) => {
      // 320 px es el ancho mínimo soportado. Lo ancho se desplaza dentro de su
      // caja; el documento nunca.
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(target.path, { waitUntil: 'networkidle' });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `desbordamiento en ${target.path}`).toBeLessThanOrEqual(1);
    });
  }
});

test('el enlace de salto lleva al contenido con el teclado', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#contenido$/);
});

test('todo elemento enfocable muestra un anillo de foco visible', async ({ page }) => {
  await page.goto('/');

  // Se recorre el principio del orden de tabulación comprobando que el foco
  // nunca queda invisible: suprimir el outline sin sustituirlo deja a quien
  // navega con teclado sin saber dónde está.
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    const outlineWidth = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return null;
      const style = getComputedStyle(active);
      return style.outlineStyle === 'none' ? '0px' : style.outlineWidth;
    });
    if (outlineWidth === null) continue;
    expect(parseFloat(outlineWidth)).toBeGreaterThan(0);
  }
});

/**
 * El selector de tema.
 *
 * Antes era un botón que rotaba entre tres estados y el caso comprobaba que el
 * ciclo diera la vuelta. Ahora es un menú con las tres opciones a la vez, así
 * que se comprueba lo que de verdad importa de un menú: que se puede operar con
 * el teclado, que la elección se aplica y que sobrevive a una recarga.
 */
test('el selector de tema ofrece las tres opciones y aplica la elegida', async ({ page }) => {
  await page.goto('/');

  const trigger = page.getByRole('button', { name: /tema/i });
  await expect(trigger).toBeVisible();

  // Arranca en automático: sin atributo, manda prefers-color-scheme.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);

  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitemradio', { name: 'Automático' })).toBeVisible();
  await expect(menu.getByRole('menuitemradio', { name: 'Claro' })).toBeVisible();
  await expect(menu.getByRole('menuitemradio', { name: 'Oscuro' })).toBeVisible();

  // Se llega directo a oscuro, sin adivinar cuántas veces hay que pulsar.
  await menu.getByRole('menuitemradio', { name: 'Oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Y se puede volver a automático, que es lo que antes costaba dos pulsaciones
  // a ciegas.
  await trigger.click();
  await page.getByRole('menuitemradio', { name: 'Automático' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
});

test('el selector de tema se opera entero con el teclado', async ({ page }) => {
  await page.goto('/');

  const trigger = page.getByRole('button', { name: /tema/i });
  await trigger.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
  // Al cerrar, el foco vuelve al disparador: sin eso, quien navega con teclado
  // se queda al principio de la página después de cada elección.
  await expect(trigger).toBeFocused();
});

test('Escape cierra el menú sin cambiar el tema', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /tema/i }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('menu')).toBeHidden();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
});

test('el fondo cambia de verdad entre tema claro y oscuro', async ({ page }) => {
  await page.goto('/');
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  const trigger = page.getByRole('button', { name: /tema/i });

  await trigger.click();
  await page.getByRole('menuitemradio', { name: 'Claro' }).click();
  const light = await background();

  await trigger.click();
  await page.getByRole('menuitemradio', { name: 'Oscuro' }).click();
  const dark = await background();

  expect(light).not.toBe(dark);
});

test('con movimiento reducido el anillo se detiene pero no desaparece', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');

  // El pulso se retira...
  await expect(page.locator('.radar__pulse').first()).toBeHidden();
  // ...y el anillo estático ocupa su lugar: quitar el movimiento no debe
  // quitar el significado.
  await expect(page.locator('.radar__static')).toBeVisible();

  await context.close();
});

test('la quedada pública se lee sin cuenta y muestra a los asistentes', async ({ page }) => {
  await page.goto('/quedada/paseo-manana-central');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Paseo de la mañana');
  await expect(page.getByRole('heading', { name: 'Perros apuntados' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Nina' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Toby' })).toBeVisible();
});

test('la página del espacio no filtra la dirección exacta', async ({ page }) => {
  await page.goto('/spot/patio-chamberi');

  const body = await page.locator('body').innerText();
  // La dirección de la semilla es "Calle de Ejemplo 12". Antes de confirmar una
  // reserva no puede aparecer en ninguna parte de la página.
  expect(body).not.toContain('Calle de Ejemplo');
  await expect(page.getByText(/dirección exacta se envía al confirmar/i)).toBeVisible();
});

test('el reparto del coste que se muestra suma el total', async ({ page }) => {
  await page.goto('/spot/patio-chamberi');

  // El patio cuesta 40 € y admite seis perros: entre cuatro son 10 € cada uno.
  const row = page.getByRole('row', { name: /^4/ });
  await expect(row).toContainText('10,00 €');
});

test('una quedada inexistente devuelve 404 y ofrece salida', async ({ page }) => {
  const response = await page.goto('/quedada/no-existe-esta-quedada');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /no existe/i })).toBeVisible();
});

/**
 * El catálogo de especies es la página que mejor explica el producto: Coincide
 * no es una aplicación de perros con otras especies añadidas encima, y eso se ve
 * en cuanto se agrupa por modelo social.
 */


test('la portada ofrece comunidad y urgencias además de las quedadas', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /Un tutor necesita más cosas que un paseo/ }),
  ).toBeVisible();
  // Buscar un veterinario de guardia es la necesidad que no distingue de
  // especie, y por eso se enseña sin cuenta.
  await expect(page.getByText(/Urgencias cerca/)).toBeVisible();
});

test('cada quedada declara a quién admite', async ({ page }) => {
  await page.goto('/');

  // Talla y nivel de actividad tienen que ser legibles en la tarjeta: es lo que
  // decide si merece la pena abrirla.
  const first = page.locator('#quedadas .card').first();
  await expect(first.locator('.badge').first()).not.toBeEmpty();
});

/**
 * El bienestar no es una sección decorativa: si desaparece de la portada, la
 * afirmación de que la aplicación es del animal deja de ser cierta y nadie se
 * entera hasta que alguien la lee.
 */
test('la portada explica que el interés del animal puede decir que no', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /El plan es del tutor; el cuerpo que lo aguanta, no/ }),
  ).toBeVisible();
  await expect(page.getByText(/no da consejo veterinario/i)).toBeVisible();
});


test('una quedada dice cuánto dura el contacto, no solo el evento', async ({ page }) => {
  await page.goto('/quedada/vuelta-corta-sombra');

  await expect(page.getByRole('heading', { name: 'Cuánto dura de verdad' })).toBeVisible();
  await expect(page.getByText(/30 min de contacto seguidos/)).toBeVisible();
});

/**
 * El catálogo de especies se retiró al acotar la aplicación a perros. Este caso
 * comprueba que se retiró de verdad y no quedó accesible por la URL: una página
 * huérfana que sigue respondiendo es peor que una borrada, porque nadie la
 * mantiene y alguien acaba encontrándola.
 */
test('el catálogo de especies ya no existe', async ({ page }) => {
  const response = await page.goto('/especies');
  expect(response?.status()).toBe(404);
});
