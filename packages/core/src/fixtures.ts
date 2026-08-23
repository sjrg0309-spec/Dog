/**
 * Constructores de datos para los tests.
 *
 * Viven en `src` y no en un directorio de tests porque la semilla de la base de
 * datos también los usa: así las mascotas de ejemplo de la aplicación y las de
 * las pruebas no pueden divergir.
 */

import type {
  Availability,
  EnergyLevel,
  MatchablePet,
  PetSex,
  PetSize,
  PlayStyle,
  TrustCircleFlag,
} from './types.js';
import { SPECIES } from './species.js';

let counter = 0;

/** Por defecto un perro: es la especie con el modelo social más completo. */
export function makePet(overrides: Partial<MatchablePet> = {}): MatchablePet {
  counter += 1;
  return {
    id: `pet-${counter}`,
    speciesId: 'dog',
    size: 'medium',
    energyLevel: 'medium',
    playStyles: ['chase'],
    trustCircle: [],
    sex: 'female',
    ageMonths: 36,
    ...overrides,
  };
}

/** Reinicia el contador para que los ids sean estables dentro de un test. */
export function resetPetIds(): void {
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

const SIZES: PetSize[] = ['mini', 'small', 'medium', 'large', 'giant'];
const ENERGIES: EnergyLevel[] = ['low', 'medium', 'high'];
const STYLES: PlayStyle[] = [
  'chase',
  'wrestle',
  'toys',
  'calm_walk',
  'grooming',
  'side_by_side',
  'forage',
];
const TRUST: TrustCircleFlag[] = [
  'loves_everyone',
  'same_size_only',
  'prefers_females',
  'prefers_males',
  'shy_at_first',
  'no_hyper_juveniles',
];
const SEXES: PetSex[] = ['male', 'female'];
const SPECIES_IDS = SPECIES.map((species) => species.id);

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)] as T;

const pickSome = <T>(random: () => number, items: readonly T[]): T[] =>
  items.filter(() => random() < 0.35);

/** Mascota aleatoria de cualquier especie del catálogo. */
export function randomPet(random: () => number, id: string): MatchablePet {
  const styles = pickSome(random, STYLES);
  return {
    id,
    speciesId: pick(random, SPECIES_IDS),
    size: pick(random, SIZES),
    energyLevel: pick(random, ENERGIES),
    playStyles: styles.length > 0 ? styles : [pick(random, STYLES)],
    trustCircle: pickSome(random, TRUST),
    sex: pick(random, SEXES),
    ageMonths: Math.floor(random() * 150),
  };
}

/** Mascota aleatoria de una especie concreta, para probar el nivel de puntuación. */
export function randomPetOfSpecies(
  random: () => number,
  id: string,
  speciesId: string,
): MatchablePet {
  return { ...randomPet(random, id), speciesId };
}
