/**
 * Tipografía de la aplicación móvil.
 *
 * Son las mismas dos familias que la web, y el reparto no es estético:
 *
 *  - **Plus Jakarta Sans** para titulares y etiquetas de interfaz. Es la familia
 *    que pide la especificación visual. De las dos que nombra —Plus Jakarta Sans
 *    o Inter— se toma esta, porque Inter está en la lista de bloqueantes del
 *    proyecto desde el primer día.
 *  - **Atkinson Hyperlegible** para el cuerpo, diseñada para legibilidad en baja
 *    visión. El texto largo de esta aplicación —los pasos de una alerta, la
 *    ficha médica— se lee de pie, en la calle, a contraluz y con una correa en
 *    la otra mano. Es justo la situación para la que se hizo esa fuente.
 */

import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

export const FONT_MAP = {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

/**
 * Nombres de familia por uso.
 *
 * En React Native el peso no se aplica con `fontWeight` cuando se cargan fuentes
 * por archivo: hay que nombrar la variante concreta. Por eso se exponen así, en
 * lugar de dejar que cada pantalla adivine.
 */
export const fonts = {
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
  displaySemibold: 'PlusJakartaSans_600SemiBold',
  displayBold: 'PlusJakartaSans_700Bold',
  displayExtrabold: 'PlusJakartaSans_800ExtraBold',
} as const;
