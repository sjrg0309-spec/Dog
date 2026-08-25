/**
 * Tokens semánticos — nivel 2 de 3.
 *
 * La interfaz consume estos nombres, nunca los primitivos. Cambiar el tema es
 * reasignar este mapa; ningún componente debería necesitar tocarse.
 */

import { amber, blue, bone, ink, red, sage, shadow, terracotta } from './primitives.js';

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

  /**
   * La banda de referencia de un gráfico: lo declarado, lo previsto, el techo.
   *
   * Es un neutro y **tiene que leerse como neutro**, porque no es una segunda
   * serie: es contra qué se compara la que sí lo es. Vive aquí y no como un
   * hexadecimal dentro de una pantalla por lo mismo que la escala tipográfica
   * vive en un solo sitio — un color de gráfico escrito a mano en un
   * componente es el primero de cinco que no casan.
   *
   * Sus dos pasos están elegidos midiendo, no a ojo: llegan a 3:1 contra su
   * superficie —una banda que no se ve convierte un día sin salir en un hueco
   * en blanco, que es justo el dato que había que enseñar— y se separan del
   * primario lo suficiente para distinguirse con y sin visión cromática
   * normal. Un test lo comprueba en los dos temas.
   */
  chartTrack: string;

  /**
   * El halo de actividad del mapa: cuánta gente hay en un sitio ahora.
   *
   * Es cálido y el resto del mapa es frío, y eso no es gusto: sobre un parque
   * verde, un halo verde se lee como **más parque**. El primer intento lo puso
   * en el color de «en vivo» —que semánticamente era lo correcto— y en la
   * captura salió una papilla de dos verdes. Medirlo desmintió el diagnóstico
   * fácil: la distancia entre los dos tokens era 0,230, muy por encima del
   * mínimo del proyecto. Lo que se confundía no eran los colores sino **dos
   * discos translúcidos apilados**, así que el halo pasó a sustituir el relleno
   * del parque en vez de sumarse a él, y de paso a un matiz que ningún terreno
   * tiene.
   */
  mapHeat: string;

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
  background: bone[50],
  foreground: ink[800],
  surface: bone[0],
  surfaceForeground: ink[800],
  surfaceElevated: bone[0],
  surfaceSunken: bone[100],

  primary: sage[600],
  primaryForeground: bone[0],
  primaryHover: sage[700],
  primaryActive: sage[800],

  secondary: bone[100],
  secondaryForeground: ink[800],
  secondaryHover: bone[200],
  secondaryActive: bone[300],

  muted: bone[100],
  mutedForeground: ink[600],

  accent: terracotta[100],
  accentForeground: terracotta[800],

  liveRing: terracotta[600],
  liveSurface: terracotta[50],
  liveForeground: terracotta[800],

  destructive: red[600],
  destructiveForeground: bone[0],
  destructiveHover: red[700],
  success: sage[700],
  successForeground: bone[0],
  successSurface: sage[50],
  warning: amber[700],
  warningForeground: bone[0],
  warningSurface: amber[100],
  information: blue[600],
  informationForeground: bone[0],
  informationSurface: blue[100],

  chartTrack: ink[400],
  mapHeat: amber[500],

  border: bone[200],
  borderStrong: ink[500],
  input: bone[0],
  inputForeground: ink[800],
  inputPlaceholder: ink[500],
  focusRing: sage[600],
  overlay: 'oklch(23.5% 0.034 281 / 0.55)',

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
  background: ink[950],
  foreground: bone[50],
  surface: ink[900],
  surfaceForeground: bone[50],
  surfaceElevated: ink[800],
  surfaceSunken: ink[950],

  primary: sage[400],
  primaryForeground: sage[900],
  primaryHover: sage[300],
  primaryActive: sage[200],

  secondary: ink[800],
  secondaryForeground: bone[100],
  secondaryHover: ink[700],
  secondaryActive: ink[600],

  muted: ink[800],
  mutedForeground: ink[300],

  accent: terracotta[900],
  accentForeground: terracotta[200],

  /**
   * En oscuro el anillo sube al paso 300 y no al 400. A 400 la distancia con el
   * rojo de extraviados caía a ΔE 0.071 en OKLab: dos colores que significan
   * «está pasando algo» y «hay un perro perdido» a un pelo de pintarse igual.
   */
  liveRing: terracotta[300],
  liveSurface: terracotta[900],
  liveForeground: terracotta[200],

  destructive: red[400],
  destructiveForeground: ink[950],
  destructiveHover: red[300],
  /**
   * Sube un escalón respecto a `primary` a propósito: si apuntaran al mismo
   * paso, un estado que no se toca se pintaría con el color que en esta
   * aplicación significa «esto se puede tocar».
   */
  success: sage[300],
  successForeground: sage[900],
  successSurface: sage[900],
  warning: amber[300],
  warningForeground: amber[900],
  warningSurface: amber[900],
  information: blue[300],
  informationForeground: blue[900],
  informationSurface: blue[900],

  /* El mismo paso que en claro, y no el que suele tocar en oscuro. El
     escalón 300 es exactamente `warning` en este tema —el test lo cazó a la
     primera con una distancia de cero— y además el halo no es texto ni
     superficie: se compone translúcido sobre el mapa, así que lo que tiene que
     hacer es ser cálido y separarse, no adaptar su claridad al fondo. */
  chartTrack: ink[500],
  mapHeat: amber[500],

  border: ink[800],
  borderStrong: ink[500],
  input: ink[900],
  inputForeground: bone[50],
  inputPlaceholder: ink[400],
  focusRing: sage[300],
  overlay: 'oklch(10% 0.010 282 / 0.70)',

  shadowSm: '0 1px 2px oklch(0% 0 0 / 0.30)',
  shadowMd: '0 4px 14px oklch(0% 0 0 / 0.40)',

  colorScheme: 'dark',
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;
