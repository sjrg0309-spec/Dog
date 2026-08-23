/**
 * Monta el recorrido publicable en una sola página autocontenida.
 *
 * Existe porque el servidor de desarrollo corre dentro del contenedor y no hay
 * puerto abierto hacia fuera: un `localhost` no le sirve a quien no esté aquí
 * dentro. Esto empaqueta las capturas reales de la aplicación —las dos
 * versiones de tema— dentro de un archivo que se abre en cualquier navegador.
 *
 * La paleta y las tipografías son las del producto, no unas nuevas para la
 * página: hueso y carbón, salvia y terracota, Plus Jakarta Sans y Atkinson
 * Hyperlegible. Si la página tuviera su propia identidad, enseñaría una
 * aplicación que no existe.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const here = (path) => new URL(path, import.meta.url);
const tour = JSON.parse(readFileSync(here('../artifacts/tour.json'), 'utf8'));

const byName = new Map();
for (const shot of tour.shots) {
  const entry = byName.get(shot.name) ?? { name: shot.name, note: shot.note };
  entry[shot.theme] = shot.data;
  byName.set(shot.name, entry);
}
const screens = tour.screens.map((name) => byName.get(name)).filter(Boolean);

const html = `<title>Coincide en el teléfono</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap">

<style>
  /* Los tokens del producto, tal cual. Claro por defecto; el tema oscuro solo
     redefine estas variables, nunca los componentes. */
  :root {
    --bone-0: #ffffff;
    --bone-25: #fdfbf7;
    --bone-50: #faf7f2;
    --bone-100: #f2efe9;
    --bone-200: #e5e1d9;
    --ink-300: #b5b6c3;
    --ink-500: #6f7185;
    --ink-600: #515369;
    --ink-800: #2b2d42;
    --ink-900: #1b1c2e;
    --ink-950: #0c0d1a;
    --sage: #387256;
    --sage-soft: #d8eee2;
    --terracotta: #e07a5f;
    --terracotta-deep: #a54530;

    --ground: var(--bone-50);
    --surface: var(--bone-0);
    --sunken: var(--bone-100);
    --line: var(--bone-200);
    --text: var(--ink-800);
    --muted: var(--ink-600);
    --accent: var(--terracotta-deep);
    --brand: var(--sage);
    --frame: var(--ink-900);
    --shadow: 0 24px 60px rgba(43, 45, 66, 0.16), 0 4px 12px rgba(43, 45, 66, 0.08);
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
      --ground: var(--ink-950);
      --surface: var(--ink-900);
      --sunken: #15162a;
      --line: #272941;
      --text: var(--bone-50);
      --muted: var(--ink-300);
      --accent: var(--terracotta);
      --brand: #81b29a;
      --frame: #000000;
      --shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4);
    }
  }

  :root[data-theme='dark'] {
    --ground: var(--ink-950);
    --surface: var(--ink-900);
    --sunken: #15162a;
    --line: #272941;
    --text: var(--bone-50);
    --muted: var(--ink-300);
    --accent: var(--terracotta);
    --brand: #81b29a;
    --frame: #000000;
    --shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--ground);
    color: var(--text);
    font-family: 'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif;
    font-size: 17px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  .wrap {
    max-width: 1140px;
    margin: 0 auto;
    padding: clamp(24px, 5vw, 56px) clamp(16px, 4vw, 40px) 72px;
  }

  header { margin-bottom: clamp(28px, 5vw, 48px); }

  .eyebrow {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 10px;
  }

  h1 {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 800;
    font-size: clamp(30px, 5.5vw, 46px);
    line-height: 1.08;
    letter-spacing: -0.025em;
    margin: 0 0 14px;
    text-wrap: balance;
  }

  .lede {
    margin: 0;
    max-width: 62ch;
    color: var(--muted);
    font-size: 17px;
  }

  .lede strong { color: var(--text); font-weight: 700; }

  .stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: clamp(24px, 4vw, 44px);
    align-items: start;
  }

  @media (min-width: 900px) {
    .stage { grid-template-columns: 390px minmax(0, 1fr); }
  }

  /* El teléfono. Marco real, no un borde redondeado: es el sujeto de la
     página y tiene que leerse como un dispositivo. */
  .device {
    position: sticky;
    top: 24px;
    justify-self: center;
    width: min(390px, 100%);
  }

  .bezel {
    position: relative;
    border-radius: 46px;
    padding: 11px;
    background: var(--frame);
    box-shadow: var(--shadow);
  }

  .notch {
    position: absolute;
    top: 11px;
    left: 50%;
    transform: translateX(-50%);
    width: 108px;
    height: 26px;
    border-radius: 0 0 16px 16px;
    background: var(--frame);
    z-index: 2;
  }

  .screen {
    position: relative;
    border-radius: 36px;
    overflow: hidden;
    background: var(--sunken);
    aspect-ratio: 390 / 844;
  }

  .screen img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .screen img[hidden] { display: none; }

  .controls {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 18px;
  }

  button {
    font: inherit;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700;
    font-size: 14px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 999px;
    min-height: 44px;
    padding: 0 18px;
    cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease;
  }

  button:hover { background: var(--sunken); }
  button:focus-visible { outline: 3px solid var(--brand); outline-offset: 2px; }
  button[disabled] { opacity: 0.4; cursor: default; }

  .arrow { width: 44px; padding: 0; font-size: 18px; }

  .counter {
    flex: 1;
    text-align: center;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700;
    font-size: 13px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .theme-switch {
    display: inline-flex;
    background: var(--sunken);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 3px;
    gap: 3px;
    margin-top: 12px;
  }

  .theme-switch button {
    border: 0;
    background: transparent;
    min-height: 36px;
    padding: 0 14px;
    font-size: 13px;
    color: var(--muted);
    border-radius: 999px;
  }

  .theme-switch button[aria-pressed='true'] {
    background: var(--surface);
    color: var(--text);
  }

  /* El índice. La numeración aquí sí es información: un recorrido tiene orden. */
  .index { min-width: 0; }

  .now h2 {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 800;
    font-size: clamp(22px, 3.2vw, 30px);
    letter-spacing: -0.02em;
    margin: 0 0 8px;
    text-wrap: balance;
  }

  .now p {
    margin: 0 0 28px;
    max-width: 54ch;
    color: var(--muted);
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--line);
  }

  ol li { border-bottom: 1px solid var(--line); }

  ol button {
    display: flex;
    align-items: baseline;
    gap: 14px;
    width: 100%;
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 13px 6px;
    min-height: 48px;
    color: var(--muted);
    font-weight: 400;
    font-family: 'Atkinson Hyperlegible', sans-serif;
    font-size: 16px;
  }

  ol button:hover { background: var(--sunken); }

  ol button .n {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-500);
    min-width: 22px;
  }

  ol li[aria-current='true'] button { color: var(--text); font-weight: 700; }
  ol li[aria-current='true'] button .n { color: var(--accent); }

  .foot {
    margin-top: 56px;
    padding-top: 24px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 15px;
    max-width: 68ch;
  }

  .foot p { margin: 0 0 12px; }
  .foot code {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 13px;
    background: var(--sunken);
    padding: 2px 6px;
    border-radius: 5px;
  }

  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; }
  }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">Coincide · captura de la aplicación real</p>
    <h1>La aplicación, pantalla por pantalla</h1>
    <p class="lede">
      Veinte pantallas capturadas de la aplicación corriendo, en tema claro y oscuro.
      <strong>No es un maquetado:</strong> los porcentajes, los veredictos de bienestar, los radios
      de las alertas y las ilustraciones salen del código que hay en la rama.
    </p>
  </header>

  <div class="stage">
    <div class="device">
      <div class="bezel">
        <div class="notch"></div>
        <div class="screen" id="screen"></div>
      </div>

      <div class="controls">
        <button class="arrow" id="prev" aria-label="Pantalla anterior">←</button>
        <span class="counter" id="counter"></span>
        <button class="arrow" id="next" aria-label="Pantalla siguiente">→</button>
      </div>

      <div class="theme-switch" role="group" aria-label="Tema de la aplicación">
        <button data-theme-btn="light" aria-pressed="true">Claro</button>
        <button data-theme-btn="dark" aria-pressed="false">Oscuro</button>
      </div>
    </div>

    <div class="index">
      <div class="now">
        <h2 id="title"></h2>
        <p id="note"></p>
      </div>
      <ol id="list"></ol>
    </div>
  </div>

  <div class="foot">
    <p>
      <strong>Sobre el localhost.</strong> La aplicación se sirve en
      <code>http://localhost:8081</code> y la web en <code>http://localhost:3000</code>, pero los
      dos procesos corren dentro del contenedor donde se construyó esto y no hay ningún puerto
      abierto hacia fuera. Esta página existe justamente por eso.
    </p>
    <p>
      <strong>Sobre las imágenes.</strong> Ninguna es una foto. Son ilustraciones generadas a
      partir del identificador de cada animal y de la hora a la que se publicó, con los mismos
      colores que la interfaz. Cada una lo lleva escrito.
    </p>
  </div>
</div>

<script>
  const SCREENS = ${JSON.stringify(screens)};
  let current = 0;
  let appTheme = 'light';

  const screenEl = document.getElementById('screen');
  const titleEl = document.getElementById('title');
  const noteEl = document.getElementById('note');
  const counterEl = document.getElementById('counter');
  const listEl = document.getElementById('list');
  const prevEl = document.getElementById('prev');
  const nextEl = document.getElementById('next');

  // Las dos imágenes de cada pantalla se montan una sola vez y se alternan con
  // \`hidden\`. Cambiar el \`src\` provocaba un parpadeo en blanco al conmutar el
  // tema, que es justo el momento en que se está comparando.
  SCREENS.forEach((screen, index) => {
    for (const theme of ['light', 'dark']) {
      const img = document.createElement('img');
      img.src = screen[theme];
      img.alt = 'Pantalla «' + screen.name + '» de Coincide en tema ' + (theme === 'light' ? 'claro' : 'oscuro');
      img.dataset.index = String(index);
      img.dataset.theme = theme;
      img.loading = index < 2 ? 'eager' : 'lazy';
      img.hidden = true;
      screenEl.append(img);
    }

    const li = document.createElement('li');
    const button = document.createElement('button');
    button.innerHTML = '<span class="n">' + String(index + 1).padStart(2, '0') + '</span><span>' + screen.name + '</span>';
    button.addEventListener('click', () => show(index));
    li.append(button);
    listEl.append(li);
  });

  function show(index) {
    current = (index + SCREENS.length) % SCREENS.length;
    const screen = SCREENS[current];

    for (const img of screenEl.children) {
      img.hidden = !(Number(img.dataset.index) === current && img.dataset.theme === appTheme);
    }

    titleEl.textContent = screen.name;
    noteEl.textContent = screen.note;
    counterEl.textContent = String(current + 1) + ' de ' + SCREENS.length;

    for (const [position, li] of [...listEl.children].entries()) {
      if (position === current) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    }
  }

  function setAppTheme(theme) {
    appTheme = theme;
    for (const button of document.querySelectorAll('[data-theme-btn]')) {
      button.setAttribute('aria-pressed', String(button.dataset.themeBtn === theme));
    }
    show(current);
  }

  prevEl.addEventListener('click', () => show(current - 1));
  nextEl.addEventListener('click', () => show(current + 1));
  for (const button of document.querySelectorAll('[data-theme-btn]')) {
    button.addEventListener('click', () => setAppTheme(button.dataset.themeBtn));
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { show(current - 1); event.preventDefault(); }
    if (event.key === 'ArrowRight') { show(current + 1); event.preventDefault(); }
  });

  // Deslizar en el teléfono, que es donde más se va a mirar esto.
  let startX = null;
  screenEl.addEventListener('touchstart', (event) => { startX = event.touches[0].clientX; }, { passive: true });
  screenEl.addEventListener('touchend', (event) => {
    if (startX === null) return;
    const delta = event.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 40) show(current + (delta < 0 ? 1 : -1));
    startX = null;
  }, { passive: true });

  show(0);
</script>
`;

const out = '/tmp/claude-0/-home-user-Dog/6263f0bc-0e8f-5994-98c8-11f510938927/scratchpad/coincide-tour.html';
writeFileSync(out, html);
console.log(`✓ ${screens.length} pantallas · ${(html.length / 1024 / 1024).toFixed(1)} MB · ${out}`);
