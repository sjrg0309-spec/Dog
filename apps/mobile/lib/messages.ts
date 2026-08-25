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

/**
 * Quién sale en el retrato de un hilo.
 *
 * Una lista de mensajes sin caras se lee como una bandeja de notificaciones del
 * sistema: iconos grises de categoría, todos iguales, ninguno de nadie. En
 * WhatsApp y en los directos de Instagram lo primero de cada fila es **la cara
 * de quien te escribe**, y es lo que hace que la lista se reconozca de un
 * vistazo sin leer un nombre.
 *
 * Aquí la cara es la del **animal**, no la del tutor, porque es de quien se
 * habla en todos los hilos y es lo que el generador de retratos sabe dibujar.
 * En un grupo van dos, montadas.
 */
export type Face = { id: string; name: string };

export type Message = {
  id: string;
  /** Estable por persona: de aquí sale su color en un grupo. */
  authorId: string;
  authorName: string;
  body: string;
  at: Date;
  mine: boolean;
  /**
   * Hasta dónde ha llegado, en los mensajes propios.
   *
   * Es el doble check de WhatsApp, y no es adorno: en un hilo de alerta la
   * diferencia entre «entregado» y «leído» es la diferencia entre saber que
   * alguien está buscando y no saberlo. En los mensajes ajenos no aplica.
   */
  delivery?: 'sent' | 'delivered' | 'read';
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
  /** Los retratos de la fila. Uno cara a cara, dos montadas en grupo. */
  faces: Face[];
  messages: Message[];
};

/**
 * El color del nombre de cada persona dentro de un grupo.
 *
 * Es el detalle de WhatsApp que hace legible un grupo de cuatro sin leer: el
 * ojo separa a los interlocutores por color antes de procesar las letras. Sale
 * del identificador y no del orden de llegada, así que a nadie le cambia el
 * color cuando entra otro al grupo.
 *
 * Devuelve un índice y no un color: los colores viven en el tema, y esta capa
 * no sabe —ni debe saber— si la aplicación está en claro o en oscuro.
 */
export function authorTint(authorId: string): 0 | 1 | 2 {
  let hash = 0;
  for (let index = 0; index < authorId.length; index += 1) {
    hash = (hash * 31 + authorId.charCodeAt(index)) % 9973;
  }
  return (hash % 3) as 0 | 1 | 2;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

/**
 * Los animales de la semilla, por identificador.
 *
 * Se repiten aquí a propósito en vez de importar `demo-data`: los mensajes son
 * datos de demostración de otra pantalla y no tienen por qué depender de la
 * forma del catálogo de mascotas. Lo que sí importa es que el identificador
 * **sea el mismo**, porque el retrato se dibuja a partir de él: si Toby saliera
 * aquí con otro identificador, en el chat tendría otra cara que en el feed, y
 * ese es justo el fallo que hace que una lista de conversaciones no sirva para
 * reconocer a nadie.
 */
const PET = {
  toby: { id: '20000000-0000-4000-8000-000000000002', name: 'Toby' },
  rocky: { id: '20000000-0000-4000-8000-000000000003', name: 'Rocky' },
  bruno: { id: '20000000-0000-4000-8000-000000000004', name: 'Bruno' },
  /* Lúa es de la alerta y no está en el catálogo de la demostración: es el
     animal de otra persona, que es justo el caso de un SOS. */
  lua: { id: 'alert-lua', name: 'Lúa' },
} as const;

let threads: Thread[] = [
  {
    id: 'thread-alert',
    kind: 'alert',
    title: 'Lúa · alerta abierta',
    reason: 'Hay una alerta de perro perdido abierta a 900 m de ti.',
    memberCount: 14,
    unread: 3,
    faces: [PET.lua],
    messages: [
      {
        id: 'm1',
        authorId: 'elena',
        authorName: 'Elena V.',
        body: 'Se soltó en Doctor Esquerdo sobre las nueve. Es blanca con manchas canela y lleva arnés rojo.',
        at: minutesAgo(94),
        mine: false,
      },
      {
        id: 'm2',
        authorId: 'javier',
        authorName: 'Javier P.',
        body: 'La he visto cruzando hacia el Retiro hace media hora. No se dejó acercar.',
        at: minutesAgo(38),
        mine: false,
      },
      {
        id: 'm3',
        authorId: 'elena',
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
    faces: [PET.toby],
    messages: [
      {
        id: 'm4',
        authorId: 'carlos',
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
    faces: [PET.toby, PET.rocky],
    messages: [
      {
        id: 'm5',
        authorId: 'carlos',
        authorName: 'Carlos M.',
        body: 'Confirmado el patio de 11 a 13. Salen 10 € por perro.',
        at: minutesAgo(600),
        mine: false,
      },
      {
        id: 'm6',
        authorId: 'marta',
        authorName: 'Marta R.',
        body: 'Nosotras vamos. Kira se queda en casa, con ese calor no le conviene.',
        at: minutesAgo(540),
        mine: true,
        delivery: 'read',
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
    faces: [PET.rocky, PET.bruno],
    messages: [
      {
        id: 'm7',
        authorId: 'diego',
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
              /* Todo lo propio comparte autor: en un grupo tus mensajes no
                 llevan nombre de todas formas, así que el color no se usa. */
              authorId: 'me',
              authorName,
              body: trimmed,
              at: new Date(),
              mine: true,
              // Sale como enviado, no como leído. Pintar dos checks azules en
              // cuanto sale el mensaje sería mentir sobre lo único que ese
              // icono significa.
              delivery: 'sent',
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

/** «14:32». En un chat la hora exacta importa; el «hace 3 h» no sirve. */
export function clockTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/**
 * El separador de fecha de WhatsApp: «Hoy», «Ayer», o el día.
 *
 * Va como una pastilla flotando entre los mensajes, no como una cabecera fija,
 * porque marca un corte en la conversación y no una sección.
 */
export function dayLabel(date: Date, now = new Date()): string {
  const startOf = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return date.toLocaleDateString('es-ES', { weekday: 'long' });
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

/** Agrupa los mensajes por día, para poder intercalar el separador. */
export function groupByDay(messages: readonly Message[]): Array<{ day: string; items: Message[] }> {
  const groups: Array<{ day: string; items: Message[] }> = [];
  for (const message of messages) {
    const day = dayLabel(message.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(message);
    else groups.push({ day, items: [message] });
  }
  return groups;
}
