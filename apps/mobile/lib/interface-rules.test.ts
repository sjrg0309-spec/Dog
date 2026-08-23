/**
 * Las reglas de interfaz de las plataformas, como prueba.
 *
 * Apple, Google y Meta coinciden en dos números, y son los dos que se rompen
 * solos según crece una aplicación:
 *
 *  1. **Nada de texto por debajo de 11 pt.** Es el mínimo que fija la guía de
 *     interfaz humana de Apple para móvil, y Material lo sitúa en el mismo
 *     sitio con su estilo `labelSmall`. Por debajo, un rótulo deja de leerse
 *     para quien no tiene veinte años de vista, y es justo el sitio donde se
 *     mete lo que «no importa tanto»: la hora de un mensaje, un contador, una
 *     atribución.
 *  2. **Nada que se toque por debajo de 44 pt.** Apple pide 44 × 44 y Material
 *     48 × 48; se toma el más laxo de los dos como suelo, que es el que ambos
 *     cumplen. Un control de treinta píxeles se ve bien en una captura y se
 *     falla con el dedo, sobre todo andando por la calle, que es donde se usa
 *     esto.
 *
 * **Por qué esto es un test y no una revisión.** Las dos reglas se incumplen de
 * una en una y nunca a propósito: alguien baja un rótulo a diez para que quepa
 * en una línea, y tiene razón —cabe— y la pantalla se ve mejor. El daño no se
 * ve en la captura, se ve en el uso, y para entonces hay cuarenta sitios así.
 * Un repaso a ojo encuentra los de esa semana; una regla los encuentra todos y
 * los sigue encontrando.
 *
 * **Lo que esta regla no ve, y conviene no fingir que sí.** Sólo mide controles
 * con un tamaño escrito en números. Un `Pressable` que crece por su relleno
 * —lo más común— pasa sin que se compruebe nada, porque el alto sale del texto
 * de dentro y del tipo de letra del sistema, y eso no está en el código. Es una
 * red que atrapa la clase de fallo más frecuente, no todas.
 *
 * **La excepción está prevista y es explícita.** Un control puede verse pequeño
 * —un chip de filtro mide 32 de alto en Material— siempre que su **área táctil**
 * llegue a 44, y en React Native eso se hace con `hitSlop`. Así que la regla no
 * es «todo mide 44», es «todo se puede tocar en 44», que es lo que dice la guía
 * de verdad.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Mínimo de tamaño de texto, en puntos. */
const MIN_FONT_SIZE = 11;

/** Mínimo de área táctil, en puntos. */
const MIN_TOUCH_TARGET = 44;

/* `process.cwd()` y no `import.meta.url`: el `tsconfig` de la aplicación
   compila a un módulo que no admite `import.meta`, y vitest arranca desde la
   raíz del paquete, así que apunta al mismo sitio. */
const ROOT = `${process.cwd()}/`;

function sources(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.tsx')) found.push(full);
    }
  };
  walk(join(ROOT, 'app'));
  walk(join(ROOT, 'components'));
  return found.sort();
}

const relative = (path: string) => path.slice(ROOT.length);

describe('tamaño de texto', () => {
  it('ningún rótulo baja de 11 pt', () => {
    const offenders: string[] = [];
    for (const file of sources()) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          const match = /fontSize:\s*(\d+)\b/.exec(line);
          if (match && Number(match[1]) < MIN_FONT_SIZE) {
            offenders.push(`${relative(file)}:${index + 1} → ${match[1]} pt`);
          }
        });
    }
    expect(offenders, `Texto por debajo de ${MIN_FONT_SIZE} pt:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });
});

describe('área táctil', () => {
  it('todo lo que se toca llega a 44 pt, con o sin hitSlop', () => {
    const offenders: string[] = [];

    for (const file of sources()) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (!line.includes('<Pressable')) return;

        /* El bloque de propiedades del `Pressable`: desde la etiqueta hasta que
           se cierra. Cuarenta y cinco líneas de tope porque alguno lleva un
           estilo largo, y porque leer más metería dentro los hijos. */
        const block = lines.slice(index, index + 45);
        const end = block.findIndex((candidate, offset) => offset > 0 && /^\s*\/?>\s*$/.test(candidate));
        const props = block.slice(0, end === -1 ? block.length : end + 1).join('\n');

        const dimension = (key: string): number | null => {
          const match = new RegExp(`\\b${key}:\\s*(\\d+)\\b`).exec(props);
          return match ? Number(match[1]) : null;
        };

        /* `hitSlop` amplía el área táctil sin tocar el dibujo, que es la salida
           que da la propia guía para un control que tiene que verse pequeño.
           Se admite en número —se reparte a los cuatro lados— o en objeto. */
        const slopNumber = /hitSlop=\{(\d+)\}/.exec(props);
        const slopVertical = /hitSlop=\{\{[^}]*?(?:top|vertical):\s*(\d+)/.exec(props);
        const slopHorizontal = /hitSlop=\{\{[^}]*?(?:left|horizontal):\s*(\d+)/.exec(props);
        const padVertical = Number(slopNumber?.[1] ?? slopVertical?.[1] ?? 0) * 2;
        const padHorizontal = Number(slopNumber?.[1] ?? slopHorizontal?.[1] ?? 0) * 2;

        const height = dimension('minHeight') ?? dimension('height');
        const width = dimension('minWidth') ?? dimension('width');

        const short: string[] = [];
        if (height !== null && height + padVertical < MIN_TOUCH_TARGET) {
          short.push(`alto ${height}${padVertical ? ` + ${padVertical} de hitSlop` : ''}`);
        }
        if (width !== null && width + padHorizontal < MIN_TOUCH_TARGET) {
          short.push(`ancho ${width}${padHorizontal ? ` + ${padHorizontal} de hitSlop` : ''}`);
        }
        if (short.length > 0) {
          offenders.push(`${relative(file)}:${index + 1} → ${short.join(', ')}`);
        }
      });
    }

    expect(
      offenders,
      `Controles por debajo de ${MIN_TOUCH_TARGET} pt de área táctil:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
