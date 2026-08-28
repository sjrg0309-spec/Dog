/**
 * Los animales que lleva una protectora, del lado de la aplicación.
 *
 * Es la única parte del producto que **no** es de un tutor: aquí un animal no
 * tiene dueño, tiene una situación y una fecha de entrada. Por eso no reutiliza
 * `DemoPet` —que asume tutor, horario y casa— sino un tipo propio con lo poco
 * que una protectora necesita ver en una lista de cuarenta.
 *
 * ## La situación es una sola y avanza
 *
 * Un animal está **en tratamiento**, **en acogida**, **en adopción** o
 * **adoptado**, nunca en dos a la vez. Modelarlo con cuatro interruptores
 * independientes —«¿está en acogida?», «¿está publicado?»— permite estados
 * imposibles: publicado y adoptado, en tratamiento y en adopción. Una lista de
 * animales en la que uno puede estar adoptado y seguir apareciendo como
 * disponible es una llamada de una familia preguntando por un perro que ya no
 * está, y eso lo paga alguien.
 *
 * ## Lo que se guarda y lo que no
 *
 * Se guarda en memoria, como el resto de la demostración, y la pantalla lo dice
 * en vez de esconderlo. Llevarlo a la base es una tabla `shelter_animals` con
 * su RLS: legible por los miembros del colectivo y por nadie más mientras el
 * animal no esté publicado en adopción. Lo que **no** lleva, ni aquí ni allí,
 * es historial médico completo ni datos de la familia adoptante: eso es una
 * ficha clínica y un contrato, no una lista de trabajo.
 */

import { useSyncExternalStore } from 'react';

/** En qué punto está el animal. Una sola, y avanza hacia la adopción. */
export type AnimalStatus = 'treatment' | 'foster' | 'adoptable' | 'adopted';

export type ShelterAnimal = {
  id: string;
  name: string;
  /** Lo que se sabe, que en un animal recogido casi nunca es una raza limpia. */
  breed: string;
  /** En meses. Aproximada: en la calle nadie trae la cartilla. */
  ageMonths: number;
  size: 'mini' | 'small' | 'medium' | 'large' | 'giant';
  status: AnimalStatus;
  /** Desde cuándo está con vosotros. Es el dato que ordena la lista. */
  since: string;
  /** Una línea, la que se publicaría. Vacía mientras no esté en adopción. */
  note: string;
  /** Con quién está, si está en una casa de acogida. */
  fosterName: string | null;
  /** Lo que falta para poder publicarlo: vacunas, chip, esterilización. */
  pending: readonly string[];
};

export const STATUS_LABEL: Record<AnimalStatus, string> = {
  treatment: 'En tratamiento',
  foster: 'En acogida',
  adoptable: 'En adopción',
  adopted: 'Adoptado',
};

/**
 * El orden de la lista **no** es alfabético ni por fecha: es por urgencia de
 * gestión. Lo que está en tratamiento necesita algo hoy; lo adoptado ya no
 * necesita nada y baja al final aunque sea lo más reciente.
 */
export const STATUS_ORDER: readonly AnimalStatus[] = [
  'treatment',
  'foster',
  'adoptable',
  'adopted',
];

const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
};

/*
 * La semilla.
 *
 * Ocho animales y no tres: una lista de gestión con tres filas no enseña el
 * problema que resuelve —filtrar, contar, encontrar el que falta— y con ocho
 * ya se ve. Los nombres y los casos salen de lo que de verdad llega a una
 * protectora: camadas, abandonos de verano, un perro mayor que nadie quiere.
 */
let animals: ShelterAnimal[] = [
  {
    id: 'refugio-1',
    name: 'Trufa',
    breed: 'Mestiza de podenco',
    ageMonths: 8,
    size: 'medium',
    status: 'treatment',
    since: daysAgo(6),
    note: '',
    fosterName: null,
    pending: ['Segunda vacuna', 'Esterilización'],
  },
  {
    id: 'refugio-2',
    name: 'Canela',
    breed: 'Mestiza pequeña',
    ageMonths: 30,
    size: 'small',
    status: 'foster',
    since: daysAgo(21),
    note: '',
    fosterName: 'Marta R.',
    pending: ['Chip'],
  },
  {
    id: 'refugio-3',
    name: 'Bruno',
    breed: 'Mastín cruzado',
    ageMonths: 96,
    size: 'giant',
    status: 'adoptable',
    since: daysAgo(140),
    note: 'Tranquilo, se lleva bien con otros perros y con niños. Necesita casa con espacio.',
    fosterName: null,
    pending: [],
  },
  {
    id: 'refugio-4',
    name: 'Lola',
    breed: 'Galga',
    ageMonths: 48,
    size: 'large',
    status: 'adoptable',
    since: daysAgo(75),
    note: 'Miedosa al principio y muy cariñosa después. Mejor sin niños pequeños.',
    fosterName: null,
    pending: [],
  },
  {
    id: 'refugio-5',
    name: 'Pipo',
    breed: 'Mestizo de teckel',
    ageMonths: 14,
    size: 'mini',
    status: 'foster',
    since: daysAgo(9),
    note: '',
    fosterName: 'Diego S.',
    pending: ['Cartilla al día'],
  },
  {
    id: 'refugio-6',
    name: 'Nube',
    breed: 'Border collie cruzada',
    ageMonths: 24,
    size: 'medium',
    status: 'adoptable',
    since: daysAgo(38),
    note: 'Lista y con muchísima energía: necesita alguien que salga a diario.',
    fosterName: null,
    pending: [],
  },
  {
    id: 'refugio-7',
    name: 'Sombra',
    breed: 'Mestizo de pastor',
    ageMonths: 132,
    size: 'large',
    status: 'adopted',
    since: daysAgo(210),
    note: '',
    fosterName: null,
    pending: [],
  },
  {
    id: 'refugio-8',
    name: 'Uva',
    breed: 'Mestiza',
    ageMonths: 4,
    size: 'small',
    status: 'adopted',
    since: daysAgo(64),
    note: '',
    fosterName: null,
    pending: [],
  },
];

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* La lista entera es la instantánea y se sustituye en vez de mutarse: con
   `useSyncExternalStore`, una instantánea que cambia por dentro no provoca
   render porque la referencia sigue siendo la misma. */
const snapshot = (): ShelterAnimal[] => animals;

/** Todos los animales, ordenados por urgencia de gestión y luego por antigüedad. */
export function useShelterAnimals(): ShelterAnimal[] {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  return [...all].sort((a, b) => {
    const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (byStatus !== 0) return byStatus;
    return Date.parse(a.since) - Date.parse(b.since);
  });
}

/**
 * Mover un animal de situación.
 *
 * Publicar en adopción exige que no quede nada pendiente, y esa regla vive
 * aquí y no en la pantalla: un botón deshabilitado se puede saltar desde otra
 * pantalla, una función que rechaza no. Devuelve por qué no se pudo, para que
 * quien llame lo diga en vez de fallar en silencio.
 */
export function setAnimalStatus(
  id: string,
  status: AnimalStatus,
): { ok: true } | { ok: false; reason: string } {
  const animal = animals.find((entry) => entry.id === id);
  if (!animal) return { ok: false, reason: 'Ese animal ya no está en la lista.' };

  if (status === 'adoptable' && animal.pending.length > 0) {
    return {
      ok: false,
      reason: `Antes de publicar a ${animal.name} falta: ${animal.pending.join(', ').toLowerCase()}.`,
    };
  }

  animals = animals.map((entry) => (entry.id === id ? { ...entry, status } : entry));
  emit();
  return { ok: true };
}

/** Tachar algo de lo que falta. Al quedarse a cero, ya se puede publicar. */
export function resolvePending(id: string, task: string): void {
  animals = animals.map((entry) =>
    entry.id === id ? { ...entry, pending: entry.pending.filter((item) => item !== task) } : entry,
  );
  emit();
}

export type ShelterTally = {
  total: number;
  treatment: number;
  foster: number;
  adoptable: number;
  adopted: number;
  /** Cuántos no se pueden publicar todavía. Es la cifra que pide trabajo. */
  blocked: number;
};

/**
 * El resumen, calculado de la misma lista que se enseña debajo.
 *
 * Se deriva y no se guarda: un contador guardado aparte de la lista es un
 * contador que algún día dice cinco cuando hay cuatro, y el día que pase nadie
 * sabrá cuál de los dos miente.
 */
export function tally(all: readonly ShelterAnimal[]): ShelterTally {
  const count = (status: AnimalStatus): number =>
    all.filter((animal) => animal.status === status).length;

  return {
    total: all.length,
    treatment: count('treatment'),
    foster: count('foster'),
    adoptable: count('adoptable'),
    adopted: count('adopted'),
    blocked: all.filter((animal) => animal.status !== 'adopted' && animal.pending.length > 0)
      .length,
  };
}

/** «8 meses», «2 años», «4 a 6». Lo que se dice de un animal sin cartilla. */
export function ageLabel(months: number): string {
  if (months < 12) return months === 1 ? '1 mes' : `${months} meses`;
  const years = Math.round(months / 12);
  return years === 1 ? '1 año' : `${years} años`;
}

/** «Hace 6 días», «hace 3 meses». Desde cuándo está con vosotros. */
export function sinceLabel(iso: string): string {
  const days = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));
  if (days === 0) return 'Desde hoy';
  if (days === 1) return 'Desde ayer';
  if (days < 30) return `Hace ${days} días`;
  const months = Math.round(days / 30);
  return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
}
