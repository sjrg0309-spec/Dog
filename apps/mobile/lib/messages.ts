/**
 * Mensajes y grupos.
 *
 * Un detalle que no es de interfaz: **una conversación aquí nace de un
 * encuentro**, no de un botón de «enviar mensaje» sobre un perfil cualquiera.
 * Cada hilo lleva por qué existe —coincidís los martes, estuvisteis en la misma
 * quedada, hay una alerta abierta—, y eso cambia lo que se puede escribir
 * primero. Un chat sin contexto en una aplicación donde quedas con desconocidos
 * es, sobre todo, un canal de acoso.
 *
 * Los grupos son las comunidades que ya existían. No se duplican: la comunidad
 * **es** el grupo, y separarlas habría dado dos listas con los mismos nombres.
 */

import { useSyncExternalStore } from 'react';

export type ThreadKind = 'schedule_match' | 'playdate' | 'alert' | 'group';

export type Message = {
  id: string;
  authorName: string;
  body: string;
  at: Date;
  mine: boolean;
};

export type Thread = {
  id: string;
  kind: ThreadKind;
  title: string;
  /** Por qué existe este hilo. Se enseña siempre, no solo la primera vez. */
  reason: string;
  /** Cuántos son. Uno significa cara a cara. */
  memberCount: number;
  unread: number;
  messages: Message[];
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

let threads: Thread[] = [
  {
    id: 'thread-alert',
    kind: 'alert',
    title: 'Lúa · alerta abierta',
    reason: 'Hay una alerta de perro perdido abierta a 900 m de ti.',
    memberCount: 14,
    unread: 3,
    messages: [
      {
        id: 'm1',
        authorName: 'Elena V.',
        body: 'Se soltó en Doctor Esquerdo sobre las nueve. Es blanca con manchas canela y lleva arnés rojo.',
        at: minutesAgo(94),
        mine: false,
      },
      {
        id: 'm2',
        authorName: 'Javier P.',
        body: 'La he visto cruzando hacia el Retiro hace media hora. No se dejó acercar.',
        at: minutesAgo(38),
        mine: false,
      },
      {
        id: 'm3',
        authorName: 'Elena V.',
        body: 'Voy para allá. Si alguien la ve, que no corra detrás: se aleja más.',
        at: minutesAgo(35),
        mine: false,
      },
    ],
  },
  {
    id: 'thread-carlos',
    kind: 'schedule_match',
    title: 'Carlos M. · Toby',
    reason: 'Coincidís 5 días a la semana, de 7:00 a 7:45, en el Parque Central.',
    memberCount: 1,
    unread: 1,
    messages: [
      {
        id: 'm4',
        authorName: 'Carlos M.',
        body: 'Mañana salimos a las siete como siempre. Si venís, Toby se pone contentísimo con Nina.',
        at: minutesAgo(180),
        mine: false,
      },
    ],
  },
  {
    id: 'thread-quedada',
    kind: 'playdate',
    title: 'Cumpleaños de Toby · sábado',
    reason: 'Estáis los cuatro apuntados. Afinidad del grupo: 81 %.',
    memberCount: 4,
    unread: 0,
    messages: [
      {
        id: 'm5',
        authorName: 'Carlos M.',
        body: 'Confirmado el patio de 11 a 13. Salen 10 € por perro.',
        at: minutesAgo(600),
        mine: false,
      },
      {
        id: 'm6',
        authorName: 'Marta R.',
        body: 'Nosotras vamos. Kira se queda en casa, con ese calor no le conviene.',
        at: minutesAgo(540),
        mine: true,
      },
    ],
  },
  {
    id: 'thread-barrio',
    kind: 'group',
    title: 'Perros de Chamberí',
    reason: 'Grupo del barrio · 2 miembros.',
    memberCount: 2,
    unread: 0,
    messages: [
      {
        id: 'm7',
        authorName: 'Diego S.',
        body: 'Han cortado la entrada sur del parque por obras. Hay cristales, cuidado con las patas.',
        at: minutesAgo(1300),
        mine: false,
      },
    ],
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
const snapshot = () => threads;

export function useThreads(): Thread[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function useThread(id: string | null): Thread | null {
  const all = useThreads();
  return all.find((thread) => thread.id === id) ?? null;
}

export function markRead(id: string): void {
  threads = threads.map((thread) => (thread.id === id ? { ...thread, unread: 0 } : thread));
  emit();
}

export function send(threadId: string, body: string, authorName: string): void {
  const trimmed = body.trim();
  if (trimmed.length === 0) return;

  threads = threads.map((thread) =>
    thread.id === threadId
      ? {
          ...thread,
          unread: 0,
          messages: [
            ...thread.messages,
            {
              id: `m-${thread.messages.length}-${thread.id}`,
              authorName,
              body: trimmed,
              at: new Date(),
              mine: true,
            },
          ],
        }
      : thread,
  );
  emit();
}

export function totalUnread(all: Thread[]): number {
  return all.reduce((sum, thread) => sum + thread.unread, 0);
}
