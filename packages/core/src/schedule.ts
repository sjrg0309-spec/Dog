/**
 * Coincidencia de horarios de paseo.
 *
 * Es el motor que hace que DoggyMeet funcione a cualquier hora. El radar en
 * vivo solo sirve en hora punta; esto sirve siempre, y no exige que dos
 * personas estén conectadas a la vez. Quien pasea a las once de la noche es
 * justamente quien más lo necesita, así que el cruce de medianoche no es un
 * caso raro: es el caso importante.
 */

import type { Availability } from './types.js';

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;

/**
 * Referencia para normalizar la puntuación: cinco paseos de una hora a la
 * semana ya es una coincidencia excelente, así que ahí está el tope.
 */
export const SCHEDULE_SCORE_REFERENCE_MINUTES = 300;

/** Peso extra del solapamiento que además ocurre en el mismo parque. */
export const SHARED_PLACE_BONUS = 0.5;

export type WeeklyInterval = {
  /** Minuto de la semana, 0 = domingo 00:00. */
  start: number;
  /** Exclusivo. Siempre mayor que `start`. */
  end: number;
  placeId: string | null;
};

export type ScheduleOverlap = {
  totalMinutes: number;
  /** Parte del solapamiento que ocurre además en el mismo parque. */
  sharedPlaceMinutes: number;
  /** Días de la semana con algún solapamiento, 0 = domingo. */
  days: number[];
  /** 0–100, para ordenar el descubrimiento. */
  score: number;
  /** Franja solapada más larga, para poder decir "7:00–7:45". */
  longestWindow: { start: number; end: number; minutes: number } | null;
};

/** `"07:45"` → 465. Lanza si el formato no es válido. */
export function parseTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error(`Hora no válida: ${value} (se espera HH:MM en 24 h)`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 465 → `"07:45"`. Acepta minutos de semana y los reduce al día. */
export function formatTime(weeklyMinute: number): string {
  const minuteOfDay = ((weeklyMinute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Proyecta una franja declarada a intervalos absolutos de la semana.
 *
 * Una franja que cruza medianoche se parte en dos: el resto del día y el
 * arranque del siguiente. Si ese siguiente día es el domingo posterior, envuelve
 * al principio de la semana, porque la semana es circular.
 */
export function toWeeklyIntervals(availability: Availability): WeeklyInterval[] {
  const { weekday, placeId = null } = availability;
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new Error(`Día de la semana no válido: ${weekday}`);
  }

  const start = parseTime(availability.startTime);
  const end = parseTime(availability.endTime);
  const dayStart = weekday * MINUTES_PER_DAY;

  // Igual significa franja vacía, no veinticuatro horas. La ambigüedad se
  // resuelve aquí y no en cada llamador.
  if (end === start) return [];

  if (end > start) {
    return [{ start: dayStart + start, end: dayStart + end, placeId }];
  }

  // Cruce de medianoche: el paseo de las 23:30.
  const firstPart: WeeklyInterval = {
    start: dayStart + start,
    end: dayStart + MINUTES_PER_DAY,
    placeId,
  };
  const nextDayStart = ((weekday + 1) % 7) * MINUTES_PER_DAY;
  const secondPart: WeeklyInterval = { start: nextDayStart, end: nextDayStart + end, placeId };
  return [firstPart, secondPart];
}

export function expandAvailability(entries: readonly Availability[]): WeeklyInterval[] {
  return entries.flatMap(toWeeklyIntervals);
}

/**
 * Calcula el solapamiento semanal entre dos agendas.
 *
 * Coste O(n·m). Las agendas reales tienen unas pocas franjas por perro, así que
 * no compensa complicarlo con un barrido ordenado.
 */
export function scheduleOverlap(
  a: readonly Availability[],
  b: readonly Availability[],
): ScheduleOverlap {
  const intervalsA = expandAvailability(a);
  const intervalsB = expandAvailability(b);

  let totalMinutes = 0;
  let sharedPlaceMinutes = 0;
  const days = new Set<number>();
  let longestWindow: ScheduleOverlap['longestWindow'] = null;

  for (const first of intervalsA) {
    for (const second of intervalsB) {
      const start = Math.max(first.start, second.start);
      const end = Math.min(first.end, second.end);
      const minutes = end - start;
      if (minutes <= 0) continue;

      totalMinutes += minutes;
      if (first.placeId !== null && first.placeId === second.placeId) {
        sharedPlaceMinutes += minutes;
      }

      days.add(Math.floor(start / MINUTES_PER_DAY) % 7);

      if (!longestWindow || minutes > longestWindow.minutes) {
        longestWindow = { start, end, minutes };
      }
    }
  }

  const effective = totalMinutes + SHARED_PLACE_BONUS * sharedPlaceMinutes;
  const score = Math.min(
    100,
    Math.round((effective / SCHEDULE_SCORE_REFERENCE_MINUTES) * 100),
  );

  return {
    totalMinutes,
    sharedPlaceMinutes,
    days: [...days].sort((x, y) => x - y),
    score,
    longestWindow,
  };
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Describe el solapamiento en lenguaje llano.
 *
 * La interfaz nunca enseña la agenda de nadie: enseña la coincidencia. Publicar
 * un calendario navegable equivaldría a publicar la rutina diaria de una
 * persona, así que este resumen es todo lo que se revela.
 */
export function describeOverlap(overlap: ScheduleOverlap): string | null {
  if (overlap.totalMinutes <= 0 || !overlap.longestWindow) return null;

  const { days, longestWindow, sharedPlaceMinutes } = overlap;
  const window = `${formatTime(longestWindow.start)}–${formatTime(longestWindow.end)}`;
  const samePlace = sharedPlaceMinutes > 0 ? ', mismo parque' : '';

  if (days.length === 1) {
    const dayName = DAY_NAMES[days[0] as number];
    return `Coincidís los ${dayName}, ${window}${samePlace}`;
  }
  return `Coincidís ${days.length} días, ${window}${samePlace}`;
}
