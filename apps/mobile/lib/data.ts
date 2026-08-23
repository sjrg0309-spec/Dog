/**
 * Capa de datos.
 *
 * Una sola interfaz con dos implementaciones. Hoy corre la local, porque en el
 * entorno donde se construyó esto no hay un proyecto Supabase desplegado y
 * React Native no puede hablar con Postgres directamente. Cambiar de una a otra
 * es sustituir un módulo, no reescribir pantallas.
 *
 * Lo que **no** es local es el cálculo: la afinidad, la coincidencia de horarios
 * y el orden del descubrimiento salen de `@coincide/core`, el mismo código que
 * verifican los 94 tests del paquete y que la base de datos espeja en SQL.
 */

import {
  classifyResults,
  formatDistance,
  rankCandidates,
  type DiscoveryCandidate,
  type DiscoveryMatch,
  type EmptyStateReason,
} from '@coincide/core';

import { MY_DOG, OTHER_DOGS, PLAYDATES, SPOTS, type DemoDog } from './demo-data';

export type { DemoDog, DemoPlaydate, DemoSpot } from './demo-data';

export type DiscoveryEntry = {
  dog: DemoDog;
  match: DiscoveryMatch;
  distanceLabel: string | null;
};

export type DiscoveryResult = {
  entries: DiscoveryEntry[];
  emptyReason: EmptyStateReason;
  /** Perros descartados por seguridad, para poder decirlo en vez de callarlo. */
  vetoedCount: number;
};

export function myDog(): DemoDog {
  return MY_DOG;
}

/**
 * Descubrimiento por los tres ejes.
 *
 * Se devuelve también cuántos quedaron fuera por veto: si no hay nadie
 * compatible pero sí hay perros cerca, la aplicación debe poder decirlo con
 * honestidad en vez de mostrar una pantalla vacía sin explicación.
 */
export function discover(): DiscoveryResult {
  const viewer = {
    dog: MY_DOG,
    availability: MY_DOG.availability,
    location: MY_DOG.location,
  };

  const candidates: DiscoveryCandidate[] = OTHER_DOGS.map((dog) => ({
    dog,
    availability: dog.availability,
    location: dog.location,
  }));

  const matches = rankCandidates(viewer, candidates, { radiusMeters: 5000 });
  const byId = new Map(OTHER_DOGS.map((dog) => [dog.id, dog]));

  const entries: DiscoveryEntry[] = matches.flatMap((match) => {
    const dog = byId.get(match.dogId);
    if (!dog) return [];
    return [
      {
        dog,
        match,
        distanceLabel:
          match.distanceMeters === null ? null : formatDistance(match.distanceMeters),
      },
    ];
  });

  const shownIds = new Set(matches.map((match) => match.dogId));
  const withIncompatible = rankCandidates(viewer, candidates, {
    radiusMeters: 5000,
    includeIncompatible: true,
  });
  const vetoedCount = OTHER_DOGS.length - withIncompatible.length;

  return {
    entries,
    emptyReason: classifyResults(viewer, candidates, matches),
    vetoedCount: Math.max(0, vetoedCount - (shownIds.size - entries.length)),
  };
}

/** Quién está paseando ahora mismo, sin filtrar por compatibilidad. */
export function walkingNow(): DemoDog[] {
  return OTHER_DOGS.filter((dog) => dog.walkingUntilMinutes !== null);
}

export function playdates() {
  return [...PLAYDATES].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function spots() {
  return SPOTS;
}

export function dogById(id: string): DemoDog | null {
  if (id === MY_DOG.id) return MY_DOG;
  return OTHER_DOGS.find((dog) => dog.id === id) ?? null;
}
