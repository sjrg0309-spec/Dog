/**
 * Los paseos que ya ocurrieron, del lado de la aplicación.
 *
 * La lógica —qué es un patrón, cuándo un paseo se pasó del rato, qué le llega
 * al algoritmo— vive en `@petnav/core`, sin red ni almacenamiento. Aquí solo
 * está lo que esa capa no puede tener: **dónde se guardan** y **quién los
 * escribe**.
 *
 * Se guardan en memoria, como el resto de la demostración, y eso tiene una
 * consecuencia que la pantalla dice en lugar de esconder: al cerrar la
 * aplicación se pierden. Llevarlos a la base es una tabla `walks` con su RLS —
 * un historial de paseos es la rutina de una persona, así que va con las
 * mismas reglas que `tracker_pings`: ilegible para cualquiera que no sea su
 * tutor.
 */

import { useSyncExternalStore } from 'react';

import {
  pairHistoryFrom,
  type PairHistory,
  type WalkOutcome,
  type WalkRecord,
} from '@petnav/core';

import { MY_PETS, OTHER_PETS, PLACES } from './demo-data';

const NINA = MY_PETS[0]!.id;
const TOBY = OTHER_PETS[0]!.id;
const ROCKY = OTHER_PETS[1]!.id;
const BRUNO = OTHER_PETS[2]!.id;

/**
 * La fecha de la última vez que fue ese día de la semana.
 *
 * `weeksAgo` cuenta hacia atrás desde ahí. La guarda del final es la que
 * importa: si hoy **es** ese día y la hora todavía no ha llegado, la fecha
 * saldría en el futuro y el historial abriría con un paseo que no ha ocurrido.
 * Es exactamente el fallo que ya se coló una vez en el feed, donde una
 * publicación anclada a una hora de paseo real aparecía por delante del reloj
 * diciendo «ahora» para algo que no había pasado.
 */
function recentWeekday(weekday: number, weeksAgo: number, hour: number, minute: number): Date {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  date.setDate(date.getDate() - ((date.getDay() - weekday + 7) % 7));
  if (date.getTime() >= now.getTime()) date.setDate(date.getDate() - 7);
  date.setDate(date.getDate() - weeksAgo * 7);
  return date;
}

function seedWalk(
  id: string,
  start: Date,
  minutes: number,
  rest: Omit<WalkRecord, 'id' | 'petId' | 'startedAt' | 'endedAt'>,
): WalkRecord {
  return {
    id,
    petId: NINA,
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
    ...rest,
  };
}

/**
 * El historial de ejemplo, y cada pieza está puesta para que se vea algo.
 *
 * Un historial de relleno enseñaría una lista bonita y ninguna de las reglas.
 * Este trae, a propósito:
 *
 *  · **Tres martes seguidos con Toby**, que es lo que hace aparecer la
 *    propuesta de paseo fijo. Con dos no saldría, y eso también se puede
 *    comprobar borrando uno.
 *  · **Un paseo que se pasó del rato**, a mediodía y sobre asfalto: el
 *    veredicto guardado dice `caution` y veinte minutos, y se estuvo treinta y
 *    cinco. Es el único número del resumen que habla del animal.
 *  · **Un 👎 con Bruno**, que descuenta en la afinidad y además impide que su
 *    patrón de los jueves llegue a proponerse.
 *  · **Uno sin contestar**, porque «no ha contestado» y «regular» no son lo
 *    mismo y la interfaz tiene que distinguirlos.
 */
function seed(): WalkRecord[] {
  const base = {
    placeId: PLACES.central.id,
    recommendedMinutes: 60,
    welfareLevel: 'ok' as const,
    temperatureC: 17,
    surface: 'grass' as const,
  };

  const walks: WalkRecord[] = [];

  // Los tres martes de las siete de la tarde con Toby.
  for (let weeksAgo = 0; weeksAgo < 3; weeksAgo += 1) {
    walks.push(
      seedWalk(`tuesday-${weeksAgo}`, recentWeekday(2, weeksAgo, 19, 0), 50, {
        ...base,
        companions: [{ petId: TOBY, outcome: 'good' }],
      }),
    );
  }

  // Las carreras de las seis, por la calle y sin parque: `placeId` null.
  for (let weeksAgo = 0; weeksAgo < 2; weeksAgo += 1) {
    walks.push(
      seedWalk(`run-${weeksAgo}`, recentWeekday(4, weeksAgo, 6, 0), 55, {
        ...base,
        placeId: null,
        temperatureC: 12,
        surface: 'asphalt',
        companions: [{ petId: ROCKY, outcome: 'good' }],
      }),
    );
  }

  // El de mediodía sobre asfalto: propuesto veinte minutos, se estuvo treinta y cinco.
  walks.push(
    seedWalk('midday', recentWeekday(6, 0, 13, 30), 35, {
      ...base,
      recommendedMinutes: 20,
      welfareLevel: 'caution',
      temperatureC: 29,
      surface: 'asphalt',
      companions: [],
    }),
  );

  // Los jueves con Bruno: hay patrón, pero uno salió mal.
  for (let weeksAgo = 0; weeksAgo < 3; weeksAgo += 1) {
    walks.push(
      seedWalk(`bruno-${weeksAgo}`, recentWeekday(3, weeksAgo, 18, 30), 40, {
        ...base,
        placeId: PLACES.retiro.id,
        companions: [{ petId: BRUNO, outcome: weeksAgo === 1 ? 'bad' : 'good' }],
      }),
    );
  }

  // El de ayer por la mañana, todavía sin contestar.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(7, 0, 0, 0);
  walks.push(
    seedWalk('pending', yesterday, 45, {
      ...base,
      companions: [{ petId: TOBY, outcome: null }],
    }),
  );

  return walks;
}

let walks: WalkRecord[] = seed();
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

/* El array entero es la instantánea, y se sustituye en vez de mutarse: con
   `useSyncExternalStore` una instantánea que cambia por dentro no provoca
   render, porque la referencia sigue siendo la misma. */
const snapshot = (): WalkRecord[] => walks;

/** Todos los paseos de una mascota, del más reciente al más antiguo. */
export function useWalks(petId: string): WalkRecord[] {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  return all
    .filter((walk) => walk.petId === petId)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export function useWalk(id: string | undefined): WalkRecord | null {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (id === undefined) return null;
  return all.find((walk) => walk.id === id) ?? null;
}

/**
 * Cierra un paseo y lo guarda. Devuelve su identificador para poder abrirlo.
 *
 * Se llama al **terminar**, no al empezar: un paseo que se guardara al salir
 * tendría que actualizarse después, y si la aplicación se cierra por el camino
 * quedaría abierto para siempre. Aquí un registro existe cuando ya se sabe
 * todo de él.
 */
export function recordWalk(walk: Omit<WalkRecord, 'id'>): string {
  const id = `walk-${Date.parse(walk.startedAt)}-${walk.petId.slice(-4)}`;
  walks = [...walks, { ...walk, id }];
  emit();
  return id;
}

/**
 * El 👍/👎 de **una pareja** de un paseo.
 *
 * La firma lleva las dos claves porque la valoración no es del paseo: si en
 * una salida hubo tres perros y uno fue un problema, marcar el paseo entero
 * ensuciaría los tres pares y la aplicación dejaría de proponer a dos que no
 * hicieron nada.
 */
export function setWalkOutcome(walkId: string, petId: string, outcome: WalkOutcome): void {
  walks = walks.map((walk) =>
    walk.id !== walkId
      ? walk
      : {
          ...walk,
          companions: walk.companions.map((companion) =>
            companion.petId === petId ? { ...companion, outcome } : companion,
          ),
        },
  );
  emit();
}

/**
 * Lo que el descubrimiento tiene que saber del pasado.
 *
 * Es la función que convierte el resumen en algo más que una pantalla: sin
 * esto, el 👍/👎 se guardaría, se dibujaría y no cambiaría nada.
 */
export function walkPairHistory(petId: string): Map<string, PairHistory> {
  return pairHistoryFrom(walks.filter((walk) => walk.petId === petId));
}
