/**
 * Las direcciones, medidas.
 *
 * Una dirección visual sin esto es una opinión. El compromiso del proyecto
 * —contraste AA comprobado, no prometido— no se relaja por cambiar de paleta,
 * así que todas las combinaciones (cada dirección × dos fondos) pasan por las
 * mismas afirmaciones que pasaba la única que había antes.
 *
 * Esto es lo que sujeta a «Relieve». El neumorfismo se hunde justo por aquí:
 * empieza siendo tarjetas del color del fondo y acaba siendo **texto** del
 * color del fondo, porque una vez que la luz separa las superficies parece que
 * también puede separar las letras. No puede. Con estas veinte medidas
 * aplicándose igual que a las otras tres, la dirección o se lee o no entra.
 *
 * Lo que se mide y por qué ese umbral:
 *
 *  - **Texto sobre fondo: 7:1 (AAA).** Es texto largo leído de pie, en la
 *    calle. AA sería el mínimo legal; aquí el mínimo es el siguiente escalón.
 *  - **Texto apagado y color de marca sobre fondo: 4,5:1 (AA).** Son textos
 *    cortos y iconos, pero se leen igual.
 *  - **Texto sobre relleno: 4,5:1.** El rótulo de un botón está sobre el
 *    color, no sobre el fondo, y es el par que más se olvida.
 *  - **Anillo de en vivo y bordes: 3:1.** Son formas, no letras, y ese es el
 *    umbral que fija la norma para elementos no textuales.
 */

import { describe, expect, it } from 'vitest';

import { DIRECTIONS, DIRECTION_IDS, contrastHex, mix } from './direcciones';

/** Los pares que tienen que aguantar, con su umbral y el motivo en el nombre. */
const PAIRS: readonly {
  name: string;
  fg: (c: Record<string, string>) => string;
  bg: (c: Record<string, string>) => string;
  min: number;
}[] = [
  { name: 'texto sobre el fondo', fg: (c) => c.foreground!, bg: (c) => c.background!, min: 7 },
  {
    name: 'texto sobre la tarjeta',
    fg: (c) => c.surfaceForeground!,
    bg: (c) => c.surface!,
    min: 7,
  },
  { name: 'texto sobre lo hundido', fg: (c) => c.foreground!, bg: (c) => c.surfaceSunken!, min: 7 },
  {
    name: 'texto sobre lo elevado',
    fg: (c) => c.foreground!,
    bg: (c) => c.surfaceElevated!,
    min: 4.5,
  },
  {
    name: 'texto apagado sobre el fondo',
    fg: (c) => c.mutedForeground!,
    bg: (c) => c.background!,
    min: 4.5,
  },
  {
    name: 'texto apagado sobre la tarjeta',
    fg: (c) => c.mutedForeground!,
    bg: (c) => c.surface!,
    min: 4.5,
  },
  { name: 'marca sobre el fondo', fg: (c) => c.primary!, bg: (c) => c.background!, min: 4.5 },
  {
    name: 'rótulo sobre la marca',
    fg: (c) => c.primaryForeground!,
    bg: (c) => c.primary!,
    min: 4.5,
  },
  {
    name: 'rótulo sobre la marca pulsada',
    fg: (c) => c.primaryForeground!,
    bg: (c) => c.primaryActive!,
    min: 4.5,
  },
  {
    name: 'texto sobre el tinte del acento',
    fg: (c) => c.accentForeground!,
    bg: (c) => c.accent!,
    min: 4.5,
  },
  {
    name: 'texto sobre el tinte de en vivo',
    fg: (c) => c.liveForeground!,
    bg: (c) => c.liveSurface!,
    min: 4.5,
  },
  {
    name: 'rótulo sobre peligro',
    fg: (c) => c.destructiveForeground!,
    bg: (c) => c.destructive!,
    min: 4.5,
  },
  { name: 'peligro sobre el fondo', fg: (c) => c.destructive!, bg: (c) => c.background!, min: 4.5 },
  {
    name: 'rótulo sobre acierto',
    fg: (c) => c.successForeground!,
    bg: (c) => c.success!,
    min: 4.5,
  },
  { name: 'rótulo sobre aviso', fg: (c) => c.warningForeground!, bg: (c) => c.warning!, min: 4.5 },
  {
    name: 'rótulo sobre información',
    fg: (c) => c.informationForeground!,
    bg: (c) => c.information!,
    min: 4.5,
  },
  {
    name: 'marcador de campo sobre el campo',
    fg: (c) => c.inputPlaceholder!,
    bg: (c) => c.input!,
    min: 4.5,
  },
  /* Formas, no letras: el umbral de la norma para no texto es 3:1. */
  {
    name: 'anillo de en vivo sobre el fondo',
    fg: (c) => c.liveRing!,
    bg: (c) => c.background!,
    min: 3,
  },
  {
    name: 'anillo de foco sobre el fondo',
    fg: (c) => c.focusRing!,
    bg: (c) => c.background!,
    min: 3,
  },
  {
    name: 'borde fuerte sobre el fondo',
    fg: (c) => c.borderStrong!,
    bg: (c) => c.background!,
    min: 3,
  },
];

describe('las direcciones', () => {
  for (const id of DIRECTION_IDS) {
    for (const ground of ['light', 'dark'] as const) {
      describe(`${id} · ${ground}`, () => {
        const colors = DIRECTIONS[id][ground] as unknown as Record<string, string>;

        for (const pair of PAIRS) {
          it(`${pair.name} llega a ${pair.min}:1`, () => {
            const ratio = contrastHex(pair.fg(colors), pair.bg(colors));
            expect(
              ratio,
              `${id}/${ground} · ${pair.name}: ${pair.fg(colors)} sobre ${pair.bg(colors)} da ${ratio.toFixed(2)}:1`,
            ).toBeGreaterThanOrEqual(pair.min);
          });
        }

        it('declara el esquema que le toca', () => {
          expect(colors.colorScheme).toBe(ground);
        });

        it('no tiene ningún token sin definir', () => {
          for (const [key, value] of Object.entries(colors)) {
            expect(value, `${id}/${ground} · ${key}`).toBeTruthy();
          }
        });
      });
    }
  }

  it('cada una tiene su propia identidad', () => {
    const primaries = DIRECTION_IDS.map((id) => DIRECTIONS[id].dark.primary);
    expect(new Set(primaries).size).toBe(DIRECTION_IDS.length);
  });

  it('la forma también cambia, no solo el color', () => {
    const radios = DIRECTION_IDS.map((id) => DIRECTIONS[id].radius.lg);
    expect(new Set(radios).size).toBe(DIRECTION_IDS.length);
  });

  it('«Señal» crece las áreas táctiles y las demás no', () => {
    expect(DIRECTIONS.senal.touchBoost).toBeGreaterThan(0);
    expect(DIRECTIONS.nocturno.touchBoost).toBe(0);
    expect(DIRECTIONS.papel.touchBoost).toBe(0);
    expect(DIRECTIONS.relieve.touchBoost).toBe(0);
  });

  it('ninguna usa Inter, que sigue bloqueada', () => {
    for (const id of DIRECTION_IDS) {
      for (const family of Object.values(DIRECTIONS[id].fonts)) {
        expect(family.toLowerCase()).not.toContain('inter');
      }
    }
  });
});

/**
 * El relieve, medido como lo que es: física.
 *
 * Una dirección con relieve promete una sola fuente de luz. Si el brillo no es
 * más claro que la superficie o la sombra no es más oscura, el relieve no está
 * mal ajustado: está del revés, y lo que parecía sobresalir se hunde. Es un
 * fallo que en una captura se ve raro y nadie sabe decir por qué.
 */
describe('el relieve', () => {
  const luminance = (color: string): number => contrastHex(color, '#000000');

  it('solo lo declara la dirección que se dibuja con luz', () => {
    expect(DIRECTIONS.relieve.relief).not.toBeNull();
    for (const id of DIRECTION_IDS.filter((entry) => entry !== 'relieve')) {
      expect(DIRECTIONS[id].relief, id).toBeNull();
    }
  });

  for (const ground of ['light', 'dark'] as const) {
    it(`en ${ground}, el brillo aclara y la sombra oscurece`, () => {
      const relief = DIRECTIONS.relieve.relief![ground];
      const surface = DIRECTIONS.relieve[ground].surface;

      expect(luminance(relief.light)).toBeGreaterThan(luminance(surface));
      expect(luminance(relief.dark)).toBeLessThan(luminance(surface));
    });
  }

  it('en oscuro el fondo no es negro puro, porque sobre negro no hay brillo', () => {
    /* La sombra clara tiene que caber entre la superficie y el blanco. Con el
       negro puro de «Nocturno» ese hueco no existe. */
    expect(luminance(DIRECTIONS.relieve.dark.background)).toBeGreaterThan(
      luminance('#000000') * 1.5,
    );
  });
});

describe('la mezcla', () => {
  it('con 0 devuelve el primero y con 1 el segundo', () => {
    expect(mix('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(mix('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });

  it('a la mitad cae en medio', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('el contraste', () => {
  it('blanco sobre negro da 21:1', () => {
    expect(contrastHex('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('no depende del orden', () => {
    expect(contrastHex('#387256', '#ffffff')).toBeCloseTo(contrastHex('#ffffff', '#387256'), 6);
  });
});
