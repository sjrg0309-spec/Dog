/**
 * Tipos del dominio.
 *
 * Se definen aquí y no en el paquete de base de datos porque el algoritmo debe
 * poder ejecutarse —y probarse— sin base de datos, sin red y sin Supabase.
 */

import type { PlayStyle } from './species.js';
import type { HealthFlag } from './welfare.js';

export type { PlayStyle, SocialModel, SpeciesProfile, TaxonGroup } from './species.js';

/**
 * Talla, **relativa dentro de la especie**.
 *
 * Un conejo "gigante" y un perro "gigante" no tienen nada que ver, y da igual:
 * los encuentros son siempre entre animales de la misma especie, así que la
 * comparación nunca cruza ese límite. Una escala relativa evita inventar
 * categorías absolutas de peso que no significarían lo mismo para un hurón que
 * para un mastín.
 */
export const PET_SIZES = ['mini', 'small', 'medium', 'large', 'giant'] as const;
export type PetSize = (typeof PET_SIZES)[number];

/**
 * Nivel de actividad.
 *
 * Los valores son neutros a propósito. La interfaz los traduce al lenguaje de
 * cada especie —"de sofá" y "velocista" para un perro, "tranquilo" y "muy
 * activo" para un conejo—, pero el dato que guarda la base es el mismo, y así
 * el algoritmo no necesita saber de qué animal habla.
 */
export const ENERGY_LEVELS = ['low', 'medium', 'high'] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

export const TRUST_CIRCLE = [
  'loves_everyone',
  'same_size_only',
  'prefers_females',
  'prefers_males',
  'shy_at_first',
  /** Antes era "no cachorros": ahora vale para el juvenil de cualquier especie. */
  'no_hyper_juveniles',
] as const;
export type TrustCircleFlag = (typeof TRUST_CIRCLE)[number];

export type PetSex = 'male' | 'female';

/**
 * La proyección de una mascota que necesita el algoritmo.
 *
 * Deliberadamente no incluye nombre ni foto: mantener fuera lo presentacional
 * hace imposible que una decisión de puntuación dependa de ello.
 */
export type MatchablePet = {
  id: string;
  /** Identificador del catálogo de especies. Decide todo lo demás. */
  speciesId: string;
  size: PetSize;
  energyLevel: EnergyLevel;
  playStyles: readonly PlayStyle[];
  trustCircle: readonly TrustCircleFlag[];
  sex: PetSex;
  ageMonths: number;

  /**
   * Lo que le pasa a este animal y cambia lo que puede hacer hoy.
   *
   * Son opcionales porque una ficha recién creada no las tiene, y porque no
   * intervienen en la afinidad: el carácter y el bienestar son dos preguntas
   * distintas. Ninguna puntuación de compatibilidad debería poder decidir si un
   * bulldog sale a 34 grados.
   */
  healthFlags?: readonly HealthFlag[];
  /** Techo de duración propio. Solo puede bajar del de la especie. */
  ownMaxSessionMinutes?: number | null;
  /** Techo térmico propio. También solo hacia abajo. */
  ownMaxTempC?: number | null;
};

/** Franja declarada de paseo o de salida. `endTime <= startTime` cruza medianoche. */
export type Availability = {
  /** 0 = domingo … 6 = sábado, como en `Date#getDay`. */
  weekday: number;
  /** `HH:MM` en 24 h. */
  startTime: string;
  endTime: string;
  /** Lugar habitual de esa franja, si lo hay. */
  placeId?: string | null;
};

export type LatLng = { lat: number; lng: number };

/** Banda de afinidad. Determina cómo se presenta un match, no solo su color. */
export type AffinityBand = 'great' | 'good' | 'supervised' | 'incompatible';

export type AffinityBreakdown = {
  energy: number;
  playStyle: number;
  size: number;
  trust: number;
  modifiers: number;
};

export type AffinityResult = {
  /** 0–100. Cero si hay veto. */
  score: number;
  band: AffinityBand;
  /** Un veto es un bloqueo de seguridad, no una puntuación baja. */
  vetoed: boolean;
  /**
   * Por qué se ha bloqueado.
   *
   * `different_species` y `solitary_species` no son "muy incompatibles": son
   * situaciones en las que el encuentro no debe plantearse, y la interfaz las
   * explica de forma distinta a un veto por tamaño o por límite declarado.
   */
  vetoKind: 'none' | 'different_species' | 'solitary_species' | 'safety' | 'self';
  /** Motivos de veto, en español, listos para mostrar. */
  vetoReasons: string[];
  /** Por qué encajan, en español. Alimenta el "por qué" de la tarjeta. */
  reasons: string[];
  breakdown: AffinityBreakdown;
};

/** Señales del historial que el llamador aporta; el algoritmo no consulta nada. */
export type PairHistory = {
  /** El tutor marcó 👎 en un encuentro previo de este par o de uno muy parecido. */
  hadNegativeFeedback?: boolean;
};
