/**
 * El recorrido publicable.
 *
 * El servidor de desarrollo corre dentro del contenedor y no hay puerto abierto
 * hacia fuera, así que un `localhost` no le sirve a nadie que no esté aquí
 * dentro. Esto captura las pantallas de verdad —la aplicación real, corriendo—
 * y las deja listas para incrustarlas en una página autocontenida que sí se
 * puede abrir desde cualquier navegador.
 *
 * Se capturan a escala 2 y en JPEG porque el resultado tiene que caber entero
 * dentro de un solo archivo: a escala 3 y en PNG, veinte pantallas pesan más
 * que el tope de la página.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const BASE = process.env.MOBILE_URL ?? 'http://127.0.0.1:8081';
const OUT = new URL('../artifacts/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

/** Las pantallas del recorrido, en el orden en que se cuentan. */
const SCREENS = [
  { path: '/', name: 'Feed', note: 'Dos caras: Siguiendo y Cerca de mí. El radio recorta y se dice cuánto deja fuera.' },
  { path: '/', name: 'Siguiendo', scope: 'Siguiendo', note: 'Vacío por definición el primer día. Por eso el alternador va visible.' },
  { path: '/estados', name: 'Estados', note: 'Caducan a las 24 h. Barras arriba, tocar para avanzar, mantener para pausar.' },
  { path: '/reels', name: 'Reels', note: 'Cada uno declara la temperatura y la superficie de cuando se grabó.' },
  { path: '/sos', name: 'SOS', note: 'Doce escenarios, cada uno con su radio y su crecimiento.' },
  { path: '/sos', name: 'Escenarios', tap: 'Dar la alarma', note: 'Un cebo no se mueve: 500 m que no crecen. Los petardos empiezan en 3 km.' },
  { path: '/explorar', name: 'Explorar', note: 'Esquema, no cartografía. La geometría y los radios sí son reales.' },
  { path: '/', name: 'Reels de la zona', tap: 'Reels', note: 'Tercera pestaña del feed: el vídeo corto es feed, no exploración geográfica. Lo grabado en malas condiciones sale etiquetado, no escondido.' },
  { path: '/mensajes', name: 'Mensajes', note: 'Cada hilo dice de dónde sale. Aquí no se escribe a desconocidos por escribir.' },
  { path: '/mensajes', name: 'Conversación', tap: 'Cumpleaños de Toby', note: 'Burbujas con pico, hora dentro, y el azul solo cuando está leído.' },
  { path: '/perfil', name: 'Perfil', note: 'Retrato, tres cifras, destacados y cuadrícula.' },
  { path: '/perfil', name: 'Modo Paseo', tap: 'Modo Paseo', note: 'El código enseña a quién llamar, no el historial.' },
  { path: '/perfil', name: 'Ficha médica', tap: 'Ficha médica', note: 'Privada, y detrás de una pestaña porque esta pantalla se enseña a otros.' },
  { path: '/actividad', name: 'Actividad', note: 'Lo accionable arriba. Ni un motivo inventado para volver.' },
  { path: '/publicar', name: 'Publicar', tap: 'Reel', note: 'Tres modos. El selector abajo, junto al pulgar.' },
  { path: '/descubrir', name: 'Con quién salir', note: 'Los tres ejes por separado: temperamento, horarios y cercanía.' },
  { path: '/descubrir', name: 'Hoy no', temperature: '34°', note: 'A 34 grados no hay lista. El animal manda sobre el plan de su tutor.' },
  { path: '/citas', name: 'Cita de juego', note: 'La baraja ya viene filtrada: el mal encuentro no está en el mazo.' },
  { path: '/radar', name: 'Radar', note: 'Solo se enciende dentro de una zona pet-friendly.' },
  { path: '/quedadas', name: 'Quedadas', note: 'La afinidad del grupo es la del peor par, no el promedio.' },
];

const TABS = ['Ficha médica', 'Guardados', 'Fotos', 'Reels', 'Mapa', 'Estado', 'Reel', 'Publicación'];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

const shots = [];
const problems = [];

for (const theme of [
  { key: 'light', colorScheme: 'light' },
  { key: 'dark', colorScheme: 'dark' },
]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: theme.colorScheme,
    locale: 'es-ES',
    isMobile: true,
    hasTouch: true,
  });

  for (const screen of SCREENS) {
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`${screen.name} · ${error.message}`));

    await page.goto(`${BASE}${screen.path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(
      'text=/Coincide|SOS|Explorar|Mensajes|Radar|Quedadas|Con quién|Cita de juego|Reels|Actividad|Publicar|Caduca|estado/i',
      { timeout: 15_000 },
    );

    if (screen.scope) {
      await page.getByRole('tab', { name: screen.scope }).click();
      await page.waitForTimeout(300);
    }
    if (screen.temperature) {
      await page.getByRole('radio', { name: screen.temperature }).click();
      await page.waitForTimeout(300);
    }
    if (screen.tap) {
      const role = screen.tap === 'Modo Paseo' ? 'switch' : TABS.includes(screen.tap) ? 'tab' : 'button';
      await page.getByRole(role, { name: screen.tap }).first().click();
      await page.waitForTimeout(450);
    }
    // Un respiro para que terminen las animaciones de entrada.
    await page.waitForTimeout(500);

    const buffer = await page.screenshot({ type: 'jpeg', quality: 70 });
    shots.push({
      theme: theme.key,
      name: screen.name,
      note: screen.note,
      data: `data:image/jpeg;base64,${buffer.toString('base64')}`,
    });
    await page.close();
  }

  await context.close();
}

await browser.close();
await writeFile(`${OUT}tour.json`, JSON.stringify({ screens: SCREENS.map((s) => s.name), shots }));

const bytes = shots.reduce((sum, shot) => sum + shot.data.length, 0);
console.log(`✓ ${shots.length} pantallas · ${(bytes / 1024 / 1024).toFixed(1)} MB en base64`);
if (problems.length > 0) {
  console.error(`✗ ${problems.length} errores de página:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
}
