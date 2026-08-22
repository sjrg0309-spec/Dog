/**
 * Emisión de CSS desde los tokens.
 *
 * Los tokens de TypeScript son la fuente única; este módulo los proyecta a
 * variables CSS. Web y React Native leen el mismo origen, así que no pueden
 * desincronizarse.
 */

import {
  breakpoint,
  duration,
  easing,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  measure,
  radius,
  space,
  touchTarget,
  zIndex,
} from './primitives.js';
import { dark, light, type SemanticTokens } from './semantic.js';

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function semanticVars(theme: SemanticTokens, indent: string): string {
  return Object.entries(theme)
    .map(([key, value]) =>
      key === 'colorScheme'
        ? `${indent}color-scheme: ${value};`
        : `${indent}--dm-${kebab(key)}: ${value};`,
    )
    .join('\n');
}

function scaleVars(prefix: string, scale: Record<string, string>, indent: string): string {
  return Object.entries(scale)
    .map(([key, value]) => `${indent}--dm-${prefix}-${kebab(key).replace('.', '_')}: ${value};`)
    .join('\n');
}

/**
 * Genera la hoja de tokens completa.
 *
 * El orden importa y sigue la regla de tema del proyecto:
 *   1. `:root` define la paleta clara completa — ningún color tiene su única
 *      definición dentro de una media query.
 *   2. `prefers-color-scheme: dark` la redefine, pero guardada con
 *      `:not([data-theme="light"])` para que una elección explícita del usuario
 *      gane sobre la del sistema.
 *   3. `[data-theme="dark"]` la redefine de nuevo, para que el conmutador gane
 *      en ambas direcciones.
 */
export function buildTokensCss(): string {
  const staticScales = [
    scaleVars('space', space, '  '),
    scaleVars('radius', radius, '  '),
    scaleVars('font-size', fontSize, '  '),
    scaleVars('font-weight', fontWeight, '  '),
    scaleVars('line-height', lineHeight, '  '),
    scaleVars('tracking', letterSpacing, '  '),
    scaleVars('measure', measure, '  '),
    scaleVars('duration', duration, '  '),
    scaleVars('easing', easing, '  '),
    scaleVars('z', zIndex, '  '),
    scaleVars('screen', breakpoint, '  '),
    scaleVars('touch', touchTarget, '  '),
    scaleVars('font', fontFamily, '  '),
  ].join('\n\n');

  return `/**
 * DoggyMeet — tokens de diseño.
 *
 * GENERADO por packages/tokens. No editar a mano: los cambios se pierden en el
 * siguiente build. La fuente está en packages/tokens/src.
 */

:root {
${staticScales}

  /* Semánticos — tema claro (base) */
${semanticVars(light, '  ')}
}

/* Preferencia del sistema, salvo que el usuario haya elegido claro a mano. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${semanticVars(dark, '    ')}
  }
}

/* Elección explícita del usuario: gana sobre el sistema en ambas direcciones. */
:root[data-theme='dark'] {
${semanticVars(dark, '    ')}
}

:root[data-theme='light'] {
${semanticVars(light, '    ')}
}
`;
}
