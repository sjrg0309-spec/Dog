/**
 * Las tres direcciones visuales, como dato.
 *
 * Una dirección **no es una paleta**: es una paleta, una tipografía y una
 * forma. Separarlas en tres ajustes distintos —color por aquí, letra por allá—
 * produce combinaciones que nadie ha diseñado y que casi siempre son peores que
 * cualquiera de las tres enteras. Aquí van juntas y se cambian de una pieza.
 *
 *  - **Nocturno.** Negro puro y la foto mandando. El acento es acromático —el
 *    botón principal es blanco sobre negro— y el único color que aparece está
 *    reservado a un estado: en vivo, o peligro. Es la respuesta literal a «como
 *    Instagram».
 *  - **Papel.** Blanco de imprenta, tinta casi negra, titulares en Bricolage
 *    Grotesque y un solo azul. Aguanta de pie sin una sola foto, que es
 *    exactamente el estado de una aplicación recién instalada.
 *  - **Señal.** Pizarra y ámbar de alta visibilidad, letra grande, esquinas
 *    blandas y áreas táctiles crecidas. Pensada para lo que de verdad se hace
 *    con esto: mirarla de noche, en la calle, con una mano.
 *  - **Relieve.** Todo es del mismo color y lo que separa las cosas es la luz:
 *    una tarjeta sale del fondo, un campo se hunde en él. Es el «Soft UI» de
 *    toda la vida, con una condición que aquí no se negocia y se explica abajo:
 *    el relieve **acompaña** al contraste, nunca lo sustituye.
 *
 * **Cada dirección trae sus dos fondos.** Claro y oscuro siguen siendo un
 * ajuste, porque una aplicación que se usa a las siete de la mañana y a las
 * once de la noche no puede tener un solo fondo. Lo que no cambia entre los dos
 * es la identidad: la dirección manda, el fondo la acompaña.
 *
 * Los 45 tokens semánticos **no se escriben a mano seis veces**. Cada fondo
 * declara una semilla de veinte valores y el resto se deriva mezclando: los
 * estados de pulsado, los tintes suaves, los bordes. Escribir 270 hexadecimales
 * a mano garantiza que tres de ellos acaben mal y que nadie lo note.
 */

import { useSyncExternalStore } from 'react';

import type { SemanticTokens } from '@petnav/tokens';

export const DIRECTION_IDS = ['nocturno', 'papel', 'senal', 'relieve'] as const;
export type DirectionId = (typeof DIRECTION_IDS)[number];

/* ------------------------------------------------------------------ mezcla */

const hex = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

const parse = (value: string): [number, number, number] => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

/** `t` es cuánto del segundo color entra: 0 devuelve `a`, 1 devuelve `b`. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return `#${hex(ar + (br - ar) * t)}${hex(ag + (bg - ag) * t)}${hex(ab + (bb - ab) * t)}`;
}

const channel = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Contraste WCAG entre dos hexadecimales. Lo usan los tests de esta paleta. */
export function contrastHex(a: string, b: string): number {
  const lum = (value: string): number => {
    const [r, g, bl] = parse(value);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
  };
  const one = lum(a);
  const two = lum(b);
  const hi = Math.max(one, two);
  const lo = Math.min(one, two);
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ semilla */

type Seed = {
  bg: string;
  surface: string;
  elevated: string;
  sunken: string;
  fg: string;
  /** El texto secundario. Tiene que pasar AA sobre `bg`, no «verse bien». */
  mut: string;
  line: string;
  /** Sirve **a la vez** de color de texto sobre el fondo y de relleno de botón. */
  primary: string;
  primaryOn: string;
  /** El estado «ahora mismo». Nunca decora. */
  live: string;
  danger: string;
  dangerOn: string;
  ok: string;
  okOn: string;
  warn: string;
  warnOn: string;
  info: string;
  infoOn: string;
  /** El calor del mapa. Se mantiene entre fondos para que el mapa no cambie. */
  heat: string;
};

function build(seed: Seed, isDark: boolean): SemanticTokens {
  /* Pulsar oscurece en claro y aclara en oscuro. Es la misma regla en las tres
     direcciones, y por eso se deriva en vez de escribirse. */
  const push = isDark ? '#ffffff' : '#000000';
  const tint = (color: string, amount = isDark ? 0.84 : 0.88): string =>
    mix(color, seed.bg, amount);
  const onTint = (color: string): string => mix(color, seed.fg, isDark ? 0.35 : 0.3);

  return {
    background: seed.bg,
    foreground: seed.fg,
    surface: seed.surface,
    surfaceForeground: seed.fg,
    surfaceElevated: seed.elevated,
    surfaceSunken: seed.sunken,

    primary: seed.primary,
    primaryForeground: seed.primaryOn,
    primaryHover: mix(seed.primary, push, 0.16),
    primaryActive: mix(seed.primary, push, 0.32),

    secondary: mix(seed.fg, seed.bg, 0.92),
    secondaryForeground: seed.fg,
    secondaryHover: mix(seed.fg, seed.bg, 0.86),
    secondaryActive: mix(seed.fg, seed.bg, 0.78),

    muted: mix(seed.fg, seed.bg, 0.93),
    mutedForeground: seed.mut,

    /* El tinte del acento, no el acento. Es el fondo de la pastilla de la
       pestaña activa y de los chips seleccionados; encima va `accentForeground`,
       y el icono va de `primary`. Los tres tienen que convivir. */
    accent: tint(seed.primary),
    accentForeground: onTint(seed.primary),

    liveRing: seed.live,
    liveSurface: tint(seed.live),
    liveForeground: onTint(seed.live),

    destructive: seed.danger,
    destructiveForeground: seed.dangerOn,
    destructiveHover: mix(seed.danger, push, 0.18),
    success: seed.ok,
    successForeground: seed.okOn,
    successSurface: tint(seed.ok),
    warning: seed.warn,
    warningForeground: seed.warnOn,
    warningSurface: tint(seed.warn),
    information: seed.info,
    informationForeground: seed.infoOn,
    informationSurface: tint(seed.info),

    chartTrack: mix(seed.mut, seed.bg, 0.45),
    mapHeat: seed.heat,

    border: seed.line,
    borderStrong: mix(seed.line, seed.fg, 0.42),

    input: seed.surface,
    inputForeground: seed.fg,
    inputPlaceholder: seed.mut,
    focusRing: seed.primary,

    overlay: isDark ? '#000000c4' : '#0b0b0f8c',
    shadowSm: isDark
      ? '0 1px 2px rgba(0,0,0,0.5)'
      : '0 1px 2px rgba(11,11,15,0.07), 0 1px 3px rgba(11,11,15,0.05)',
    shadowMd: isDark
      ? '0 4px 16px rgba(0,0,0,0.6)'
      : '0 4px 12px rgba(11,11,15,0.09), 0 2px 4px rgba(11,11,15,0.05)',
    colorScheme: isDark ? 'dark' : 'light',
  } as unknown as SemanticTokens;
}

/* ------------------------------------------------------------------- radios */

export type RadiusScale = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  full: number;
};

/* --------------------------------------------------------------- tipografía */

export type FontSet = {
  body: string;
  bodyBold: string;
  displaySemibold: string;
  displayBold: string;
  displayExtrabold: string;
};

/**
 * El par de luces de una dirección con relieve.
 *
 * Neumorfismo es una sola idea: una fuente de luz fija arriba a la izquierda.
 * De ahí salen exactamente dos colores —el brillo que deja la luz en el canto
 * de arriba y la sombra que cae en el de abajo— y con esos dos se dibuja todo:
 * lo que sobresale los lleva por fuera, lo hundido los lleva por dentro y del
 * revés. No hay un tercer color, ni una sombra «de tarjeta grande»: cambia la
 * distancia, no el color.
 */
export type Relief = {
  /** El brillo. Arriba a la izquierda, siempre más claro que la superficie. */
  light: string;
  /** La sombra. Abajo a la derecha, siempre más oscura que la superficie. */
  dark: string;
};

/**
 * Las direcciones sin relieve declaran `null`, y no es un hueco: es la
 * respuesta a «¿esta dirección se dibuja con luz?». Con `null` los componentes
 * caen a lo de siempre —filete de un pelo y sombra suave— en vez de intentar un
 * relieve de mentira sobre una paleta que no lo aguanta.
 */
export type ReliefSet = { light: Relief; dark: Relief } | null;

export type Direction = {
  id: DirectionId;
  name: string;
  tagline: string;
  light: SemanticTokens;
  dark: SemanticTokens;
  radius: RadiusScale;
  fonts: FontSet;
  /**
   * Si la foto va de borde a borde o dentro de un marco.
   *
   * Es la diferencia de forma más visible de las tres y no se puede sacar de un
   * radio: en «Señal» la foto respira dentro de la tarjeta; en las otras dos
   * corta la pantalla de lado a lado, que es lo que hace que mande.
   */
  media: 'bleed' | 'inset';
  /** Cuánto crecen las áreas táctiles respecto al suelo de 44. */
  touchBoost: number;
  /** Las dos luces, si la dirección se dibuja con relieve. */
  relief: ReliefSet;
};

const NOCTURNO_DARK: Seed = {
  bg: '#000000',
  surface: '#000000',
  elevated: '#1c1c1e',
  sunken: '#0a0a0a',
  fg: '#ffffff',
  mut: '#a3a3a3',
  line: '#292929',
  primary: '#ffffff',
  primaryOn: '#000000',
  live: '#ff6a3d',
  danger: '#ff453a',
  dangerOn: '#1a0301',
  ok: '#32d74b',
  okOn: '#04220a',
  warn: '#ffd60a',
  warnOn: '#221c00',
  info: '#64d2ff',
  infoOn: '#00202f',
  heat: '#ff9f0a',
};

const NOCTURNO_LIGHT: Seed = {
  bg: '#ffffff',
  surface: '#ffffff',
  elevated: '#ffffff',
  sunken: '#f5f5f5',
  fg: '#000000',
  mut: '#666666',
  line: '#dbdbdb',
  primary: '#000000',
  primaryOn: '#ffffff',
  live: '#c53d10',
  danger: '#c9000f',
  dangerOn: '#ffffff',
  ok: '#14713a',
  okOn: '#ffffff',
  warn: '#7a5600',
  warnOn: '#ffffff',
  info: '#0a4fbf',
  infoOn: '#ffffff',
  heat: '#a85400',
};

const PAPEL_LIGHT: Seed = {
  bg: '#ffffff',
  surface: '#ffffff',
  elevated: '#ffffff',
  sunken: '#f4f4f5',
  fg: '#111114',
  mut: '#5b5b63',
  line: '#e4e4e7',
  primary: '#1b3be0',
  primaryOn: '#ffffff',
  live: '#a83f16',
  danger: '#c31d1d',
  dangerOn: '#ffffff',
  ok: '#0f6b3a',
  okOn: '#ffffff',
  warn: '#7d5300',
  warnOn: '#ffffff',
  info: '#1b3be0',
  infoOn: '#ffffff',
  heat: '#a83f16',
};

const PAPEL_DARK: Seed = {
  bg: '#0c0c0f',
  surface: '#131317',
  elevated: '#1c1c22',
  sunken: '#08080a',
  fg: '#f4f4f6',
  mut: '#a3a3ad',
  line: '#2a2a32',
  primary: '#96aaff',
  primaryOn: '#050c2b',
  live: '#ff9b6a',
  danger: '#ff7b76',
  dangerOn: '#2a0505',
  ok: '#5fd18b',
  okOn: '#052012',
  warn: '#f0c65e',
  warnOn: '#241a00',
  info: '#96aaff',
  infoOn: '#050c2b',
  heat: '#ff9b6a',
};

const SENAL_DARK: Seed = {
  bg: '#0e151b',
  surface: '#18212b',
  elevated: '#22303d',
  sunken: '#0a1015',
  fg: '#f1f6f9',
  mut: '#9daebb',
  line: '#283746',
  primary: '#ffb000',
  primaryOn: '#0e151b',
  live: '#ff8a2b',
  danger: '#ff5b47',
  dangerOn: '#28070a',
  ok: '#4ec9a0',
  okOn: '#04241b',
  warn: '#ffb000',
  warnOn: '#0e151b',
  info: '#6ab8ff',
  infoOn: '#041d33',
  heat: '#ff8a2b',
};

/*
 * «Señal» en claro es la variante de cortesía, no su forma verdadera.
 *
 * El ámbar es un relleno, no un texto: #ffb000 sobre un fondo claro no llega ni
 * a 2:1, así que un icono ámbar sobre blanco sería un icono que no se ve. En
 * claro, `primary` baja a un ámbar tostado que sí se lee, y el ámbar de verdad
 * se queda donde funciona —el botón principal y el anillo de en vivo—. Es la
 * única concesión de las tres, y se dice en vez de disimularse.
 */
const SENAL_LIGHT: Seed = {
  bg: '#f4f7f9',
  surface: '#ffffff',
  elevated: '#ffffff',
  sunken: '#e7edf1',
  fg: '#0e151b',
  mut: '#495a68',
  line: '#d2dbe2',
  primary: '#87550a',
  primaryOn: '#ffffff',
  live: '#a8500c',
  danger: '#b62414',
  dangerOn: '#ffffff',
  ok: '#0d6b53',
  okOn: '#ffffff',
  warn: '#87550a',
  warnOn: '#ffffff',
  info: '#0a5aa8',
  infoOn: '#ffffff',
  heat: '#a8500c',
};

/*
 * «Relieve»: todo del mismo color, y la luz hace el resto.
 *
 * El neumorfismo tiene un fallo conocido y aquí está corregido a propósito: en
 * su forma de manual, el texto y los iconos también se hunden en el fondo —gris
 * sobre gris— y la interfaz deja de leerse en cuanto hay sol. Esta dirección se
 * queda con la parte buena —el relieve como material— y **no negocia el
 * contraste**: la letra es pizarra sobre el gris azulado, el texto apagado pasa
 * de 5:1, y las mismas veinte medidas que aprueban a las otras tres la aprueban
 * a ella. El relieve separa **superficies**; el color separa **texto**. Nunca
 * se cambian los papeles.
 *
 * La segunda regla, que se ve en la paleta: `surface` **es** `background`. Es
 * el punto entero del estilo —una tarjeta no es un papel más claro puesto
 * encima, es el mismo material abombado— y por eso lo hundido baja solo un
 * escalón: si el relieve no llegara a pintarse, la ranura de un campo se
 * seguiría distinguiendo del fondo.
 */
const RELIEVE_LIGHT: Seed = {
  bg: '#e0e5ec',
  /* Igual que el fondo, a propósito: lo que levanta la tarjeta es la luz. */
  surface: '#e0e5ec',
  elevated: '#e8ecf2',
  sunken: '#d6dbe3',
  fg: '#2b3442',
  mut: '#565f70',
  /* Es el mismo gris azulado que la sombra de esta dirección. Un borde, cuando
     hace falta uno, no es más que la sombra vista de canto. */
  line: '#adb6c6',
  primary: '#3452b5',
  primaryOn: '#ffffff',
  live: '#a8460f',
  danger: '#b3261e',
  dangerOn: '#ffffff',
  ok: '#106b45',
  okOn: '#ffffff',
  warn: '#7a5300',
  warnOn: '#ffffff',
  info: '#0a55b0',
  infoOn: '#ffffff',
  heat: '#a8460f',
};

/*
 * En oscuro el fondo es carbón mate y no negro puro, y no por gusto: **sobre
 * negro no existe la sombra clara**. El relieve necesita poder ir un paso hacia
 * la luz y otro hacia la sombra desde la superficie, y el negro puro solo deja
 * uno. Es la misma razón por la que «Nocturno» no podría llevar relieve aunque
 * se quisiera.
 */
const RELIEVE_DARK: Seed = {
  bg: '#2e3239',
  surface: '#2e3239',
  elevated: '#383d46',
  sunken: '#262a30',
  fg: '#eef1f6',
  mut: '#a4aebd',
  line: '#3d434d',
  primary: '#8ba2f2',
  primaryOn: '#0b1330',
  live: '#ff9a63',
  danger: '#ff8078',
  dangerOn: '#2b0705',
  ok: '#5cd39b',
  okOn: '#04241a',
  warn: '#f5c65c',
  warnOn: '#241a00',
  info: '#8ba2f2',
  infoOn: '#0b1330',
  heat: '#ff9a63',
};

export const DIRECTIONS: Record<DirectionId, Direction> = {
  nocturno: {
    id: 'nocturno',
    name: 'Nocturno',
    tagline: 'Negro puro y la foto mandando',
    light: build(NOCTURNO_LIGHT, false),
    dark: build(NOCTURNO_DARK, true),
    /* Casi recto. La foto va a sangre y el resto se aparta. */
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 10, '2xl': 14, full: 9999 },
    fonts: {
      body: 'PlusJakartaSans_400Regular',
      bodyBold: 'PlusJakartaSans_700Bold',
      displaySemibold: 'PlusJakartaSans_600SemiBold',
      displayBold: 'PlusJakartaSans_700Bold',
      displayExtrabold: 'PlusJakartaSans_800ExtraBold',
    },
    media: 'bleed',
    touchBoost: 0,
    relief: null,
  },
  papel: {
    id: 'papel',
    name: 'Papel',
    tagline: 'Blanco de imprenta y un solo azul',
    light: build(PAPEL_LIGHT, false),
    dark: build(PAPEL_DARK, true),
    /* Imprenta: el filete es recto. Solo los avatares son redondos. */
    radius: { xs: 0, sm: 2, md: 3, lg: 4, xl: 6, '2xl': 8, full: 9999 },
    fonts: {
      body: 'AtkinsonHyperlegible_400Regular',
      bodyBold: 'AtkinsonHyperlegible_700Bold',
      displaySemibold: 'BricolageGrotesque_600SemiBold',
      displayBold: 'BricolageGrotesque_700Bold',
      displayExtrabold: 'BricolageGrotesque_800ExtraBold',
    },
    media: 'bleed',
    touchBoost: 0,
    relief: null,
  },
  senal: {
    id: 'senal',
    name: 'Señal',
    tagline: 'Ámbar de alta visibilidad, para la calle',
    light: build(SENAL_LIGHT, false),
    dark: build(SENAL_DARK, true),
    /* Blando y grande: se acierta con guante y se distingue de un vistazo. */
    radius: { xs: 6, sm: 10, md: 14, lg: 18, xl: 22, '2xl': 28, full: 9999 },
    fonts: {
      body: 'AtkinsonHyperlegible_400Regular',
      bodyBold: 'AtkinsonHyperlegible_700Bold',
      displaySemibold: 'AtkinsonHyperlegible_700Bold',
      displayBold: 'AtkinsonHyperlegible_700Bold',
      displayExtrabold: 'AtkinsonHyperlegible_700Bold',
    },
    media: 'inset',
    touchBoost: 8,
    relief: null,
  },
  relieve: {
    id: 'relieve',
    name: 'Relieve',
    tagline: 'Todo del mismo color, y la luz hace el resto',
    light: build(RELIEVE_LIGHT, false),
    dark: build(RELIEVE_DARK, true),
    /* Blando, pero menos que «Señal»: el relieve ya redondea de por sí —una
       esquina con brillo arriba y sombra abajo se lee más mullida de lo que
       mide—, así que pasarse convierte cada tarjeta en una pastilla. */
    radius: { xs: 8, sm: 12, md: 14, lg: 16, xl: 20, '2xl': 26, full: 9999 },
    fonts: {
      body: 'PlusJakartaSans_400Regular',
      bodyBold: 'PlusJakartaSans_700Bold',
      displaySemibold: 'PlusJakartaSans_600SemiBold',
      displayBold: 'PlusJakartaSans_700Bold',
      displayExtrabold: 'PlusJakartaSans_800ExtraBold',
    },
    /* La foto va dentro del marco. A sangre rompería la ilusión: una tarjeta
       de relieve es un objeto con canto, y un objeto con canto no tiene una
       fotografía saliéndose por el borde. */
    media: 'inset',
    touchBoost: 0,
    relief: {
      /* El par canónico del gris #e0e5ec, y los dos únicos colores que dibujan
         toda la interfaz en esta dirección. */
      light: { light: '#ffffff', dark: '#a3b1c6' },
      dark: { light: '#3a4049', dark: '#22262b' },
    },
  },
};

export const DIRECTION_LABEL: Record<DirectionId, string> = {
  nocturno: 'Nocturno',
  papel: 'Papel',
  senal: 'Señal',
  relieve: 'Relieve',
};

/* ------------------------------------------------------------------ almacén */

/*
 * La dirección vive en su propio almacén y no en `lib/settings`.
 *
 * Motivo concreto: `lib/fonts` tiene que leerla, y `lib/settings` importa el
 * catálogo de ajustes, que importa media aplicación. Un módulo de tipografías
 * que arrastre eso detrás es un ciclo esperando a ocurrir.
 */
let current: DirectionId = 'nocturno';
const listeners = new Set<() => void>();

export function subscribeDirection(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fuera de React —lo necesita `lib/fonts`, que no es un componente—. */
export function readDirection(): DirectionId {
  return current;
}

const snapshot = (): DirectionId => current;

export function useDirection(): DirectionId {
  return useSyncExternalStore(subscribeDirection, snapshot, snapshot);
}

export function setDirection(id: DirectionId): void {
  if (current === id) return;
  current = id;
  for (const listener of listeners) listener();
}

/** Los tests no se heredan entre sí. */
export function resetDirection(): void {
  current = 'nocturno';
  for (const listener of listeners) listener();
}
