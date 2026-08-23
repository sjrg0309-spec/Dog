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

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

/**
 * Tamaños de texto.
 *
 * Aquí no hay `clamp()`: en móvil el ancho no varía lo suficiente como para que
 * un tamaño fluido aporte algo, así que se fija el extremo inferior de la escala
 * de la web. Nada baja de 16 px en el cuerpo.
 */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 21,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/** Área táctil mínima. 44 es el suelo, no el objetivo. */
export const touchTarget = { min: 44, comfortable: 48 } as const;

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
