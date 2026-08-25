/**
 * Actividad: lo que te ha pasado a ti.
 *
 * Es la pantalla del corazón de Instagram, y tiene una regla que en esta
 * aplicación importa más que en ninguna: **está separada de los mensajes a
 * propósito**. Una reacción es algo que ha ocurrido; un mensaje es alguien
 * esperando respuesta. Mezclarlos hace que lo segundo se pierda entre lo
 * primero, y aquí lo segundo puede ser «he visto a tu perro cruzando la calle».
 *
 * Y una cosa que no hace: **no inventa motivos para volver**. No hay «hace tres
 * días que no publicas» ni «a Toby le podría gustar tu foto». Todo lo de esta
 * lista lo ha hecho una persona.
 */

import { useSyncExternalStore } from 'react';

export type ActivityKind =
  | 'reaction'
  | 'comment'
  | 'bark'
  | 'follow'
  | 'schedule_match'
  | 'sighting'
  | 'reminder';

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  /** Quién lo hizo. Nulo solo en los recordatorios de la ficha médica. */
  actorName: string | null;
  actorPetId: string | null;
  body: string;
  at: Date;
  read: boolean;
  /** Un recordatorio o un avistamiento pide hacer algo; una reacción no. */
  actionable: boolean;
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

let items: ActivityItem[] = [
  {
    id: 'ac-1',
    kind: 'sighting',
    actorName: 'Javier P.',
    actorPetId: null,
    body: 'ha reportado un avistamiento de Lúa cerca de tu ruta habitual.',
    at: minutesAgo(38),
    read: false,
    actionable: true,
  },
  {
    id: 'ac-2',
    kind: 'reminder',
    actorName: null,
    actorPetId: '20000000-0000-4000-8000-000000000001',
    body: 'La desparasitación de Nina venció hace 5 días.',
    at: minutesAgo(120),
    read: false,
    actionable: true,
  },
  {
    id: 'ac-3',
    kind: 'schedule_match',
    actorName: 'Carlos M.',
    actorPetId: '20000000-0000-4000-8000-000000000002',
    body: 'coincide contigo 5 días a la semana, de 7:00 a 7:45, en el Parque Central.',
    at: minutesAgo(180),
    read: false,
    actionable: true,
  },
  {
    id: 'ac-4',
    kind: 'reaction',
    actorName: 'Diego S.',
    actorPetId: '20000000-0000-4000-8000-000000000003',
    body: 'ha movido la cola con tu foto de Nina.',
    at: minutesAgo(220),
    read: true,
    actionable: false,
  },
  {
    id: 'ac-5',
    kind: 'comment',
    actorName: 'Carlos M.',
    actorPetId: '20000000-0000-4000-8000-000000000002',
    body: 'ha comentado: «Nosotros salimos a esa hora también».',
    at: minutesAgo(240),
    read: true,
    actionable: false,
  },
  {
    id: 'ac-6',
    kind: 'bark',
    actorName: 'Pablo G.',
    actorPetId: '20000000-0000-4000-8000-000000000004',
    body: 'ha ladrado tu foto: la ha visto gente que no te sigue.',
    at: minutesAgo(900),
    read: true,
    actionable: false,
  },
  {
    id: 'ac-7',
    kind: 'follow',
    actorName: 'Elena V.',
    actorPetId: null,
    body: 'ha empezado a seguir a Nina.',
    at: minutesAgo(1400),
    read: true,
    actionable: false,
  },
];

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
const snapshot = () => items;

export function useActivity(): ActivityItem[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot).slice().sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );
}

export function useUnreadActivity(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot).filter((item) => !item.read).length;
}

export function markActivityRead(): void {
  items = items.map((item) => (item.read ? item : { ...item, read: true }));
  emit();
}
