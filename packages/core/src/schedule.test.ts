import { describe, expect, it } from 'vitest';

import { makeAvailability } from './fixtures.js';
import {
  MINUTES_PER_DAY,
  SCHEDULE_SCORE_REFERENCE_MINUTES,
  describeOverlap,
  formatTime,
  parseTime,
  scheduleOverlap,
  toWeeklyIntervals,
} from './schedule.js';

describe('parseo y formato de horas', () => {
  it('convierte HH:MM a minutos y de vuelta', () => {
    expect(parseTime('00:00')).toBe(0);
    expect(parseTime('07:45')).toBe(465);
    expect(parseTime('23:59')).toBe(1439);
    expect(formatTime(465)).toBe('07:45');
    expect(formatTime(0)).toBe('00:00');
  });

  it('reduce minutos de semana al día correspondiente', () => {
    // Martes 07:00 = 2 * 1440 + 420.
    expect(formatTime(2 * MINUTES_PER_DAY + 420)).toBe('07:00');
  });

  it('rechaza formatos inválidos en lugar de adivinar', () => {
    expect(() => parseTime('7:00')).toThrow();
    expect(() => parseTime('24:00')).toThrow();
    expect(() => parseTime('12:60')).toThrow();
    expect(() => parseTime('mañana')).toThrow();
  });
});

describe('proyección a intervalos de la semana', () => {
  it('una franja normal produce un solo intervalo', () => {
    const intervals = toWeeklyIntervals(makeAvailability({ weekday: 1 }));
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({ start: MINUTES_PER_DAY + 420, end: MINUTES_PER_DAY + 480 });
  });

  it('una franja que cruza medianoche se parte en dos días', () => {
    // El paseo de las 23:30, que es justo el caso que la app tiene que servir.
    const intervals = toWeeklyIntervals(
      makeAvailability({ weekday: 1, startTime: '23:30', endTime: '00:30' }),
    );

    expect(intervals).toHaveLength(2);
    expect(intervals[0]).toMatchObject({ start: MINUTES_PER_DAY + 1410, end: 2 * MINUTES_PER_DAY });
    expect(intervals[1]).toMatchObject({ start: 2 * MINUTES_PER_DAY, end: 2 * MINUTES_PER_DAY + 30 });
  });

  it('el sábado por la noche envuelve al domingo, porque la semana es circular', () => {
    const intervals = toWeeklyIntervals(
      makeAvailability({ weekday: 6, startTime: '23:00', endTime: '01:00' }),
    );

    expect(intervals[0]).toMatchObject({ start: 6 * MINUTES_PER_DAY + 1380, end: 7 * MINUTES_PER_DAY });
    // Domingo, no "día 7".
    expect(intervals[1]).toMatchObject({ start: 0, end: 60 });
  });

  it('una franja de duración cero no produce intervalos', () => {
    expect(toWeeklyIntervals(makeAvailability({ startTime: '07:00', endTime: '07:00' }))).toEqual([]);
  });

  it('rechaza días de la semana fuera de rango', () => {
    expect(() => toWeeklyIntervals(makeAvailability({ weekday: 7 }))).toThrow();
    expect(() => toWeeklyIntervals(makeAvailability({ weekday: -1 }))).toThrow();
  });
});

describe('solapamiento entre agendas', () => {
  it('calcula los minutos compartidos', () => {
    const a = [makeAvailability({ weekday: 1, startTime: '07:00', endTime: '08:00' })];
    const b = [makeAvailability({ weekday: 1, startTime: '07:30', endTime: '09:00' })];

    const overlap = scheduleOverlap(a, b);
    expect(overlap.totalMinutes).toBe(30);
    expect(overlap.days).toEqual([1]);
  });

  it('dos franjas que solo se tocan no solapan', () => {
    const a = [makeAvailability({ startTime: '07:00', endTime: '08:00' })];
    const b = [makeAvailability({ startTime: '08:00', endTime: '09:00' })];

    expect(scheduleOverlap(a, b).totalMinutes).toBe(0);
  });

  it('días distintos no solapan', () => {
    const a = [makeAvailability({ weekday: 1 })];
    const b = [makeAvailability({ weekday: 2 })];

    expect(scheduleOverlap(a, b).totalMinutes).toBe(0);
  });

  it('encuentra la coincidencia de dos paseos nocturnos que cruzan medianoche', () => {
    // Dos personas que sacan al animal pasada la medianoche son las que más
    // necesitan esta función y las que un cálculo ingenuo dejaría fuera.
    const a = [makeAvailability({ weekday: 3, startTime: '23:30', endTime: '00:30' })];
    const b = [makeAvailability({ weekday: 3, startTime: '23:45', endTime: '00:15' })];

    const overlap = scheduleOverlap(a, b);
    expect(overlap.totalMinutes).toBe(30);
  });

  it('cruza correctamente una franja nocturna con otra de madrugada del día siguiente', () => {
    const nightOwl = [makeAvailability({ weekday: 1, startTime: '23:00', endTime: '01:00' })];
    const earlyBird = [makeAvailability({ weekday: 2, startTime: '00:30', endTime: '06:00' })];

    // Lunes 23:00–01:00 llega hasta el martes 01:00; el martes empieza a las 00:30.
    expect(scheduleOverlap(nightOwl, earlyBird).totalMinutes).toBe(30);
  });

  it('acumula varios días', () => {
    const weekdays = [1, 2, 3, 4, 5].map((weekday) =>
      makeAvailability({ weekday, startTime: '07:00', endTime: '07:45' }),
    );

    const overlap = scheduleOverlap(weekdays, weekdays);
    expect(overlap.totalMinutes).toBe(5 * 45);
    expect(overlap.days).toEqual([1, 2, 3, 4, 5]);
  });

  it('el mismo parque cuenta aparte y sube la puntuación', () => {
    const a = [makeAvailability({ placeId: 'parque-central' })];
    const sharedPlace = [makeAvailability({ placeId: 'parque-central' })];
    const otherPlace = [makeAvailability({ placeId: 'parque-del-rio' })];

    const shared = scheduleOverlap(a, sharedPlace);
    const separate = scheduleOverlap(a, otherPlace);

    expect(shared.totalMinutes).toBe(separate.totalMinutes);
    expect(shared.sharedPlaceMinutes).toBe(60);
    expect(separate.sharedPlaceMinutes).toBe(0);
    expect(shared.score).toBeGreaterThan(separate.score);
  });

  it('dos franjas sin parque declarado no cuentan como el mismo parque', () => {
    const a = [makeAvailability({ placeId: null })];
    const b = [makeAvailability({ placeId: null })];

    expect(scheduleOverlap(a, b).sharedPlaceMinutes).toBe(0);
  });

  it('la puntuación se satura en 100', () => {
    const heavy = [0, 1, 2, 3, 4, 5, 6].map((weekday) =>
      makeAvailability({ weekday, startTime: '06:00', endTime: '12:00' }),
    );

    const overlap = scheduleOverlap(heavy, heavy);
    expect(overlap.totalMinutes).toBeGreaterThan(SCHEDULE_SCORE_REFERENCE_MINUTES);
    expect(overlap.score).toBe(100);
  });

  it('es simétrico', () => {
    const a = [
      makeAvailability({ weekday: 1, startTime: '07:00', endTime: '08:00', placeId: 'p1' }),
      makeAvailability({ weekday: 5, startTime: '22:00', endTime: '01:00' }),
    ];
    const b = [
      makeAvailability({ weekday: 1, startTime: '07:30', endTime: '09:00', placeId: 'p1' }),
      makeAvailability({ weekday: 5, startTime: '23:00', endTime: '00:30' }),
    ];

    expect(scheduleOverlap(a, b)).toEqual(scheduleOverlap(b, a));
  });
});

describe('descripción en lenguaje llano', () => {
  it('describe un solo día con su nombre', () => {
    const a = [makeAvailability({ weekday: 2, startTime: '07:00', endTime: '07:45' })];
    expect(describeOverlap(scheduleOverlap(a, a))).toBe('Coincidís los martes, 07:00–07:45');
  });

  it('cuenta los días cuando hay varios y señala el parque compartido', () => {
    const week = [1, 2, 3, 4, 5].map((weekday) =>
      makeAvailability({ weekday, startTime: '07:00', endTime: '07:45', placeId: 'central' }),
    );

    expect(describeOverlap(scheduleOverlap(week, week))).toBe(
      'Coincidís 5 días, 07:00–07:45, mismo parque',
    );
  });

  it('no describe nada cuando no hay coincidencia', () => {
    const a = [makeAvailability({ weekday: 1 })];
    const b = [makeAvailability({ weekday: 4 })];

    expect(describeOverlap(scheduleOverlap(a, b))).toBeNull();
  });

  it('describe la franja nocturna con las horas reales del día, no del cómputo semanal', () => {
    const a = [makeAvailability({ weekday: 6, startTime: '23:00', endTime: '01:00' })];
    const summary = describeOverlap(scheduleOverlap(a, a));

    expect(summary).toContain('23:00');
  });
});
