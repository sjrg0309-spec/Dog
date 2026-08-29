/**
 * El relieve: las dos luces convertidas en estilo.
 *
 * La dirección «Relieve» dibuja la interfaz con una sola fuente de luz fija
 * arriba a la izquierda. De ahí salen exactamente dos gestos, y no hay un
 * tercero:
 *
 *  - **Sobresale** lo que se puede tocar y todavía no se ha tocado: una
 *    tarjeta, un botón en reposo, una ficha de icono. Brillo por el canto de
 *    arriba, sombra por el de abajo.
 *  - **Se hunde** lo que recibe algo: un campo de texto, un botón mientras el
 *    dedo está encima, la pestaña que está puesta. Las mismas dos luces por
 *    dentro y del revés.
 *
 * Que sean **las mismas dos luces invertidas** y no dos parejas distintas es lo
 * que hace que la pantalla parezca una sola pieza de material y no un montón de
 * recortes: la luz viene de un sitio, y todo lo demás se deduce.
 *
 * ## Por qué esto devuelve `{}` en las otras tres direcciones
 *
 * Las pantallas no preguntan «¿qué dirección hay puesta?». Piden el relieve y
 * lo extienden en su estilo; en «Nocturno», «Papel» y «Señal» lo que reciben es
 * un objeto vacío y se quedan exactamente como estaban. Es lo que permite que
 * una dirección entera se aplique a veintitantas pantallas sin editarlas: la
 * condición vive aquí, en un sitio, y no repartida en veintitantos `if`.
 *
 * ## Por qué `boxShadow` y no `shadowOffset`
 *
 * Las propiedades `shadow*` de React Native solo aceptan **una** sombra, y el
 * relieve necesita dos a la vez —brillo y sombra— sobre la misma vista. Con
 * ellas habría que anidar una vista dentro de otra en cada tarjeta de la
 * aplicación. `boxShadow` acepta la lista entera en una sola declaración, es lo
 * que la nueva arquitectura de React Native admite desde la 0.76, y en web es
 * literalmente la propiedad de CSS.
 */

import { type ViewStyle } from 'react-native';

import { useTheme } from './theme';

/**
 * Cuánto sobresale o se hunde.
 *
 * Tres pasos y no una escala continua, por la misma razón que el espaciado es
 * una escala: con un número libre por componente, dos tarjetas hermanas acaban
 * a 6 y a 7 y la pantalla se ve mal sin que nadie sepa decir dónde.
 *
 *  - `sm` es lo pequeño que se toca —una ficha de icono, un chip, una pastilla—.
 *  - `md` es la pieza normal: una tarjeta, un grupo de lista, un botón.
 *  - `lg` es lo que flota de verdad: una hoja, el botón de acción.
 */
export type Depth = 'sm' | 'md' | 'lg';

/* La distancia y el desenfoque van de la mano: una sombra que se aleja sin
   difuminarse más deja un borde duro, que es justo lo contrario del efecto. */
const STEPS: Record<Depth, { distance: number; blur: number }> = {
  sm: { distance: 2, blur: 5 },
  md: { distance: 5, blur: 11 },
  lg: { distance: 9, blur: 20 },
};

export type Relief = {
  /** Si la dirección activa se dibuja con luz. Casi nadie debería mirarlo. */
  on: boolean;
  /** Lo que sobresale del fondo. */
  raised: (depth?: Depth) => ViewStyle;
  /** Lo que se hunde en él. */
  pressed: (depth?: Depth) => ViewStyle;
};

const NONE: ViewStyle = {};

export function useRelief(): Relief {
  const relief = useTheme().direction.relief;
  const theme = useTheme();
  const lights = relief?.[theme.isDark ? 'dark' : 'light'];

  if (!lights) {
    return { on: false, raised: () => NONE, pressed: () => NONE };
  }

  return {
    on: true,
    raised: (depth = 'md') => {
      const { distance, blur } = STEPS[depth];
      /* El brillo primero: en una lista de sombras, la primera se dibuja
         encima, y lo que tiene que ganar en el canto de arriba es la luz. */
      return {
        boxShadow: `-${distance}px -${distance}px ${blur}px ${lights.light}, ${distance}px ${distance}px ${blur}px ${lights.dark}`,
      };
    },
    pressed: (depth = 'md') => {
      const { distance, blur } = STEPS[depth];
      /* Hundido es lo mismo del revés y por dentro: la sombra cae ahora en el
         canto de arriba, que es lo que el ojo lee como «esto tiene fondo». */
      return {
        boxShadow: `inset ${distance}px ${distance}px ${blur}px ${lights.dark}, inset -${distance}px -${distance}px ${blur}px ${lights.light}`,
      };
    },
  };
}
