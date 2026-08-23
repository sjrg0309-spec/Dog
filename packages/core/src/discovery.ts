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
import { assessWelfare, groupWelfare, type Conditions, type WelfareVerdict } from './welfare.js';
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
  /**
   * Qué le conviene al par si quedasen hoy, o null si no se dieron condiciones.
   *
   * Es del par y no de uno solo: el encuentro tiene que convenirle también al
   * otro animal, que no es un recurso del plan de nadie.
   */
  welfare: WelfareVerdict | null;
};

export type DiscoveryOptions = {
  /** Radio de búsqueda. Fuera de él, la cercanía puntúa cero pero no excluye. */
  radiusMeters?: number;
  /** Por debajo de esto no se muestra. 40 = umbral de "con supervisión". */
  minAffinity?: number;
  /** Incluir los que quedarían ocultos, para poder decir la verdad al usuario. */
  includeIncompatible?: boolean;
  /**
   * Condiciones del encuentro que se está planteando: hoy, aquí, este rato.
   *
   * Si se dan, el bienestar **manda sobre la lista**: cuando al animal del
   * tutor no le conviene salir, no se devuelve ningún candidato. No es una
   * advertencia encima de una lista que sigue ahí, porque una lista que sigue
   * ahí se acaba usando.
   */
  conditions?: Conditions | null;
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
  const {
    radiusMeters = 2000,
    minAffinity = 40,
    includeIncompatible = false,
    conditions = null,
  } = options;

  // El bienestar del propio animal se comprueba antes que nada: si hoy no le
  // conviene salir, la pregunta de con quién ya no procede.
  if (conditions && assessWelfare(viewer.pet, conditions).level === 'stop') return [];

  const matches: DiscoveryMatch[] = [];

  for (const candidate of candidates) {
    if (candidate.pet.id === viewer.pet.id) continue;

    const affinity = calculateAffinity(viewer.pet, candidate.pet, candidate.history ?? {});
    if (affinity.vetoed) continue;
    if (!includeIncompatible && affinity.score < minAffinity) continue;

    // Y el del otro animal también: un encuentro que a él no le conviene no es
    // un match, por muy bien que encajen de carácter.
    const welfare = conditions
      ? groupWelfare([viewer.pet, candidate.pet], conditions)
      : null;
    if (welfare && welfare.level === 'stop') continue;

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
      welfare,
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
  /** Hoy no le conviene salir. Es un estado vacío del que la app se hace cargo. */
  | 'welfare_stop'
  | 'has_matches';

export function classifyResults(
  viewer: DiscoveryInput,
  candidates: readonly DiscoveryCandidate[],
  matches: readonly DiscoveryMatch[],
  conditions?: Conditions | null,
): EmptyStateReason {
  if (matches.length > 0) return 'has_matches';
  // Va antes que "no hay nadie": decirle a alguien que no hay candidatos cuando
  // el motivo real es que hace 36 grados sería mentirle sobre lo que pasa.
  if (conditions && assessWelfare(viewer.pet, conditions).level === 'stop') return 'welfare_stop';
  if (candidates.filter((candidate) => candidate.pet.id !== viewer.pet.id).length === 0) {
    return 'no_candidates';
  }
  const anyOverlap = candidates.some(
    (candidate) => scheduleOverlap(viewer.availability, candidate.availability).totalMinutes > 0,
  );
  return anyOverlap ? 'all_incompatible' : 'no_schedule_overlap';
}
