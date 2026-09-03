/**
 * Las reglas de interfaz de las plataformas, como prueba.
 *
 * Apple, Google y Meta coinciden en dos números, y son los dos que se rompen
 * solos según crece una aplicación:
 *
 *  1. **Nada de texto por debajo de 11 pt.** Es el mínimo que fija la guía de
 *     interfaz humana de Apple para móvil, y Material lo sitúa en el mismo
 *     sitio con su estilo `labelSmall`. Por debajo, un rótulo deja de leerse
 *     para quien no tiene veinte años de vista, y es justo el sitio donde se
 *     mete lo que «no importa tanto»: la hora de un mensaje, un contador, una
 *     atribución.
 *  2. **Nada que se toque por debajo de 44 pt.** Apple pide 44 × 44 y Material
 *     48 × 48; se toma el más laxo de los dos como suelo, que es el que ambos
 *     cumplen. Un control de treinta píxeles se ve bien en una captura y se
 *     falla con el dedo, sobre todo andando por la calle, que es donde se usa
 *     esto.
 *  3. **Ningún tamaño de texto escrito a mano.** Las dos guías no hablan de
 *     números sueltos sino de una **escala**: Apple tiene once estilos con
 *     nombre, Material quince, y en ambas el tamaño se elige de una lista
 *     cerrada. Un número escrito directamente en un componente no está en
 *     ninguna lista: es una decisión tomada por una pantalla, en una tarde,
 *     sin saber qué hacen las otras veintidós.
 *
 * **Cómo se rompió la tercera, que es la interesante.** Al escribirla salieron
 * veintisiete tamaños fuera de escala, y no estaban repartidos al azar:
 * veintitrés eran `11` y cuatro eran `13`. La escala iba `12, 15, 17…`, así que
 * el escalón por debajo de 12 —el que Apple llama Caption 2 y Material
 * `labelSmall`— sencillamente no existía. Y **un escalón que no está en la
 * escala no se salta: se improvisa**, veintitrés veces, cada una por su cuenta.
 * El arreglo no fue reescribir veintitrés sitios: fue añadir el escalón que
 * faltaba (`2xs`) y doblar los cuatro `13` al `xs` que ya había, porque cuatro
 * usos no justifican un peldaño nuevo.
 *
 * **Por qué esto es un test y no una revisión.** Las dos reglas se incumplen de
 * una en una y nunca a propósito: alguien baja un rótulo a diez para que quepa
 * en una línea, y tiene razón —cabe— y la pantalla se ve mejor. El daño no se
 * ve en la captura, se ve en el uso, y para entonces hay cuarenta sitios así.
 * Un repaso a ojo encuentra los de esa semana; una regla los encuentra todos y
 * los sigue encontrando.
 *
 * **Lo que esta regla no ve, y conviene no fingir que sí.** Sólo mide controles
 * con un tamaño escrito en números. Un `Pressable` que crece por su relleno
 * —lo más común— pasa sin que se compruebe nada, porque el alto sale del texto
 * de dentro y del tipo de letra del sistema, y eso no está en el código. Es una
 * red que atrapa la clase de fallo más frecuente, no todas.
 *
 * **La excepción está prevista y es explícita.** Un control puede verse pequeño
 * —un chip de filtro mide 32 de alto en Material— siempre que su **área táctil**
 * llegue a 44, y en React Native eso se hace con `hitSlop`. Así que la regla no
 * es «todo mide 44», es «todo se puede tocar en 44», que es lo que dice la guía
 * de verdad.
 *
 * **La cuarta regla es de la misma familia y llegó con «Relieve».** Esa
 * dirección promete **una sola fuente de luz**: arriba a la izquierda, para
 * toda la aplicación. Basta con que una pantalla escriba su propia sombra
 * —«aquí queda mejor un poco más abajo»— para que la promesa se rompa, y el
 * fallo no se ve en esa captura: se ve al poner las dos pantallas juntas, donde
 * de pronto hay dos soles. Por eso el relieve se pide a `lib/relieve` y no se
 * escribe: es la misma lógica que la escala de tamaños, con las sombras.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Mínimo de tamaño de texto, en puntos. */
const MIN_FONT_SIZE = 11;

/** Mínimo de área táctil, en puntos. */
const MIN_TOUCH_TARGET = 44;

/* `process.cwd()` y no `import.meta.url`: el `tsconfig` de la aplicación
   compila a un módulo que no admite `import.meta`, y vitest arranca desde la
   raíz del paquete, así que apunta al mismo sitio. */
const ROOT = `${process.cwd()}/`;

/**
 * La escala, leída del código y no copiada aquí.
 *
 * Se lee con una expresión regular en vez de importar `lib/theme`, porque ese
 * módulo importa `react-native` y este test corre en Node pelado. Es menos
 * elegante y tiene una ventaja: si alguien añade un escalón a la escala, la
 * regla lo acepta sola; si alguien lo mete a mano en un componente, no.
 */
function scale(): number[] {
  const source = readFileSync(join(ROOT, 'lib/theme.ts'), 'utf8');
  const block = /export const fontSize = \{([\s\S]*?)\n\} as const;/.exec(source);
  if (!block?.[1]) throw new Error('No se encontró la escala en lib/theme.ts');
  return [...block[1].matchAll(/:\s*(\d+)\s*,/g)].map((match) => Number(match[1]));
}

function sources(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.tsx')) found.push(full);
    }
  };
  walk(join(ROOT, 'app'));
  walk(join(ROOT, 'components'));
  return found.sort();
}

const relative = (path: string) => path.slice(ROOT.length);

describe('tamaño de texto', () => {
  it('la escala entera llega al mínimo de 11 pt', () => {
    /* El suelo se comprueba **en la escala**, no en cada pantalla: es el único
       sitio donde se decide un tamaño, así que es el único que hay que mirar.
       Si el suelo se cumple aquí, se cumple en toda la aplicación. */
    expect(scale().filter((size) => size < MIN_FONT_SIZE)).toEqual([]);
  });

  it('ninguna pantalla escribe un tamaño a mano', () => {
    const offenders: string[] = [];
    for (const file of sources()) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          const match = /fontSize:\s*(\d+)\b/.exec(line);
          if (!match) return;
          const size = Number(match[1]);
          const known = scale().includes(size);
          offenders.push(
            `${relative(file)}:${index + 1} → ${size}${
              known ? ' (está en la escala: úsalo por su nombre)' : ' (no está en la escala)'
            }`,
          );
        });
    }
    expect(
      offenders,
      `Tamaños escritos a mano en vez de tomados de theme.fontSize:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

describe('la luz', () => {
  /*
   * Dónde sí se puede escribir una sombra a mano, y por qué.
   *
   * `ajustes` dibuja la miniatura de **cada** dirección con los valores de esa
   * dirección, no con los de la que esté puesta: es un retrato de la opción, y
   * `useRelief` devolvería siempre la luz de la activa. Es la misma excepción
   * que ya tiene con el color y la tipografía, unas líneas más abajo en el
   * mismo componente.
   */
  const ALLOWED = ['app/ajustes.tsx'];

  it('ninguna pantalla escribe su propia sombra de relieve', () => {
    const offenders: string[] = [];

    for (const file of sources()) {
      if (ALLOWED.includes(relative(file))) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/\bboxShadow\s*:/.test(line)) {
            offenders.push(`${relative(file)}:${index + 1}`);
          }
        });
    }

    expect(
      offenders,
      `Sombras escritas a mano en vez de pedidas a useRelief():\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

describe('área táctil', () => {
  it('todo lo que se toca llega a 44 pt, con o sin hitSlop', () => {
    const offenders: string[] = [];

    for (const file of sources()) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (!line.includes('<Pressable')) return;

        /* El bloque de propiedades del `Pressable`: desde la etiqueta hasta que
           se cierra. Cuarenta y cinco líneas de tope porque alguno lleva un
           estilo largo, y porque leer más metería dentro los hijos. */
        const block = lines.slice(index, index + 45);
        const end = block.findIndex(
          (candidate, offset) => offset > 0 && /^\s*\/?>\s*$/.test(candidate),
        );
        const props = block.slice(0, end === -1 ? block.length : end + 1).join('\n');

        const dimension = (key: string): number | null => {
          const match = new RegExp(`\\b${key}:\\s*(\\d+)\\b`).exec(props);
          return match ? Number(match[1]) : null;
        };

        /* `hitSlop` amplía el área táctil sin tocar el dibujo, que es la salida
           que da la propia guía para un control que tiene que verse pequeño.
           Se admite en número —se reparte a los cuatro lados— o en objeto. */
        const slopNumber = /hitSlop=\{(\d+)\}/.exec(props);
        const slopVertical = /hitSlop=\{\{[^}]*?(?:top|vertical):\s*(\d+)/.exec(props);
        const slopHorizontal = /hitSlop=\{\{[^}]*?(?:left|horizontal):\s*(\d+)/.exec(props);
        const padVertical = Number(slopNumber?.[1] ?? slopVertical?.[1] ?? 0) * 2;
        const padHorizontal = Number(slopNumber?.[1] ?? slopHorizontal?.[1] ?? 0) * 2;

        const height = dimension('minHeight') ?? dimension('height');
        const width = dimension('minWidth') ?? dimension('width');

        const short: string[] = [];
        if (height !== null && height + padVertical < MIN_TOUCH_TARGET) {
          short.push(`alto ${height}${padVertical ? ` + ${padVertical} de hitSlop` : ''}`);
        }
        if (width !== null && width + padHorizontal < MIN_TOUCH_TARGET) {
          short.push(`ancho ${width}${padHorizontal ? ` + ${padHorizontal} de hitSlop` : ''}`);
        }
        if (short.length > 0) {
          offenders.push(`${relative(file)}:${index + 1} → ${short.join(', ')}`);
        }
      });
    }

    expect(
      offenders,
      `Controles por debajo de ${MIN_TOUCH_TARGET} pt de área táctil:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

/*
 * La cuarta regla: un gesto nunca es el único camino.
 *
 * Es la que menos se ve y la que más deja fuera. Una hoja que solo sube
 * arrastrando y un mapa que solo se acerca pellizcando funcionan para quien
 * los descubre con el pulgar; quien navega con lector de pantalla, o con una
 * mano ocupada por la correa, no descubre nada. La guía de plataforma lo dice
 * con otras palabras —«no dependas de gestos para funciones esenciales»— y el
 * repositorio lo venía cumpliendo a mano: el asa de la hoja es un botón, los
 * botones de acercar y alejar existen. Aquí queda escrito, para que un
 * refactor que quite un botón porque «ya hay gesto» no pase.
 */
describe('gestos con camino sin gesto', () => {
  it('la hoja cambia de posición con un toque en el asa, no solo arrastrando', () => {
    const source = readFileSync(join(ROOT, 'components/sheet.tsx'), 'utf8');
    expect(source).toMatch(/Gesture\.Pan\(\)/);
    /* El asa es un `Pressable` que pasa a la siguiente posición y lo anuncia
       como expandido o no: es el camino sin gesto. */
    expect(source).toMatch(/nextDetent\(/);
    expect(source).toMatch(/accessibilityState=\{\{\s*expanded/);
  });

  it('cada gesto del mapa tiene su botón gemelo en la pantalla del mapa', () => {
    const map = readFileSync(join(ROOT, 'components/mini-map.tsx'), 'utf8');
    const screen = readFileSync(join(ROOT, 'app/(tabs)/explorar.tsx'), 'utf8');
    const twins: Array<[gesture: RegExp, button: string]> = [
      [/Gesture\.Pinch\(\)/, 'label="Acercar"'],
      [/Gesture\.Pinch\(\)/, 'label="Alejar"'],
      [/Gesture\.Pan\(\)/, 'label="Volver a donde estás"'],
    ];
    for (const [gesture, button] of twins) {
      if (!gesture.test(map)) continue;
      expect(screen, `El mapa tiene ${gesture} y a la pantalla le falta ${button}`).toContain(
        button,
      );
    }
  });
});
