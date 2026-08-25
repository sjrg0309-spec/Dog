import { defineConfig } from 'vitest/config';

/**
 * Los tests de integración comparten una única base de datos.
 *
 * Cada fichero la siembra desde cero, así que ejecutarlos en paralelo hace que
 * uno vacíe las tablas mientras otro las lee. El síntoma es el peor posible:
 * fallos que cambian de sitio entre ejecuciones y que parecen un problema de la
 * consulta cuando son del corredor.
 *
 * Se ejecutan en serie. Son segundos, y a cambio un fallo aquí significa
 * siempre lo que dice.
 */
export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
