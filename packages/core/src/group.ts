/**
 * Afinidad de grupo y formación de grupos.
 *
 * La decisión central de este módulo: **el titular de un grupo es el mínimo par
 * a par, no el promedio.** Un grupo vale lo que vale su peor pareja. Un promedio
 * del 85 % puede esconder un par al 30 % que arruina el paseo y provoca justo el
 * conflicto territorial que el producto quiere evitar; el mínimo no puede
 * esconderlo.
 */

import { calculateAffinity } from './affinity.js';
import type { AffinityBand, MatchableDog, PairHistory } from './types.js';
import { bandFor } from './affinity.js';

export type PairScore = {
  a: string;
  b: string;
  score: number;
  vetoed: boolean;
};

export type GroupAffinity = {
  /** El titular: la peor pareja del grupo. */
  min: number;
  /** Secundario, útil para matizar pero nunca para encabezar. */
  mean: number;
  band: AffinityBand;
  /** El eslabón más débil, con nombre y apellidos, para poder mostrarlo. */
  weakestPair: PairScore | null;
  /** Un solo veto invalida el grupo entero. */
  hasVeto: boolean;
  pairs: PairScore[];
};

type HistoryLookup = (a: string, b: string) => PairHistory;

const noHistory: HistoryLookup = () => ({});

/** Todas las parejas del grupo, sin repetir y sin el par consigo mismo. */
export function scorePairs(
  dogs: readonly MatchableDog[],
  history: HistoryLookup = noHistory,
): PairScore[] {
  const pairs: PairScore[] = [];
  for (let i = 0; i < dogs.length; i += 1) {
    for (let j = i + 1; j < dogs.length; j += 1) {
      const first = dogs[i];
      const second = dogs[j];
      if (!first || !second) continue;
      const result = calculateAffinity(first, second, history(first.id, second.id));
      pairs.push({ a: first.id, b: second.id, score: result.score, vetoed: result.vetoed });
    }
  }
  return pairs;
}

/**
 * Afinidad de un grupo ya formado.
 *
 * Un grupo de un solo perro es trivialmente perfecto: no hay pareja que pueda
 * fallar. Se devuelve 100 en lugar de un caso especial en cada llamador.
 */
export function groupAffinity(
  dogs: readonly MatchableDog[],
  history: HistoryLookup = noHistory,
): GroupAffinity {
  if (dogs.length < 2) {
    return { min: 100, mean: 100, band: 'great', weakestPair: null, hasVeto: false, pairs: [] };
  }

  const pairs = scorePairs(dogs, history);
  let weakestPair = pairs[0] ?? null;
  let total = 0;

  for (const pair of pairs) {
    total += pair.score;
    if (weakestPair && pair.score < weakestPair.score) weakestPair = pair;
  }

  const min = weakestPair ? weakestPair.score : 100;
  const mean = Math.round(total / pairs.length);

  return {
    min,
    mean,
    band: bandFor(min),
    weakestPair,
    hasVeto: pairs.some((pair) => pair.vetoed),
    pairs,
  };
}

export type FormedGroup = {
  dogs: MatchableDog[];
  affinity: GroupAffinity;
  /** Candidatos que no entraron, con el motivo. */
  rejected: Array<{ dogId: string; reason: string }>;
};

/**
 * Propone el grupo que maximiza el mínimo.
 *
 * Esto es lo que un directorio de espacios en renta no puede hacer: alquilar un
 * patio a una persona es fácil; saber qué cinco perros pueden compartirlo sin
 * pelearse requiere conocer a los perros.
 *
 * La búsqueda es voraz — en cada paso entra el candidato que menos daña el
 * mínimo. No garantiza el óptimo global, y es la decisión correcta igualmente:
 * los grupos reales son de tres a ocho perros, el usuario puede quitar y poner a
 * mano, y una búsqueda exhaustiva sobre decenas de candidatos costaría
 * combinatoria a cambio de una diferencia que nadie percibe. El sesgo del voraz
 * es conservador: prefiere grupos pequeños y seguros a grandes y frágiles.
 */
export function formGroup(
  host: MatchableDog,
  candidates: readonly MatchableDog[],
  options: { maxDogs: number; minAffinity?: number; history?: HistoryLookup } = { maxDogs: 6 },
): FormedGroup {
  const { maxDogs, minAffinity = 60, history = noHistory } = options;

  const chosen: MatchableDog[] = [host];
  const rejected: Array<{ dogId: string; reason: string }> = [];
  const remaining = candidates.filter((dog) => dog.id !== host.id);
  const discarded = new Set<string>();

  while (chosen.length < maxDogs) {
    let best: { dog: MatchableDog; affinity: GroupAffinity } | null = null;

    for (const candidate of remaining) {
      if (discarded.has(candidate.id)) continue;

      const affinity = groupAffinity([...chosen, candidate], history);
      if (affinity.hasVeto) {
        discarded.add(candidate.id);
        rejected.push({ dogId: candidate.id, reason: 'Incompatible por seguridad con el grupo' });
        continue;
      }
      if (affinity.min < minAffinity) {
        discarded.add(candidate.id);
        rejected.push({ dogId: candidate.id, reason: 'Bajaría demasiado la afinidad del grupo' });
        continue;
      }

      // Desempates deterministas: primero el mínimo, luego el promedio, y por
      // último el id, para que la misma entrada dé siempre el mismo grupo.
      const better =
        !best ||
        affinity.min > best.affinity.min ||
        (affinity.min === best.affinity.min && affinity.mean > best.affinity.mean) ||
        (affinity.min === best.affinity.min &&
          affinity.mean === best.affinity.mean &&
          candidate.id < best.dog.id);

      if (better) best = { dog: candidate, affinity };
    }

    if (!best) break;
    chosen.push(best.dog);
    discarded.add(best.dog.id);
  }

  return { dogs: chosen, affinity: groupAffinity(chosen, history), rejected };
}

/**
 * Reparte un importe entre participantes sin perder ni un céntimo.
 *
 * Se trabaja en enteros y el resto se reparte de uno en uno entre los primeros,
 * de modo que la suma de las partes es exactamente el total. Dividir en coma
 * flotante y redondear cada parte deja descuadres de céntimos, y un descuadre en
 * dinero real de un usuario es de las pocas cosas de las que no se sale
 * iterando.
 */
export function splitCost(totalCents: number, participants: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error('El importe total debe ser un entero de céntimos no negativo');
  }
  if (!Number.isInteger(participants) || participants <= 0) {
    throw new Error('Debe haber al menos un participante');
  }

  const base = Math.floor(totalCents / participants);
  const remainder = totalCents % participants;

  return Array.from({ length: participants }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
}

/** Formatea céntimos para la interfaz: 1050 → "10,50 €". */
export function formatCents(cents: number, currency = '€'): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const units = Math.floor(absolute / 100);
  const decimals = String(absolute % 100).padStart(2, '0');
  return `${sign}${units},${decimals} ${currency}`;
}
