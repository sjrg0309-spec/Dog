import { defineConfig } from 'vitest/config';

/**
 * Configuración de Vitest de la web.
 *
 * Lo único que hace, y por lo que existe: dejar fuera `e2e/`. Esas pruebas son
 * de Playwright y se ejecutan con su propio corredor; si Vitest las recoge,
 * falla al importar `test.describe` y el error que sale no tiene nada que ver
 * con lo que de verdad pasa.
 */
export default defineConfig({
  test: {
    include: ['{app,components,lib}/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
  },
});
