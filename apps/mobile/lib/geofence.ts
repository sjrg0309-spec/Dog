/**
 * ¿Está el tutor dentro de una zona pet-friendly?
 *
 * El radar solo se enciende dentro de una: un parque, un área canina, una
 * terraza que admite perros. No es una restricción por gusto, es lo que
 * convierte el radar en algo distinto de una baliza personal:
 *
 *  1. **Deja de decir «estoy aquí» y pasa a decir «estoy en el Parque
 *     Central».** El resto no necesita más, y es lo único que alguien querría
 *     publicar de sí mismo. La regla de privacidad que la aplicación ya tenía
 *     —anclar al lugar, nunca a la persona— deja de ser una convención de la
 *     interfaz y pasa a ser algo que la base de datos garantiza.
 *  2. **Un aviso solo llega donde se puede ir.** Enterarse de que hay un perro
 *     compatible en el patio cerrado de un particular no sirve de nada.
 *  3. **Filtra el ruido sin pedir nada.** Nadie tiene que acordarse de apagar el
 *     check-in al llegar a casa, porque desde casa no se puede encender.
 *
 * Esto espeja `place_at()` de Postgres, que es quien manda: el cliente decide
 * qué botón enseñar y la base decide qué se guarda.
 */

import { distanceMeters } from '@coincide/core';

import { PLACES, type DemoPlace } from './demo-data';

const ALL: DemoPlace[] = Object.values(PLACES);

/**
 * La zona que contiene este punto, o null.
 *
 * Gana la más pequeña: si una terraza cae dentro de un parque, la respuesta útil
 * es la terraza. Es el mismo criterio que usa la consulta de la base.
 */
export function placeAt(location: { lat: number; lng: number }): DemoPlace | null {
  const inside = ALL.filter(
    (place) => distanceMeters(location, { lat: place.lat, lng: place.lng }) <= place.radiusM,
  );
  if (inside.length === 0) return null;
  return inside.reduce((best, place) => (place.radiusM < best.radiusM ? place : best));
}

/** Las zonas donde el radar funciona, para poder enseñarlas cuando no se está en ninguna. */
export function petFriendlyPlaces(): DemoPlace[] {
  return ALL;
}

export const RADAR_AREA_NOTE =
  'El radar solo se enciende dentro de una zona pet-friendly. Desde casa no se puede: lo que se ' +
  'comparte es el lugar, y tu portal no es un lugar al que nadie pueda ir.';
