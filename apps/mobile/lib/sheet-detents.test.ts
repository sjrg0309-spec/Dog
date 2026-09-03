/**
 * Las posiciones de la hoja.
 *
 * Una hoja que cae al sitio equivocado no rompe nada: se siente rara y nadie
 * sabe decir por qué. Es el tipo de fallo que no aparece en una captura y sí
 * en la calle, así que se comprueba con números: cada gesto que la gente hace
 * de verdad —arrastrar despacio, dar un latigazo, rozar sin querer— tiene una
 * posición esperada.
 */

import { describe, expect, it } from 'vitest';

import {
  detentOffsets,
  nextDetent,
  settleDetent,
  SHEET_FULL_RATIO,
  SHEET_MID_RATIO,
  visibleHeight,
} from './sheet-detents.js';

/* Un teléfono corriente: 800 de alto y el asomo de la pantalla de explorar. */
const OFFSETS = detentOffsets({ available: 800, peekHeight: 164 });

describe('los desplazamientos', () => {
  it('van de arriba abajo: full < mid < peek', () => {
    // Es la única propiedad que hace falta para que el arrastre tenga sentido:
    // subir el dedo tiene que llevar siempre a una posición más alta.
    expect(OFFSETS.full).toBe(0);
    expect(OFFSETS.full).toBeLessThan(OFFSETS.mid);
    expect(OFFSETS.mid).toBeLessThan(OFFSETS.peek);
    expect(OFFSETS.peek).toBeLessThan(OFFSETS.height);
  });

  it('salen de las proporciones publicadas', () => {
    expect(OFFSETS.height).toBe(Math.round(800 * SHEET_FULL_RATIO));
    expect(visibleHeight('mid', OFFSETS)).toBe(Math.round(800 * SHEET_MID_RATIO));
  });

  it('son enteros', () => {
    // A medio píxel la sombra sale borrosa contra el mapa.
    for (const value of [OFFSETS.full, OFFSETS.mid, OFFSETS.peek, OFFSETS.height]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('lo que se ve', () => {
  it('abajo se ve exactamente el asomo', () => {
    // Es lo que promete el nombre: `peekHeight` es lo que asoma, ni un píxel
    // más. El mapa coloca sus botones flotantes contando con ese número.
    expect(visibleHeight('peek', OFFSETS)).toBe(164);
  });

  it('arriba se ve la hoja entera', () => {
    expect(visibleHeight('full', OFFSETS)).toBe(OFFSETS.height);
  });
});

describe('a dónde cae al soltar', () => {
  it('sin velocidad, a la más cercana', () => {
    expect(settleDetent(OFFSETS.full + 10, 0, OFFSETS)).toBe('full');
    expect(settleDetent(OFFSETS.mid - 10, 0, OFFSETS)).toBe('mid');
    expect(settleDetent(OFFSETS.peek - 10, 0, OFFSETS)).toBe('peek');
  });

  it('un roce no la mueve', () => {
    // Coger la hoja y soltarla casi en el mismo sitio tiene que dejarla donde
    // estaba: si no, cada toque torpe en la lista la cambia de posición.
    expect(settleDetent(OFFSETS.peek - 30, 0, OFFSETS)).toBe('peek');
    expect(settleDetent(OFFSETS.mid + 30, 0, OFFSETS)).toBe('mid');
  });

  it('un arrastre lento y largo pasado el punto medio la cambia', () => {
    // Sin velocidad, así que sólo cuenta dónde se suelta. Es el gesto de quien
    // va andando: despacio, pero con intención.
    const halfway = (OFFSETS.mid + OFFSETS.peek) / 2;
    expect(settleDetent(halfway + 20, 0, OFFSETS)).toBe('peek');
    expect(settleDetent(halfway - 20, 0, OFFSETS)).toBe('mid');

    const upperHalf = (OFFSETS.full + OFFSETS.mid) / 2;
    expect(settleDetent(upperHalf - 20, 0, OFFSETS)).toBe('full');
    expect(settleDetent(upperHalf + 20, 0, OFFSETS)).toBe('mid');
  });

  it('un latigazo desde abajo llega a medio, y uno fuerte, arriba', () => {
    // Apenas se ha movido el dedo —veinte píxeles— pero va rápido. Elegir por
    // la posición al soltar lo dejaría abajo, y es justo el gesto que más se
    // hace: tirar de la lista hacia arriba sin mirar.
    expect(settleDetent(OFFSETS.peek - 20, -1500, OFFSETS)).toBe('mid');
    expect(settleDetent(OFFSETS.peek - 20, -4000, OFFSETS)).toBe('full');
  });

  it('un latigazo desde arriba baja, y uno fuerte, hasta abajo', () => {
    expect(settleDetent(OFFSETS.full + 20, 1500, OFFSETS)).toBe('mid');
    expect(settleDetent(OFFSETS.full + 20, 4000, OFFSETS)).toBe('peek');
  });

  it('la velocidad puede deshacer un arrastre', () => {
    // Se arrastra la hoja hasta casi arriba y se suelta empujando hacia
    // abajo: la inercia manda y no se queda arriba. Es lo que hacen las hojas
    // del sistema, y lo que se espera al «devolver» algo que se cogió por
    // error.
    expect(settleDetent(OFFSETS.full + 40, 1200, OFFSETS)).toBe('mid');
  });

  it('proyectar fuera del recorrido no rompe nada', () => {
    // La proyección puede pasarse por arriba o por abajo; la más cercana sigue
    // siendo un extremo.
    expect(settleDetent(OFFSETS.full, -9000, OFFSETS)).toBe('full');
    expect(settleDetent(OFFSETS.peek, 9000, OFFSETS)).toBe('peek');
  });
});

describe('el toque en el asa', () => {
  it('sube de una en una y desde arriba vuelve al mapa', () => {
    // Pasa por las tres: es el único camino para quien no puede arrastrar, y
    // un ciclo que se saltara «medio» dejaría esa posición sin acceso.
    expect(nextDetent('peek')).toBe('mid');
    expect(nextDetent('mid')).toBe('full');
    expect(nextDetent('full')).toBe('peek');
  });

  it('tres toques devuelven al principio', () => {
    expect(nextDetent(nextDetent(nextDetent('peek')))).toBe('peek');
  });
});
