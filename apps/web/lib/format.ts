/**
 * Traducción de valores del dominio a lenguaje humano.
 *
 * Vive en un solo sitio para que "sprinter" se lea igual en la web, y para que
 * añadir un valor al enum obligue a decidir aquí cómo se llama en español en
 * lugar de que se cuele un identificador en bruto en la interfaz.
 */

import { formatCents } from '@coincide/core';

export const SIZE_LABEL: Record<string, string> = {
  mini: 'Mini',
  small: 'Pequeño',
  medium: 'Mediano',
  large: 'Grande',
  giant: 'Gigante',
};

/**
 * Nivel de actividad, traducido al lenguaje de cada especie.
 *
 * El dato guardado es neutro —`low`, `medium`, `high`— para que el algoritmo no
 * necesite saber de qué animal habla. Aquí se le pone el nombre que usaría su
 * tutor: "de sofá" tiene sentido para un perro y ninguno para un gecko.
 */
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

export function energyLabel(level: string | null, speciesId?: string): string {
  if (!level) return '';
  const bySpecies = speciesId ? ENERGY_BY_SPECIES[speciesId] : undefined;
  return bySpecies?.[level] ?? ENERGY_DEFAULT[level] ?? level;
}

/** Compatibilidad con las pantallas que aún no conocen la especie. */
export const ENERGY_LABEL: Record<string, string> = ENERGY_DEFAULT;

export const PLAY_STYLE_LABEL: Record<string, string> = {
  chase: 'Persecución',
  wrestle: 'Lucha',
  toys: 'Juguetes',
  calm_walk: 'Paseo tranquilo',
  grooming: 'Acicalarse',
  side_by_side: 'Estar juntos',
  forage: 'Buscar comida',
};

export const SOCIAL_MODEL_LABEL: Record<string, string> = {
  pack: 'Socializa en grupo',
  small_group: 'Grupo pequeño y supervisado',
  solitary: 'No socializa con otros animales',
};

export const TAXON_LABEL: Record<string, string> = {
  mammal_carnivore: 'Mamífero carnívoro',
  mammal_lagomorph: 'Lagomorfo',
  mammal_rodent: 'Roedor',
  bird: 'Ave',
  reptile: 'Reptil',
  amphibian: 'Anfibio',
  fish: 'Pez',
  invertebrate: 'Invertebrado',
};

export const LEGAL_STATUS_LABEL: Record<string, string> = {
  companion_animal: 'Animal de compañía por ley',
  domestic: 'Especie doméstica',
  positive_list_pending: 'Pendiente del listado positivo',
  restricted: 'Permitida con requisitos',
  excluded: 'No permitida',
};

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

/**
 * Aviso que acompaña a cualquier información legal.
 *
 * Se exporta como constante para que sea difícil mostrar un estado legal sin
 * él: si alguien lo olvida en una pantalla, se nota en la revisión porque el
 * dato viaja sin su advertencia.
 */
export const LEGAL_DISCLAIMER =
  'Coincide no da asesoramiento legal. Esta información es orientativa y puede quedar ' +
  'desactualizada: la lista vigente es siempre la del organismo competente.';

export const KIND_LABEL: Record<string, string> = {
  live_walk: 'Paseando ahora',
  scheduled: 'Quedada programada',
  recurring: 'Paseo recurrente',
  spot_booking: 'Reserva de espacio',
};

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Madrid',
});

const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

/** "martes, 26 de agosto · 07:00–07:45" */
export function formatWhen(start: Date, end: Date): string {
  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`;
}

/** Cuánto falta, en lenguaje llano y sin falsa precisión. */
export function formatRelative(date: Date, now = new Date()): string {
  const minutes = Math.round((date.getTime() - now.getTime()) / 60_000);
  if (minutes < 0) return 'ya ha empezado';
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `en ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'mañana' : `en ${days} días`;
}

export function formatPrice(cents: number, minutes: number): string {
  const hours = minutes / 60;
  const duration = Number.isInteger(hours) ? `${hours} h` : `${minutes} min`;
  return `${formatCents(cents)} / ${duration}`;
}

/**
 * Estado de un atributo con tres valores posibles.
 *
 * Se distingue "no lo tiene" de "no lo sabemos" a propósito: decir que un
 * parque no está vallado cuando en realidad nadie lo ha comprobado es peor que
 * admitir que falta el dato, sobre todo si de ello depende soltar a un perro.
 */
export function triState(value: boolean | null | undefined): 'yes' | 'no' | 'unknown' {
  if (value === null || value === undefined) return 'unknown';
  return value ? 'yes' : 'no';
}

export function triStateLabel(value: boolean | null | undefined, name: string): string {
  const state = triState(value);
  if (state === 'yes') return name;
  if (state === 'no') return `Sin ${name.toLowerCase()}`;
  return `${name}: sin confirmar`;
}
