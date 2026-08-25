/**
 * Utilidades geoespaciales del cliente.
 *
 * Las consultas de verdad las hace PostGIS en la base de datos; esto es para lo
 * que ocurre antes de llegar allí: ordenar una lista ya traída, decidir si un
 * perro entró en una geocerca, y sobre todo **degradar la precisión** de una
 * ubicación antes de guardarla.
 */

import type { LatLng } from './types.js';

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Distancia en metros sobre la esfera. Suficiente a escala de barrio. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Reduce una ubicación a una rejilla de aproximadamente un kilómetro.
 *
 * Es la regla de privacidad del proyecto hecha código: para decidir a quién
 * llega una notificación en un radio de dos kilómetros basta esta resolución, y
 * con ella deja de ser posible reconstruir por dónde anda una persona. Se
 * guarda redondeada, se sobrescribe y no se historiza.
 *
 * 0.01° de latitud ≈ 1,11 km. En longitud el paso se estrecha con la latitud,
 * lo que solo mejora la privacidad; no se corrige a propósito.
 */
export function coarsen(point: LatLng, decimals = 2): LatLng {
  const factor = 10 ** decimals;
  return {
    lat: Math.round(point.lat * factor) / factor,
    lng: Math.round(point.lng * factor) / factor,
  };
}

/** ¿El punto cae dentro de la geocerca? Base del check-in automático. */
export function isInsideGeofence(
  point: LatLng,
  center: LatLng,
  radiusMeters: number,
): boolean {
  return distanceMeters(point, center) <= radiusMeters;
}

/**
 * Puntúa la cercanía de 0 a 100 para ordenar el descubrimiento.
 *
 * Se mantiene aparte de la afinidad a propósito: mezclar distancia con
 * temperamento haría que un perro mediocre pero cercano apareciera como
 * "95 % compatible", que es mentirle al usuario sobre lo único que le importa.
 */
export function proximityScore(distance: number, radiusMeters = 2000): number {
  if (distance <= 0) return 100;
  if (distance >= radiusMeters) return 0;
  return Math.round((1 - distance / radiusMeters) * 100);
}

/** Formatea una distancia para la interfaz: "600 m", "1,4 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}
