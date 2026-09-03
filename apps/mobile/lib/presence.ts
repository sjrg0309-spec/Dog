/**
 * La presencia: «estamos fuera ahora», y el modo fantasma que la apaga.
 *
 * Hasta ahora el check-in vivía en el estado de la pantalla del radar. Servía
 * mientras el radar era la única pantalla que lo enseñaba, y dejó de servir en
 * cuanto hubo una segunda: la fila de estados decía «Salir ahora» con un
 * booleano propio que nadie sincronizaba, así que se podía estar fuera según
 * el radar y en casa según el inicio. Un estado que se ve desde dos sitios
 * tiene que vivir en uno.
 *
 * Aquí vive, con las mismas reglas que tenía en la pantalla:
 *
 *  1. **Caduca solo, y la caducidad se calcula al leer.** No hay un proceso
 *     que barra sesiones vencidas: una sesión con `until` en el pasado deja de
 *     existir para quien pregunte, igual que un estado de 24 horas en
 *     `lib/stories`. Una caducidad que depende de que alguien se acuerde de
 *     barrer no es una caducidad, y la promesa del radar —nadie se queda
 *     visible por olvido— no puede depender de un temporizador que se pierde
 *     al cerrar la aplicación.
 *  2. **Lo que se guarda es el sitio, no la persona.** La sesión lleva el
 *     identificador del área y su nombre, nunca unas coordenadas.
 *  3. **Se congela lo que se propuso al salir.** El consejo de bienestar se
 *     guarda con la sesión: recalcularlo al cerrar lo mediría con la
 *     temperatura de dentro de dos horas, y el resumen compararía lo que se
 *     hizo contra un consejo que nunca se dio.
 *
 * ## Modo fantasma: el interruptor de «hoy no me veis»
 *
 * Es lo mejor que tiene el mapa de Snapchat y lo que menos se copia, porque no
 * se ve en una captura: un botón grande, en la propia pantalla del mapa, que
 * te saca de él sin apagar nada más. No está escondido en ajustes, no pide
 * confirmar, y **se nota en el mismo sitio donde se pulsa** — el mapa cambia
 * delante de ti.
 *
 * Aquí encaja con lo que la aplicación ya prometía y hace la promesa
 * comprobable. El radar ya caducaba solo; esto añade lo contrario del olvido:
 * poder decidir. Un tutor que no quiere que su vecindario sepa que sale a las
 * seis de la mañana tenía que acordarse de no hacer check-in, que es pedirle
 * que se acuerde de una ausencia.
 *
 * **Y de verdad apaga.** No es un filtro del dibujo: con el modo puesto
 * `checkIn` se niega, así que no hay presencia que publicar, y da igual desde
 * qué pantalla se pida. Un interruptor de privacidad que solo te esconde de
 * tu propia pantalla es peor que no tenerlo, porque enseña a confiar en él.
 * Cerrar, en cambio, funciona siempre: nada de lo que hace la privacidad
 * puede dejar a alguien visible más tiempo.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

import type { Conditions, WelfareVerdict } from '@petnav/core';

export type PresenceSession = {
  /** El animal que ha salido. Un tutor con dos perros solo saca a uno a la vez. */
  petId: string;
  /** El área pet-friendly donde se hizo el check-in. Nunca unas coordenadas. */
  placeId: string;
  placeName: string;
  /**
   * Cuándo empezó, en milisegundos de época.
   *
   * Hace falta guardar **cuándo empezó**, no solo hasta cuándo dura: sin eso,
   * al cerrar no hay forma de saber cuánto se estuvo fuera, que es el dato del
   * que vive el resumen entero.
   */
  startedAt: number;
  /** Cuándo se apaga sola. No hay opción de dejarlo indefinido. */
  until: number;
  /** Lo que se propuso **al salir**, congelado aquí. Ver la regla 3 de arriba. */
  recommendedMinutes: number;
  /** `null` cuando se salió sin saber qué tiempo hacía. Nunca cero por defecto. */
  temperatureC: number | null;
  surface: Conditions['surface'];
  welfareLevel: WelfareVerdict['level'];
  /** A quién se avisó de la salida, si a alguien. */
  escortContactId?: string | null;
};

/**
 * Cada cuánto se vuelve a mirar el reloj una pantalla que está abierta.
 *
 * Treinta segundos: el rótulo dice minutos, así que mirar más a menudo no
 * cambiaría nada visible, y mirar menos dejaría el radar diciendo «en vivo»
 * hasta medio minuto después de haberse apagado.
 */
export const PRESENCE_TICK_MS = 30_000;

let session: PresenceSession | null = null;
let ghost = false;

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

const sessionSnapshot = (): PresenceSession | null => session;
const ghostSnapshot = (): boolean => ghost;

/* ------------------------------------------------------------ la sesión */

/**
 * Salir.
 *
 * Devuelve `false` y no hace nada si el modo fantasma está puesto: la regla
 * vive aquí y no en la pantalla, para que ninguna superficie nueva —un chip en
 * una cabecera, una burbuja en la fila de estados— pueda publicar una
 * presencia que el tutor pidió esconder. Las pantallas no enseñan el botón
 * en ese caso; esto es la red de debajo, por si alguna se olvida.
 */
export function checkIn(next: PresenceSession): boolean {
  if (ghost) return false;
  session = next;
  emit();
  return true;
}

/**
 * Volver.
 *
 * Devuelve la sesión que se cierra —aunque ya hubiera vencido— para que quien
 * llama pueda guardar el paseo con la hora de salida real. Funciona con el
 * modo fantasma puesto: apagar la presencia nunca puede estar bloqueado.
 */
export function checkOut(): PresenceSession | null {
  const closed = session;
  if (closed === null) return null;
  session = null;
  emit();
  return closed;
}

/** La sesión tal cual, vencida o no. Para quien necesite el dato crudo. */
export function readPresence(): PresenceSession | null {
  return session;
}

/**
 * La sesión si sigue en vivo; `null` si venció.
 *
 * Es la única puerta que deberían usar las pantallas. Se calcula al leer y
 * con el reloj de quien pregunta, de modo que dos pantallas abiertas a la vez
 * no pueden discrepar en si alguien sigue fuera.
 */
export function livePresence(
  current: PresenceSession | null,
  now = Date.now(),
): PresenceSession | null {
  if (current === null) return null;
  return current.until > now ? current : null;
}

export function readLivePresence(now = Date.now()): PresenceSession | null {
  return livePresence(session, now);
}

/**
 * Cuánto queda, en minutos enteros y nunca menos de uno.
 *
 * Se redondea hacia arriba porque el rótulo es una promesa de apagado: «1 min»
 * con cuarenta segundos por delante es verdad, «0 min» mientras sigue visible
 * no lo es.
 */
export function remainingMinutes(until: number, now = Date.now()): number {
  return Math.max(1, Math.ceil((until - now) / 60_000));
}

/** La sesión cruda, vencida o no. Ver `useLivePresence` para lo que se enseña. */
export function usePresence(): PresenceSession | null {
  return useSyncExternalStore(subscribe, sessionSnapshot, sessionSnapshot);
}

/**
 * La sesión en vivo, y `null` en cuanto vence.
 *
 * La caducidad se calcula al leer, como en los estados, así que nada la borra
 * y nadie puede quedarse visible porque un temporizador se perdió. Lo que sí
 * hace falta es que una pantalla **abierta** se entere de que ha vencido sin
 * que nadie la toque: el reloj no dispara un render por sí solo. De ahí el
 * tic de treinta segundos, que solo corre mientras hay una sesión viva y se
 * apaga en cuanto deja de haberla.
 */
export function useLivePresence(): PresenceSession | null {
  const current = usePresence();
  const live = livePresence(current);
  const alive = live !== null;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!alive) return;
    const timer = setInterval(() => setTick((tick) => tick + 1), PRESENCE_TICK_MS);
    return () => clearInterval(timer);
  }, [alive, current]);

  return live;
}

/* ------------------------------------------------------- modo fantasma */

export function setGhostMode(value: boolean): void {
  if (value === ghost) return;
  ghost = value;
  emit();
}

/** ¿Está el tutor invisible ahora mismo? */
export function useGhostMode(): boolean {
  return useSyncExternalStore(subscribe, ghostSnapshot, ghostSnapshot);
}

export function readGhostMode(): boolean {
  return ghost;
}

/** Vuelve al estado inicial. Solo para los tests, que comparten el módulo. */
export function resetPresence(): void {
  session = null;
  ghost = false;
  emit();
}

/* --------------------------------------------------------------- frescura */

/**
 * «hace 12 min», «ahora mismo».
 *
 * En un mapa de gente, la frescura es la mitad del dato: una cara sin hora
 * dice «está ahí» cuando lo que se sabe es «estaba ahí hace un rato», y esa
 * diferencia es la que hace que alguien cruce el barrio para nada. Snapchat lo
 * pone debajo de cada Bitmoji por eso mismo.
 */
export function freshness(minutesAgo: number): string {
  if (minutesAgo < 2) return 'ahora mismo';
  if (minutesAgo < 60) return `hace ${minutesAgo} min`;
  const hours = Math.round(minutesAgo / 60);
  return hours === 1 ? 'hace 1 h' : `hace ${hours} h`;
}
