/**
 * Tokens semánticos — nivel 2 de 3.
 *
 * La interfaz consume estos nombres, nunca los primitivos. Cambiar el tema es
 * reasignar este mapa; ningún componente debería necesitar tocarse.
 */

import { amber, blue, green, live, neutral, red, shadow } from './primitives.js';

export type SemanticTokens = {
  // Superficies
  background: string;
  foreground: string;
  surface: string;
  surfaceForeground: string;
  surfaceElevated: string;
  surfaceSunken: string;

  // Jerarquía de acción
  primary: string;
  primaryForeground: string;
  primaryHover: string;
  primaryActive: string;

  secondary: string;
  secondaryForeground: string;
  secondaryHover: string;
  secondaryActive: string;

  muted: string;
  mutedForeground: string;

  accent: string;
  accentForeground: string;

  /**
   * Estado "en vivo" del radar. Reservado: si este color aparece, algo está
   * ocurriendo ahora. Nunca se usa como decoración.
   */
  liveRing: string;
  liveSurface: string;
  liveForeground: string;

  // Estados
  destructive: string;
  destructiveForeground: string;
  destructiveHover: string;
  success: string;
  successForeground: string;
  successSurface: string;
  warning: string;
  warningForeground: string;
  warningSurface: string;
  information: string;
  informationForeground: string;
  informationSurface: string;

  // Bordes y controles
  border: string;
  borderStrong: string;
  input: string;
  inputForeground: string;
  inputPlaceholder: string;
  focusRing: string;
  overlay: string;

  // Elevación
  shadowSm: string;
  shadowMd: string;

  /** Sugerencia al navegador para los controles nativos. */
  colorScheme: 'light' | 'dark';
};

/**
 * Tema claro.
 *
 * Los pares de texto sobre fondo están elegidos para superar WCAG AA (4.5:1
 * para cuerpo, 3:1 para texto grande y elementos de interfaz). El test de
 * contraste del paquete los verifica; no son una estimación a ojo.
 */
export const light: SemanticTokens = {
  background: neutral[50],
  foreground: neutral[900],
  surface: neutral[0],
  surfaceForeground: neutral[900],
  surfaceElevated: neutral[0],
  surfaceSunken: neutral[100],

  primary: green[600],
  primaryForeground: neutral[0],
  primaryHover: green[700],
  primaryActive: green[800],

  secondary: neutral[100],
  secondaryForeground: neutral[800],
  secondaryHover: neutral[200],
  secondaryActive: neutral[300],

  muted: neutral[100],
  mutedForeground: neutral[600],

  accent: green[100],
  accentForeground: green[800],

  liveRing: live[600],
  liveSurface: live[50],
  liveForeground: live[800],

  destructive: red[600],
  destructiveForeground: neutral[0],
  destructiveHover: red[700],
  success: green[700],
  successForeground: neutral[0],
  successSurface: green[50],
  warning: amber[700],
  warningForeground: neutral[0],
  warningSurface: amber[100],
  information: blue[600],
  informationForeground: neutral[0],
  informationSurface: blue[100],

  border: neutral[200],
  borderStrong: neutral[500],
  input: neutral[0],
  inputForeground: neutral[900],
  inputPlaceholder: neutral[500],
  focusRing: green[600],
  overlay: 'oklch(21% 0.014 72 / 0.55)',

  shadowSm: shadow.sm,
  shadowMd: shadow.md,

  colorScheme: 'light',
};

/**
 * Tema oscuro.
 *
 * No es el claro invertido: los verdes suben en luminosidad y bajan en croma
 * para no vibrar sobre fondo oscuro, y las superficies se separan por
 * luminosidad porque la sombra casi no se percibe en oscuro.
 */
export const dark: SemanticTokens = {
  background: neutral[950],
  foreground: neutral[50],
  surface: neutral[900],
  surfaceForeground: neutral[50],
  surfaceElevated: neutral[800],
  surfaceSunken: neutral[950],

  primary: green[400],
  primaryForeground: green[900],
  primaryHover: green[300],
  primaryActive: green[200],

  secondary: neutral[800],
  secondaryForeground: neutral[100],
  secondaryHover: neutral[700],
  secondaryActive: neutral[600],

  muted: neutral[800],
  mutedForeground: neutral[400],

  accent: green[900],
  accentForeground: green[200],

  liveRing: live[400],
  liveSurface: live[900],
  liveForeground: live[200],

  destructive: red[400],
  destructiveForeground: neutral[950],
  destructiveHover: red[300],
  success: green[400],
  successForeground: green[900],
  successSurface: green[900],
  warning: amber[300],
  warningForeground: amber[900],
  warningSurface: amber[900],
  information: blue[300],
  informationForeground: blue[900],
  informationSurface: blue[900],

  border: neutral[800],
  borderStrong: neutral[500],
  input: neutral[900],
  inputForeground: neutral[50],
  inputPlaceholder: neutral[400],
  focusRing: green[300],
  overlay: 'oklch(10% 0.010 72 / 0.70)',

  shadowSm: '0 1px 2px oklch(0% 0 0 / 0.30)',
  shadowMd: '0 4px 14px oklch(0% 0 0 / 0.40)',

  colorScheme: 'dark',
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;
