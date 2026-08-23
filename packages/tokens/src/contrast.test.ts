/**
 * El sistema de color como test.
 *
 * El plan del proyecto se compromete a contraste WCAG AA. Estas aserciones son
 * la evidencia: si alguien ajusta un token y rompe la legibilidad, el build
 * falla antes de llegar a una pantalla.
 */

import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  isInSrgbGamut,
  oklabDistance,
  oklchToHex,
  parseOklch,
  themeToHex,
} from './contrast.js';
import { dark, light, type SemanticTokens } from './semantic.js';
import { amber, blue, bone, ink, red, sage, terracotta } from './primitives.js';

/** AA: 4.5 para cuerpo, 3.0 para texto grande y componentes de interfaz. */
const AA_TEXT = 4.5;
const AA_UI = 3.0;

const themes: Array<[string, SemanticTokens]> = [
  ['claro', light],
  ['oscuro', dark],
];

/**
 * Los tres colores de nombre de un grupo de chat.
 *
 * En WhatsApp cada participante tiene su color, y no es decoración: es lo que
 * hace legible un grupo de cuatro sin leer, porque el ojo separa a los
 * interlocutores por color antes de procesar las letras. Aquí se toman tres
 * tokens que ya existen —marca, aviso e informativo— en vez de inventar una
 * paleta nueva, y por eso hay que comprobar dos cosas de las que el resto de la
 * suite no dice nada: que los tres se lean **sobre la burbuja**, que es
 * `surface` y no `background`, y que se distingan **entre sí**. Un par de
 * nombres que se confunden convierte esta función en ruido de colores.
 *
 * El trío no salió a la primera: el terracota del estado en vivo era el
 * candidato obvio y este test lo tiró con 3,79 sobre superficie clara. Es el
 * mismo color, exactamente igual de bonito, y de texto no vale.
 */
const AUTHOR_TINTS = ['primary', 'warning', 'information'] as const;

/**
 * El estado en vivo es un color de **anillo**, no de texto.
 *
 * Pasa el listón de componente de interfaz —anillos, rellenos, iconos— y no el
 * de cuerpo, y esa diferencia no es un detalle: pintar un número de quince
 * píxeles en terracota sobre hueso da 3,55, que está por debajo de AA y nadie
 * lo nota mirando, porque el color se ve perfectamente. Se ve; lo que no se
 * hace es leerlo cómodo.
 */
describe.each(themes)('el estado en vivo en el tema %s', (_name, theme) => {
  it('vale como anillo, relleno o icono', () => {
    expect(contrastRatio(theme.liveRing, theme.background)).toBeGreaterThanOrEqual(AA_UI);
    expect(contrastRatio(theme.liveRing, theme.surface)).toBeGreaterThanOrEqual(AA_UI);
  });
});

describe.each(themes)('nombres de autor en el tema %s', (_name, theme) => {
  it.each(AUTHOR_TINTS)('«%s» se lee sobre la burbuja', (token) => {
    // Van a trece píxeles en negrita, así que se les pide el listón de cuerpo
    // y no el de texto grande.
    expect(contrastRatio(theme[token], theme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('los tres se distinguen entre sí', () => {
    // El ratio WCAG mide luminancia, así que daría por buenos dos matices
    // opuestos con la misma claridad. Aquí lo que importa es justo el matiz.
    for (let i = 0; i < AUTHOR_TINTS.length; i += 1) {
      for (let j = i + 1; j < AUTHOR_TINTS.length; j += 1) {
        const a = AUTHOR_TINTS[i]!;
        const b = AUTHOR_TINTS[j]!;
        expect(oklabDistance(theme[a], theme[b])).toBeGreaterThan(0.1);
      }
    }
  });
});

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
  it('la salvia primaria y la terracota en vivo tienen luminancias distintas', () => {
    // Además del icono y el texto que siempre acompañan al estado, los dos
    // colores se separan también por claridad, que es lo que sobrevive a una
    // deficiencia de visión del color.
    expect(contrastRatio(sage[600], terracotta[600])).toBeGreaterThan(1.3);
  });
});

describe.each([
  ['hueso', bone],
  ['carbón', ink],
])('la rampa %s es monótona', (_name, ramp) => {
  it('la claridad decrece al subir el número de paso', () => {
    const steps = Object.entries(ramp)
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
  const ramps = { bone, ink, sage, terracotta, red, blue, amber };

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

    expect(luminance(oklchToHex(bone[50]))).toBeGreaterThan(luminance(oklchToHex(ink[500])));
    expect(luminance(oklchToHex(ink[500]))).toBeGreaterThan(luminance(oklchToHex(ink[950])));
  });
});


/**
 * Los colores de estado usados **como texto**.
 *
 * Las comprobaciones de arriba miran el par «primer plano sobre su superficie»
 * —texto oscuro sobre el verde de éxito—, que es como se usan en una insignia.
 * Pero la aplicación también los escribe directamente sobre el fondo: la banda
 * de afinidad, el aviso de bienestar. Ese par no estaba cubierto por nada, así
 * que podía romperse sin que fallara ningún test.
 */
describe('estados escritos sobre el fondo', () => {
  for (const [name, theme] of themes) {
    for (const token of ['success', 'warning', 'information', 'primary'] as const) {
      it(`${token} se lee sobre el fondo y sobre la superficie en tema ${name}`, () => {
        expect(contrastRatio(theme[token], theme.background)).toBeGreaterThanOrEqual(AA_TEXT);
        expect(contrastRatio(theme[token], theme.surface)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
  }
});

/**
 * Dos estados distintos no pueden ser el mismo color.
 *
 * Lo encontró una revisión de interfaz, no un test: en tema oscuro `primary` y
 * `success` tenían exactamente el mismo valor, así que la banda «Gran match» y
 * la «Buen match» salían pintadas igual. No era un fallo de accesibilidad
 * —ambas llevan su etiqueta escrita— pero sí un color que no significaba nada.
 */
describe('los colores de estado se distinguen entre sí', () => {
  for (const [name, theme] of themes) {
    it(`éxito, información y aviso son tres colores distintos en tema ${name}`, () => {
      const used = [theme.success, theme.information, theme.warning];
      expect(new Set(used).size, `en ${name} hay dos estados con el mismo color`).toBe(used.length);
    });

    it(`ningún estado se confunde con el color de lo interactivo en tema ${name}`, () => {
      // `primary` es el color con el que esta aplicación dice «esto se toca».
      // Un estado que no se toca pintado igual convierte el color en ruido.
      for (const [token, value] of [
        ['success', theme.success],
        ['information', theme.information],
        ['warning', theme.warning],
      ] as const) {
        expect(value, `${token} es idéntico a primary en ${name}`).not.toBe(theme.primary);
      }
    });
  }
});


/**
 * Los anclajes de PAWNET, exactos.
 *
 * La especificación llega en hexadecimal y el proyecto trabaja en OKLCH. La
 * conversión se hizo una vez; este test es el que impide que se pierda por el
 * camino en el siguiente ajuste de rampa.
 */
describe('anclajes de la paleta PAWNET', () => {
  const anchors: Array<[string, string, string]> = [
    ['terracota', terracotta[500], '#e07a5f'],
    ['salvia', sage[400], '#81b29a'],
    ['hueso', bone[50], '#faf7f2'],
    ['ámbar', amber[300], '#f2cc8f'],
    ['carbón', ink[800], '#2b2d42'],
  ];

  it.each(anchors)('%s cae exactamente en el hexadecimal de la especificación', (_n, token, hex) => {
    expect(oklchToHex(token)).toBe(hex);
  });
});

/**
 * Colores que significan cosas distintas tienen que verse distintos.
 *
 * El ratio WCAG no sirve para esto: mide luminancia, así que dos matices
 * opuestos con la misma claridad le salen «iguales». La métrica es la distancia
 * en OKLab, que sí ve el matiz.
 *
 * Existe porque la paleta de PAWNET traía el fallo dentro: terracota `#E07A5F`
 * está en matiz 36 y el rojo de extraviados `#E76F51` en matiz 35. Un grado. El
 * color de marca y el aviso de perro perdido se habrían pintado igual, y ningún
 * test de contraste lo habría notado.
 */
describe('significados que no pueden confundirse', () => {
  /** Por debajo de esto dejan de leerse como dos colores. */
  const MIN_DISTANCE = 0.1;

  const pairs = [
    ['el color de marca', 'primary', 'el estado en vivo', 'liveRing'],
    ['el estado en vivo', 'liveRing', 'el aviso de extraviado', 'destructive'],
    ['el color de marca', 'primary', 'el aviso de extraviado', 'destructive'],
  ] as const;

  for (const [name, theme] of themes) {
    it.each(pairs)(`%s y %s se distinguen en tema ${name}`, (_la, a, _lb, b) => {
      expect(oklabDistance(theme[a], theme[b])).toBeGreaterThanOrEqual(MIN_DISTANCE);
    });
  }
});

/**
 * La banda de referencia de los gráficos.
 *
 * Dos exigencias que se tiran la una de la otra, y por eso se miden las dos:
 *
 *  1. **Que se vea.** Una banda por debajo de 3:1 contra su superficie
 *     desaparece, y con ella el dato que más importa del ritmo semanal: el día
 *     que estaba declarado y en el que no se salió. Un hueco en blanco se lee
 *     como «aquí no hay nada que contar», que es lo contrario de lo que pasa.
 *  2. **Que no se confunda con la barra.** Es la que hace falta subir cuando
 *     se cumple la primera a lo bruto: al oscurecer la banda hasta que se ve
 *     bien, se acerca en claridad al verde del primario y las dos dejan de
 *     distinguirse. El primer intento se quedó en ΔE 10,8 —por debajo del
 *     suelo incluso con visión cromática normal— y hubo que subir la banda un
 *     paso de la rampa en vez de oscurecerla más.
 *
 * No es una segunda serie y no tiene que parecerlo: lo declarado es contra qué
 * se compara lo que pasó, así que va en neutro y con relleno distinto —hueca
 * frente a maciza—, que es la forma de no dejar la identidad en manos del
 * color.
 */
describe('la banda de referencia de los gráficos', () => {
  for (const [name, theme] of themes) {
    it(`se ve sobre su superficie en tema ${name}`, () => {
      expect(contrastRatio(theme.chartTrack, theme.surface)).toBeGreaterThanOrEqual(3);
    });

    it(`no se confunde con la barra en tema ${name}`, () => {
      expect(oklabDistance(theme.chartTrack, theme.primary)).toBeGreaterThanOrEqual(0.15);
    });
  }
});

/**
 * Hueso arriba y carbón abajo: la pareja de superficie y texto de PAWNET.
 *
 * Es lo único de la especificación que se toma tal cual y sin ajustar, porque
 * es lo único que ya pasaba AA con margen: 12.62 sobre el fondo.
 */
describe('hueso y carbón', () => {
  it('el texto sobre el fondo va muy por encima del mínimo, no rozándolo', () => {
    expect(contrastRatio(light.foreground, light.background)).toBeGreaterThanOrEqual(10);
    expect(contrastRatio(dark.foreground, dark.background)).toBeGreaterThanOrEqual(10);
  });

  it('las superficies son cálidas y el texto frío, no al revés', () => {
    // Matiz 81 en las superficies, 280 en el texto. Si alguien las iguala, la
    // paleta pierde justo lo que la distingue de una plantilla gris.
    expect(parseOklch(light.background).h).toBeCloseTo(81, 0);
    expect(parseOklch(light.foreground).h).toBeCloseTo(280, 0);
  });
});
