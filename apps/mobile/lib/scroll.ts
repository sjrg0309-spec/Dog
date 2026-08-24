/**
 * El desplazamiento como fuente de verdad del cromo.
 *
 * Hasta ahora la barra sabía una sola cosa del scroll: si estaba en cero o no,
 * con un `useState` que se actualizaba en el hilo de JavaScript. Eso da un
 * cambio de estado —línea sí, línea no— y encima llega tarde: mientras el dedo
 * arrastra, JavaScript está ocupado dibujando tarjetas, así que el cromo
 * reacciona a tirones.
 *
 * Aquí el desplazamiento es un **valor compartido** que vive en el hilo de la
 * interfaz. Lo que se deriva de él —la línea de la barra, el título que se
 * recoge, la barra de pestañas que se condensa— se calcula ahí mismo, sesenta
 * veces por segundo, pase lo que pase en JavaScript. Es la diferencia entre una
 * interfaz que responde y una que va detrás del dedo.
 *
 * ## Condensar y no esconder
 *
 * Instagram esconde la barra de pestañas al bajar. Aquí se **condensa**: pierde
 * los rótulos y baja de 72 a 52 puntos, pero no se va. Dos razones, y la
 * segunda es la que decide:
 *
 *  1. Esta aplicación tiene una pestaña de emergencia. Una barra que se
 *     esconde mientras alguien lee el feed es un botón de SOS que hay que
 *     buscar con un gesto antes de poder pulsarlo.
 *  2. Un control que desaparece obliga a un gesto previo —subir— para volver a
 *     usarlo, y ese gesto no lo conoce quien no lo ha visto desaparecer.
 *
 * Lo que se gana con el sitio es lo mismo: casi treinta puntos de alto vuelven
 * al contenido en cuanto se empieza a leer.
 */

import { useCallback } from 'react';
import {
  makeMutable,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Cuánto está condensado el cromo: 0 entero, 1 al mínimo.
 *
 * Es global —`makeMutable` y no un gancho— porque lo escribe la pantalla que se
 * desplaza y lo lee la barra de pestañas, que vive en otro árbol de React. Un
 * contexto habría servido, pero cruzaría el hilo de JavaScript en cada
 * fotograma, que es justo lo que este módulo existe para evitar.
 */
export const chromeCondensed = makeMutable(0);

/** El muelle del cromo: sin rebote. Una barra que oscila parece rota. */
const CHROME_SPRING = { damping: 30, stiffness: 220, mass: 0.8 };

/**
 * A partir de dónde se empieza a condensar.
 *
 * No es cero: con el umbral en el borde, el rebote elástico de iOS al llegar
 * arriba condensaba la barra por un movimiento que el dedo no ha hecho.
 */
const START_AT = 40;

/** Cuánto tiene que moverse el dedo para que cuente como intención. */
const INTENT = 8;

export type ScrollDriver = {
  /** Desplazamiento actual, en el hilo de la interfaz. */
  scrollY: SharedValue<number>;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
};

export function useScrollDriver(): ScrollDriver {
  const scrollY = useSharedValue(0);
  const anchor = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const delta = y - anchor.value;
      scrollY.value = y;

      if (y <= START_AT) {
        // Arriba del todo el cromo siempre está entero, se haya venido como se
        // haya venido. Es el estado que ve quien abre la pantalla.
        anchor.value = y;
        chromeCondensed.value = withSpring(0, CHROME_SPRING);
        return;
      }

      if (delta > INTENT) {
        anchor.value = y;
        chromeCondensed.value = withSpring(1, CHROME_SPRING);
      } else if (delta < -INTENT) {
        anchor.value = y;
        chromeCondensed.value = withSpring(0, CHROME_SPRING);
      }
    },
  });

  return { scrollY, onScroll };
}

/**
 * Devolver el cromo a su sitio.
 *
 * Lo llama quien cambia de pantalla o de pestaña: llegar a una pantalla nueva
 * con la barra condensada por el scroll de la anterior es heredar un estado que
 * no se ha provocado aquí.
 */
export function useResetChrome(): () => void {
  return useCallback(() => {
    chromeCondensed.value = withSpring(0, CHROME_SPRING);
  }, []);
}
