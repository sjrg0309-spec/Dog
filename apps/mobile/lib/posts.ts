/**
 * Las publicaciones del feed.
 *
 * Una foto, un texto y, si el tutor quiere, el lugar. Es lo que la gente ya sabe
 * hacer sin que nadie se lo explique, y aquí tiene una función que no tiene en
 * una red social genérica: **el perro que sale en la foto está identificado**, y
 * ese es el motivo por el que le escribes a alguien con cuyo perro el tuyo
 * encaja al 92 %.
 *
 * Sobre las fotos de la demostración: no hay ninguna. No he metido fotos de
 * archivo de perros que no son de nadie, porque un feed lleno de eso se ve como
 * una maqueta y además esas fotos tienen dueño. Lo que hay es el hueco con su
 * texto alternativo, y **la subida funciona de verdad**: eliges una foto de tu
 * dispositivo y aparece en el feed. Es la parte que se puede comprobar.
 *
 * Y una decisión que no es de interfaz: el texto alternativo es obligatorio.
 * Una foto sin descripción no la ve todo el mundo, y en una aplicación cuyo
 * cuerpo de texto es Atkinson Hyperlegible por accesibilidad, dejar las
 * imágenes sin describir sería contradecirse.
 */

import { useSyncExternalStore } from 'react';

import { distanceMeters, formatDistance } from '@petnav/core';

/**
 * Las reacciones.
 *
 * «Me gusta» y «me encanta» con otro nombre serían maquillaje. Estas dos sí
 * significan cosas distintas y cualquiera con perro las distingue: lamer es
 * cariño y mover la cola es alegría. Son excluyentes entre sí, como en cualquier
 * feed: reaccionar dos veces a la misma foto no quiere decir nada.
 *
 * `bark` va aparte y no es una reacción: es compartir. Y en esta aplicación
 * compartir carga peso de verdad, porque una publicación de perro perdido
 * compartida es lo único que la saca del radio de la alerta.
 */
export const REACTIONS = [
  {
    id: 'lick',
    /** Verbo, no sustantivo: es lo que haces, no lo que dejas. */
    label: 'Lamer',
    past: 'Lamido',
    hint: 'Como un «me gusta», pero en perro.',
  },
  {
    id: 'wag',
    label: 'Mover la cola',
    past: 'Cola movida',
    hint: 'Para lo que da alegría de verdad.',
  },
] as const;

export type Reaction = (typeof REACTIONS)[number]['id'];

export type Post = {
  id: string;
  petId: string;
  petName: string;
  authorName: string;
  /**
   * Las fotos, en orden. Siempre hay al menos una.
   *
   * Es una lista y no un campo suelto porque una salida no es una foto: el
   * charco, el perro empapado y la cara de después son la misma historia, y
   * obligar a elegir una convierte el feed en un muestrario. Instagram lo
   * resolvió con el carrusel hace diez años y desde entonces es lo que la gente
   * espera al ver un contador «1/3».
   *
   * **Cada foto lleva su propia descripción**, no una para el conjunto. Un
   * lector de pantalla las recorre de una en una: una descripción compartida
   * diría lo mismo tres veces y las otras dos fotos serían tres imágenes sin
   * texto alternativo.
   */
  photos: readonly PostPhoto[];
  caption: string;
  placeName: string | null;
  /**
   * Dónde se publicó.
   *
   * Es lo que separa «Cerca de mí» de «Siguiendo». Un feed de vecindario que no
   * sabe dónde está cada cosa no es un feed de vecindario: es el mismo feed con
   * otro rótulo.
   */
  point: { lat: number; lng: number } | null;
  createdAt: Date;
  /** Cuántas de cada. El nombre de la reacción se queda en `REACTIONS`. */
  reactions: Record<Reaction, number>;
  /** La mía, si he puesto alguna. Solo puede haber una. */
  myReaction: Reaction | null;
  /** Ladridos: veces que se ha compartido. */
  barkCount: number;
  barkedByMe: boolean;
  /**
   * Guardada.
   *
   * Es la única acción de la tarjeta que **no ve nadie más**: las otras
   * publican algo. Por eso no lleva contador —cuánta gente ha guardado tu foto
   * es un dato que no le corresponde a nadie— y por eso vive en el perfil,
   * detrás de su propia pestaña.
   */
  savedByMe: boolean;
  comments: PostComment[];
};

export type PostPhoto = {
  /**
   * Ruta del objeto en el almacenamiento, o URI local si la acaba de elegir el
   * tutor. Nula mientras no hay foto: entonces se dibuja la escena generada.
   */
  uri: string | null;
  path: string;
  /** Obligatoria. Sin ella la publicación no la ve todo el mundo. */
  alt: string;
};

export type PostComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

/**
 * La hora de una publicación, anclada a una hora de paseo real.
 *
 * Antes era «hace N horas» sin más, y eso tenía un efecto que solo se vio al
 * dibujar: como el cielo de la ilustración sale de la hora, y las horas
 * relativas caían todas de madrugada, **el feed entero salía de noche**.
 *
 * Anclarlas no es maquillaje: esta aplicación gira alrededor de a qué hora sale
 * cada perro, así que una publicación de las 7:15 y otra de las 23:10 son dos
 * cosas distintas del producto y tienen que verse distintas.
 */
const atHour = (daysAgo: number, hour: number, minute: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  // Si la hora del paseo todavía no ha llegado hoy, la fecha caería en el
  // futuro y la tarjeta diría «ahora» para algo que no ha pasado. Se retrocede
  // un día. Sin esto, abrir la aplicación a las seis de la mañana ponía en el
  // feed un paseo de las siete y cuarenta.
  if (date.getTime() > Date.now()) date.setDate(date.getDate() - 1);
  return date;
};

/** Los puntos de los lugares de la semilla, para poder medir el «cerca de mí». */
const PLACE_POINTS = {
  central: { lat: 40.4098, lng: -3.6939 },
  retiro: { lat: 40.4153, lng: -3.6844 },
  berlin: { lat: 40.4562, lng: -3.6764 },
} as const;

/**
 * A quién sigue el tutor.
 *
 * Es lo que distingue las dos pestañas del feed, y por eso son distintas de
 * verdad: «Siguiendo» son estos, «Cerca de mí» es todo lo que caiga en el radio
 * elija a quien elija seguir.
 */
const FOLLOWING = new Set(['Carlos M.', 'Marta R.']);

/** Espeja `posts` de la semilla: los mismos textos, los mismos autores. */
export const SEED_POSTS: Post[] = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    petId: '20000000-0000-4000-8000-000000000001',
    petName: 'Nina',
    authorName: 'Marta R.',
    /* Tres fotos: la publicación con carrusel de la semilla. Está aquí para que
       el paginador y el contador «1/3» se vean funcionando desde el principio,
       y para que se note lo que cuesta de verdad — tres descripciones, una por
       foto, escritas por quien publica. */
    photos: [
      {
        uri: null,
        path: 'posts/nina-pelota.jpg',
        alt: 'Nina, border collie blanca y negra, con una pelota en la boca sobre la hierba',
      },
      {
        uri: null,
        path: 'posts/nina-carrera.jpg',
        alt: 'Nina corriendo de vuelta con la pelota, las orejas hacia atrás',
      },
      {
        uri: null,
        path: 'posts/nina-sentada.jpg',
        alt: 'Nina sentada delante de la pelota, esperando a que se la tiren otra vez',
      },
    ],
    caption:
      'Cuarenta minutos y no ha soltado la pelota ni una vez. Mañana a las siete, como siempre.',
    placeName: 'Parque Central',
    createdAt: atHour(0, 7, 40),
    point: PLACE_POINTS.central,
    reactions: { lick: 2, wag: 5 },
    myReaction: null,
    barkCount: 1,
    barkedByMe: false,
    savedByMe: false,
    comments: [
      {
        id: 'c1',
        authorName: 'Carlos M.',
        body: 'Nosotros salimos a esa hora también. Nos vemos mañana.',
        createdAt: atHour(0, 8, 5),
      },
      {
        id: 'c2',
        authorName: 'Diego S.',
        body: 'Esa pelota le va a durar dos días.',
        createdAt: atHour(0, 9, 30),
      },
    ],
  },
  {
    id: '60000000-0000-4000-8000-000000000002',
    petId: '20000000-0000-4000-8000-000000000002',
    petName: 'Toby',
    authorName: 'Carlos M.',
    photos: [
      {
        uri: null,
        path: 'posts/toby-charco.jpg',
        alt: 'Toby, mestizo marrón, empapado saliendo de un charco',
      },
      {
        uri: null,
        path: 'posts/toby-sacudida.jpg',
        alt: 'Toby sacudiéndose el agua con el parque de fondo',
      },
    ],
    caption: 'Ha encontrado el único charco del parque. Obviamente.',
    placeName: 'Parque Central',
    createdAt: atHour(0, 18, 25),
    point: PLACE_POINTS.central,
    reactions: { lick: 1, wag: 0 },
    myReaction: 'lick',
    barkCount: 0,
    barkedByMe: false,
    savedByMe: false,
    comments: [],
  },
  {
    id: '60000000-0000-4000-8000-000000000003',
    petId: '20000000-0000-4000-8000-000000000003',
    petName: 'Rocky',
    authorName: 'Diego S.',
    photos: [
      {
        uri: null,
        path: 'posts/rocky-sombra.jpg',
        alt: 'Rocky, galgo español, tumbado a la sombra de un árbol',
      },
    ],
    caption:
      'A esta hora ya no hay nadie y se está mejor. Los martes y jueves salimos a las once.',
    placeName: 'Parque del Retiro',
    createdAt: atHour(1, 23, 10),
    point: PLACE_POINTS.retiro,
    reactions: { lick: 0, wag: 1 },
    myReaction: null,
    barkCount: 0,
    barkedByMe: false,
    savedByMe: false,
    comments: [
      {
        id: 'c3',
        authorName: 'Carlos M.',
        body: 'Buena idea lo de las once. En verano no se puede antes.',
        createdAt: atHour(1, 23, 40),
      },
    ],
  },
  {
    id: '60000000-0000-4000-8000-000000000005',
    petId: '20000000-0000-4000-8000-00000000000c',
    petName: 'Kira',
    authorName: 'Marta R.',
    photos: [
      {
        uri: null,
        path: 'posts/kira-sombra.jpg',
        alt: 'Kira, bulldog francés, jadeando a la sombra',
      },
    ],
    caption:
      'Hoy media hora y a casa. La app no me dejaba ni eso a mediodía y tenía razón.',
    placeName: 'Parque del Retiro',
    createdAt: atHour(3, 13, 5),
    point: PLACE_POINTS.retiro,
    reactions: { lick: 3, wag: 1 },
    myReaction: 'wag',
    barkCount: 2,
    barkedByMe: false,
    savedByMe: false,
    comments: [],
  },
  {
    // Parque Berlín queda a más de cinco kilómetros. Existe para que el control
    // de radio haga algo de verdad: a 5 km esta publicación no sale y a 10 sí.
    id: '60000000-0000-4000-8000-000000000006',
    petId: '20000000-0000-4000-8000-000000000004',
    petName: 'Bruno',
    authorName: 'Pablo G.',
    photos: [
      {
        uri: null,
        path: 'posts/bruno-noche.jpg',
        alt: 'Bruno, pastor alemán cachorro, sentado bajo una farola',
      },
    ],
    caption: 'Primera semana saliendo de noche. Aquí a las once no hay nadie y él va más tranquilo.',
    placeName: 'Parque Berlín',
    createdAt: atHour(1, 6, 20),
    point: PLACE_POINTS.berlin,
    reactions: { lick: 1, wag: 2 },
    myReaction: null,
    barkCount: 0,
    barkedByMe: false,
    savedByMe: false,
    comments: [],
  },
];

let posts: Post[] = SEED_POSTS;
const listeners = new Set<() => void>();

function emit() {
  posts = [...posts];
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): Post[] => posts;

export function useFeed(): Post[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** El feed sin hook, para los tests. La pantalla usa `useFeed`. */
export function feedSnapshot(): Post[] {
  return snapshot();
}

/**
 * Las dos caras del feed.
 *
 * «Siguiendo» es el feed de siempre. «Cerca de mí» es el que hace que esta
 * aplicación sea de barrio y no de internet: enseña lo que se ha publicado
 * dentro de un radio, siga uno a quien siga.
 *
 * Es también el estado vacío honesto del primer día. Alguien que acaba de
 * instalarla no sigue a nadie, así que «Siguiendo» está vacío por definición y
 * «Cerca de mí» es lo único que tiene algo dentro.
 */
export type FeedScope = 'following' | 'nearby';

export const FEED_SCOPES: ReadonlyArray<{ id: FeedScope; label: string; hint: string }> = [
  { id: 'following', label: 'Siguiendo', hint: 'Solo de quien sigues.' },
  { id: 'nearby', label: 'Cerca de mí', hint: 'Todo lo publicado dentro del radio.' },
];

/** Radios que se pueden elegir para «Cerca de mí», en metros. */
export const NEARBY_RADII_M = [5000, 10000] as const;
export type NearbyRadius = (typeof NEARBY_RADII_M)[number];

export type ScopedPost = { post: Post; distanceLabel: string | null };

/**
 * El filtro, aparte del hook.
 *
 * Se separa para poder probarlo: un test que tuviera que montar un componente
 * de React para comprobar que una publicación a 5,2 km no entra en un radio de
 * 5 km estaría probando React, no la regla.
 */
export function scopePosts(
  all: readonly Post[],
  scope: FeedScope,
  from: { lat: number; lng: number },
  radiusM: number,
): ScopedPost[] {
  if (scope === 'following') {
    return all
      .filter((post) => FOLLOWING.has(post.authorName))
      .map((post) => ({ post, distanceLabel: null }));
  }

  return all
    .map((post): ScopedPost | null => {
      // Una publicación sin lugar no puede estar «cerca» de nada. Se queda
      // fuera en lugar de colarse con distancia cero, que es lo que haría un
      // valor por defecto mal elegido.
      if (!post.point) return null;
      const distance = distanceMeters(from, post.point);
      if (distance > radiusM) return null;
      // Por debajo de cincuenta metros no se dice la distancia: «a 0 m» se lee
      // como un dato roto, y de un sitio en el que ya estás lo que importa no
      // es cuántos metros faltan.
      return { post, distanceLabel: distance < 50 ? null : formatDistance(distance) };
    })
    .filter((entry): entry is ScopedPost => entry !== null);
}

/** Cuántas quedan fuera del radio, para poder decirlo en vez de recortar en silencio. */
export function countOutsideRadius(
  all: readonly Post[],
  from: { lat: number; lng: number },
  radiusM: number,
): number {
  return all.filter((post) => post.point !== null && distanceMeters(from, post.point) > radiusM)
    .length;
}

export function useScopedFeed(
  scope: FeedScope,
  from: { lat: number; lng: number },
  radiusM: NearbyRadius,
): ScopedPost[] {
  return scopePosts(useFeed(), scope, from, radiusM);
}

export function useOutsideRadiusCount(
  from: { lat: number; lng: number },
  radiusM: NearbyRadius,
): number {
  return countOutsideRadius(useFeed(), from, radiusM);
}

export function usePostsOf(petId: string): Post[] {
  return useFeed().filter((post) => post.petId === petId);
}

export function useSavedPosts(): Post[] {
  return useFeed().filter((post) => post.savedByMe);
}

/**
 * Reaccionar.
 *
 * Poner la misma reacción dos veces la quita, y poner otra sustituye a la
 * anterior. Es lo que hace cualquier feed y lo que espera cualquiera, pero aquí
 * hay que escribirlo porque son dos y no una: sin la exclusión, una foto podría
 * salir con «5 lamidos y 5 colas» de las mismas cinco personas.
 */
export function react(postId: string, reaction: Reaction): void {
  posts = posts.map((post) => {
    if (post.id !== postId) return post;

    const previous = post.myReaction;
    const next = previous === reaction ? null : reaction;
    const counts = { ...post.reactions };

    if (previous) counts[previous] = Math.max(0, counts[previous] - 1);
    if (next) counts[next] += 1;

    return { ...post, myReaction: next, reactions: counts };
  });
  emit();
}

/**
 * Ladrar: compartir.
 *
 * No se puede desladrar, y es a propósito. Compartir manda la publicación a
 * gente que no la tenía; retirarla del feed de otro no está en tu mano, así que
 * el botón no puede fingir que sí. Se puede ladrar una vez.
 */
export function bark(postId: string): void {
  posts = posts.map((post) =>
    post.id === postId && !post.barkedByMe
      ? { ...post, barkedByMe: true, barkCount: post.barkCount + 1 }
      : post,
  );
  emit();
}

/** Guardar y dejar de guardar. Sin contador: no es de nadie más. */
export function toggleSaved(postId: string): void {
  posts = posts.map((post) =>
    post.id === postId ? { ...post, savedByMe: !post.savedByMe } : post,
  );
  emit();
}

/** Cuántas reacciones tiene en total, que es lo que se enseña en el resumen. */
export function totalReactions(post: Post): number {
  return REACTIONS.reduce((sum, reaction) => sum + post.reactions[reaction.id], 0);
}

export function addComment(postId: string, body: string, authorName: string): void {
  const trimmed = body.trim();
  if (trimmed.length === 0) return;

  posts = posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          comments: [
            ...post.comments,
            {
              id: `c-${post.comments.length}-${post.id}`,
              authorName,
              body: trimmed,
              createdAt: new Date(),
            },
          ],
        }
      : post,
  );
  emit();
}

export type NewPost = {
  petId: string;
  petName: string;
  authorName: string;
  /** Una o varias, ya con su descripción cada una. */
  photos: readonly { uri: string; alt: string }[];
  caption: string;
  placeName: string | null;
  point: { lat: number; lng: number } | null;
};

/** La publicación nueva entra arriba, que es donde el autor espera verla. */
export function publish(draft: NewPost): void {
  posts = [
    {
      id: `local-${posts.length}-${draft.petId}`,
      petId: draft.petId,
      petName: draft.petName,
      authorName: draft.authorName,
      photos: draft.photos.map((photo) => ({
        uri: photo.uri,
        path: 'pendiente-de-subida',
        alt: photo.alt.trim(),
      })),
      caption: draft.caption.trim(),
      placeName: draft.placeName,
      point: draft.point,
      createdAt: new Date(),
      reactions: { lick: 0, wag: 0 },
      myReaction: null,
      barkCount: 0,
      barkedByMe: false,
      savedByMe: false,
      comments: [],
    },
    ...posts,
  ];
  emit();
}

/** "hace 3 h", "ayer". Sin falsa precisión: nadie necesita los segundos. */
export function timeAgo(date: Date, now = new Date()): string {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}

export const UPLOAD_NOTE =
  'La subida a almacenamiento no está conectada: no hay proyecto desplegado. La foto que elijas ' +
  'se queda en este dispositivo y en esta sesión, y la aplicación lo dice en lugar de aparentar ' +
  'que se ha guardado en algún sitio.';
