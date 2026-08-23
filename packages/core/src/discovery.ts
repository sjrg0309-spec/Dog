/**
 * Descubrimiento: los tres ejes juntos para ordenar, separados para mostrar.
 *
 *   afinidad   → temperamento. Es el titular en la tarjeta.
 *   horario    → solapamiento semanal. Lo que hace útil la app a cualquier hora.
 *   cercanía   → distancia.
 *
 * Se combinan **solo** para decidir el orden de la lista. La interfaz enseña los
 * tres por separado, porque fundirlos en un único porcentaje convertiría a un
 * animal mediocre pero cercano en un "95 % compatible", y eso es mentirle al
 * usuario sobre lo único que de verdad le importa.
 */

import { calculateAffinity } from './affinity.js';
import { distanceMeters, proximityScore } from './geo.js';
import { describeOverlap, scheduleOverlap, type ScheduleOverlap } from './schedule.js';
import type { AffinityResult, Availability, LatLng, MatchablePet, PairHistory } from './types.js';

/** Pesos del orden. Solo afectan a la ordenación, nunca a lo que se muestra. */
export const RANK_WEIGHTS = { affinity: 0.5, schedule: 0.3, proximity: 0.2 } as const;

export type DiscoveryInput = {
  pet: MatchablePet;
  availability: readonly Availability[];
  location?: LatLng | null;
};

export type DiscoveryCandidate = DiscoveryInput & {
  history?: PairHistory;
};

export type DiscoveryMatch = {
  petId: string;
  affinity: AffinityResult;
  schedule: ScheduleOverlap;
  /** Descripción en lenguaje llano, o null si no coinciden. */
  scheduleSummary: string | null;
  distanceMeters: number | null;
  proximity: number;
  /** Solo para ordenar. No se muestra. */
  rankScore: number;
};

export type DiscoveryOptions = {
  /** Radio de búsqueda. Fuera de él, la cercanía puntúa cero pero no excluye. */
  radiusMeters?: number;
  /** Por debajo de esto no se muestra. 40 = umbral de "con supervisión". */
  minAffinity?: number;
  /** Incluir los que quedarían ocultos, para poder decir la verdad al usuario. */
  includeIncompatible?: boolean;
};

/**
 * Ordena candidatos para el descubrimiento.
 *
 * Los vetados nunca aparecen: un veto es un límite de seguridad, no una
 * puntuación baja que se pueda compensar ordenando.
 */
export function rankCandidates(
  viewer: DiscoveryInput,
  candidates: readonly DiscoveryCandidate[],
  options: DiscoveryOptions = {},
): DiscoveryMatch[] {
  const { radiusMeters = 2000, minAffinity = 40, includeIncompatible = false } = options;

  const matches: DiscoveryMatch[] = [];

  for (const candidate of candidates) {
    if (candidate.pet.id === viewer.pet.id) continue;

    const affinity = calculateAffinity(viewer.pet, candidate.pet, candidate.history ?? {});
    if (affinity.vetoed) continue;
    if (!includeIncompatible && affinity.score < minAffinity) continue;

    const schedule = scheduleOverlap(viewer.availability, candidate.availability);

    const distance =
      viewer.location && candidate.location
        ? distanceMeters(viewer.location, candidate.location)
        : null;
    const proximity = distance === null ? 0 : proximityScore(distance, radiusMeters);

    const rankScore =
      RANK_WEIGHTS.affinity * affinity.score +
      RANK_WEIGHTS.schedule * schedule.score +
      RANK_WEIGHTS.proximity * proximity;

    matches.push({
      petId: candidate.pet.id,
      affinity,
      schedule,
      scheduleSummary: describeOverlap(schedule),
      distanceMeters: distance,
      proximity,
      rankScore: Math.round(rankScore * 100) / 100,
    });
  }

  // El id desempata para que dos ejecuciones con los mismos datos den el mismo
  // orden; una lista que baila entre recargas se percibe como un fallo.
  return matches.sort(
    (a, b) => b.rankScore - a.rankScore || (a.petId < b.petId ? -1 : a.petId > b.petId ? 1 : 0),
  );
}

/**
 * El estado que hay que resolver bien: no hay nadie compatible cerca.
 *
 * Distingue tres situaciones que la interfaz debe tratar distinto, en lugar de
 * enseñar la misma pantalla vacía para todas. Rellenar con malos matches para
 * que la lista no esté vacía sería el camino fácil y el equivocado.
 */
export type EmptyStateReason =
  | 'no_candidates'
  | 'all_incompatible'
  | 'no_schedule_overlap'
  | 'has_matches';

export function classifyResults(
  viewer: DiscoveryInput,
  candidates: readonly DiscoveryCandidate[],
  matches: readonly DiscoveryMatch[],
): EmptyStateReason {
  if (matches.length > 0) return 'has_matches';
  if (candidates.filter((candidate) => candidate.pet.id !== viewer.pet.id).length === 0) {
    return 'no_candidates';
  }
  const anyOverlap = candidates.some(
    (candidate) => scheduleOverlap(viewer.availability, candidate.availability).totalMinutes > 0,
  );
  return anyOverlap ? 'all_incompatible' : 'no_schedule_overlap';
}
