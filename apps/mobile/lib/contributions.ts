/**
 * Lo que aporta la gente al mapa.
 *
 * Hasta ahora el mapa era de solo lectura: parques, fuentes y veterinarios que
 * venían dados. Eso deja fuera lo que de verdad sabe quien pasea por ahí todos
 * los días — que la fuente de la esquina tiene bebedero bajo, que hay sombra a
 * media tarde en ese tramo, que el pipicán del plano municipal lleva dos años
 * cerrado.
 *
 * ## Una persona no hace un sitio
 *
 * Un aporte entra como **propuesta**, no como dato, y sale al mapa cuando lo
 * confirma alguien más. Es la misma regla que marca una zona de cebos —contar
 * personas y no formularios— y por el mismo motivo: sin ella, cualquiera pone
 * una fuente donde no hay ninguna, y un mapa con fuentes inventadas es peor que
 * un mapa sin fuentes. En verano, alguien camina hasta ahí con su perro
 * sediento contando con ella.
 *
 * Dos y no tres, al revés que en las zonas marcadas. La diferencia es el daño
 * que hace equivocarse: marcar un parque como envenenado ahuyenta a un barrio
 * entero y es difícil de deshacer, así que pide más gente. Una fuente que no
 * existe cuesta un rodeo, y quien llegue y no la vea puede quitarla.
 */

import { useSyncExternalStore } from 'react';

/** Confirmaciones que hacen falta para que un aporte salga en el mapa. */
export const SUGGESTION_MIN_CONFIRMATIONS = 2;

export type PlaceSuggestion = {
  id: string;
  /** Qué es: fuente, bebedero, sombra, papelera, zona canina. */
  kind: string;
  /** A qué sitio del catálogo se pega, o null si fue por la calle. */
  placeId: string | null;
  /** Quién lo propuso y quién lo ha confirmado. No se publica: se cuenta. */
  confirmedBy: readonly string[];
  suggestedAt: string;
};

let suggestions: PlaceSuggestion[] = [];
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

const snapshot = (): PlaceSuggestion[] => suggestions;

/**
 * Proponer algo, o confirmar lo que ya propuso otro.
 *
 * Las dos cosas son la misma llamada a propósito: quien llega a una fuente que
 * alguien ya apuntó no está haciendo una propuesta nueva, está diciendo que sí
 * está. Tratarlo como dos aportes distintos duplicaría el sitio en el mapa y
 * además nunca llegaría a confirmarse ninguno.
 */
export function addPlaceSuggestion(input: {
  kind: string;
  placeId: string | null;
  byId?: string;
}): void {
  const by = input.byId ?? 'yo';
  const existing = suggestions.find(
    (candidate) => candidate.kind === input.kind && candidate.placeId === input.placeId,
  );

  if (existing) {
    if (existing.confirmedBy.includes(by)) return;
    suggestions = suggestions.map((candidate) =>
      candidate === existing
        ? { ...candidate, confirmedBy: [...candidate.confirmedBy, by] }
        : candidate,
    );
  } else {
    suggestions = [
      ...suggestions,
      {
        id: `sug-${suggestions.length}-${input.kind}`,
        kind: input.kind,
        placeId: input.placeId,
        confirmedBy: [by],
        suggestedAt: new Date().toISOString(),
      },
    ];
  }

  emit();
}

export function usePlaceSuggestions(): PlaceSuggestion[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Lo que ya cuenta como sitio de verdad. */
export function isConfirmed(suggestion: PlaceSuggestion): boolean {
  return suggestion.confirmedBy.length >= SUGGESTION_MIN_CONFIRMATIONS;
}
