/**
 * El sistema de color como test.
 *
 * El plan del proyecto se compromete a contraste WCAG AA. Estas aserciones son
 * la evidencia: si alguien ajusta un token y rompe la legibilidad, el build
 * falla antes de llegar a una pantalla.
 */

import { describe, expect, it } from 'vitest';

import { contrastRatio, isInSrgbGamut, oklchToHex, parseOklch, themeToHex } from './contrast.js';
import { dark, light, type SemanticTokens } from './semantic.js';
import { amber, blue, green, live, neutral, red } from './primitives.js';

/** AA: 4.5 para cuerpo, 3.0 para texto grande y componentes de interfaz. */
const AA_TEXT = 4.5;
const AA_UI = 3.0;

const themes: Array<[string, SemanticTokens]> = [
  ['claro', light],
  ['oscuro', dark],
];

describe.each(themes)('tema %s', (_name, theme) => {
  it('el texto de cuerpo sobre el fondo cumple AA', () => {
    expect(contrastRatio(theme.foreground, theme.background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('el texto de cuerpo sobre superficie cumple AA', () => {
    expect(contrastRatio(theme.surfaceForeground, theme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('el texto atenuado sigue siendo legible — nada de gris decorativo', () => {
    expect(contrastRatio(theme.mutedForeground, theme.background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(theme.mutedForeground, theme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('el botón primario es legible en reposo y en hover', () => {
    expect(contrastRatio(theme.primaryForeground, theme.primary)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(theme.primaryForeground, theme.primaryHover)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it('el botón secundario es legible', () => {
    expect(contrastRatio(theme.secondaryForeground, theme.secondary)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it('la acción destructiva es legible en reposo y en hover', () => {
    expect(contrastRatio(theme.destructiveForeground, theme.destructive)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
    expect(
      contrastRatio(theme.destructiveForeground, theme.destructiveHover),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('los estados sobre su superficie son legibles', () => {
    expect(contrastRatio(theme.accentForeground, theme.accent)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(theme.successForeground, theme.success)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(theme.warningForeground, theme.warning)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(theme.informationForeground, theme.information)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it('el estado en vivo es legible sobre su superficie', () => {
    expect(contrastRatio(theme.liveForeground, theme.liveSurface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('el anillo del radar se distingue del fondo como componente de interfaz', () => {
    expect(contrastRatio(theme.liveRing, theme.background)).toBeGreaterThanOrEqual(AA_UI);
  });

  it('el anillo de foco se distingue del fondo y de la superficie', () => {
    expect(contrastRatio(theme.focusRing, theme.background)).toBeGreaterThanOrEqual(AA_UI);
    expect(contrastRatio(theme.focusRing, theme.surface)).toBeGreaterThanOrEqual(AA_UI);
  });

  it('el borde fuerte y el borde del campo son perceptibles', () => {
    expect(contrastRatio(theme.borderStrong, theme.background)).toBeGreaterThanOrEqual(AA_UI);
  });

  it('el marcador de posición del campo cumple AA', () => {
    expect(contrastRatio(theme.inputPlaceholder, theme.input)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('todo color opaco del tema cae dentro de la gama sRGB', () => {
    for (const [key, value] of Object.entries(theme)) {
      if (typeof value !== 'string' || !value.startsWith('oklch(')) continue;
      if (parseOklch(value).alpha < 1) continue; // los velos se componen sobre el fondo
      expect(isInSrgbGamut(value), `${key} = ${value} está fuera de gama`).toBe(true);
    }
  });
});

describe('distinción entre estados que no debe apoyarse solo en el color', () => {
  it('el verde primario y el ámbar en vivo tienen luminancias distintas', () => {
    // Además del icono y el texto que siempre acompañan al estado, los dos
    // colores se separan también por claridad, que es lo que sobrevive a una
    // deficiencia de visión del color.
    const ratio = contrastRatio(green[600], live[600]);
    expect(ratio).toBeGreaterThan(1.3);
  });
});

describe('la rampa neutra es monótona', () => {
  it('la claridad decrece al subir el número de paso', () => {
    const steps = Object.entries(neutral)
      .map(([key, value]) => [Number(key), parseOklch(value).l] as const)
      .sort((a, b) => a[0] - b[0]);

    for (let i = 1; i < steps.length; i += 1) {
      const previous = steps[i - 1];
      const current = steps[i];
      if (!previous || !current) continue;
      expect(current[1]).toBeLessThan(previous[1]);
    }
  });
});

describe('las rampas primitivas caben en sRGB', () => {
  // Un color fuera de gama se recorta de forma impredecible según el navegador,
  // así que el contraste medido dejaría de corresponderse con lo que se ve.
  const ramps = { neutral, green, live, red, blue, amber };

  it.each(Object.entries(ramps))('la rampa %s está dentro de gama', (name, ramp) => {
    for (const [step, value] of Object.entries(ramp)) {
      expect(isInSrgbGamut(value), `${name}[${step}] = ${value} está fuera de gama`).toBe(true);
    }
  });
});

describe('conversión a hexadecimal para React Native', () => {
  it('el blanco y el negro salen exactos', () => {
    expect(oklchToHex('oklch(100% 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0% 0 0)')).toBe('#000000');
  });

  it('produce hexadecimales de seis dígitos válidos', () => {
    for (const value of Object.values(light)) {
      if (typeof value !== 'string' || !value.startsWith('oklch(')) continue;
      if (parseOklch(value).alpha < 1) continue;
      expect(oklchToHex(value)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('conserva la transparencia con un cuarto par de dígitos', () => {
    expect(oklchToHex('oklch(21% 0.014 72 / 0.55)')).toMatch(/^#[0-9a-f]{8}$/);
  });

  it('el tema convertido conserva las mismas claves', () => {
    const hex = themeToHex(dark as unknown as Record<string, string>);
    expect(Object.keys(hex).sort()).toEqual(Object.keys(dark).sort());
    // `colorScheme` no es un color y debe pasar tal cual.
    expect(hex.colorScheme).toBe('dark');
  });

  it('la conversión conserva el orden de claridad, que es lo que sostiene el contraste', () => {
    // Si el hexadecimal invirtiera la relación entre dos tonos, el contraste
    // verificado sobre OKLCH dejaría de valer para la aplicación móvil.
    const luminance = (hex: string) => {
      const value = parseInt(hex.slice(1, 7), 16);
      return ((value >> 16) & 255) * 0.2126 + ((value >> 8) & 255) * 0.7152 + (value & 255) * 0.0722;
    };

    expect(luminance(oklchToHex(neutral[50]))).toBeGreaterThan(luminance(oklchToHex(neutral[500])));
    expect(luminance(oklchToHex(neutral[500]))).toBeGreaterThan(luminance(oklchToHex(neutral[950])));
  });
});
