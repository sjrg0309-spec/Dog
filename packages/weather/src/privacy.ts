/**
 * Lo que se le manda al proveedor, y lo que no.
 *
 * Consultar el tiempo es contarle a un tercero dónde está una persona, cada
 * cuarto de hora, todos los días. Eso es una traza de la rutina de alguien, que
 * es exactamente lo que el resto del proyecto se ha cuidado de no generar: los
 * pings del collar no salen de la cuenta, la ubicación para avisos se guarda
 * redondeada a un kilómetro, y el radar ancla al lugar y no a la persona.
 *
 * La coartada aquí es que **no hace falta la precisión**. Los modelos de
 * Open-Meteo tienen una rejilla de entre uno y once kilómetros según el modelo;
 * pedir el tiempo con seis decimales devuelve el dato de la misma celda que
 * pedirlo con dos. Se pierde exactitud cero y se deja de enviar el portal.
 *
 * Dos decimales son ~1,1 km en latitud, y menos en longitud según el paralelo.
 * Es el mismo orden que el redondeo que ya usa `device_tokens.coarse_point`, y
 * mantenerlos iguales es deliberado: dos redondeos distintos para el mismo
 * propósito acaban siendo uno que alguien afloja sin darse cuenta.
 */

import type { Coordinates } from './types.js';

/** ~1,1 km. Ver la explicación de arriba. */
export const GRID_DECIMALS = 2;

const round = (value: number): number => {
  const factor = 10 ** GRID_DECIMALS;
  /* `Math.round` sesga los negativos hacia arriba en el empate, así que se
     redondea sobre el valor absoluto y se devuelve el signo. Sin esto, dos
     puntos simétricos del ecuador o del meridiano caerían en celdas distintas. */
  const rounded = Math.round(Math.abs(value) * factor) / factor;
  return value < 0 ? -rounded : rounded;
};

/**
 * Reduce una coordenada a la celda que se le va a preguntar al proveedor.
 *
 * Devolver el mismo objeto para posiciones cercanas es además lo que hace que
 * la caché sirva de algo: alguien que camina por el parque no dispara una
 * consulta por cada paso.
 */
export function coarsen(at: Coordinates): Coordinates {
  return { lat: round(at.lat), lng: round(at.lng) };
}

/** Clave estable de caché. El signo importa: 3.5 y -3.5 no son el mismo sitio. */
export function cellKey(at: Coordinates): string {
  const cell = coarsen(at);
  return `${cell.lat.toFixed(GRID_DECIMALS)},${cell.lng.toFixed(GRID_DECIMALS)}`;
}

/** Cuánto se está revelando, en metros, para poder decirlo en pantalla. */
export const GRID_PRECISION_M = 1100;
