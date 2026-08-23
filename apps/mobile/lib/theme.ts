/**
 * Puente entre los tokens y React Native.
 *
 * Los componentes de interfaz no se comparten entre la web y el móvil —Tailwind
 * y shadcn/ui no corren en React Native, y prometer lo contrario sería falso—,
 * pero los **valores** sí. Este módulo traduce los mismos tokens a lo que
 * entiende React Native: hexadecimales en lugar de OKLCH y números en lugar de
 * cadenas con `px`.
 */

import { useColorScheme } from 'react-native';

import {
  dark as darkTokens,
  light as lightTokens,
  themeToHex,
  type SemanticTokens,
} from '@coincide/tokens';

export const lightColors = themeToHex(lightTokens as unknown as Record<string, string>) as unknown as SemanticTokens;
export const darkColors = themeToHex(darkTokens as unknown as Record<string, string>) as unknown as SemanticTokens;

/**
 * Espaciado en números.
 *
 * React Native no acepta `'16px'`, solo `16`. Se replican los mismos pasos que
 * el token en lugar de inventar otra escala.
 */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

/**
 * Radios. Mismos pasos que el token de la web.
 *
 * `lg` y `xl` viven en la franja de 16 a 24 px que pide la especificación
 * visual. Los controles pequeños se quedan por debajo: 20 px de radio en un chip
 * de 32 px de alto lo convierte en una pastilla y borra la jerarquía.
 */
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  '2xl': 32,
  full: 9999,
} as const;

/**
 * Tamaños de texto.
 *
 * Aquí no hay `clamp()`: en móvil el ancho no varía lo suficiente como para que
 * un tamaño fluido aporte algo, así que se fija el extremo inferior de la escala
 * de la web. Nada baja de 16 px en el cuerpo.
 *
 * `base` es 17 y no 16 porque es el tamaño de cuerpo por defecto que pide la
 * guía de interfaz de la plataforma para móvil, y el mínimo legible que fija son
 * 11. Un punto de más no se nota al mirarlo y sí al leer una ficha de pie en la
 * calle, que es donde se usa esto.
 */
export const fontSize = {
  /**
   * El suelo, y el escalón que faltaba.
   *
   * Apple lo llama Caption 2 y Material `labelSmall`: las dos plataformas lo
   * ponen en once y las dos dicen que por debajo no se baja. Faltaba en esta
   * escala, así que cada vez que hacía falta un rótulo diminuto —la hora de un
   * mensaje, un contador, la atribución del mapa— alguien escribía el número a
   * mano. Veintitrés sitios, cada uno decidido por su cuenta. Un escalón que no
   * existe en la escala no se salta: se improvisa.
   */
  '2xs': 11,
  xs: 12,
  sm: 15,
  base: 17,
  lg: 19,
  xl: 22,
  '2xl': 26,
  '3xl': 32,
  /** Título grande de cabecera, el que se encoge al desplazar. */
  '4xl': 38,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/**
 * Área táctil mínima. 44 es el suelo, no el objetivo.
 *
 * `floating` es el botón de acción flotante, y su tamaño tiene motivo: se pulsa
 * con una mano mientras la otra lleva la correa, a veces con guantes y a veces
 * andando.
 */
export const touchTarget = { min: 44, comfortable: 48, floating: 64 } as const;

export type Theme = {
  colors: SemanticTokens;
  isDark: boolean;
  space: typeof space;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  touchTarget: typeof touchTarget;
};

/**
 * Tema activo según la preferencia del sistema.
 *
 * `useColorScheme` puede devolver `null` mientras el sistema no ha resuelto la
 * preferencia; se cae a claro en lugar de parpadear.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
    space,
    radius,
    fontSize,
    fontWeight,
    touchTarget,
  };
}
