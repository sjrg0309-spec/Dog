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

/**
 * Las rutas, y con qué mascota se capturan.
 *
 * `pet` es el nombre del selector que hay que pulsar antes de la captura. Que
 * exista es la mitad del producto: son dos perros del mismo tutor y a 26 grados
 * la aplicación deja salir a uno y al otro no. Una captura solo del primer caso
 * escondería justo eso.
 */
const ROUTES = [
  { path: '/', name: 'app-feed' },
  // Los estados y los reels a pantalla completa, que es donde viven.
  { path: '/estados', name: 'app-estados' },
  { path: '/reels', name: 'app-reels' },
  { path: '/actividad', name: 'app-actividad' },
  // El compositor en sus tres modos.
  { path: '/publicar', name: 'app-publicar-estado', tap: 'Estado' },
  { path: '/publicar', name: 'app-publicar-reel', tap: 'Reel' },
  // La otra cara del feed. Sin esta captura, «Siguiendo» y «Cerca de mí»
  // parecen el mismo feed con dos rótulos, que es justo lo que no son.
  { path: '/', name: 'app-feed-siguiendo', scope: 'Siguiendo' },
  { path: '/sos', name: 'app-sos' },
  // El botón de pánico abierto: el catálogo de escenarios con su radio delante.
  { path: '/sos', name: 'app-sos-escenarios', tap: 'Dar la alarma' },
  { path: '/explorar', name: 'app-explorar' },
  // Los reels dejaron de vivir en Explorar: ahora son la tercera cara del feed.
  { path: '/', name: 'app-feed-reels', scope: 'Reels' },
  { path: '/perfil', name: 'app-perfil' },
  { path: '/perfil', name: 'app-perfil-ficha', tap: 'Ficha médica' },
  { path: '/perfil', name: 'app-perfil-guardados', tap: 'Guardados' },
  // Modo Paseo encendido: el código y lo que enseña, que es la mitad de la
  // decisión de privacidad de esa pantalla.
  { path: '/perfil', name: 'app-perfil-modo-paseo', tap: 'Modo Paseo' },
  // Kira: hocico chato y sensible al calor. Los avisos del código cambian, y la
  // ficha médica también.
  { path: '/perfil', name: 'app-perfil-kira', pet: 'Kira', tap: 'Modo Paseo' },
  { path: '/mensajes', name: 'app-mensajes' },
  // Una conversación abierta: burbujas, separador de día y doble check.
  { path: '/mensajes', name: 'app-mensajes-hilo', tap: 'Cumpleaños de Toby' },
  { path: '/citas', name: 'app-citas' },
  { path: '/descubrir', name: 'app-descubrir' },
  { path: '/descubrir', name: 'app-descubrir-kira', pet: 'Kira' },
  // El caso que define de quién es la aplicación: a 34 grados no hay lista.
  { path: '/descubrir', name: 'app-descubrir-calor', temperature: '34°' },
  // Kira a 26 grados: el mismo día, la misma especie, y la aplicación contesta
  // que no. Es lo que hace visible que decide por el animal.
  { path: '/descubrir', name: 'app-descubrir-calor-kira', pet: 'Kira', temperature: '26°' },
  { path: '/radar', name: 'app-radar' },
  // El radar fuera de zona: es la regla nueva, y una captura solo desde dentro
  // del parque la escondería.
  { path: '/radar', name: 'app-radar-fuera', place: 'En casa' },
  { path: '/publicar', name: 'app-publicar' },
  { path: '/quedadas', name: 'app-quedadas' },
  { path: '/espacios', name: 'app-espacios' },
  { path: '/comunidad', name: 'app-comunidad' },
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
    await page.waitForSelector(
      'text=/Coincide|SOS|Explorar|Mensajes|Radar|Quedadas|Espacios|Con quién|Cita de juego|Reels|Actividad|Publicar|Caduca|estado/i',
      { timeout: 15_000 },
    );

    if (route.scope) {
      await page.getByRole('tab', { name: route.scope }).click();
      await page.waitForTimeout(300);
    }

    if (route.temperature) {
      await page.getByRole('radio', { name: route.temperature }).click();
      await page.waitForTimeout(300);
    }

    if (route.place) {
      await page.getByRole('radio', { name: route.place }).click();
      await page.waitForTimeout(300);
    }

    if (route.pet) {
      await page.getByRole('tab', { name: new RegExp(route.pet) }).click();
      // El selector es estado de React, no navegación: se espera al texto que
      // solo aparece cuando la pantalla ya se ha vuelto a pintar.
      await page.waitForTimeout(300);
    }

    // Lo último: un interruptor o un botón que abre lo que hay que enseñar. Va
    // después del selector de mascota para que se abra sobre la correcta.
    if (route.tap) {
      const TABS = ['Ficha médica', 'Guardados', 'Fotos', 'Reels', 'Mapa', 'Estado', 'Reel', 'Publicación'];
      const role =
        route.tap === 'Modo Paseo' ? 'switch' : TABS.includes(route.tap) ? 'tab' : 'button';
      await page.getByRole(role, { name: route.tap }).first().click();
      await page.waitForTimeout(400);
    }

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
