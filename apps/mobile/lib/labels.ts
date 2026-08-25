/**
 * Traducción de valores del dominio a lenguaje humano, en el móvil.
 *
 * Existe por el mismo motivo que su gemelo de la web: el dato que guarda la base
 * es neutro —`low`, `medium`, `high`— para que el algoritmo no necesite saber de
 * qué animal habla, y es aquí donde se le pone el nombre que usaría su tutor.
 * "De sofá" significa algo para un perro y nada para un gecko.
 */

import {
  SOCIAL_MODEL_LABEL as CORE_SOCIAL_MODEL_LABEL,
  findSpecies,
  legalStatusIn,
  type SpeciesProfile,
} from '@petnav/core';

export const SIZE_LABEL: Record<string, string> = {
  mini: 'Mini',
  small: 'Pequeño',
  medium: 'Mediano',
  large: 'Grande',
  giant: 'Gigante',
};

const ENERGY_BY_SPECIES: Record<string, Record<string, string>> = {
  dog: { low: 'De sofá', medium: 'Explorador', high: 'Velocista' },
  cat: { low: 'Tranquilo', medium: 'Curioso', high: 'Incansable' },
  ferret: { low: 'Dormilón', medium: 'Activo', high: 'Terremoto' },
  rabbit: { low: 'Tranquilo', medium: 'Explorador', high: 'Muy activo' },
  guinea_pig: { low: 'Tranquila', medium: 'Activa', high: 'Muy activa' },
  rat: { low: 'Tranquila', medium: 'Curiosa', high: 'Incansable' },
};

const ENERGY_DEFAULT: Record<string, string> = {
  low: 'Actividad baja',
  medium: 'Actividad media',
  high: 'Actividad alta',
};

export function energyLabel(level: string, speciesId?: string): string {
  const bySpecies = speciesId ? ENERGY_BY_SPECIES[speciesId] : undefined;
  return bySpecies?.[level] ?? ENERGY_DEFAULT[level] ?? level;
}

export const PLAY_LABEL: Record<string, string> = {
  chase: 'Persecución',
  wrestle: 'Lucha',
  toys: 'Juguetes',
  calm_walk: 'Paseo tranquilo',
  grooming: 'Acicalarse',
  side_by_side: 'Estar juntos',
  forage: 'Buscar comida',
};

export const SOCIAL_MODEL_LABEL: Record<string, string> = CORE_SOCIAL_MODEL_LABEL;

export const SERVICE_KIND_LABEL: Record<string, string> = {
  vet: 'Veterinario',
  exotic_vet: 'Veterinario de exóticos',
  emergency_vet: 'Urgencias 24 h',
  groomer: 'Peluquería',
  boarding: 'Alojamiento',
  trainer: 'Educador',
  shop: 'Tienda',
  shelter: 'Protectora',
};

/** Nombre común de una especie, o su identificador si no está en el catálogo. */
export function speciesName(speciesId: string): string {
  return findSpecies(speciesId)?.commonName ?? speciesId;
}

export const LEGAL_STATUS_LABEL: Record<string, string> = {
  companion_animal: 'Animal de compañía por ley',
  domestic: 'Especie doméstica',
  positive_list_pending: 'Pendiente del listado positivo',
  restricted: 'Permitida con requisitos',
  excluded: 'No permitida',
};

/**
 * Estado legal de una especie en España, en una línea.
 *
 * Nunca se muestra sin el aviso que lo acompaña: la aplicación no da
 * asesoramiento, repite lo que dice una norma concreta y enlaza a ella.
 */
export function legalSummary(species: SpeciesProfile): string {
  const entry = legalStatusIn(species);
  if (!entry) return 'Sin información legal registrada para España.';
  return `${LEGAL_STATUS_LABEL[entry.status] ?? entry.status}. ${entry.note}`;
}

/** La fuente de la que sale ese estado, para que se pueda comprobar. */
export function legalSource(species: SpeciesProfile): string | null {
  return legalStatusIn(species)?.source ?? null;
}
