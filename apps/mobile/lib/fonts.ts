/**
 * Tipografía de la aplicación móvil.
 *
 * Aquí ya no hay una pareja fija de familias: hay **tres**, una por dirección
 * visual, y la que manda sale de `lib/direcciones`.
 *
 *  - **Nocturno** — Plus Jakarta Sans en todo. Geométrica y neutra: la letra se
 *    aparta para que mande la foto, que es la tesis de esa dirección.
 *  - **Papel** — Bricolage Grotesque en los titulares y Atkinson Hyperlegible
 *    en el cuerpo. Bricolage es una grotesca con manías, y es lo que hace que
 *    una pantalla sin una sola foto siga teniendo cara.
 *  - **Señal** — Atkinson Hyperlegible en todo, titulares incluidos. Está
 *    dibujada para baja visión —distingue la l de la I y el 0 del O— y esta
 *    aplicación se lee de pie, a contraluz y con una correa en la otra mano.
 *
 * En ninguna de las tres aparece Inter, que sigue en la lista de bloqueantes
 * del proyecto desde el primer día.
 *
 * **Por qué `fonts` es un objeto con captadores y no uno normal.** Hay 324 usos
 * de `fonts.body` y compañía repartidos por cuarenta y tres ficheros. Pasarlos
 * todos por el tema para poder cambiar de familia sería un refactor enorme con
 * mucho sitio donde equivocarse; con captadores, cada lectura devuelve la
 * familia de la dirección activa y **no hay que tocar ni una llamada**. El
 * repintado lo provoca `useTheme`, del que ya cuelga cualquier componente con
 * estilos: al cambiar de dirección se vuelve a renderizar y en ese momento
 * `fonts.body` ya devuelve otra cosa.
 */

import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { DIRECTIONS, readDirection, type FontSet } from './direcciones';

/**
 * Todo lo que carga `useFonts` al arrancar.
 *
 * Se cargan las nueve de las tres direcciones y no solo las de la activa: son
 * unos cientos de kilobytes que ya viajan en el paquete, y cargarlas a demanda
 * significaría que cambiar de dirección en ajustes enseña medio segundo de
 * tipografía del sistema. Un cambio de dirección tiene que ser instantáneo o no
 * se puede comparar.
 */
export const FONT_MAP = {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

/**
 * Nombres de familia por uso.
 *
 * En React Native el peso no se aplica con `fontWeight` cuando se cargan
 * fuentes por archivo: hay que nombrar la variante concreta. Por eso se exponen
 * así, en lugar de dejar que cada pantalla adivine.
 */
/*
 * «Texto en negrita» del sistema, en una variable de módulo.
 *
 * No puede ser un hook porque `fonts` no es un componente: lo lee cualquier
 * hoja de estilos de la aplicación. Lo pone `app/_layout.tsx`, que sí es un
 * componente y sí puede suscribirse, y como el repintado ya lo provoca ese
 * mismo cambio de estado, para cuando alguien vuelve a leer `fonts.body` aquí
 * ya está el valor nuevo.
 */
let bold = false;

export function setBoldText(on: boolean): void {
  bold = on;
}

export const fonts: FontSet = {
  get body() {
    /* La preferencia de la plataforma, cumplida a mano.
       Una tipografía del sistema engorda sola con este ajuste; una cargada por
       fichero se queda como está, así que aquí el cuerpo pasa a su negrita. */
    const set = DIRECTIONS[readDirection()].fonts;
    return bold ? set.bodyBold : set.body;
  },
  get bodyBold() {
    return DIRECTIONS[readDirection()].fonts.bodyBold;
  },
  get displaySemibold() {
    return DIRECTIONS[readDirection()].fonts.displaySemibold;
  },
  get displayBold() {
    return DIRECTIONS[readDirection()].fonts.displayBold;
  },
  get displayExtrabold() {
    return DIRECTIONS[readDirection()].fonts.displayExtrabold;
  },
};
