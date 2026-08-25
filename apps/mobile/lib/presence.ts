/**
 * Modo fantasma: el interruptor de «hoy no me veis».
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
 * **Y de verdad apaga.** No es un filtro del dibujo: con el modo puesto el
 * radar no ofrece salir, así que no hay presencia que publicar. Un interruptor
 * de privacidad que solo te esconde de tu propia pantalla es peor que no
 * tenerlo, porque enseña a confiar en él.
 */

import { useSyncExternalStore } from 'react';

let ghost = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): boolean => ghost;

export function setGhostMode(value: boolean): void {
  if (value === ghost) return;
  ghost = value;
  for (const listener of listeners) listener();
}

/** ¿Está el tutor invisible ahora mismo? */
export function useGhostMode(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

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
