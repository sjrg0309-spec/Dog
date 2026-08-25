/**
 * Ensambla el prototipo publicable.
 *
 * Une tres cosas que ya existen y no se reescriben aquí: los tokens de diseño
 * emitidos por `packages/tokens`, los resultados calculados por el algoritmo
 * real (`build-demo-data.mjs`) y la plantilla de la página. Así el prototipo no
 * puede divergir del producto por accidente: si cambia la paleta o cambia el
 * algoritmo, cambia la página en cuanto se vuelve a ejecutar.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const here = (path) => new URL(path, import.meta.url);

const tokens = readFileSync(here('../packages/tokens/dist/tokens.css'), 'utf8');

/**
 * Las tipografías, incrustadas.
 *
 * Son las mismas que usa la aplicación —Atkinson Hyperlegible para el cuerpo,
 * pensada para leerse de pie y a contraluz, y Plus Jakarta Sans para los
 * titulares— y viajan dentro del fichero en lugar de pedirse a un servidor.
 * Así la página se ve igual esté donde esté, y se puede comprobar aquí mismo
 * en vez de confiar en que el visor las cargue.
 */
const FONTS = [
  ['Atkinson Hyperlegible', 400, 'normal', '@expo-google-fonts+atkinson-hyperlegible@0.4.1/node_modules/@expo-google-fonts/atkinson-hyperlegible/400Regular/AtkinsonHyperlegible_400Regular.ttf'],
  ['Atkinson Hyperlegible', 700, 'normal', '@expo-google-fonts+atkinson-hyperlegible@0.4.1/node_modules/@expo-google-fonts/atkinson-hyperlegible/700Bold/AtkinsonHyperlegible_700Bold.ttf'],
  ['Plus Jakarta Sans', 600, 'normal', '@expo-google-fonts+plus-jakarta-sans@0.4.2/node_modules/@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf'],
  ['Plus Jakarta Sans', 800, 'normal', '@expo-google-fonts+plus-jakarta-sans@0.4.2/node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'],
];

const faces = FONTS.map(([family, weight, style, path]) => {
  const data = readFileSync(here(`../node_modules/.pnpm/${path}`)).toString('base64');
  return `@font-face {
  font-family: '${family}';
  font-weight: ${weight};
  font-style: ${style};
  font-display: swap;
  src: url(data:font/ttf;base64,${data}) format('truetype');
}`;
}).join('\n');
const data = readFileSync(here('../artifacts/demo-data.json'), 'utf8');
const template = readFileSync(here('demo-template.html'), 'utf8');

const html = template
  .replace('/* {{FONTS}} */', faces)
  .replace('/* {{TOKENS}} */', tokens)
  .replace('"{{DATA}}"', data);

writeFileSync(here('../artifacts/petnav-demo.html'), html);
console.log(`✓ prototipo escrito (${Math.round(html.length / 1024)} KB)`);
