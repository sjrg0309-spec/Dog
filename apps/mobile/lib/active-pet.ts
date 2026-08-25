/**
 * Qué mascota está mirando el tutor ahora mismo.
 *
 * Un tutor puede tener varias, y de modelos sociales distintos: la misma persona
 * tiene una perra que queda en el parque y una gata que no va a conocer a nadie.
 * Lo que la aplicación ofrece cambia por completo según cuál esté seleccionada,
 * así que la selección no puede vivir dentro de una pantalla.
 *
 * Es un almacén externo mínimo en lugar de un contexto de React porque no
 * necesita nada más: un valor, una suscripción y ningún proveedor que envolver.
 */

import { useSyncExternalStore } from 'react';

import { MY_PETS, type DemoPet } from './demo-data';

let activeId = MY_PETS[0]!.id;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): string {
  return activeId;
}

export function setActivePetId(id: string): void {
  if (id === activeId) return;
  activeId = id;
  for (const listener of listeners) listener();
}

/** La mascota seleccionada. Nunca null: siempre hay una primera. */
export function useActivePet(): DemoPet {
  const id = useSyncExternalStore(subscribe, snapshot, snapshot);
  return MY_PETS.find((pet) => pet.id === id) ?? MY_PETS[0]!;
}

export function myPets(): DemoPet[] {
  return MY_PETS;
}
