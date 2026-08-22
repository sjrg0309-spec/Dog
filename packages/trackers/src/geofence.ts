/**
 * Geocercas y check-in automático.
 *
 * Es lo que hace que el collar aporte algo de verdad: el perro llega al parque,
 * el radar se enciende solo y al salir caduca solo. El tutor no tiene que
 * acordarse de nada, que es exactamente lo que falla cuando hay que pulsar un
 * botón antes de salir con prisa.
 *
 * Dos detalles que separan esto de un simple "¿está dentro del círculo?":
 *
 *  1. **Histéresis.** El radio de entrada y el de salida no son el mismo. Con un
 *     único umbral, un perro parado justo en el borde con una lectura de GPS que
 *     baila diez metros genera entradas y salidas sin parar, y con ellas una
 *     cascada de notificaciones. Se entra al cruzar el radio y se sale al
 *     superarlo con un margen.
 *
 *  2. **Permanencia mínima.** Pasar por delante del parque camino del trabajo no
 *     es estar en el parque. Hasta que no se acumulan unos minutos dentro, no se
 *     abre el check-in.
 */

import { distanceMeters, type LatLng } from '@doggymeet/core';

/** Margen del radio de salida sobre el de entrada. */
export const EXIT_HYSTERESIS = 1.25;

/** Minutos dentro de la geocerca antes de dar el check-in por bueno. */
export const DEFAULT_DWELL_MINUTES = 3;

export type Geofence = {
  id: string;
  dogId: string;
  placeId: string | null;
  center: LatLng;
  radiusMeters: number;
  autoCheckin: boolean;
};

/** Lo que se sabe del perro respecto a una geocerca entre lectura y lectura. */
export type GeofenceState = {
  inside: boolean;
  /** Momento de la primera lectura dentro de la racha actual. */
  since: Date | null;
  /** Si ya se abrió el check-in de esta visita. */
  checkedIn: boolean;
};

export const initialGeofenceState: GeofenceState = {
  inside: false,
  since: null,
  checkedIn: false,
};

export type GeofenceEvent =
  | { type: 'entered'; geofenceId: string; at: Date }
  /** La permanencia mínima se ha cumplido: ahora sí se abre el check-in. */
  | { type: 'checkin'; geofenceId: string; placeId: string | null; at: Date }
  | { type: 'exited'; geofenceId: string; at: Date }
  | { type: 'none' };

export type GeofenceTransition = {
  state: GeofenceState;
  event: GeofenceEvent;
  distanceMeters: number;
};

/**
 * Avanza el estado de una geocerca con una lectura nueva.
 *
 * Función pura: recibe el estado anterior y devuelve el siguiente, sin tocar
 * base de datos ni reloj. Así se puede probar una visita entera —llegada,
 * permanencia, salida y falso positivo de borde— sin esperar minutos reales.
 */
export function advanceGeofence(
  fence: Geofence,
  state: GeofenceState,
  point: LatLng,
  at: Date,
  dwellMinutes: number = DEFAULT_DWELL_MINUTES,
): GeofenceTransition {
  const distance = distanceMeters(point, fence.center);

  // Umbral asimétrico: entrar cuesta menos que salir, y eso es lo que evita el
  // parpadeo en el borde.
  const threshold = state.inside ? fence.radiusMeters * EXIT_HYSTERESIS : fence.radiusMeters;
  const isInside = distance <= threshold;

  if (!state.inside && isInside) {
    return {
      state: { inside: true, since: at, checkedIn: false },
      event: { type: 'entered', geofenceId: fence.id, at },
      distanceMeters: distance,
    };
  }

  if (state.inside && !isInside) {
    return {
      state: initialGeofenceState,
      event: { type: 'exited', geofenceId: fence.id, at },
      distanceMeters: distance,
    };
  }

  if (state.inside && isInside && !state.checkedIn && state.since) {
    const dwelt = (at.getTime() - state.since.getTime()) / 60_000;
    if (dwelt >= dwellMinutes) {
      return {
        state: { ...state, checkedIn: true },
        event: { type: 'checkin', geofenceId: fence.id, placeId: fence.placeId, at },
        distanceMeters: distance,
      };
    }
  }

  return { state, event: { type: 'none' }, distanceMeters: distance };
}

/**
 * Elige la geocerca a la que corresponde una lectura.
 *
 * Cuando dos parques se solapan gana el centro más cercano, no la primera
 * coincidencia: si no, el orden de la lista decidiría en qué parque aparece el
 * perro.
 */
export function pickGeofence(fences: readonly Geofence[], point: LatLng): Geofence | null {
  let best: { fence: Geofence; distance: number } | null = null;

  for (const fence of fences) {
    if (!fence.autoCheckin) continue;
    const distance = distanceMeters(point, fence.center);
    if (distance > fence.radiusMeters * EXIT_HYSTERESIS) continue;
    if (!best || distance < best.distance) best = { fence, distance };
  }

  return best?.fence ?? null;
}
