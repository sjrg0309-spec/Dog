/**
 * Tipos del dominio.
 *
 * Se definen aquí y no en el paquete de base de datos porque el algoritmo debe
 * poder ejecutarse —y probarse— sin base de datos, sin red y sin Supabase.
 */

/** Talla. El orden importa: la distancia entre tallas es aritmética. */
export const DOG_SIZES = ['mini', 'small', 'medium', 'large', 'giant'] as const;
export type DogSize = (typeof DOG_SIZES)[number];

/** "Nivel de batería" en el lenguaje del producto. */
export const ENERGY_LEVELS = ['couch', 'explorer', 'sprinter'] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

export const PLAY_STYLES = ['chase', 'wrestle', 'toys', 'calm_walk'] as const;
export type PlayStyle = (typeof PLAY_STYLES)[number];

export const TRUST_CIRCLE = [
  'loves_everyone',
  'same_size_only',
  'prefers_females',
  'prefers_males',
  'shy_at_first',
  'no_hyper_puppies',
] as const;
export type TrustCircleFlag = (typeof TRUST_CIRCLE)[number];

export type DogSex = 'male' | 'female';

/**
 * La proyección de un perro que necesita el algoritmo.
 *
 * Deliberadamente no incluye nombre ni foto: mantener fuera lo presentacional
 * hace imposible que una decisión de puntuación dependa de ello.
 */
export type MatchableDog = {
  id: string;
  size: DogSize;
  energyLevel: EnergyLevel;
  playStyles: readonly PlayStyle[];
  trustCircle: readonly TrustCircleFlag[];
  sex: DogSex;
  /** Meses de edad. Por debajo de 12 se considera cachorro. */
  ageMonths: number;
};

/** Franja declarada de paseo. `endTime <= startTime` significa cruce de medianoche. */
export type Availability = {
  /** 0 = domingo … 6 = sábado, como en `Date#getDay`. */
  weekday: number;
  /** `HH:MM` en 24 h. */
  startTime: string;
  endTime: string;
  /** Parque habitual de esa franja, si lo hay. */
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
