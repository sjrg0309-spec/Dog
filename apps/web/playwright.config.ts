import { defineConfig, devices } from '@playwright/test';

/**
 * El servidor de producción, no el de desarrollo: lo que se valida tiene que
 * ser lo que se sirve, con su build real y sin las ayudas del modo dev.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    // El navegador va preinstalado en el entorno y su número de build no tiene
    // por qué coincidir con el que espera esta versión de Playwright, así que se
    // apunta al ejecutable directamente en lugar de descargar otro.
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
    },
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
});
