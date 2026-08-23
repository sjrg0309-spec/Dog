/**
 * Conversión OKLCH → sRGB y ratio de contraste WCAG.
 *
 * Existe para que el contraste del sistema de color sea una aserción de test y
 * no una estimación a ojo. Si un token deja de cumplir AA, el build falla.
 */

export type Rgb = { r: number; g: number; b: number };

/** `oklch(62.5% 0.14 148)` o `oklch(21% 0.014 72 / 0.55)` → componentes. */
export function parseOklch(value: string): { l: number; c: number; h: number; alpha: number } {
  const match = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(
    value.trim(),
  );
  if (!match) throw new Error(`Color OKLCH no reconocido: ${value}`);
  const [, l, c, h, alpha] = match;
  return {
    l: Number(l) / 100,
    c: Number(c),
    h: Number(h),
    alpha: alpha === undefined ? 1 : Number(alpha),
  };
}

/** OKLCH → sRGB lineal (sin recortar, para poder detectar fuera de gama). */
export function oklchToLinearRgb(value: string): Rgb {
  const { l: L, c: C, h: H } = parseOklch(value);
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const lp = L + 0.3963377774 * a + 0.2158037573 * b;
  const mp = L - 0.1055613458 * a - 0.0638541728 * b;
  const sp = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = lp * lp * lp;
  const m3 = mp * mp * mp;
  const s3 = sp * sp * sp;

  return {
    r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Luminancia relativa WCAG. Espera sRGB lineal. */
export function relativeLuminance(value: string): number {
  const { r, g, b } = oklchToLinearRgb(value);
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

/**
 * Ratio de contraste WCAG 2.1 entre dos colores OKLCH opacos.
 *
 * Devuelve un número entre 1 y 21. AA pide 4.5 para texto de cuerpo, 3 para
 * texto grande y para componentes de interfaz.
 */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** ¿Está el color dentro de la gama sRGB? Útil para no confiar en el recorte. */
export function isInSrgbGamut(value: string, tolerance = 0.001): boolean {
  const { r, g, b } = oklchToLinearRgb(value);
  return [r, g, b].every((channel) => channel >= -tolerance && channel <= 1 + tolerance);
}

/** Codificación gamma sRGB: de lineal a los valores que entiende una pantalla. */
function encodeGamma(channel: number): number {
  const clamped = clamp01(channel);
  return clamped <= 0.0031308
    ? 12.92 * clamped
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

/**
 * OKLCH → hexadecimal.
 *
 * React Native no sabe interpretar `oklch()`: su analizador de color solo
 * entiende hex, `rgb()`, `hsl()` y los nombres. En lugar de mantener una
 * segunda paleta escrita a mano para la aplicación móvil —que se desincronizaría
 * con la web a la primera— se deriva el hexadecimal de los mismos tokens.
 *
 * El color fuera de gama se recorta al convertir. Los tokens del proyecto están
 * dentro de sRGB y hay un test que lo comprueba, así que aquí no se pierde nada.
 */
export function oklchToHex(value: string): string {
  const { alpha } = parseOklch(value);
  const linear = oklchToLinearRgb(value);

  const toHex = (channel: number) =>
    Math.round(encodeGamma(channel) * 255)
      .toString(16)
      .padStart(2, '0');

  const hex = `#${toHex(linear.r)}${toHex(linear.g)}${toHex(linear.b)}`;
  if (alpha >= 1) return hex;

  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${alphaHex}`;
}

/** Convierte un tema semántico entero a hexadecimales, para React Native. */
export function themeToHex<T extends Record<string, string>>(theme: T): T {
  const converted: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme)) {
    converted[key] = value.startsWith('oklch(') ? oklchToHex(value) : value;
  }
  return converted as T;
}
