/**
 * Las tres posiciones de la hoja: la parte que no dibuja nada.
 *
 * Va aparte del componente por la razón de siempre en este proyecto: es
 * aritmética que **se equivoca en silencio**. Una hoja que cae al sitio
 * equivocado no revienta, solo se siente rara —«la he soltado y ha vuelto»—, y
 * nadie sabe decir por qué. Con los números aquí se prueba con casos: un
 * arrastre largo y lento tiene que cambiarla de sitio, un latigazo corto
 * también, y un roce no.
 *
 * Todo se expresa en `translateY`: **0 es arriba del todo** y crece hacia
 * abajo. Es la coordenada en la que vive la animación, así que es la única
 * que no obliga a convertir en el hilo de la interfaz.
 */

export type SheetPosition = 'peek' | 'mid' | 'full';

/**
 * Cuánto del alto disponible ocupa la hoja en «medio»: la mitad. Es el punto
 * en el que una lista o una ficha se leen enteras y el mapa sigue siendo un
 * mapa y no una franja.
 */
export const SHEET_MID_RATIO = 0.5;

/**
 * Cuánto ocupa arriba del todo. No es 1 porque una hoja que llega al borde
 * deja de parecer una hoja: se lee como otra pantalla, y entonces la gente
 * busca un botón de volver que no existe. El 8 % que queda de mapa dice que
 * sigue ahí debajo.
 */
export const SHEET_FULL_RATIO = 0.92;

/** Los tres desplazamientos, más el alto total del que salen. */
export type SheetOffsets = {
  /** Arriba del todo: no se desplaza nada. */
  full: number;
  mid: number;
  peek: number;
  /** El alto de la hoja entera, que es el alto en `full`. */
  height: number;
};

/**
 * De un alto disponible y un asomo salen las tres posiciones.
 *
 * Cada posición es «cuánto hay que bajar la hoja para que asome lo que toca»,
 * así que las tres se calculan desde el alto total: restar lo que se quiere
 * ver. Redondear cada altura por separado —y no el resultado— evita que la
 * hoja quede a medio píxel y la sombra se vea borrosa contra el mapa.
 *
 * Se da por hecho que `peekHeight` es menor que la mitad del alto: es el
 * asa y dos filas, no media pantalla.
 */
export function detentOffsets({
  available,
  peekHeight,
}: {
  available: number;
  peekHeight: number;
}): SheetOffsets {
  const height = Math.round(available * SHEET_FULL_RATIO);
  return {
    full: 0,
    mid: height - Math.round(available * SHEET_MID_RATIO),
    peek: height - peekHeight,
    height,
  };
}

const POSITIONS: readonly SheetPosition[] = ['full', 'mid', 'peek'];

/**
 * A qué posición cae la hoja al soltarla.
 *
 * Se proyecta a dónde iría el dedo si siguiera frenando —un quinto de segundo
 * de inercia— y se elige la posición más cercana a **ese** punto, no al de
 * soltar. Elegir por la posición al soltar obliga a arrastrar media hoja para
 * cambiarla de sitio; elegir solo por la velocidad hace que un arrastre lento
 * y largo no haga nada. La proyección resuelve los dos casos con una sola
 * regla, y es lo que hacen las hojas del sistema.
 *
 * Con tres posiciones la regla no cambia: se sigue eligiendo la más cercana.
 * Lo que cambia es que un latigazo desde abajo puede saltarse «medio» y llegar
 * arriba, que es justo lo que se espera de un latigazo.
 */
export function settleDetent(y: number, velocityY: number, offsets: SheetOffsets): SheetPosition {
  const projected = y + velocityY * 0.2;
  let nearest: SheetPosition = 'full';
  let distance = Number.POSITIVE_INFINITY;
  for (const position of POSITIONS) {
    const gap = Math.abs(projected - offsets[position]);
    if (gap < distance) {
      distance = gap;
      nearest = position;
    }
  }
  return nearest;
}

/**
 * Cuántos píxeles de hoja se ven en una posición.
 *
 * Lo usa el mapa, no la hoja: cuando se elige un marcador y la hoja sube a
 * «medio» con su ficha, el mapa tiene que saber cuánto le queda para dejar el
 * marcador **por encima** de la hoja y no debajo de ella.
 */
export function visibleHeight(position: SheetPosition, offsets: SheetOffsets): number {
  return offsets.height - offsets[position];
}

/**
 * A dónde va el toque en el asa: sube de una en una y desde arriba vuelve al
 * mapa. Es el camino sin gesto —para quien navega con lector de pantalla— y
 * por eso tiene que pasar por las tres, no solo por los extremos.
 */
export function nextDetent(position: SheetPosition): SheetPosition {
  switch (position) {
    case 'peek':
      return 'mid';
    case 'mid':
      return 'full';
    case 'full':
      return 'peek';
  }
}
