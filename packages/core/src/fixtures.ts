/**
 * Constructores de datos para los tests.
 *
 * Viven en `src` y no en un directorio de tests porque la semilla de la base de
 * datos también los usa: así los perros de ejemplo de la aplicación y los de las
 * pruebas no pueden divergir.
 */

import type {
  Availability,
  DogSex,
  DogSize,
  EnergyLevel,
  MatchableDog,
  PlayStyle,
  TrustCircleFlag,
} from './types.js';

let counter = 0;

export function makeDog(overrides: Partial<MatchableDog> = {}): MatchableDog {
  counter += 1;
  return {
    id: `dog-${counter}`,
    size: 'medium',
    energyLevel: 'explorer',
    playStyles: ['chase'],
    trustCircle: [],
    sex: 'female',
    ageMonths: 36,
    ...overrides,
  };
}

/** Reinicia el contador para que los ids sean estables dentro de un test. */
export function resetDogIds(): void {
  counter = 0;
}

export function makeAvailability(overrides: Partial<Availability> = {}): Availability {
  return { weekday: 1, startTime: '07:00', endTime: '08:00', placeId: null, ...overrides };
}

/**
 * Generador determinista para los tests de propiedades.
 *
 * Un LCG y no `Math.random`: un fallo de simetría debe poder reproducirse
 * exactamente, y un test que falla una vez de cada cien ejecuciones no es una
 * red de seguridad, es ruido.
 */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const SIZES: DogSize[] = ['mini', 'small', 'medium', 'large', 'giant'];
const ENERGIES: EnergyLevel[] = ['couch', 'explorer', 'sprinter'];
const STYLES: PlayStyle[] = ['chase', 'wrestle', 'toys', 'calm_walk'];
const TRUST: TrustCircleFlag[] = [
  'loves_everyone',
  'same_size_only',
  'prefers_females',
  'prefers_males',
  'shy_at_first',
  'no_hyper_puppies',
];
const SEXES: DogSex[] = ['male', 'female'];

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)] as T;

const pickSome = <T>(random: () => number, items: readonly T[]): T[] =>
  items.filter(() => random() < 0.35);

export function randomDog(random: () => number, id: string): MatchableDog {
  const styles = pickSome(random, STYLES);
  return {
    id,
    size: pick(random, SIZES),
    energyLevel: pick(random, ENERGIES),
    playStyles: styles.length > 0 ? styles : [pick(random, STYLES)],
    trustCircle: pickSome(random, TRUST),
    sex: pick(random, SEXES),
    ageMonths: Math.floor(random() * 150),
  };
}
