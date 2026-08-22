/**
 * Algoritmo de compatibilidad canina.
 *
 * Función pura: mismas entradas, misma salida, sin red ni reloj ni base de
 * datos. Es la pieza que define el producto, así que se prueba a fondo y se
 * mantiene simple de leer — un algoritmo de emparejamiento que nadie puede
 * auditar es un algoritmo en el que nadie debería confiar.
 *
 * Reparto de los 100 puntos:
 *   batería 35 · estilo de juego 30 · tamaño 25 · círculo de confianza 10
 *
 * Por encima de la puntuación están los vetos, que no son "muy incompatibles"
 * sino "no deben encontrarse": responden a riesgo de lesión o a un límite que
 * el tutor declaró de forma explícita.
 */

import {
  DOG_SIZES,
  ENERGY_LEVELS,
  type AffinityBand,
  type AffinityResult,
  type MatchableDog,
  type PairHistory,
  type PlayStyle,
  type TrustCircleFlag,
} from './types.js';

const PUPPY_MAX_AGE_MONTHS = 12;

export const WEIGHTS = { energy: 35, playStyle: 30, size: 25, trust: 10 } as const;

export const BAND_THRESHOLDS = { great: 80, good: 60, supervised: 40 } as const;

/**
 * Compatibilidad entre estilos de juego.
 *
 * No es coincidencia exacta: dos perros pueden divertirse con estilos distintos
 * pero afines, y hay pares que directamente chocan. El caso claro es "lucha
 * libre" frente a "caminata tranquila" (0.10): uno quiere placar y el otro
 * quiere pasear.
 *
 * La matriz es simétrica por construcción; hay un test que lo comprueba.
 */
export const PLAY_STYLE_MATRIX: Record<PlayStyle, Record<PlayStyle, number>> = {
  chase: { chase: 1.0, wrestle: 0.6, toys: 0.5, calm_walk: 0.3 },
  wrestle: { chase: 0.6, wrestle: 1.0, toys: 0.4, calm_walk: 0.1 },
  toys: { chase: 0.5, wrestle: 0.4, toys: 1.0, calm_walk: 0.4 },
  calm_walk: { chase: 0.3, wrestle: 0.1, toys: 0.4, calm_walk: 1.0 },
};

const sizeIndex = (dog: MatchableDog) => DOG_SIZES.indexOf(dog.size);
const energyIndex = (dog: MatchableDog) => ENERGY_LEVELS.indexOf(dog.energyLevel);
const has = (dog: MatchableDog, flag: TrustCircleFlag) => dog.trustCircle.includes(flag);
const isPuppy = (dog: MatchableDog) => dog.ageMonths < PUPPY_MAX_AGE_MONTHS;

const ENERGY_LABEL: Record<string, string> = {
  couch: 'de sofá',
  explorer: 'exploradora',
  sprinter: 'de velocista',
};

const PLAY_LABEL: Record<PlayStyle, string> = {
  chase: 'persecución',
  wrestle: 'lucha libre',
  toys: 'juguetes',
  calm_walk: 'caminata tranquila',
};

/**
 * Vetos duros. Se evalúan en las dos direcciones y basta uno para bloquear.
 *
 * Un veto nunca se compensa con puntos: da igual lo bien que encajen en todo lo
 * demás.
 */
function findVetoes(a: MatchableDog, b: MatchableDog): string[] {
  const reasons: string[] = [];
  const sizeGap = Math.abs(sizeIndex(a) - sizeIndex(b));

  // Riesgo de lesión, no de carácter: un gigante puede hacer daño a un mini sin
  // ninguna mala intención, solo por masa.
  if (sizeGap >= 3) {
    reasons.push('La diferencia de tamaño es demasiado grande para un juego seguro');
  } else {
    // Límite declarado por el tutor. Solo aplica a partir de dos escalones,
    // porque "solo perros de mi tamaño" en la práctica admite al vecino de talla.
    if (sizeGap >= 2 && (has(a, 'same_size_only') || has(b, 'same_size_only'))) {
      reasons.push('Uno de los dos solo se relaciona con perros de su tamaño');
    }
  }

  for (const [self, other] of [
    [a, b],
    [b, a],
  ] as const) {
    if (has(self, 'no_hyper_puppies') && isPuppy(other) && other.energyLevel === 'sprinter') {
      reasons.push('Uno de los dos no tolera cachorros de energía alta');
      break;
    }
  }

  return reasons;
}

/** Batería: 35 puntos. El factor con más peso, y a propósito. */
function scoreEnergy(a: MatchableDog, b: MatchableDog): { points: number; reason?: string } {
  const gap = Math.abs(energyIndex(a) - energyIndex(b));
  if (gap === 0) {
    return { points: WEIGHTS.energy, reason: `Misma energía, ${ENERGY_LABEL[a.energyLevel]}` };
  }
  if (gap === 1) return { points: 20, reason: 'Energías parecidas' };
  // Un perro de sofá con un velocista es la causa número uno de un mal encuentro.
  return { points: 5 };
}

/**
 * Estilo de juego: 30 puntos.
 *
 * Se toma el **máximo** de la matriz, no el promedio: a dos perros les basta
 * *una* forma compartida de jugar para pasarlo bien. Promediar penalizaría al
 * perro versátil, que es justo el que mejor encaja con todo el mundo.
 */
function scorePlayStyle(a: MatchableDog, b: MatchableDog): { points: number; reason?: string } {
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
      ? `Los dos juegan a ${PLAY_LABEL[styleA]}`
      : `${PLAY_LABEL[styleA]} y ${PLAY_LABEL[styleB]} combinan bien`;

  return { points, reason: best >= 0.5 ? reason : undefined };
}

/** Tamaño: 25 puntos. Diferencias de tres escalones ya se han vetado. */
function scoreSize(a: MatchableDog, b: MatchableDog): { points: number; reason?: string } {
  const gap = Math.abs(sizeIndex(a) - sizeIndex(b));
  if (gap === 0) return { points: WEIGHTS.size, reason: 'Mismo tamaño' };
  if (gap === 1) return { points: 18, reason: 'Tamaños parecidos' };
  return { points: 8 };
}

/**
 * Círculo de confianza: 10 puntos.
 *
 * Se resuelve por apertura declarada — abierto, sin declarar, tímido — porque
 * un perro sin declaración no debe puntuar como uno tímido: es desconocido, no
 * reservado.
 */
function scoreTrust(a: MatchableDog, b: MatchableDog): { points: number; reason?: string } {
  const openness = (dog: MatchableDog): 'open' | 'neutral' | 'shy' => {
    if (has(dog, 'shy_at_first')) return 'shy';
    if (has(dog, 'loves_everyone')) return 'open';
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

/**
 * Modificadores. Restan sobre el total y capturan combinaciones que los ejes
 * por separado no ven.
 */
function scoreModifiers(
  a: MatchableDog,
  b: MatchableDog,
  history: PairHistory,
): { points: number; reasons: string[] } {
  let points = 0;
  const reasons: string[] = [];

  // Un perro seguro y bruto arrolla a uno tímido aunque el resto encaje.
  for (const [self, other] of [
    [a, b],
    [b, a],
  ] as const) {
    if (
      has(self, 'shy_at_first') &&
      other.energyLevel === 'sprinter' &&
      other.playStyles.includes('wrestle')
    ) {
      points -= 10;
      reasons.push('Un perro tímido con uno muy intenso: hace falta supervisión');
      break;
    }
  }

  // Preferencia de sexo: es una preferencia declarada, no un veto, así que
  // resta. Se aplica por cada dirección insatisfecha.
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
 * Calcula la afinidad entre dos perros.
 *
 * Simétrica por construcción: todos los vetos y modificadores se evalúan en las
 * dos direcciones, y los ejes usan diferencias absolutas. Hay un test que lo
 * verifica sobre entradas generadas, porque una asimetría aquí significaría que
 * A ve a B como buen match y B no ve a A, que es un fallo visible para el
 * usuario y muy difícil de diagnosticar después.
 */
export function calculateAffinity(
  a: MatchableDog,
  b: MatchableDog,
  history: PairHistory = {},
): AffinityResult {
  const emptyBreakdown = { energy: 0, playStyle: 0, size: 0, trust: 0, modifiers: 0 };

  if (a.id === b.id) {
    return {
      score: 0,
      band: 'incompatible',
      vetoed: true,
      vetoReasons: ['Un perro no puede emparejarse consigo mismo'],
      reasons: [],
      breakdown: emptyBreakdown,
    };
  }

  const vetoReasons = findVetoes(a, b);
  if (vetoReasons.length > 0) {
    return {
      score: 0,
      band: 'incompatible',
      vetoed: true,
      vetoReasons,
      reasons: [],
      breakdown: emptyBreakdown,
    };
  }

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
