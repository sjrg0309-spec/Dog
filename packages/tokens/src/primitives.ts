/**
 * Tokens primitivos — nivel 1 de 3.
 *
 * Dirección visual: **PAWNET**. Superficies de hueso cálido, texto de carbón,
 * salvia como color de marca y terracota reservada a lo que está ocurriendo
 * ahora.
 *
 * Los anclajes hexadecimales de la especificación se conservan exactos, pero
 * viven dentro de rampas OKLCH porque los hex sueltos no pasaban AA donde hacía
 * falta: `#E07A5F` sobre hueso da 2.76 y como texto es ilegible. La rampa
 * resuelve eso sin perder el color — el ancla se usa donde sí funciona (relleno
 * con carbón encima) y los pasos oscuros cubren el texto.
 *
 * | ancla PAWNET | hex | paso |
 * |---|---|---|
 * | Terracota | `#E07A5F` | `terracotta[500]` |
 * | Salvia | `#81B29A` | `sage[400]` |
 * | Hueso | `#FAF7F2` | `bone[50]` |
 * | Ámbar | `#F2CC8F` | `amber[300]` |
 * | Carbón | `#2B2D42` | `ink[800]` |
 *
 * Todo el color se expresa en OKLCH. Ningún valor hexadecimal vive fuera de
 * este archivo.
 */

/**
 * Salvia — el color de marca y el de las acciones primarias.
 *
 * PAWNET nombra «Terracota / Salvia» como par primario. La acción va en salvia
 * y no en terracota por una razón operativa: terracota (matiz 36) y el rojo de
 * extraviados (matiz 26) son vecinos, y un botón de marca que se parece al aviso
 * de perro perdido es un problema de seguridad, no de gusto.
 */
export const sage = {
  50: 'oklch(96.8% 0.014 163)',
  100: 'oklch(93.0% 0.028 163)',
  200: 'oklch(87.0% 0.046 163)',
  300: 'oklch(79.5% 0.058 163)',
  /** Ancla PAWNET: `#81B29A`. */
  400: 'oklch(72.2% 0.063 163)',
  500: 'oklch(63.0% 0.070 162)',
  600: 'oklch(50.5% 0.076 161)',
  700: 'oklch(41.5% 0.066 160)',
  800: 'oklch(34.0% 0.052 160)',
  900: 'oklch(25.5% 0.038 160)',
} as const;

/**
 * Terracota — el calor de la marca y el estado «en vivo».
 *
 * Es el único color de la interfaz cuyo uso está restringido por convención: si
 * aparece saturada, algo está ocurriendo ahora mismo. El anillo del radar, el
 * borde de una historia sin ver y el botón flotante son sus tres sitios.
 *
 * El botón flotante usa el paso 700 y no el 500: sobre `#E07A5F` el texto blanco
 * se queda en 3.79 y no llega a AA.
 */
export const terracotta = {
  50: 'oklch(97.2% 0.012 40)',
  100: 'oklch(93.8% 0.030 38)',
  200: 'oklch(88.5% 0.058 37)',
  300: 'oklch(80.5% 0.096 38)',
  400: 'oklch(74.5% 0.118 36)',
  /** Ancla PAWNET: `#E07A5F`. */
  500: 'oklch(68.8% 0.133 36)',
  600: 'oklch(62.5% 0.142 36)',
  700: 'oklch(51.5% 0.132 34)',
  800: 'oklch(38.5% 0.105 32)',
  900: 'oklch(29.5% 0.082 32)',
} as const;

/**
 * Hueso — las superficies.
 *
 * Matiz 81, cálido, sin una gota del gris azulado de plantilla. En tema claro
 * son los fondos; en oscuro, el texto.
 */
export const bone = {
  0: 'oklch(100% 0 0)',
  25: 'oklch(98.8% 0.005 81)',
  /** Ancla PAWNET: `#FAF7F2`. */
  50: 'oklch(97.7% 0.007 81)',
  100: 'oklch(95.2% 0.009 81)',
  200: 'oklch(91.0% 0.011 81)',
  300: 'oklch(84.0% 0.012 80)',
  400: 'oklch(70.5% 0.013 78)',
} as const;

/**
 * Carbón — el texto.
 *
 * Matiz 280, frío y de croma bajísimo. Hueso cálido debajo y carbón frío encima
 * es exactamente lo que pide PAWNET, y es una pareja que funciona: 12.62 de
 * contraste, muy por encima de AA. En tema oscuro los papeles se invierten y
 * esta rampa pasa a ser el fondo.
 */
export const ink = {
  200: 'oklch(88.0% 0.010 280)',
  300: 'oklch(78.0% 0.018 280)',
  400: 'oklch(66.5% 0.024 280)',
  500: 'oklch(55.5% 0.030 280)',
  600: 'oklch(45.0% 0.035 280)',
  700: 'oklch(37.5% 0.038 280)',
  /** Ancla PAWNET: `#2B2D42`. */
  800: 'oklch(30.5% 0.038 280)',
  900: 'oklch(23.5% 0.034 281)',
  950: 'oklch(16.5% 0.028 282)',
} as const;

/** Ámbar de eventos y advertencias. Ancla PAWNET `#F2CC8F` en el paso 300. */
export const amber = {
  100: 'oklch(96.0% 0.030 82)',
  200: 'oklch(91.5% 0.058 80)',
  /** Ancla PAWNET: `#F2CC8F`. */
  300: 'oklch(86.4% 0.089 79)',
  500: 'oklch(74.0% 0.130 78)',
  700: 'oklch(52.0% 0.105 74)',
  900: 'oklch(31.0% 0.064 74)',
} as const;

/**
 * Rojo de extraviados y de acciones destructivas.
 *
 * PAWNET propone `#E76F51` para perro extraviado. Está a un grado de matiz de la
 * terracota de marca, así que se pintarían igual. Esta rampa mantiene la
 * calidez pero baja el matiz y sube el croma hasta que se distingue: ΔE 0.137
 * en OKLab frente al acento. Un aviso de animal perdido que se confunde con el
 * color decorativo de la aplicación no es un aviso.
 */
export const red = {
  100: 'oklch(94.0% 0.030 22)',
  300: 'oklch(79.0% 0.120 24)',
  400: 'oklch(70.5% 0.170 25)',
  500: 'oklch(58.5% 0.198 26)',
  600: 'oklch(50.0% 0.190 26)',
  700: 'oklch(41.0% 0.160 26)',
  900: 'oklch(25.0% 0.098 26)',
} as const;

/** Azul informativo. Se distingue de la salvia primaria en deuteranopía. */
export const blue = {
  100: 'oklch(93.5% 0.032 250)',
  300: 'oklch(78.5% 0.100 250)',
  500: 'oklch(57.0% 0.140 252)',
  600: 'oklch(48.5% 0.140 254)',
  700: 'oklch(40.0% 0.120 254)',
  900: 'oklch(24.5% 0.070 254)',
} as const;

/**
 * Alias de compatibilidad.
 *
 * El código que ya existía pide `neutral`, `green` y `live`. Apuntan a las
 * rampas nuevas para no reescribir cada pantalla en el mismo commit que cambia
 * la paleta.
 */
export const neutral = {
  ...bone,
  500: ink[500],
  600: ink[600],
  700: ink[700],
  800: ink[800],
  900: ink[900],
  950: ink[950],
} as const;
export const green = sage;
export const live = terracotta;

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
 * PAWNET pide bordes suaves de 16 a 24 px. Esa franja es de superficies, no de
 * todo: aplicar 20 px a un chip de 32 px de alto lo convierte en una pastilla.
 * Así que las superficies grandes viven en la franja pedida (`lg` 18, `xl` 24) y
 * los controles pequeños se quedan por debajo. Un radio idéntico en toda la
 * interfaz es uno de los anti-patrones bloqueantes del proyecto: aplana la
 * jerarquía y delata la plantilla.
 */
export const radius = {
  none: '0px',
  xs: '4px',
  sm: '8px',
  md: '12px',
  /** Tarjetas y hojas. Dentro de la franja PAWNET. */
  lg: '18px',
  /** Diálogos y superficies grandes. Tope de la franja PAWNET. */
  xl: '24px',
  '2xl': '32px',
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

/**
 * Familias tipográficas.
 *
 * PAWNET pide «Plus Jakarta Sans o Inter». Se toma la primera: Inter está en la
 * lista de bloqueantes de este proyecto desde el primer día, y de las dos
 * opciones que da la especificación solo una choca.
 *
 * El reparto no es decorativo. Plus Jakarta Sans lleva los titulares y las
 * etiquetas de interfaz, que se leen de un vistazo. El cuerpo se queda en
 * Atkinson Hyperlegible, diseñada para baja visión, porque el texto largo de
 * esta aplicación —los pasos de una alerta, la ficha médica— se lee de pie, en
 * la calle, a contraluz y con una correa en la otra mano.
 */
export const fontFamily = {
  /** Legibilidad en baja visión: esta app se lee de pie y a contraluz. */
  body: "'Atkinson Hyperlegible', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  /** Titulares y etiquetas. La familia que pide PAWNET. */
  display: "'Plus Jakarta Sans', 'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif",
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
  /** El rastro de huellas del doble toque, de la primera a la última. */
  pawTrail: '900ms',
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
  /**
   * El botón de acción flotante. PAWNET lo pide «de gran tamaño», y aquí hay
   * una razón concreta: se pulsa con una mano mientras la otra lleva la correa,
   * a veces con guantes y a veces corriendo.
   */
  floating: '64px',
} as const;
