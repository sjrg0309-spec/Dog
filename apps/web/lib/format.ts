/**
 * Traducción de valores del dominio a lenguaje humano.
 *
 * Vive en un solo sitio para que "sprinter" se lea igual en la web, y para que
 * añadir un valor al enum obligue a decidir aquí cómo se llama en español en
 * lugar de que se cuele un identificador en bruto en la interfaz.
 */

import { formatCents } from '@doggymeet/core';

export const SIZE_LABEL: Record<string, string> = {
  mini: 'Mini',
  small: 'Pequeño',
  medium: 'Mediano',
  large: 'Grande',
  giant: 'Gigante',
};

export const ENERGY_LABEL: Record<string, string> = {
  couch: 'De sofá',
  explorer: 'Explorador',
  sprinter: 'Velocista',
};

export const PLAY_STYLE_LABEL: Record<string, string> = {
  chase: 'Persecución',
  wrestle: 'Lucha libre',
  toys: 'Juguetes',
  calm_walk: 'Caminata tranquila',
};

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
