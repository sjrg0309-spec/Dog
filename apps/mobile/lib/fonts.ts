/**
 * Tipografía de la aplicación móvil.
 *
 * Son las mismas dos familias que la web, y por la misma razón:
 *
 *  - **Atkinson Hyperlegible** para el cuerpo, diseñada para legibilidad en baja
 *    visión. No es una elección estética: esta aplicación se lee de pie, en la
 *    calle, a contraluz y con una correa en la otra mano. Es justo la situación
 *    para la que se hizo esa fuente.
 *  - **Bricolage Grotesque** para los titulares, con carácter suficiente para
 *    que la aplicación no parezca una plantilla.
 *
 * Inter no aparece por decisión explícita.
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

export const FONT_MAP = {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
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
  displaySemibold: 'BricolageGrotesque_600SemiBold',
  displayBold: 'BricolageGrotesque_700Bold',
  displayExtrabold: 'BricolageGrotesque_800ExtraBold',
} as const;
