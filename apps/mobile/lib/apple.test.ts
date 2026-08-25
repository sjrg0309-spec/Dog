/**
 * Lo que hace que esto se sienta de la plataforma, comprobado en el código.
 *
 * Estas afirmaciones no miran píxeles: miran **el código fuente**. Son
 * comprobaciones de las que se pierden en silencio, y todas se perdieron ya una
 * vez —el marco de pantalla se escribió sin zonas seguras y nadie lo vio
 * durante semanas, porque en el navegador no hay barra de estado que esquivar y
 * todas las capturas salían bien—.
 *
 * Lo que se afirma sale de las guías de interfaz de la plataforma:
 *
 *  - **Zonas seguras.** «Respeta las zonas seguras definidas por el sistema»:
 *    son las que evitan la isla dinámica, la muesca y el indicador de inicio.
 *  - **Texto escalable.** «Asegúrate de que la gente puede ajustar el tamaño
 *    del texto», con la contrapartida de «prioriza el contenido importante»:
 *    los rótulos del cromo llevan tope, el contenido no.
 *  - **Tipografías propias.** «Si usas una tipografía propia, asegúrate de que
 *    implementa los mismos comportamientos» que las del sistema —en concreto,
 *    texto en negrita—.
 *  - **Materiales.** Un panel translúcido tiene que poder dejar de serlo cuando
 *    alguien activa «reducir transparencia».
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/* Igual que el test de ajustes: la raíz del paquete, que es desde donde
   corre Vitest. `import.meta` no está permitido con el módulo que compila
   esta aplicación. */
const ROOT = `${process.cwd()}/`;
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

describe('zonas seguras', () => {
  const ui = read('components/ui.tsx');

  it('el marco de pantalla las aplica, no las ignora', () => {
    /* Hasta la llave que cierra la función —en su propia línea—, no hasta la
       primera que aparezca: la de las propiedades desestructuradas llega antes
       y dejaba fuera el cuerpo entero, que es justo lo que hay que mirar. */
    const screen = /export function Screen\([\s\S]*?\n}\n/.exec(ui)?.[0] ?? '';
    expect(screen).not.toBe('');
    expect(screen).toContain('useSafeAreaInsets');
    expect(screen).toContain('paddingTop');
  });

  it('también aparta los costados, que es la muesca en horizontal', () => {
    const screen = /export function Screen\([\s\S]*?\n}\n/.exec(ui)?.[0] ?? '';
    expect(screen).toContain('insets.left');
    expect(screen).toContain('insets.right');
  });

  it('la barra de pestañas reserva el indicador de inicio', () => {
    expect(read('components/tab-bar.tsx')).toContain('insets.bottom');
  });

  it('una pantalla puede pedir ir a sangre, y el mapa lo pide', () => {
    expect(read('components/ui.tsx')).toContain('full?: boolean');
    expect(read('app/(tabs)/explorar.tsx')).toContain('<Screen full>');
  });

  it('nadie suma la zona segura dos veces', () => {
    /* El chat tenía su propia cuenta antes de que la tuviera el marco. Con las
       dos puestas, la cabecera bajaba cincuenta puntos de más. */
    expect(read('app/chat.tsx')).toContain('topInset={0}');
  });
});

describe('texto escalable', () => {
  it('los rótulos del cromo llevan tope y el contenido no', () => {
    const tabs = read('components/tab-bar.tsx');
    const chrome = read('components/chrome.tsx');
    expect(tabs).toContain('maxFontSizeMultiplier');
    expect(chrome).toContain('maxFontSizeMultiplier');
    /* El tope del cromo nunca es 1: eso sería no escalar nada, que es el otro
       fallo. Se deja crecer, con límite. */
    expect(tabs).toContain('LABEL_CAP = 1.2');
    expect(chrome).toContain('NAV_TITLE_CAP = 1.3');
  });

  it('las barras crecen con la letra en vez de recortarla', () => {
    for (const file of ['components/tab-bar.tsx', 'components/chrome.tsx']) {
      expect(read(file), file).toContain('PixelRatio.getFontScale()');
    }
  });

  it('el alto que reservan las pantallas se calcula, no se supone', () => {
    expect(read('components/tab-bar.tsx')).toContain('TAB_BAR_HEIGHT = barHeight(FULL)');
  });

  it('nada apaga el escalado por las bravas', () => {
    /* `allowFontScaling={false}` es la forma rápida de que un diseño deje de
       romperse y la forma segura de dejar fuera a quien no ve bien. */
    for (const file of [
      'components/ui.tsx',
      'components/tab-bar.tsx',
      'components/chrome.tsx',
      'components/post-card.tsx',
    ]) {
      expect(read(file), file).not.toContain('allowFontScaling={false}');
    }
  });
});

describe('preferencias del sistema', () => {
  const a11y = read('lib/a11y.ts');

  it('se leen las dos que faltaban, y se escuchan en caliente', () => {
    expect(a11y).toContain('isBoldTextEnabled');
    expect(a11y).toContain('isReduceTransparencyEnabled');
    expect(a11y).toContain('boldTextChanged');
    expect(a11y).toContain('reduceTransparencyChanged');
  });

  it('la tipografía propia obedece «texto en negrita»', () => {
    const fonts = read('lib/fonts.ts');
    expect(fonts).toContain('setBoldText');
    expect(fonts).toContain('bold ? set.bodyBold : set.body');
    expect(read('app/_layout.tsx')).toContain('useSystemBoldText');
  });

  it('el cristal deja de serlo con «reducir transparencia»', () => {
    const glass = read('components/glass.tsx');
    expect(glass).toContain('useReduceTransparency');
    /* Y el velo de una hoja no: ahí lo translúcido es el fondo oscurecido. */
    expect(glass).toContain("tone !== 'scrim'");
  });

  it('«reducir movimiento» sigue leyéndose donde ya estaba', () => {
    expect(read('lib/motion.ts')).toContain('reduceMotionChanged');
  });
});

describe('la dinámica', () => {
  const motion = read('components/motion.tsx');

  it('lo que se recoloca se ve recolocarse', () => {
    /* Cero transiciones de disposición en cuarenta y tres pantallas era lo que
       hacía que la aplicación se sintiera barata al tocarla: las tarjetas se
       teletransportaban a su sitio nuevo. */
    expect(motion).toContain('LinearTransition');
    expect(motion).toContain('export const reflow');
    /* Y va donde de verdad llega: `Appear` envuelve a casi todo lo que vive en
       una lista. */
    expect(motion).toContain('layout={reduced ? undefined : reflow}');
  });

  it('los contadores ruedan, y en la dirección del cambio', () => {
    expect(motion).toContain('export function Counter');
    expect(motion).toContain('direction.current = value > shown ? 1 : -1');
    expect(read('components/post-card.tsx')).toContain('<Counter');
  });

  it('el número que se va no lo anuncia el lector de pantalla', () => {
    /* Dos números apilados son un truco de dibujo, no dos valores: anunciarlos
       los dos diría «6 7» en voz alta. */
    expect(motion).toContain('accessibilityElementsHidden');
  });

  it('todo lo nuevo respeta movimiento reducido', () => {
    const counter = /export function Counter\([\s\S]*?\n}\n/.exec(motion)?.[0] ?? '';
    expect(counter).not.toBe('');
    expect(counter).toContain('useReducedMotion');
    expect(counter).toContain('if (reduced)');
  });
});
