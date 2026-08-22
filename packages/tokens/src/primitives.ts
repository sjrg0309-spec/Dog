/**
 * Tokens primitivos — nivel 1 de 3.
 *
 * Dirección visual: "Las seis de la tarde". Base neutra cálida con verdes de
 * parque y un único acento vivo reservado al estado "en vivo" del radar.
 *
 * Todo el color se expresa en OKLCH. Ningún valor hexadecimal vive fuera de
 * este archivo.
 */

/** Rampa neutra cálida. El matiz 80 evita el gris azulado de plantilla. */
export const neutral = {
  0: 'oklch(100% 0 0)',
  25: 'oklch(98.8% 0.006 80)',
  50: 'oklch(97.2% 0.008 80)',
  100: 'oklch(94.5% 0.010 80)',
  200: 'oklch(90.0% 0.012 80)',
  300: 'oklch(83.0% 0.013 80)',
  400: 'oklch(68.0% 0.014 78)',
  500: 'oklch(55.5% 0.015 76)',
  600: 'oklch(46.0% 0.016 74)',
  700: 'oklch(36.5% 0.016 72)',
  800: 'oklch(27.0% 0.015 72)',
  900: 'oklch(21.0% 0.014 72)',
  950: 'oklch(16.0% 0.012 72)',
} as const;

/** Verde de parque. Es el color de marca y el de las acciones primarias. */
export const green = {
  50: 'oklch(96.5% 0.025 148)',
  100: 'oklch(92.5% 0.050 148)',
  200: 'oklch(86.0% 0.085 148)',
  300: 'oklch(78.0% 0.115 148)',
  400: 'oklch(68.0% 0.135 148)',
  500: 'oklch(58.0% 0.135 147)',
  600: 'oklch(48.0% 0.120 146)',
  700: 'oklch(39.5% 0.098 146)',
  800: 'oklch(31.0% 0.075 146)',
  900: 'oklch(24.0% 0.055 146)',
} as const;

/**
 * Ámbar "en vivo". Reservado al radar y a nada más.
 *
 * Es el único color de la interfaz cuyo uso está restringido por convención:
 * si aparece, significa que algo está ocurriendo ahora mismo.
 */
export const live = {
  50: 'oklch(97.0% 0.018 60)',
  100: 'oklch(93.5% 0.038 58)',
  200: 'oklch(88.0% 0.072 56)',
  300: 'oklch(81.0% 0.118 54)',
  400: 'oklch(74.5% 0.165 52)',
  500: 'oklch(68.0% 0.175 50)',
  600: 'oklch(59.0% 0.160 46)',
  700: 'oklch(48.5% 0.138 44)',
  800: 'oklch(38.0% 0.112 42)',
  900: 'oklch(29.0% 0.088 42)',
} as const;

/** Rojo de acciones destructivas. Nunca se usa para "en vivo". */
export const red = {
  100: 'oklch(93.0% 0.034 25)',
  300: 'oklch(78.0% 0.125 25)',
  400: 'oklch(70.0% 0.170 27)',
  500: 'oklch(58.0% 0.190 27)',
  600: 'oklch(50.5% 0.180 27)',
  700: 'oklch(42.0% 0.150 27)',
  900: 'oklch(26.0% 0.095 27)',
} as const;

/** Azul informativo. Se distingue del verde primario en deuteranopía. */
export const blue = {
  100: 'oklch(93.0% 0.035 245)',
  300: 'oklch(78.0% 0.105 245)',
  500: 'oklch(57.0% 0.140 250)',
  600: 'oklch(49.0% 0.140 252)',
  700: 'oklch(40.5% 0.120 252)',
  900: 'oklch(25.0% 0.070 252)',
} as const;

/** Amarillo de advertencia. */
export const amber = {
  100: 'oklch(95.0% 0.045 90)',
  300: 'oklch(85.0% 0.120 88)',
  500: 'oklch(76.0% 0.150 85)',
  700: 'oklch(53.0% 0.106 80)',
  900: 'oklch(32.0% 0.066 80)',
} as const;

/**
 * Escala de espaciado en múltiplos de 4 px, con el 2 px de remate fino.
 * Se nombra por paso, no por talla, para que insertar valores no rompa nombres.
 */
export const space = {
  0: '0px',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
} as const;

/**
 * Radios deliberadamente distintos entre sí.
 *
 * Un radio idéntico en toda la interfaz es uno de los anti-patrones que este
 * proyecto trata como bloqueantes: aplana la jerarquía y delata la plantilla.
 * Los controles pequeños llevan poco radio; las superficies grandes, más.
 */
export const radius = {
  none: '0px',
  xs: '4px',
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  '2xl': '28px',
  full: '9999px',
} as const;

/**
 * Dos niveles de sombra y nada más.
 *
 * Sombra en todos los elementos es otro anti-patrón bloqueante. La elevación se
 * comunica antes con superficie y borde que con sombra.
 */
export const shadow = {
  none: 'none',
  sm: '0 1px 2px oklch(0% 0 0 / 0.06), 0 1px 3px oklch(0% 0 0 / 0.05)',
  md: '0 4px 12px oklch(0% 0 0 / 0.08), 0 2px 4px oklch(0% 0 0 / 0.04)',
} as const;

/** Familias tipográficas. Inter no aparece por decisión explícita. */
export const fontFamily = {
  /** Legibilidad en baja visión: esta app se lee de pie y a contraluz. */
  body: "'Atkinson Hyperlegible', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  /** Carácter en titulares para no parecer una plantilla SaaS. */
  display: "'Bricolage Grotesque', 'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif",
  mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace",
} as const;

/** Escala tipográfica fluida. Los tamaños de cuerpo no bajan de 16 px. */
export const fontSize = {
  xs: 'clamp(0.75rem, 0.73rem + 0.10vw, 0.8125rem)',
  sm: 'clamp(0.875rem, 0.855rem + 0.10vw, 0.9375rem)',
  base: 'clamp(1rem, 0.97rem + 0.15vw, 1.0625rem)',
  lg: 'clamp(1.125rem, 1.08rem + 0.22vw, 1.25rem)',
  xl: 'clamp(1.3125rem, 1.24rem + 0.36vw, 1.5rem)',
  '2xl': 'clamp(1.5rem, 1.38rem + 0.60vw, 1.875rem)',
  '3xl': 'clamp(1.875rem, 1.65rem + 1.10vw, 2.5rem)',
  '4xl': 'clamp(2.25rem, 1.85rem + 2.00vw, 3.5rem)',
  '5xl': 'clamp(2.75rem, 2.05rem + 3.50vw, 4.5rem)',
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export const lineHeight = {
  tight: '1.1',
  snug: '1.25',
  normal: '1.5',
  relaxed: '1.65',
} as const;

export const letterSpacing = {
  tighter: '-0.03em',
  tight: '-0.015em',
  normal: '0em',
  wide: '0.02em',
  wider: '0.06em',
} as const;

/** Longitud de línea legible. 66 caracteres para texto corrido. */
export const measure = {
  narrow: '48ch',
  base: '66ch',
  wide: '78ch',
} as const;

/**
 * Movimiento. Las microinteracciones viven entre 150 y 300 ms.
 * `pulse` es la única duración larga, y pertenece al anillo del radar.
 */
export const duration = {
  instant: '0ms',
  fast: '150ms',
  base: '200ms',
  slow: '300ms',
  pulse: '2400ms',
} as const;

export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  entrance: 'cubic-bezier(0, 0, 0, 1)',
  exit: 'cubic-bezier(0.3, 0, 1, 1)',
} as const;

export const zIndex = {
  base: '0',
  raised: '10',
  sticky: '100',
  overlay: '200',
  modal: '300',
  toast: '400',
} as const;

/** Punto de ruptura mínimo soportado: 320 px. */
export const breakpoint = {
  xs: '320px',
  sm: '375px',
  md: '768px',
  lg: '1024px',
  xl: '1440px',
  '2xl': '1920px',
} as const;

/** Área táctil mínima. 44 px es el suelo, no el objetivo. */
export const touchTarget = {
  min: '44px',
  comfortable: '48px',
} as const;
