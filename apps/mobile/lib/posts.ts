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

export type Post = {
  id: string;
  petId: string;
  petName: string;
  authorName: string;
  /**
   * Ruta del objeto en el almacenamiento, o URI local si la acaba de elegir el
   * tutor. Vacía significa que aún no se ha subido nada.
   */
  imageUri: string | null;
  imagePath: string;
  imageAlt: string;
  caption: string;
  placeName: string | null;
  createdAt: Date;
  likeCount: number;
  likedByMe: boolean;
  comments: PostComment[];
};

export type PostComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * 3_600_000);

/** Espeja `posts` de la semilla: los mismos textos, los mismos autores. */
export const SEED_POSTS: Post[] = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    petId: '20000000-0000-4000-8000-000000000001',
    petName: 'Nina',
    authorName: 'Marta R.',
    imageUri: null,
    imagePath: 'posts/nina-pelota.jpg',
    imageAlt:
      'Nina, border collie blanca y negra, con una pelota en la boca sobre la hierba',
    caption:
      'Cuarenta minutos y no ha soltado la pelota ni una vez. Mañana a las siete, como siempre.',
    placeName: 'Parque Central',
    createdAt: hoursAgo(3),
    likeCount: 2,
    likedByMe: false,
    comments: [
      {
        id: 'c1',
        authorName: 'Carlos M.',
        body: 'Nosotros salimos a esa hora también. Nos vemos mañana.',
        createdAt: hoursAgo(2),
      },
      {
        id: 'c2',
        authorName: 'Diego S.',
        body: 'Esa pelota le va a durar dos días.',
        createdAt: hoursAgo(1),
      },
    ],
  },
  {
    id: '60000000-0000-4000-8000-000000000002',
    petId: '20000000-0000-4000-8000-000000000002',
    petName: 'Toby',
    authorName: 'Carlos M.',
    imageUri: null,
    imagePath: 'posts/toby-charco.jpg',
    imageAlt: 'Toby, mestizo marrón, empapado saliendo de un charco',
    caption: 'Ha encontrado el único charco del parque. Obviamente.',
    placeName: 'Parque Central',
    createdAt: hoursAgo(9),
    likeCount: 1,
    likedByMe: true,
    comments: [],
  },
  {
    id: '60000000-0000-4000-8000-000000000003',
    petId: '20000000-0000-4000-8000-000000000003',
    petName: 'Rocky',
    authorName: 'Diego S.',
    imageUri: null,
    imagePath: 'posts/rocky-sombra.jpg',
    imageAlt: 'Rocky, galgo español, tumbado a la sombra de un árbol',
    caption:
      'A esta hora ya no hay nadie y se está mejor. Los martes y jueves salimos a las once.',
    placeName: 'Parque del Retiro',
    createdAt: hoursAgo(24),
    likeCount: 1,
    likedByMe: false,
    comments: [
      {
        id: 'c3',
        authorName: 'Carlos M.',
        body: 'Buena idea lo de las once. En verano no se puede antes.',
        createdAt: hoursAgo(20),
      },
    ],
  },
  {
    id: '60000000-0000-4000-8000-000000000005',
    petId: '20000000-0000-4000-8000-00000000000c',
    petName: 'Kira',
    authorName: 'Marta R.',
    imageUri: null,
    imagePath: 'posts/kira-sombra.jpg',
    imageAlt: 'Kira, bulldog francés, jadeando a la sombra',
    caption:
      'Hoy media hora y a casa. La app no me dejaba ni eso a mediodía y tenía razón.',
    placeName: 'Parque del Retiro',
    createdAt: hoursAgo(72),
    likeCount: 0,
    likedByMe: false,
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

export function usePostsOf(petId: string): Post[] {
  return useFeed().filter((post) => post.petId === petId);
}

export function toggleLike(postId: string): void {
  posts = posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          likedByMe: !post.likedByMe,
          likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
        }
      : post,
  );
  emit();
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
  imageUri: string;
  imageAlt: string;
  caption: string;
  placeName: string | null;
};

/** La publicación nueva entra arriba, que es donde el autor espera verla. */
export function publish(draft: NewPost): void {
  posts = [
    {
      id: `local-${posts.length}-${draft.petId}`,
      petId: draft.petId,
      petName: draft.petName,
      authorName: draft.authorName,
      imageUri: draft.imageUri,
      imagePath: 'pendiente-de-subida',
      imageAlt: draft.imageAlt.trim(),
      caption: draft.caption.trim(),
      placeName: draft.placeName,
      createdAt: new Date(),
      likeCount: 0,
      likedByMe: false,
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
