/**
 * Las reservas de un espacio, y la única cosa que abren: la dirección.
 *
 * ## Por qué esto es un módulo y no un booleano en la pantalla
 *
 * La regla de privacidad de los espacios —**la zona antes, la dirección
 * después**— estaba escrita en un aviso al final de la pantalla y en ningún
 * sitio más. Un aviso no es una regla: es una promesa. La regla es que la
 * dirección **no exista en la pantalla** hasta que hay una reserva confirmada,
 * y para eso hace falta un estado.
 *
 * Es la propiedad privada de alguien. Publicarla a cualquiera que abra la
 * aplicación es lo que haría que ningún anfitrión volviera a publicar su patio,
 * y de paso convertiría un directorio de sitios en un mapa de casas con jardín
 * y sin nadie dentro los martes por la mañana.
 *
 * ## Los tres estados, y por qué son tres
 *
 *  - **Sin reserva.** Se ve la zona, los datos duros y el precio por animal.
 *  - **Propuesta.** El grupo está formado y el anfitrión todavía no ha dicho
 *    que sí. Aquí **tampoco** hay dirección: proponer no es entrar.
 *  - **Confirmada.** El anfitrión aceptó. Ahora sí, con las instrucciones de
 *    acceso y dicho en voz alta que eso solo lo tiene quien reservó.
 *
 * El paso de propuesta a confirmada lo da una persona que no está en este
 * teléfono, así que en esta versión hay un atajo de demostración —igual que con
 * el chip y con la revisión de una protectora— y la pantalla dice que lo es.
 */

import { useSyncExternalStore } from 'react';

export type BookingStatus = 'none' | 'proposed' | 'confirmed';

export type Booking = {
  spotId: string;
  status: BookingStatus;
  /** Cuántos animales entraron en el grupo, para poder repetir el reparto. */
  pets: number;
  /** Lo que le toca a cada uno, en céntimos, congelado al proponer. */
  perPetCents: number;
};

let bookings: readonly Booking[] = [];
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

const snapshot = (): readonly Booking[] => bookings;

export function useBookings(): readonly Booking[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** La reserva de un espacio concreto, si la hay. */
export function useBooking(spotId: string): Booking | null {
  return useBookings().find((booking) => booking.spotId === spotId) ?? null;
}

export function proposeBooking(input: {
  spotId: string;
  pets: number;
  perPetCents: number;
}): void {
  bookings = [
    ...bookings.filter((booking) => booking.spotId !== input.spotId),
    { ...input, status: 'proposed' },
  ];
  emit();
}

/**
 * Confirmar, que en la aplicación de verdad hace el anfitrión.
 *
 * **En esta versión es un atajo de demostración y la pantalla lo dice.** Sin
 * él no se podría ver funcionando la mitad de la regla —qué enseña una reserva
 * confirmada y qué sigue sin enseñar una propuesta—, que es justo la parte que
 * hay que poder discutir.
 */
export function confirmBooking(spotId: string): void {
  bookings = bookings.map((booking) =>
    booking.spotId === spotId ? { ...booking, status: 'confirmed' } : booking,
  );
  emit();
}

export function cancelBooking(spotId: string): void {
  bookings = bookings.filter((booking) => booking.spotId !== spotId);
  emit();
}

/**
 * Lo que se le dice a quien acaba de recibir una dirección.
 *
 * Va en la pantalla de confirmación y no en una política, porque es el único
 * momento en que significa algo: la persona tiene delante la calle y el portal
 * de alguien.
 */
export const ADDRESS_NOTE =
  'Esta dirección la tenéis quienes vais, y desde ahora. No sale en el mapa ni en la ficha del espacio, y deja de verse si se cancela la reserva.';
