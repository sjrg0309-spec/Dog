/**
 * Los estados: lo que caduca a las 24 horas.
 *
 * Es la mecánica de las historias de Instagram y del estado de WhatsApp, y aquí
 * tiene una función que no tiene en ninguna de las dos: **el paseo de hoy no es
 * contenido, es un aviso**. «Estamos en el Retiro hasta las ocho» sirve durante
 * dos horas y estorba durante dos semanas. Que caduque solo no es una gracia de
 * producto: es lo que evita que el feed se llene de planes que ya pasaron.
 *
 * Tres decisiones que no son de interfaz:
 *
 *  1. **Caduca de verdad, y se calcula al leer.** No hay un trabajo que borre
 *     nada: un estado con `expiresAt` en el pasado deja de existir para todos
 *     los consumidores. Una caducidad que depende de que un proceso se acuerde
 *     no es una caducidad.
 *  2. **«Sin ver» es por espectador, no global.** Es lo único que hace útil una
 *     fila de estados; sin ello son cuatro círculos de adorno.
 *  3. **Quien publica ve quién lo ha visto; nadie más.** La lista de
 *     espectadores es del autor. En una aplicación donde se publica dónde
 *     estás, saber quién te ha mirado es información sensible en las dos
 *     direcciones.
 */

import { useSyncExternalStore } from 'react';

/** Cuánto vive un estado. Veinticuatro horas, como en todas partes. */
export const STORY_TTL_MS = 24 * 3_600_000;

export type StoryKind = 'photo' | 'video' | 'text';

export type Story = {
  id: string;
  petId: string;
  petName: string;
  authorName: string;
  kind: StoryKind;
  /** URI local del archivo elegido. Nula en la semilla: no hay medios. */
  uri: string | null;
  /**
   * Descripción del medio, obligatoria igual que en una publicación.
   *
   * En un estado importa más todavía: dura un día, así que quien no puede ver
   * la imagen no tiene una segunda oportunidad de enterarse.
   */
  alt: string;
  /** El texto encima del medio, o el estado entero cuando es de solo texto. */
  text: string;
  placeName: string | null;
  createdAt: Date;
  expiresAt: Date;
  viewedByMe: boolean;
  /** Quién lo ha visto. Solo lo lee el autor. */
  viewers: string[];
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const expiring = (createdAt: Date) => new Date(createdAt.getTime() + STORY_TTL_MS);

const seed = (
  partial: Omit<Story, 'expiresAt' | 'viewedByMe' | 'viewers'> & {
    viewedByMe?: boolean;
    viewers?: string[];
  },
): Story => ({
  ...partial,
  expiresAt: expiring(partial.createdAt),
  viewedByMe: partial.viewedByMe ?? false,
  viewers: partial.viewers ?? [],
});

let stories: Story[] = [
  seed({
    id: 'st-toby-1',
    petId: '20000000-0000-4000-8000-000000000002',
    petName: 'Toby',
    authorName: 'Carlos M.',
    kind: 'photo',
    uri: null,
    alt: 'Toby corriendo detrás de una pelota en la hierba del Parque Central',
    text: 'Mañana a las siete, como siempre',
    placeName: 'Parque Central',
    createdAt: hoursAgo(2),
    viewedByMe: true,
    viewers: ['Marta R.', 'Diego S.'],
  }),
  seed({
    id: 'st-toby-2',
    petId: '20000000-0000-4000-8000-000000000002',
    petName: 'Toby',
    authorName: 'Carlos M.',
    kind: 'text',
    uri: null,
    alt: '',
    text: 'Hoy hay obras en la entrada sur. Id por la puerta del este.',
    placeName: 'Parque Central',
    createdAt: hoursAgo(1),
    viewedByMe: true,
    viewers: ['Marta R.'],
  }),
  seed({
    id: 'st-rocky-1',
    petId: '20000000-0000-4000-8000-000000000003',
    petName: 'Rocky',
    authorName: 'Diego S.',
    kind: 'video',
    uri: null,
    alt: 'Rocky trotando despacio por el paseo del Parque Berlín, de noche',
    text: 'Las once y no hay nadie. Se está mejor así.',
    placeName: 'Parque Berlín',
    createdAt: hoursAgo(3),
  }),
  seed({
    id: 'st-bruno-1',
    petId: '20000000-0000-4000-8000-000000000004',
    petName: 'Bruno',
    authorName: 'Pablo G.',
    kind: 'photo',
    uri: null,
    alt: 'Bruno sentado bajo una farola, mirando a cámara',
    text: 'Primera semana de socialización',
    placeName: null,
    createdAt: hoursAgo(9),
  }),
  seed({
    // Ya caducado. Está en la semilla a propósito: sin un caso vencido, la
    // caducidad es una línea de código que nadie ha visto funcionar.
    id: 'st-nina-viejo',
    petId: '20000000-0000-4000-8000-000000000001',
    petName: 'Nina',
    authorName: 'Marta R.',
    kind: 'text',
    uri: null,
    alt: '',
    text: 'Salimos ya, ¿alguien se apunta?',
    placeName: 'Parque Central',
    createdAt: hoursAgo(30),
  }),
];

/** La semilla tal cual, para los tests. La aplicación usa los hooks. */
export const SEED_STORIES_SNAPSHOT: readonly Story[] = stories;

const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => stories;

/** Los que siguen vivos. Se calcula al leer, no lo borra ningún proceso. */
export function liveStories(all: readonly Story[], now = Date.now()): Story[] {
  return all
    .filter((story) => story.expiresAt.getTime() > now)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export type StoryGroup = {
  petId: string;
  petName: string;
  authorName: string;
  stories: Story[];
  hasUnseen: boolean;
  /** El primero sin ver, que es por donde abre el visor. */
  firstUnseenIndex: number;
};

/**
 * Agrupados por animal, y ordenados como en Instagram: primero lo que no has
 * visto. Un carrete que abre siempre por lo mismo hace que dejes de mirarlo.
 */
export function groupStories(all: readonly Story[], now = Date.now()): StoryGroup[] {
  const byPet = new Map<string, Story[]>();
  for (const story of liveStories(all, now)) {
    const list = byPet.get(story.petId) ?? [];
    list.push(story);
    byPet.set(story.petId, list);
  }

  const groups: StoryGroup[] = [];
  for (const [petId, list] of byPet) {
    const first = list[0];
    if (!first) continue;
    const unseen = list.findIndex((story) => !story.viewedByMe);
    groups.push({
      petId,
      petName: first.petName,
      authorName: first.authorName,
      stories: list,
      hasUnseen: unseen >= 0,
      firstUnseenIndex: unseen >= 0 ? unseen : 0,
    });
  }

  return groups.sort((a, b) => Number(b.hasUnseen) - Number(a.hasUnseen));
}

export function useStoryGroups(): StoryGroup[] {
  return groupStories(useSyncExternalStore(subscribe, snapshot, snapshot));
}

export function useStoriesOf(petId: string): Story[] {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  return liveStories(all).filter((story) => story.petId === petId);
}

export function markStoryViewed(id: string): void {
  stories = stories.map((story) =>
    story.id === id && !story.viewedByMe ? { ...story, viewedByMe: true } : story,
  );
  emit();
}

export type NewStory = {
  petId: string;
  petName: string;
  authorName: string;
  kind: StoryKind;
  uri: string | null;
  alt: string;
  text: string;
  placeName: string | null;
};

export function publishStory(draft: NewStory): Story {
  const createdAt = new Date();
  const story: Story = {
    id: `st-local-${stories.length}-${draft.petId}`,
    ...draft,
    alt: draft.alt.trim(),
    text: draft.text.trim(),
    createdAt,
    expiresAt: expiring(createdAt),
    // El propio ya está visto: nadie tiene un estado sin ver de sí mismo.
    viewedByMe: true,
    viewers: [],
  };
  stories = [...stories, story];
  emit();
  return story;
}

/** «Caduca en 21 h». Es lo que hace entender que esto no se queda. */
export function expiresInLabel(story: Story, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((story.expiresAt.getTime() - now) / 60_000));
  if (minutes < 60) return `Caduca en ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `Caduca en ${hours} h`;
}
