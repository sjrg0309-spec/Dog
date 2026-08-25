/**
 * La ilustración, generada.
 *
 * Este fichero existe por un problema concreto: **el feed estaba muerto**. Cada
 * tarjeta era un rectángulo gris con el texto alternativo dentro, y una
 * aplicación de fotos sin ninguna foto no se ve austera, se ve rota.
 *
 * La razón para no meter fotos era buena y sigue en pie: las imágenes de archivo
 * de perros que no son de nadie tienen dueño, y un feed lleno de ellas se ve
 * como una maqueta. La salida no es rendirse: es **dibujar**. Lo que hay aquí
 * es obra original generada, no una foto ni un recorte de nadie.
 *
 * Tres reglas que la hacen servir de algo en lugar de ser un adorno:
 *
 *  1. **Determinista por animal.** El mismo perro sale siempre igual, y dos
 *     vecinos salen distintos. Si cambiara entre recargas, la ilustración
 *     dejaría de servir para reconocer a nadie, que es lo único que hace.
 *  2. **La hora manda en el color.** Una publicación de las siete de la mañana
 *     tiene cielo de amanecer y una de las once de la noche, de noche. La
 *     aplicación entera gira alrededor de a qué hora se pasea; el dibujo lo
 *     dice sin una palabra.
 *  3. **Con los colores del producto.** Salen de las mismas rampas OKLCH que la
 *     interfaz. No es una paleta de ilustración aparte, que es lo que hace que
 *     un dibujo se vea pegado encima.
 *
 * Y lo que **no** hace: pasar por una foto. El texto alternativo sigue siendo
 * obligatorio y sigue describiendo lo que el tutor dice que hay en la imagen,
 * no lo que este generador ha dibujado.
 */

import type { AccentId } from '@petnav/tokens';
import {
  amber,
  blue,
  bone,
  ink,
  oklchToHex,
  sage,
  terracotta,
} from '@petnav/tokens';

const hex = (value: string) => oklchToHex(value);

/** Un número estable a partir de una cadena. Mismo animal, mismo dibujo. */
export function hashOf(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/** Generador determinista: cada llamada avanza, siempre en el mismo orden. */
function rng(seed: number) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export type TimeOfDay = 'dawn' | 'day' | 'golden' | 'night';

export function timeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'golden';
  return 'night';
}

/**
 * Las cuatro paletas de cielo.
 *
 * «Las seis de la tarde» era la dirección visual del proyecto desde el primer
 * día: luz cálida y baja, parque, movimiento. `golden` es esa, y las otras tres
 * existen porque esta aplicación sirve también a las siete de la mañana y a las
 * once de la noche, que es su razón de ser.
 */
const SKIES: Record<TimeOfDay, { top: string; bottom: string; sun: string; glow: string }> = {
  dawn: { top: hex(blue[300]), bottom: hex(amber[200]), sun: hex(amber[300]), glow: hex(amber[100]) },
  day: { top: hex(blue[300]), bottom: hex(bone[100]), sun: hex(amber[300]), glow: hex(bone[25]) },
  golden: {
    top: hex(terracotta[300]),
    bottom: hex(amber[200]),
    sun: hex(terracotta[500]),
    glow: hex(amber[100]),
  },
  night: { top: hex(ink[950]), bottom: hex(ink[700]), sun: hex(bone[200]), glow: hex(ink[600]) },
};

const GROUNDS: Record<TimeOfDay, { near: string; far: string; hill: string }> = {
  dawn: { near: hex(sage[500]), far: hex(sage[400]), hill: hex(sage[300]) },
  day: { near: hex(sage[500]), far: hex(sage[400]), hill: hex(sage[300]) },
  golden: { near: hex(sage[600]), far: hex(sage[500]), hill: hex(sage[400]) },
  night: { near: hex(sage[900]), far: hex(sage[800]), hill: hex(ink[800]) },
};

/**
 * Pelajes. Salen de las rampas cálidas: el dibujo y la interfaz comparten color.
 *
 * Cada uno lleva **su acento**, que es el color con el que se pinta la
 * aplicación entera cuando ese animal está seleccionado. Se elige a mano y no
 * se deriva del cuerpo por dos motivos: hay pelajes neutros —el negro y el
 * hueso— que no dan ningún color, y la banda cálida de esta paleta está
 * reservada al aviso de extraviado y al estado en vivo. Lo que sí lo determina
 * es el **collar**, que es la mancha de color con la que se reconoce a un perro
 * en su retrato; donde el collar es neutro se toma el vecino legible de la
 * familia del pelaje.
 *
 * Cada uno lleva además su **fondo de retrato** elegido a mano y no derivado del
 * propio pelaje. Derivarlo fue lo primero que probé y se veía en la captura: un perro
 * claro sobre un degradado de su propio color desaparecía dentro del círculo.
 * El fondo tiene que contrastar con el animal, no acompañarlo.
 */
const COATS = [
  {
    body: hex(terracotta[600]),
    belly: hex(terracotta[300]),
    collar: hex(sage[600]),
    accent: 'sage' as const,
    backdrop: [hex(sage[200]), hex(sage[400])] as const,
  },
  {
    body: hex(ink[800]),
    belly: hex(bone[200]),
    collar: hex(terracotta[500]),
  // Collar terracota, acento ámbar: el terracota ya es «en vivo».
    accent: 'amber' as const,
    backdrop: [hex(amber[200]), hex(amber[300])] as const,
  },
  {
    body: hex(bone[300]),
    belly: hex(bone[100]),
    collar: hex(blue[500]),
    accent: 'blue' as const,
    backdrop: [hex(blue[300]), hex(blue[500])] as const,
  },
  {
    body: hex(terracotta[800]),
    belly: hex(terracotta[400]),
    collar: hex(amber[300]),
    accent: 'amber' as const,
    backdrop: [hex(bone[100]), hex(bone[300])] as const,
  },
  {
    body: hex(amber[500]),
    belly: hex(amber[200]),
    collar: hex(ink[700]),
  // Collar de carbón, que no es un color: manda el pelaje, que es ámbar.
    accent: 'amber' as const,
    backdrop: [hex(sage[400]), hex(sage[600])] as const,
  },
  {
    body: hex(ink[600]),
    belly: hex(ink[300]),
    collar: hex(sage[400]),
    accent: 'sage' as const,
    backdrop: [hex(terracotta[200]), hex(terracotta[400])] as const,
  },
];

export type Primitive =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill: string; opacity?: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; opacity?: number; rotate?: number }
  | { kind: 'path'; d: string; fill?: string; stroke?: string; width?: number; opacity?: number }
  | {
      kind: 'gradientRect';
      x: number;
      y: number;
      w: number;
      h: number;
      from: string;
      to: string;
      /**
       * Opacidad de cada parada.
       *
       * Hacía falta para las capas atmosféricas: una bruma o un viraje de color
       * tienen que **desaparecer** por un lado, y eso no se puede decir con un
       * color sólido. En SVG la transparencia de una parada es su propio
       * atributo, no parte del color, así que un `rgba()` en `stopColor` no
       * hace nada en varios renderizadores.
       */
      fromOpacity?: number;
      toOpacity?: number;
    }
  /**
   * El viñeteado: los bordes caen y el centro se queda.
   *
   * Es lo que más barato convierte un dibujo plano en algo que se lee como una
   * foto. Una ilustración vectorial tiene luz uniforme de esquina a esquina, y
   * ninguna cámara hace eso: toda lente oscurece los bordes. Sin esto, el feed
   * parecía un cuento; con esto, parece una foto con filtro — que es exactamente
   * el registro de Instagram.
   *
   * Va siempre la última, encima de todo lo demás.
   */
  | { kind: 'vignette'; strength: number };

export type Scene = {
  width: number;
  height: number;
  items: Primitive[];
  /** El color dominante, para poder teñir lo que va encima sin medirlo. */
  keyColor: string;
  time: TimeOfDay;
  /**
   * Identificador único de esta escena.
   *
   * Existe por un fallo que solo se vio al renderizar varias juntas: los `id`
   * de un degradado SVG son globales al documento, no locales al `<svg>`. Con
   * dieciséis escenas en la misma pantalla —y el feed son justo eso— todas
   * referenciaban `#g0` y heredaban el cielo de la primera. Todas salían con el
   * mismo azul, incluidas las de medianoche.
   */
  uid: string;
};

export type Pose = 'run' | 'sit' | 'stand' | 'lie';

/**
 * El perro, compuesto de primitivas y no de un trazado dibujado a mano.
 *
 * Se construye por partes —cuerpo, patas, cabeza, morro, oreja, cola— porque
 * así las proporciones son parámetros y no una curva congelada: un galgo y un
 * bulldog salen del mismo código con dos números distintos.
 */
function dog(options: {
  x: number;
  y: number;
  scale: number;
  pose: Pose;
  coat: (typeof COATS)[number];
  long: number;
  legs: number;
  floppyEars: boolean;
  facingLeft: boolean;
}): Primitive[] {
  const { x, y, scale: s, pose, coat, long, legs, floppyEars, facingLeft } = options;
  const dir = facingLeft ? -1 : 1;
  const px = (value: number) => x + value * s * dir;
  const py = (value: number) => y + value * s;

  const legLen = pose === 'lie' ? 4 : legs;
  const bodyY = pose === 'lie' ? -legLen - 4 : pose === 'sit' ? -legLen - 9 : -legLen - 10;
  const items: Primitive[] = [];

  // Patas traseras primero: quedan detrás del cuerpo.
  const backLegX = -long * 0.5;
  if (pose !== 'lie') {
    const spread = pose === 'run' ? 5 : 2;
    for (const offset of [-spread, spread]) {
      items.push({
        kind: 'rect',
        x: px(backLegX + offset) - 2.2 * s,
        y: py(bodyY + 4),
        w: 4.4 * s,
        h: (legLen + 6) * s,
        r: 2.2 * s,
        fill: coat.body,
      });
    }
  }

  // Cola.
  const tailBase = { x: px(backLegX - 2), y: py(bodyY + 1) };
  const tailTip =
    pose === 'run'
      ? { x: px(backLegX - 16), y: py(bodyY - 8) }
      : { x: px(backLegX - 13), y: py(bodyY - 11) };
  items.push({
    kind: 'path',
    d: `M ${tailBase.x} ${tailBase.y} Q ${px(backLegX - 13)} ${py(bodyY + 4)} ${tailTip.x} ${tailTip.y}`,
    stroke: coat.body,
    width: 4 * s,
  });

  // Cuerpo.
  items.push({
    kind: 'ellipse',
    cx: px(0),
    cy: py(bodyY),
    rx: (long * 0.55 + 6) * s,
    ry: 9 * s,
    fill: coat.body,
  });
  items.push({
    kind: 'ellipse',
    cx: px(0),
    cy: py(bodyY + 4),
    rx: (long * 0.4) * s,
    ry: 4.5 * s,
    fill: coat.belly,
    opacity: 0.9,
  });

  // Patas delanteras.
  const frontLegX = long * 0.42;
  if (pose !== 'lie') {
    const spread = pose === 'run' ? -6 : 2;
    for (const offset of [spread, -1]) {
      items.push({
        kind: 'rect',
        x: px(frontLegX + offset) - 2.2 * s,
        y: py(bodyY + 3),
        w: 4.4 * s,
        h: (legLen + 7) * s,
        r: 2.2 * s,
        fill: coat.body,
      });
    }
  }

  // Cuello y cabeza.
  const headX = long * 0.55 + 5;
  const headY = pose === 'sit' ? bodyY - 13 : bodyY - 10;
  items.push({
    kind: 'rect',
    x: px(long * 0.35) - 3.5 * s,
    y: py(headY),
    w: 7 * s,
    h: 12 * s,
    r: 3.5 * s,
    fill: coat.body,
  });
  items.push({ kind: 'ellipse', cx: px(headX), cy: py(headY), rx: 8 * s, ry: 7.5 * s, fill: coat.body });

  // Morro.
  items.push({
    kind: 'rect',
    x: px(headX) + (facingLeft ? -13 * s : 4 * s),
    y: py(headY + 1),
    w: 9 * s,
    h: 6 * s,
    r: 3 * s,
    fill: coat.belly,
  });
  items.push({
    kind: 'ellipse',
    cx: px(headX + 12),
    cy: py(headY + 2.5),
    rx: 1.8 * s,
    ry: 1.5 * s,
    fill: hex(ink[900]),
  });

  // Oreja: caída o de punta. Es lo que más cambia la cara de un perro a otro.
  if (floppyEars) {
    items.push({
      kind: 'ellipse',
      cx: px(headX - 4),
      cy: py(headY + 1),
      rx: 3.4 * s,
      ry: 7 * s,
      fill: coat.body,
    });
  } else {
    items.push({
      kind: 'path',
      d: `M ${px(headX - 6)} ${py(headY - 4)} L ${px(headX - 3)} ${py(headY - 14)} L ${px(headX + 1)} ${py(headY - 5)} Z`,
      fill: coat.body,
    });
  }

  // Ojo.
  items.push({
    kind: 'ellipse',
    cx: px(headX + 3),
    cy: py(headY - 1),
    rx: 1.3 * s,
    ry: 1.5 * s,
    fill: hex(ink[950]),
  });

  // Collar. Va siempre: es un perro con tutor, no un perro suelto.
  items.push({
    kind: 'rect',
    x: px(long * 0.35) - 4 * s,
    y: py(headY + 8),
    w: 8 * s,
    h: 2.6 * s,
    r: 1.3 * s,
    fill: coat.collar,
  });

  return items;
}

/** Un árbol. Copa redonda o de pino, según el sitio. */
function tree(x: number, groundY: number, height: number, pine: boolean, colors: { near: string; far: string }): Primitive[] {
  const trunk: Primitive = {
    kind: 'rect',
    x: x - height * 0.045,
    y: groundY - height * 0.42,
    w: height * 0.09,
    h: height * 0.42,
    r: height * 0.02,
    fill: hex(ink[700]),
    opacity: 0.85,
  };

  if (pine) {
    return [
      trunk,
      {
        kind: 'path',
        d: `M ${x} ${groundY - height} L ${x + height * 0.3} ${groundY - height * 0.35} L ${x - height * 0.3} ${groundY - height * 0.35} Z`,
        fill: colors.far,
      },
      {
        kind: 'path',
        d: `M ${x} ${groundY - height * 0.82} L ${x + height * 0.36} ${groundY - height * 0.2} L ${x - height * 0.36} ${groundY - height * 0.2} Z`,
        fill: colors.near,
      },
    ];
  }

  return [
    trunk,
    { kind: 'ellipse', cx: x, cy: groundY - height * 0.62, rx: height * 0.34, ry: height * 0.3, fill: colors.far },
    { kind: 'ellipse', cx: x - height * 0.16, cy: groundY - height * 0.5, rx: height * 0.24, ry: height * 0.22, fill: colors.near },
  ];
}

/**
 * El color de la aplicación cuando este animal está seleccionado.
 *
 * Sale del **mismo sorteo** que su pelaje, y esa es toda la gracia: no es un
 * color asignado aparte que además pega, es literalmente el color de su
 * retrato. Si mañana cambiara la forma de repartir pelajes, el acento cambiaría
 * con él y seguirían casando, porque es la misma línea de código la que decide
 * las dos cosas.
 */
export function accentOf(petId: string): AccentId {
  const petRandom = rng(hashOf(petId));
  const coat = COATS[Math.floor(petRandom() * COATS.length)] ?? COATS[0]!;
  return coat.accent;
}

/**
 * La escena entera.
 *
 * `seed` es el identificador de lo que se ilustra —una publicación, un estado,
 * un reel—, no el del animal: dos fotos del mismo perro tienen que salir
 * distintas o el feed vuelve a parecer una plantilla. El pelaje sí sale del
 * animal, así que el perro se reconoce entre escenas.
 */
export function buildScene(options: {
  seed: string;
  petId: string;
  at: Date;
  width: number;
  height: number;
  pose?: Pose;
  /**
   * Qué se está dibujando.
   *
   * `pet` es lo de siempre: el animal es el sujeto. `place` dibuja **el sitio y
   * nadie dentro**, que es lo que necesita la galería de un espacio en
   * alquiler: enseñar un patio con un perro que no es el tuyo sería vender la
   * foto de otro animal como si fuera parte del sitio.
   */
  subject?: 'pet' | 'place';
  /** En un sitio, si está vallado se dibuja la valla. El dibujo dice el dato. */
  fenced?: boolean;
}): Scene {
  const { seed, petId, at, width, height } = options;
  const subject = options.subject ?? 'pet';
  const random = rng(hashOf(seed));
  const petRandom = rng(hashOf(petId));

  const time = timeOfDay(at);
  const sky = SKIES[time];
  const ground = GROUNDS[time];

  const coat = COATS[Math.floor(petRandom() * COATS.length)] ?? COATS[0]!;
  const long = 16 + petRandom() * 12;
  const legs = 7 + petRandom() * 7;
  const floppyEars = petRandom() > 0.45;

  const poses: Pose[] = ['run', 'sit', 'stand', 'lie'];
  const pose = options.pose ?? poses[Math.floor(random() * poses.length)] ?? 'stand';

  const horizon = height * (0.58 + random() * 0.08);
  const items: Primitive[] = [];

  // Cielo.
  items.push({ kind: 'gradientRect', x: 0, y: 0, w: width, h: horizon + 2, from: sky.top, to: sky.bottom });

  // Sol o luna, y su halo.
  const sunX = width * (0.15 + random() * 0.7);
  const sunY = horizon * (0.28 + random() * 0.3);
  const sunR = Math.min(width, height) * 0.075;
  items.push({ kind: 'ellipse', cx: sunX, cy: sunY, rx: sunR * 2.3, ry: sunR * 2.3, fill: sky.glow, opacity: 0.35 });
  items.push({ kind: 'ellipse', cx: sunX, cy: sunY, rx: sunR, ry: sunR, fill: sky.sun });

  // De noche, unas estrellas. Es lo que hace que el paseo de las once no se vea
  // como el de las once de la mañana con el cielo apagado.
  if (time === 'night') {
    for (let index = 0; index < 14; index += 1) {
      const sx = random() * width;
      const sy = random() * horizon * 0.7;
      items.push({ kind: 'ellipse', cx: sx, cy: sy, rx: 1.2, ry: 1.2, fill: hex(bone[100]), opacity: 0.5 + random() * 0.4 });
    }
  }

  // Colinas del fondo.
  items.push({
    kind: 'ellipse',
    cx: width * (0.2 + random() * 0.2),
    cy: horizon + height * 0.06,
    rx: width * 0.45,
    ry: height * 0.12,
    fill: ground.hill,
  });
  items.push({
    kind: 'ellipse',
    cx: width * (0.7 + random() * 0.2),
    cy: horizon + height * 0.05,
    rx: width * 0.4,
    ry: height * 0.1,
    fill: ground.far,
  });

  // Suelo.
  items.push({ kind: 'rect', x: 0, y: horizon, w: width, h: height - horizon, fill: ground.near });

  /*
   * Nubes: tres manchas blandas, con la opacidad muy baja.
   *
   * Un cielo de degradado limpio no existe fuera de un renderizador. No hacen
   * falta nubes dibujadas —eso volvería a ser ilustración—: bastan tres
   * elipses solapadas de blanco al 10 %, que es lo que hace un cielo con
   * bruma alta y lo que rompe la banda perfecta del degradado.
   */
  const cloudCount = 2 + Math.floor(random() * 2);
  for (let index = 0; index < cloudCount; index += 1) {
    const cx = width * (0.1 + random() * 0.8);
    const cy = horizon * (0.2 + random() * 0.45);
    const cw = width * (0.16 + random() * 0.18);
    for (let puff = 0; puff < 3; puff += 1) {
      items.push({
        kind: 'ellipse',
        cx: cx + (puff - 1) * cw * 0.45,
        cy: cy + (puff === 1 ? -cw * 0.1 : 0),
        rx: cw * (0.5 + random() * 0.25),
        ry: cw * (0.18 + random() * 0.1),
        fill: '#ffffff',
        opacity: 0.1 + random() * 0.06,
      });
    }
  }

  // Árboles, detrás del perro.
  const treeCount = 2 + Math.floor(random() * 3);
  const trunks: { x: number; height: number }[] = [];
  for (let index = 0; index < treeCount; index += 1) {
    const tx = width * (0.08 + random() * 0.84);
    const th = height * (0.16 + random() * 0.14);
    trunks.push({ x: tx, height: th });
    items.push(...tree(tx, horizon + height * 0.02, th, random() > 0.6, { near: ground.near, far: ground.far }));
  }

  /*
   * Sombras de contacto, y por qué van **después** de los árboles.
   *
   * Es la señal de realismo más barata que existe y la que más se echa de
   * menos sin saber por qué: un objeto sin sombra no está apoyado en el suelo,
   * está pegado encima como una calcomanía. Era exactamente lo que pasaba
   * aquí —árboles flotando sobre una alfombra verde—.
   *
   * Van encima del suelo y de los troncos porque una sombra se proyecta sobre
   * lo que hay, no debajo. Elipse aplastada, oscura y muy transparente: una
   * sombra opaca es un agujero, no una sombra.
   */
  for (const trunk of trunks) {
    items.push({
      kind: 'ellipse',
      cx: trunk.x,
      cy: horizon + height * 0.025,
      rx: trunk.height * 0.3,
      ry: trunk.height * 0.055,
      fill: '#1d2b1f',
      opacity: 0.16,
    });
  }

  /*
   * La valla, cuando el sitio la tiene.
   *
   * Solo en las escenas de sitio: en una foto de paseo la valla no significa
   * nada, y en la ficha de un patio en alquiler es **el dato que más se mira**.
   * Va delante de los árboles y detrás de la hierba, que es donde estaría.
   */
  if (subject === 'place' && options.fenced) {
    const fenceY = horizon + (height - horizon) * 0.36;
    const postCount = Math.max(6, Math.round(width / 46));
    const step = width / postCount;
    const postHeight = Math.min(width, height) * 0.11;
    const wood = time === 'night' ? hex(bone[400]) : hex(bone[300]);
    for (let index = 0; index <= postCount; index += 1) {
      const px = index * step;
      items.push({
        kind: 'rect',
        x: px - 2,
        y: fenceY - postHeight,
        w: 4,
        h: postHeight,
        fill: wood,
      });
    }
    for (const ratio of [0.32, 0.68]) {
      items.push({
        kind: 'rect',
        x: 0,
        y: fenceY - postHeight * ratio - 2,
        w: width,
        h: 4,
        fill: wood,
      });
    }
  }

  // El perro, sobre la línea del suelo y a un tercio del ancho.
  // El perro es el sujeto: ocupa sitio. A escala menor la escena se leía como
  // un paisaje con un bicho pequeño en una esquina.
  const dogScale = Math.min(width, height) / 135;
  const dogX = width * (0.32 + random() * 0.3);
  const dogY = horizon + (height - horizon) * (0.62 + random() * 0.18);
  if (subject === 'pet') {
    items.push(
      ...dog({
        x: dogX,
        y: dogY,
        scale: dogScale,
        pose,
        coat,
        long,
        legs,
        floppyEars,
        facingLeft: random() > 0.5,
      }),
    );
  }

  // Una pelota, cuando corre. Es la mitad de lo que se publica aquí.
  if (subject === 'pet' && pose === 'run') {
    items.push({
      kind: 'ellipse',
      cx: dogX + width * 0.22,
      cy: dogY - height * 0.02,
      rx: Math.min(width, height) * 0.022,
      ry: Math.min(width, height) * 0.022,
      fill: hex(terracotta[500]),
    });
  }

  // Matas de hierba en primer plano: dan profundidad sin tapar nada.
  for (let index = 0; index < 7; index += 1) {
    const gx = random() * width;
    const gy = horizon + (height - horizon) * (0.55 + random() * 0.45);
    const gh = Math.min(width, height) * (0.02 + random() * 0.025);
    items.push({
      kind: 'path',
      d: `M ${gx} ${gy} Q ${gx + gh * 0.4} ${gy - gh} ${gx + gh * 0.1} ${gy - gh * 1.4}`,
      stroke: time === 'night' ? hex(sage[800]) : hex(sage[700]),
      width: 2,
      opacity: 0.75,
    });
  }

  /*
   * Las tres capas que separan un dibujo de una foto.
   *
   * Ninguna añade un objeto a la escena; las tres cambian **la luz**, que es
   * justo lo que un dibujo vectorial no tiene: color plano de esquina a esquina
   * y contraste idéntico al fondo que delante.
   *
   *  1. **Bruma en el horizonte.** A distancia el aire aclara y desatura. Sin
   *     ella, un árbol lejano y uno cercano tienen el mismo verde, y eso es lo
   *     primero que delata una ilustración.
   *  2. **Viraje.** Un tono que cruza el cuadro entero —cálido abajo, frío
   *     arriba, o al revés según la hora—. Es lo que hace una lente, y lo que
   *     imita cualquier filtro de Instagram.
   *  3. **Viñeteado.** Los bordes caen. Toda lente lo hace; ninguna ilustración.
   *
   * Van en este orden y las tres al final, encima de todo lo demás.
   */
  items.push({
    kind: 'gradientRect',
    x: 0,
    y: horizon - height * 0.16,
    w: width,
    h: height * 0.24,
    from: sky.bottom,
    to: sky.bottom,
    fromOpacity: 0,
    toOpacity: 0.42,
  });

  items.push({
    kind: 'gradientRect',
    x: 0,
    y: 0,
    w: width,
    h: height,
    from: sky.top,
    to: ground.near,
    fromOpacity: 0.16,
    toOpacity: 0.1,
  });

  items.push({ kind: 'vignette', strength: 0.34 });

  return {
    width,
    height,
    items,
    keyColor: sky.bottom,
    time,
    uid: hashOf(`${seed}|${petId}`).toString(36),
  };
}

/**
 * El retrato: solo la cabeza, grande y de frente al espectador.
 *
 * Una escena entera dentro de un círculo de 40 px es una mancha. El avatar
 * necesita otra cosa: la cara, con el pelaje y las orejas del animal, que es lo
 * que de verdad sirve para reconocerlo en una fila.
 */
export function buildPortrait(petId: string, size: number): Scene {
  const petRandom = rng(hashOf(petId));
  const coat = COATS[Math.floor(petRandom() * COATS.length)] ?? COATS[0]!;
  petRandom();
  petRandom();
  const floppyEars = petRandom() > 0.45;

  const cx = size / 2;
  // La cara va un poco por debajo del centro: deja sitio arriba para las orejas
  // de punta, que antes se cortaban contra el borde del círculo.
  const cy = size * 0.56;
  const head = size * 0.27;

  const items: Primitive[] = [
    { kind: 'gradientRect', x: 0, y: 0, w: size, h: size, from: coat.backdrop[0], to: coat.backdrop[1] },
  ];

  // Orejas, detrás de la cabeza.
  for (const side of [-1, 1]) {
    if (floppyEars) {
      items.push({
        kind: 'ellipse',
        cx: cx + side * head * 0.85,
        cy: cy + head * 0.15,
        rx: head * 0.34,
        ry: head * 0.62,
        fill: coat.body,
      });
    } else {
      items.push({
        kind: 'path',
        d: `M ${cx + side * head * 0.5} ${cy - head * 0.55} L ${cx + side * head * 0.95} ${cy - head * 1.28} L ${cx + side * head * 0.98} ${cy - head * 0.2} Z`,
        fill: coat.body,
      });
    }
  }

  // Cabeza, hocico, nariz y ojos.
  items.push({ kind: 'ellipse', cx, cy: cy - head * 0.05, rx: head, ry: head * 0.95, fill: coat.body });
  items.push({
    kind: 'ellipse',
    cx,
    cy: cy + head * 0.5,
    rx: head * 0.55,
    ry: head * 0.42,
    fill: coat.belly,
  });
  items.push({ kind: 'ellipse', cx, cy: cy + head * 0.3, rx: head * 0.17, ry: head * 0.13, fill: hex(ink[950]) });
  for (const side of [-1, 1]) {
    items.push({
      kind: 'ellipse',
      cx: cx + side * head * 0.4,
      cy: cy - head * 0.25,
      rx: head * 0.13,
      ry: head * 0.15,
      fill: hex(ink[950]),
    });
  }

  // Collar, asomando por abajo. Es lo que dice que tiene tutor.
  items.push({
    kind: 'rect',
    x: cx - head * 0.75,
    y: cy + head * 0.95,
    w: head * 1.5,
    h: head * 0.26,
    r: head * 0.13,
    fill: coat.collar,
  });

  return {
    width: size,
    height: size,
    items,
    keyColor: coat.body,
    time: 'day',
    uid: hashOf(`retrato|${petId}|${size}`).toString(36),
  };
}

/** La escena a SVG plano. Lo usa la vista previa y la página de demostración. */
export function sceneToSvg(scene: Scene): string {
  const body = scene.items
    .map((item, index) => {
      const opacity =
        'opacity' in item && item.opacity !== undefined ? ` opacity="${item.opacity}"` : '';
      switch (item.kind) {
        case 'gradientRect':
          return `<defs><linearGradient id="g-${scene.uid}-${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${item.from}"/><stop offset="1" stop-color="${item.to}"/></linearGradient></defs><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="url(#g-${scene.uid}-${index})"/>`;
        case 'rect':
          return `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="${item.r ?? 0}" fill="${item.fill}"${opacity}/>`;
        case 'ellipse':
          return `<ellipse cx="${item.cx}" cy="${item.cy}" rx="${item.rx}" ry="${item.ry}" fill="${item.fill}"${opacity}/>`;
        case 'path':
          return `<path d="${item.d}" fill="${item.fill ?? 'none'}" stroke="${item.stroke ?? 'none'}" stroke-width="${item.width ?? 1}" stroke-linecap="round"${opacity}/>`;
      }
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}">${body}</svg>`;
}
