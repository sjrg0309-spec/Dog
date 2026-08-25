/**
 * El acento de la interfaz, que es el del animal que se está mirando.
 *
 * La aplicación deja de tener **un** color de marca y pasa a tener el del perro
 * activo: al cambiar de Nina a Kira, los botones, el foco y los estados
 * cambian con ella. No es un tema por usuario ni una paleta que se elige en
 * ajustes — es que la pantalla se pinta del color del animal del que va.
 *
 * ## Por qué esto no es «tomar un color de la foto»
 *
 * Sacar un acento del píxel medio de un retrato es lo que hace todo el mundo y
 * aquí rompería tres cosas a la vez:
 *
 *  1. **El contraste.** Este proyecto tiene AA escrito como aserción. Un color
 *     arbitrario no lo cumple; lo cumplen los pasos de una rampa que ya se
 *     colocaron donde lo cumplen.
 *  2. **Los significados reservados.** El rojo de extraviados y el terracota de
 *     «en vivo» significan **una** cosa. Un pelaje canela produce un matiz que
 *     cae justo ahí, y en este repositorio eso ya pasó una vez con la paleta
 *     original: marca en matiz 36 y aviso de perro perdido en matiz 35, **un
 *     grado de diferencia**. Un acento libre reabre ese agujero en cada perro
 *     nuevo.
 *  3. **La coherencia del dibujo.** Los pelajes ya salen de las rampas del
 *     producto —terracota, ámbar, salvia, azul—, así que el color del perro ya
 *     *es* un color de la interfaz. No hay nada que extraer: hay que nombrarlo.
 *
 * Así que un acento es **una rampa entera, elegida de una lista cerrada**, y de
 * ahí salen los cinco escalones que el botón necesita.
 *
 * ## Son tres y no cuatro, y eso lo decidió un test
 *
 * El terracota era el candidato obvio —es el color de marca original y el
 * pelaje más común de la semilla— y no puede ser un acento. En tema oscuro su
 * paso resultó ser **literalmente el mismo token** que el anillo de «en vivo»:
 * distancia cero. Y en claro se queda a 0,064 del rojo de extraviados, por
 * debajo del suelo. No es que quede mal: es que en esta paleta **la banda
 * cálida ya está hablada** por dos significados que no pueden compartirse, y un
 * botón de acción del color del aviso de perro perdido vacía el aviso.
 *
 * El rojo tampoco está, por lo mismo y de forma más obvia. Quedan salvia,
 * ámbar y azul, que es lo que hay disponible de verdad; los pelajes cálidos
 * llevan ámbar, que es el vecino legible de su familia.
 *
 * ## Qué cambia y qué no
 *
 * Cambian los cinco tokens de la acción primaria y el anillo de foco. **No**
 * cambian el fondo, el texto, los estados de aviso, el rojo de extraviados ni
 * el terracota de «en vivo»: si el color de peligro dependiera del perro que
 * tengas seleccionado, el peligro dejaría de tener color.
 */

import { amber, blue, bone, sage } from './primitives.js';
import type { SemanticTokens } from './semantic.js';

/** Los tokens que un acento sustituye. Ni uno más. */
type AccentSlots = Pick<
  SemanticTokens,
  'primary' | 'primaryForeground' | 'primaryHover' | 'primaryActive' | 'focusRing'
>;

export type AccentId = 'sage' | 'amber' | 'blue';

export const ACCENT_IDS: readonly AccentId[] = ['sage', 'amber', 'blue'];

/** Cómo se llama en pantalla, para poder decir de dónde sale el color. */
export const ACCENT_LABEL: Record<AccentId, string> = {
  sage: 'salvia',
  amber: 'ámbar',
  blue: 'azul',
};

/**
 * Cada acento, en sus dos temas.
 *
 * Los pasos no están elegidos a ojo: en claro el relleno va oscuro con texto
 * hueso encima, y en oscuro va claro con texto del propio matiz al 900. Es la
 * misma escalera para los cuatro, y el test la comprueba entera —reposo, hover
 * y pulsado— en los dos temas.
 */
export const ACCENTS: Record<AccentId, { light: AccentSlots; dark: AccentSlots }> = {
  sage: {
    light: {
      primary: sage[600],
      primaryForeground: bone[0],
      primaryHover: sage[700],
      primaryActive: sage[800],
      focusRing: sage[600],
    },
    dark: {
      primary: sage[400],
      primaryForeground: sage[900],
      primaryHover: sage[300],
      primaryActive: sage[200],
      focusRing: sage[300],
    },
  },
  amber: {
    light: {
      primary: amber[700],
      primaryForeground: bone[0],
      primaryHover: amber[800],
      primaryActive: amber[900],
      focusRing: amber[700],
    },
    dark: {
      /* Aquí la escalera **baja** en vez de subir, y no es un descuido.
         El anillo de «en vivo» en tema oscuro es terracota al 80,5 % de
         claridad, y la banda útil del ámbar pasa justo por ahí: el paso que
         tocaba por simetría se quedaba en 0,088 de distancia y el siguiente
         intento, con más croma, empeoró a 0,073 —en OKLab manda la claridad, y
         los dos estaban a medio punto—. El 200 se separa 0,128 y da 10,3 de
         contraste con su propio texto, que es lo mejor de la rampa por los dos
         lados.
         Como arranca casi en el techo, el hover y el pulsado tienen que
         oscurecer: aclarar no cabe. Es lo que hace cualquier píldora clara al
         tocarla, así que se lee bien. */
      primary: amber[200],
      primaryForeground: amber[900],
      primaryHover: amber[300],
      primaryActive: amber[400],
      focusRing: amber[300],
    },
  },
  blue: {
    light: {
      primary: blue[600],
      primaryForeground: bone[0],
      primaryHover: blue[700],
      primaryActive: blue[800],
      focusRing: blue[600],
    },
    dark: {
      primary: blue[300],
      primaryForeground: blue[900],
      primaryHover: blue[200],
      primaryActive: blue[100],
      focusRing: blue[300],
    },
  },
};

/**
 * Un tema con el acento puesto.
 *
 * Devuelve un objeto nuevo en vez de mutar el que recibe: los temas son
 * constantes compartidas por toda la aplicación, y teñir el objeto original
 * dejaría a cualquiera que lo hubiera leído antes con el color del último perro
 * que alguien miró.
 */
export function applyAccent<T extends SemanticTokens>(
  theme: T,
  accent: AccentId,
  mode: 'light' | 'dark',
): T {
  return { ...theme, ...ACCENTS[accent][mode] };
}
