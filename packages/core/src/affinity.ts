/**
 * Algoritmo de compatibilidad entre mascotas.
 *
 * Función pura: mismas entradas, misma salida, sin red ni reloj ni base de
 * datos. Es la pieza que define el producto, así que se prueba a fondo y se
 * mantiene simple de leer — un algoritmo de emparejamiento que nadie puede
 * auditar es un algoritmo en el que nadie debería confiar.
 *
 * Hay tres niveles, y el orden importa:
 *
 *   1. **Especie.** Los encuentros son siempre entre animales de la misma
 *      especie, y solo de especies que socializan. Esto no se puntúa: se
 *      resuelve antes de mirar nada más.
 *   2. **Vetos de seguridad.** Riesgo de lesión o un límite que el tutor
 *      declaró. Tampoco se compensan.
 *   3. **Puntuación.** 100 puntos: actividad 35, estilo de juego 30, tamaño 25,
 *      círculo de confianza 10.
 */

import {
  ENERGY_LEVELS,
  PET_SIZES,
  type AffinityBand,
  type AffinityResult,
  type MatchablePet,
  type PairHistory,
  type TrustCircleFlag,
} from './types.js';
import { findSpecies, isPredatorPreyPair, type PlayStyle, type SpeciesProfile } from './species.js';

export const WEIGHTS = { energy: 35, playStyle: 30, size: 25, trust: 10 } as const;

export const BAND_THRESHOLDS = { great: 80, good: 60, supervised: 40 } as const;

/**
 * Compatibilidad entre estilos de juego.
 *
 * No es coincidencia exacta: dos animales pueden divertirse con estilos
 * distintos pero afines, y hay pares que directamente chocan. El caso claro es
 * "lucha libre" frente a "estar al lado" (0.05): uno quiere placar y el otro
 * quiere compañía tranquila.
 *
 * La matriz cubre el vocabulario completo, no solo el de perros: `grooming`,
 * `side_by_side` y `forage` son lo que de verdad hacen conejos, cobayas y
 * hurones, y necesitaban entrar en el cálculo, no quedarse de adorno.
 *
 * Es simétrica por construcción; hay un test que lo comprueba.
 */
export const PLAY_STYLE_MATRIX: Record<PlayStyle, Record<PlayStyle, number>> = {
  chase: {
    chase: 1.0, wrestle: 0.6, toys: 0.5, calm_walk: 0.3, grooming: 0.2, side_by_side: 0.15, forage: 0.35,
  },
  wrestle: {
    chase: 0.6, wrestle: 1.0, toys: 0.4, calm_walk: 0.1, grooming: 0.25, side_by_side: 0.05, forage: 0.2,
  },
  toys: {
    chase: 0.5, wrestle: 0.4, toys: 1.0, calm_walk: 0.4, grooming: 0.3, side_by_side: 0.3, forage: 0.6,
  },
  calm_walk: {
    chase: 0.3, wrestle: 0.1, toys: 0.4, calm_walk: 1.0, grooming: 0.5, side_by_side: 0.7, forage: 0.45,
  },
  grooming: {
    chase: 0.2, wrestle: 0.25, toys: 0.3, calm_walk: 0.5, grooming: 1.0, side_by_side: 0.8, forage: 0.4,
  },
  side_by_side: {
    chase: 0.15, wrestle: 0.05, toys: 0.3, calm_walk: 0.7, grooming: 0.8, side_by_side: 1.0, forage: 0.5,
  },
  forage: {
    chase: 0.35, wrestle: 0.2, toys: 0.6, calm_walk: 0.45, grooming: 0.4, side_by_side: 0.5, forage: 1.0,
  },
};

const sizeIndex = (pet: MatchablePet) => PET_SIZES.indexOf(pet.size);
const energyIndex = (pet: MatchablePet) => ENERGY_LEVELS.indexOf(pet.energyLevel);
const has = (pet: MatchablePet, flag: TrustCircleFlag) => pet.trustCircle.includes(flag);

/** Juvenil según el umbral de su especie, no según el del perro. */
const isJuvenile = (pet: MatchablePet, species: SpeciesProfile) =>
  pet.ageMonths < species.juvenileUntilMonths;

const PLAY_LABEL: Record<PlayStyle, string> = {
  chase: 'persecución',
  wrestle: 'lucha',
  toys: 'juguetes',
  calm_walk: 'paseo tranquilo',
  grooming: 'acicalarse',
  side_by_side: 'estar juntos sin más',
  forage: 'buscar comida',
};

const emptyBreakdown = { energy: 0, playStyle: 0, size: 0, trust: 0, modifiers: 0 };

const blocked = (
  vetoKind: AffinityResult['vetoKind'],
  reasons: string[],
): AffinityResult => ({
  score: 0,
  band: 'incompatible',
  vetoed: true,
  vetoKind,
  vetoReasons: reasons,
  reasons: [],
  breakdown: emptyBreakdown,
});

/**
 * Vetos de seguridad dentro de la misma especie.
 *
 * Se evalúan en las dos direcciones y basta uno para bloquear. Un veto nunca se
 * compensa con puntos: da igual lo bien que encajen en todo lo demás.
 */
function findVetoes(a: MatchablePet, b: MatchablePet, species: SpeciesProfile): string[] {
  const reasons: string[] = [];
  const sizeGap = Math.abs(sizeIndex(a) - sizeIndex(b));

  // Riesgo de lesión, no de carácter: un ejemplar mucho más grande puede hacer
  // daño a uno pequeño sin ninguna mala intención, solo por masa.
  if (sizeGap >= 3) {
    reasons.push('La diferencia de tamaño es demasiado grande para un encuentro seguro');
  } else if (sizeGap >= 2 && (has(a, 'same_size_only') || has(b, 'same_size_only'))) {
    // Límite declarado por el tutor. Solo a partir de dos escalones, porque
    // "solo de mi tamaño" en la práctica admite al vecino de talla.
    reasons.push('Uno de los dos solo se relaciona con animales de su tamaño');
  }

  for (const [self, other] of [
    [a, b],
    [b, a],
  ] as const) {
    if (
      has(self, 'no_hyper_juveniles') &&
      isJuvenile(other, species) &&
      other.energyLevel === 'high'
    ) {
      reasons.push('Uno de los dos no tolera juveniles de actividad alta');
      break;
    }
  }

  return reasons;
}

/** Actividad: 35 puntos. El eje con más peso, y a propósito. */
function scoreEnergy(a: MatchablePet, b: MatchablePet): { points: number; reason?: string } {
  const gap = Math.abs(energyIndex(a) - energyIndex(b));
  if (gap === 0) return { points: WEIGHTS.energy, reason: 'Mismo nivel de actividad' };
  if (gap === 1) return { points: 20, reason: 'Niveles de actividad parecidos' };
  // Un animal tranquilo con uno incansable es la causa número uno de un mal
  // encuentro, en cualquier especie del catálogo.
  return { points: 5 };
}

/**
 * Estilo de juego: 30 puntos.
 *
 * Se toma el **máximo** de la matriz, no el promedio: basta *una* forma
 * compartida de pasarlo bien. Promediar penalizaría al animal versátil, que es
 * justo el que mejor encaja con todo el mundo.
 */
function scorePlayStyle(a: MatchablePet, b: MatchablePet): { points: number; reason?: string } {
  if (a.playStyles.length === 0 || b.playStyles.length === 0) {
    return { points: WEIGHTS.playStyle * 0.5 };
  }

  let best = 0;
  let bestPair: [PlayStyle, PlayStyle] | null = null;
  for (const styleA of a.playStyles) {
    for (const styleB of b.playStyles) {
      const value = PLAY_STYLE_MATRIX[styleA][styleB];
      if (value > best) {
        best = value;
        bestPair = [styleA, styleB];
      }
    }
  }

  const points = WEIGHTS.playStyle * best;
  if (!bestPair) return { points };

  const [styleA, styleB] = bestPair;
  const reason =
    styleA === styleB
      ? `A los dos les va ${PLAY_LABEL[styleA]}`
      : `${PLAY_LABEL[styleA]} y ${PLAY_LABEL[styleB]} combinan bien`;

  return { points, reason: best >= 0.5 ? reason : undefined };
}

/** Tamaño: 25 puntos. Diferencias de tres escalones ya se han vetado. */
function scoreSize(a: MatchablePet, b: MatchablePet): { points: number; reason?: string } {
  const gap = Math.abs(sizeIndex(a) - sizeIndex(b));
  if (gap === 0) return { points: WEIGHTS.size, reason: 'Mismo tamaño' };
  if (gap === 1) return { points: 18, reason: 'Tamaños parecidos' };
  return { points: 8 };
}

/**
 * Círculo de confianza: 10 puntos.
 *
 * Se resuelve por apertura declarada —abierto, sin declarar, tímido— porque un
 * animal sin declaración no debe puntuar como uno tímido: es desconocido, no
 * reservado.
 */
function scoreTrust(a: MatchablePet, b: MatchablePet): { points: number; reason?: string } {
  const openness = (pet: MatchablePet): 'open' | 'neutral' | 'shy' => {
    if (has(pet, 'shy_at_first')) return 'shy';
    if (has(pet, 'loves_everyone')) return 'open';
    return 'neutral';
  };

  const pair = [openness(a), openness(b)].sort().join('+');
  switch (pair) {
    case 'open+open':
      return { points: 10, reason: 'Los dos se llevan bien con todo el mundo' };
    case 'neutral+open':
      return { points: 9 };
    case 'neutral+neutral':
      return { points: 8 };
    case 'open+shy':
      return { points: 7, reason: 'Uno es tímido al inicio; el otro ayuda a romper el hielo' };
    case 'neutral+shy':
      return { points: 6 };
    default: // shy+shy
      return { points: 4, reason: 'Los dos son tímidos: mejor un encuentro tranquilo' };
  }
}

/** Modificadores: restan sobre el total y capturan lo que los ejes no ven. */
function scoreModifiers(
  a: MatchablePet,
  b: MatchablePet,
  history: PairHistory,
): { points: number; reasons: string[] } {
  let points = 0;
  const reasons: string[] = [];

  // Un animal seguro y brusco arrolla a uno tímido aunque el resto encaje.
  for (const [self, other] of [
    [a, b],
    [b, a],
  ] as const) {
    if (
      has(self, 'shy_at_first') &&
      other.energyLevel === 'high' &&
      other.playStyles.includes('wrestle')
    ) {
      points -= 10;
      reasons.push('Uno tímido con otro muy intenso: hace falta supervisión');
      break;
    }
  }

  // Preferencia declarada, no veto, así que resta. Una vez por dirección.
  for (const [self, other] of [
    [a, b],
    [b, a],
  ] as const) {
    const wantsFemales = has(self, 'prefers_females') && other.sex === 'male';
    const wantsMales = has(self, 'prefers_males') && other.sex === 'female';
    if (wantsFemales || wantsMales) points -= 8;
  }

  if (history.hadNegativeFeedback) {
    points -= 15;
    reasons.push('Un encuentro anterior no fue bien');
  }

  return { points, reasons };
}

export function bandFor(score: number): AffinityBand {
  if (score >= BAND_THRESHOLDS.great) return 'great';
  if (score >= BAND_THRESHOLDS.good) return 'good';
  if (score >= BAND_THRESHOLDS.supervised) return 'supervised';
  return 'incompatible';
}

/**
 * Calcula la afinidad entre dos mascotas.
 *
 * Simétrica por construcción: todos los vetos y modificadores se evalúan en las
 * dos direcciones y los ejes usan diferencias absolutas. Hay un test que lo
 * verifica sobre entradas generadas, porque una asimetría aquí significaría que
 * A ve a B como buen match y B no ve a A: un fallo visible para el usuario y
 * muy difícil de diagnosticar después.
 */
export function calculateAffinity(
  a: MatchablePet,
  b: MatchablePet,
  history: PairHistory = {},
): AffinityResult {
  if (a.id === b.id) {
    return blocked('self', ['Una mascota no puede emparejarse consigo misma']);
  }

  const speciesA = findSpecies(a.speciesId);
  const speciesB = findSpecies(b.speciesId);

  if (!speciesA || !speciesB) {
    return blocked('safety', ['Especie desconocida: no se puede evaluar la compatibilidad']);
  }

  // ------------------------------------------------------------------------
  // Nivel 1: especie. Antes que cualquier puntuación.
  // ------------------------------------------------------------------------

  if (speciesA.id !== speciesB.id) {
    // Los encuentros son siempre entre la misma especie. Es una regla de una
    // línea que elimina de golpe toda una categoría de daño: un hurón fue
    // criado para cazar conejos, y ninguna puntuación de temperamento debería
    // poder colocarlos en el mismo sitio.
    const reason = isPredatorPreyPair(speciesA, speciesB)
      ? `${speciesA.commonName} y ${speciesB.commonName} son especies con relación de ` +
        'depredador y presa: un encuentro pone en riesgo a uno de los dos'
      : `Coincide solo organiza encuentros entre animales de la misma especie, y ` +
        `${speciesA.commonName.toLowerCase()} y ${speciesB.commonName.toLowerCase()} no lo son`;

    return blocked('different_species', [reason]);
  }

  const species = speciesA;

  if (species.socialModel === 'solitary') {
    return blocked('solitary_species', [species.socialNote]);
  }

  // ------------------------------------------------------------------------
  // Nivel 2: vetos de seguridad.
  // ------------------------------------------------------------------------

  const vetoReasons = findVetoes(a, b, species);
  if (vetoReasons.length > 0) return blocked('safety', vetoReasons);

  // ------------------------------------------------------------------------
  // Nivel 3: puntuación.
  // ------------------------------------------------------------------------

  const energy = scoreEnergy(a, b);
  const playStyle = scorePlayStyle(a, b);
  const size = scoreSize(a, b);
  const trust = scoreTrust(a, b);
  const modifiers = scoreModifiers(a, b, history);

  const raw = energy.points + playStyle.points + size.points + trust.points + modifiers.points;
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  const reasons = [energy.reason, playStyle.reason, size.reason, trust.reason]
    .filter((reason): reason is string => Boolean(reason))
    .concat(modifiers.reasons);

  return {
    score,
    band: bandFor(score),
    vetoed: false,
    vetoKind: 'none',
    vetoReasons: [],
    reasons,
    breakdown: {
      energy: energy.points,
      playStyle: Math.round(playStyle.points * 100) / 100,
      size: size.points,
      trust: trust.points,
      modifiers: modifiers.points,
    },
  };
}
