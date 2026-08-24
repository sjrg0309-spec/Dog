/**
 * El acompañante del paseo, del lado de la aplicación.
 *
 * Las reglas —cuándo se avisa, qué dice el mensaje— están en `@petnav/core`.
 * Aquí está el estado y la lista de a quién se puede avisar, que en esta
 * versión son los tutores con los que ya has coincidido: pedirle a alguien que
 * te espere despierto es pedir un favor, y no se le pide a un desconocido.
 */

import { useSyncExternalStore } from 'react';

import { escortMessage, escortState, type Escort } from '@petnav/core';

import { OTHER_PETS } from './demo-data';

let escort: Escort | null = null;
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

const snapshot = (): Escort | null => escort;

export function useEscort(): Escort | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** A quién se le puede pedir. Gente con la que ya has coincidido. */
export function escortContacts(): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const pet of OTHER_PETS) seen.set(pet.ownerId, pet.ownerName);
  return [...seen].map(([id, name]) => ({ id, name })).slice(0, 4);
}

export function startEscort(input: {
  contactId: string;
  contactName: string;
  placeName: string;
  minutes: number;
}): void {
  const now = new Date();
  const due = new Date(now.getTime() + input.minutes * 60_000);
  escort = {
    contactId: input.contactId,
    contactName: input.contactName,
    placeName: input.placeName,
    startedAt: now.toISOString(),
    dueAt: due.toISOString(),
    closedAt: null,
  };
  emit();
}

/**
 * Cerrar el paseo.
 *
 * Se llama sola al cerrar el check-in, que es lo que evita el fallo obvio: un
 * aviso de «no ha vuelto» a la una de la mañana porque alguien se olvidó de
 * tocar un segundo botón.
 */
export function closeEscort(): void {
  if (!escort || escort.closedAt) return;
  escort = { ...escort, closedAt: new Date().toISOString() };
  emit();
}

/** Quitarlo sin más, en mitad del paseo y sin avisar a nadie. */
export function cancelEscort(): void {
  escort = null;
  emit();
}

/** Lo que le llega a esa persona ahora mismo. Se enseña tal cual. */
export function escortPreview(current: Escort, now = new Date()): string {
  return escortMessage(current, now);
}

export function escortStatus(current: Escort, now = new Date()) {
  return escortState(current, now);
}
