/**
 * Empaqueta la web servida por `next start` en una sola página autocontenida.
 *
 * El servidor de desarrollo corre dentro del contenedor y no hay ningún puerto
 * abierto hacia fuera, así que `http://localhost:3000` no le sirve a nadie que
 * no esté ahí dentro. Esto toma el HTML que ese servidor produce de verdad
 * —renderizado contra Postgres, con los datos de la semilla— y lo convierte en
 * un fichero que se abre en cualquier navegador.
 *
 * No es una maqueta ni una captura: es el marcado que sale del servidor, con
 * su hoja de estilos y sus tipografías incrustadas. Lo único que se sustituye
 * es la navegación, que pasa de rutas de servidor a mostrar y ocultar
 * secciones, y el conmutador de tema, que en el original lo mueve Radix con
 * JavaScript que aquí no existe.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const WEB = new URL('../apps/web/', import.meta.url).pathname;
const OUT = new URL('../artifacts/petnav-web.html', import.meta.url).pathname;

const ROUTES = [
  { id: 'portada', label: 'Portada', path: '/' },
  { id: 'parques', label: 'Parques', path: '/parques' },
  { id: 'quedada', label: 'Quedada pública', path: '/quedada/paseo-manana-central' },
  { id: 'spot', label: 'Espacio privado', path: '/spot/patio-chamberi' },
];

/** El HTML del servidor trae el payload de Flight y los marcadores de React. */
const stripRuntime = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<div hidden="">[\s\S]*?<\/div>/g, '')
    .replace(/<!--\$-->|<!--\/\$-->|<!--\$\?-->|<!--\/\$\?-->/g, '');

const between = (html, open, close) => {
  const start = html.indexOf(open);
  if (start === -1) return '';
  const from = html.indexOf('>', start) + 1;
  const end = html.lastIndexOf(close);
  return end === -1 ? '' : html.slice(from, end);
};

const fetchRoute = async (path) => {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) throw new Error(`${path} respondió ${response.status}`);
  return await response.text();
};

/** Las tipografías se sirven desde `/_next/static/media`; aquí van dentro. */
const inlineFonts = async (css) => {
  /* Los nombres llevan puntos dentro —`636a5ac981f94f8b-s.p.woff2`—, así que
     la clase de caracteres tiene que admitirlos: sin el punto, la expresión
     falla justo en las tipografías principales y las deja apuntando al
     servidor, que es exactamente lo que este fichero no puede permitirse. */
  const references = [...new Set([...css.matchAll(/\/_next\/static\/media\/([\w.-]+\.woff2?)/g)].map((m) => m[1]))];
  let inlined = css;
  for (const file of references) {
    const bytes = await readFile(join(WEB, '.next/static/media', file));
    const mime = file.endsWith('.woff2') ? 'font/woff2' : 'font/woff';
    const uri = `data:${mime};base64,${bytes.toString('base64')}`;
    inlined = inlined.split(`/_next/static/media/${file}`).join(uri);
  }
  return { css: inlined, count: references.length };
};

const home = await fetchRoute('/');
const cssHref = home.match(/href="(\/_next\/static\/css\/[^"]+)"/)?.[1];
if (!cssHref) throw new Error('no se encontró la hoja de estilos en el HTML servido');

const rawCss = await readFile(join(WEB, cssHref.replace('/_next/', '.next/')), 'utf8');
const { css, count: fontCount } = await inlineFonts(rawCss);

const pages = [];
for (const route of ROUTES) {
  const html = stripRuntime(await fetchRoute(route.path));
  const body = between(html, '<body', '</body>');
  const main = body.slice(body.indexOf('<main'), body.lastIndexOf('</main>') + '</main>'.length);
  pages.push({ ...route, main });
}

/* La cabecera es la misma en las cuatro rutas: se toma una vez. El botón de
   tema del original lo controla Radix, así que aquí se reemplaza por uno que
   funciona sin esa librería. */
const homeBody = stripRuntime(home);
const headerHtml = between(homeBody, '<header class="site-header"', '</header>')
  ? homeBody.slice(homeBody.indexOf('<header class="site-header"'), homeBody.indexOf('</header>') + '</header>'.length)
  : '';

const header = headerHtml.replace(
  /<button type="button" class="button button--ghost" aria-label="Cambiar tema"[\s\S]*?<\/button>/,
  `<button type="button" class="button button--ghost" id="tema" aria-label="Cambiar tema" aria-live="polite"><span class="theme-toggle__label" id="tema-texto">Tema: sistema</span></button>`,
);

const nav = ROUTES.map(
  (route, index) =>
    `<button type="button" class="ruta" data-ruta="${route.id}"${index === 0 ? ' aria-current="page"' : ''}>${route.label}</button>`,
).join('');

const sections = pages
  .map((page, index) => `<div class="ruta-panel" id="panel-${page.id}"${index === 0 ? '' : ' hidden'}>${page.main}</div>`)
  .join('\n');

/* El juego de caracteres va lo primero y no es un detalle: sin declararlo el
   navegador lo adivina, y lo adivina a partir del principio del fichero. Al
   incrustar las tipografías el principio pasó a ser base64, la heurística
   cambió de opinión y «pública» se convirtió en «pÃºblica». Un fallo que
   aparece al crecer el fichero y no al escribirlo. */
const document_ = `<meta charset="utf-8">
<title>Petnav</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${css}

/* Lo único que se añade: la barra que sustituye a las rutas del servidor. */
.rutas {
  position: sticky; top: 0; z-index: 40;
  display: flex; flex-wrap: wrap; gap: 0.35rem;
  padding: 0.6rem clamp(1rem, 5vw, 2rem);
  background: var(--co-surface); border-bottom: 1px solid var(--co-border);
}
.ruta {
  font: inherit; font-size: 0.8rem; font-weight: 600;
  padding: 0.4rem 0.85rem; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--co-border); background: transparent; color: var(--co-muted-foreground);
}
.ruta:hover { color: var(--co-foreground); }
.ruta:focus-visible { outline: 2px solid var(--co-ring); outline-offset: 2px; }
.ruta[aria-current="page"] { background: var(--co-primary); border-color: var(--co-primary); color: var(--co-primary-foreground); }
.aviso-estatico {
  padding: 0.55rem clamp(1rem, 5vw, 2rem);
  font-size: 0.75rem; line-height: 1.5;
  color: var(--co-muted-foreground); background: var(--co-muted);
  border-bottom: 1px solid var(--co-border);
}
</style>

<div class="aviso-estatico">Copia estática de la web de Petnav servida por <code>next start</code> contra la base local. El marcado y los datos son los que produce el servidor; la navegación entre rutas y el conmutador de tema están reimplementados porque aquí no corre el JavaScript de Next.</div>
${header}
<nav class="rutas" aria-label="Rutas de la web">${nav}</nav>
${sections}

<script>
(() => {
  const paneles = [...document.querySelectorAll('.ruta-panel')];
  const botones = [...document.querySelectorAll('.ruta')];

  const mostrar = (id) => {
    paneles.forEach((panel) => { panel.hidden = panel.id !== 'panel-' + id; });
    botones.forEach((boton) => {
      if (boton.dataset.ruta === id) boton.setAttribute('aria-current', 'page');
      else boton.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0 });
  };

  botones.forEach((boton) => boton.addEventListener('click', () => mostrar(boton.dataset.ruta)));

  /* Los enlaces internos del marcado original apuntan a rutas de servidor.
     Aquí se traducen a paneles; los anclas de la portada se dejan en paz. */
  const RUTAS = { '/': 'portada', '/parques': 'parques' };
  document.addEventListener('click', (event) => {
    const enlace = event.target.closest('a[href^="/"]');
    if (!enlace) return;
    const href = enlace.getAttribute('href');
    if (href.startsWith('/#')) return;
    event.preventDefault();
    if (RUTAS[href]) mostrar(RUTAS[href]);
    else if (href.startsWith('/quedada/')) mostrar('quedada');
    else if (href.startsWith('/spot/')) mostrar('spot');
  });

  /* El tema: tres estados, igual que el original. Sin almacenamiento, porque
     una preferencia guardada en una copia estática no lleva a ningún sitio. */
  const ESTADOS = [
    ['system', 'Tema: sistema'],
    ['light', 'Tema: claro'],
    ['dark', 'Tema: oscuro'],
  ];
  let actual = 0;
  const boton = document.getElementById('tema');
  const texto = document.getElementById('tema-texto');
  boton?.addEventListener('click', () => {
    actual = (actual + 1) % ESTADOS.length;
    const [valor, etiqueta] = ESTADOS[actual];
    if (valor === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', valor);
    texto.textContent = etiqueta;
  });
})();
</script>`;

await writeFile(OUT, document_, 'utf8');

const kb = (Buffer.byteLength(document_) / 1024).toFixed(0);
console.log(`✓ ${pages.length} rutas, ${fontCount} tipografías incrustadas, ${kb} KB → artifacts/petnav-web.html`);
