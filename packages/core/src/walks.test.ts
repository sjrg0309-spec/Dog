/**
 * El historial de paseos.
 *
 * Lo que se comprueba aquí no es que las funciones «funcionen»: es que las
 * reglas que hacen que el historial sirva de algo sigan diciendo lo que
 * decidimos que dijeran. Tres son las que se romperían solas al tocar el
 * código, y las tres tienen su test con nombre:
 *
 *  · Un patrón se mide en **semanas seguidas**, no en paseos.
 *  · Un 👎 se guarda **por pareja**, no por salida.
 *  · Un 👎 **impide** proponer el paseo fijo, aunque el patrón esté ahí.
 */

import { describe, expect, it } from 'vitest';

import {
  OVERRUN_GRACE_MINUTES,
  RECURRING_MIN_WEEKS,
  companionTally,
  describeRecurring,
  pairHistoryFrom,
  recurringCandidates,
  summarizeWalk,
  walkMinutes,
  walkTotals,
  weekdayName,
  weeklyRhythm,
  type WalkCompanion,
  type WalkRecord,
} from './walks.js';

/**
 * Un paseo de mentira, con horas locales.
 *
 * Se construyen con `new Date(año, mes, día, hora, minuto)` —constructor
 * local— y no con cadenas `Z`, porque todo lo que mide este módulo (el día de
 * la semana, el día natural, la hora de salida) es local. Escribir los
 * fixtures en UTC probaría otra cosa distinta de la que usa la aplicación.
 */
function walk(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  minutes: number,
  overrides: Partial<WalkRecord> = {},
): WalkRecord {
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + minutes * 60_000);

  return {
    id: `${year}-${month}-${day}-${hour}${minute}`,
    petId: 'nina',
    placeId: 'central',
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    recommendedMinutes: 60,
    welfareLevel: 'ok',
    temperatureC: 18,
    surface: 'grass',
    companions: [],
    ...overrides,
  };
}

const met = (...ids: string[]): WalkCompanion[] =>
  ids.map((petId) => ({ petId, outcome: 'good' as const }));

describe('duración', () => {
  it('mide en minutos de reloj', () => {
    expect(walkMinutes(walk(2026, 3, 10, 7, 0, 45))).toBe(45);
  });

  it('cruza la medianoche sin ningún caso especial', () => {
    /* El paseo de las once y media, que es justo el usuario que este producto
       dice atender. Como los extremos son instantes y no horas de pared, no
       hace falta la aritmética que sí necesita un horario semanal. */
    const late = walk(2026, 3, 10, 23, 30, 45);
    expect(walkMinutes(late)).toBe(45);
    expect(new Date(late.endedAt).getDate()).toBe(11);
  });

  it('un final anterior al comienzo vale cero y no un número negativo', () => {
    const broken = walk(2026, 3, 10, 7, 0, 45);
    expect(walkMinutes({ ...broken, endedAt: broken.startedAt, startedAt: broken.endedAt })).toBe(0);
  });

  it('una fecha ilegible vale cero en vez de contaminar la suma', () => {
    expect(walkMinutes({ ...walk(2026, 3, 10, 7, 0, 45), startedAt: 'el martes' })).toBe(0);
  });
});

describe('resumen de un paseo', () => {
  it('no marca exceso mientras se esté dentro del margen', () => {
    const summary = summarizeWalk(walk(2026, 3, 10, 7, 0, 60 + OVERRUN_GRACE_MINUTES));
    expect(summary.overrunMinutes).toBe(0);
  });

  it('al pasarse cuenta los minutos enteros, no los que sobran del margen', () => {
    /* Setenta y cinco minutos sobre sesenta propuestos son quince de más, no
       diez: el margen decide **si** se avisa, no cuánto se dice que fue. */
    const summary = summarizeWalk(walk(2026, 3, 10, 7, 0, 75));
    expect(summary.overrunMinutes).toBe(15);
  });

  it('separa lo que falta por contestar de lo que fue mal', () => {
    const summary = summarizeWalk(
      walk(2026, 3, 10, 7, 0, 60, {
        companions: [
          { petId: 'rocky', outcome: 'good' },
          { petId: 'lola', outcome: null },
          { petId: 'toby', outcome: 'bad' },
        ],
      }),
    );

    expect(summary.companionCount).toBe(3);
    expect(summary.pendingOutcomes).toBe(1);
    expect(summary.negativeOutcomes).toBe(1);
  });

  it('guarda el veredicto de cuando se salió, no el de ahora', () => {
    /* Releer el pasado con la temperatura de hoy haría que el historial dejara
       de servir para lo único que sirve: comparar lo propuesto con lo hecho. */
    const hot = walk(2026, 7, 15, 13, 0, 30, {
      recommendedMinutes: 20,
      welfareLevel: 'caution',
      temperatureC: 31,
      surface: 'asphalt',
    });
    const summary = summarizeWalk(hot);
    expect(summary.recommendedMinutes).toBe(20);
    expect(hot.welfareLevel).toBe('caution');
    expect(summary.overrunMinutes).toBe(10);
  });
});

describe('ritmo semanal', () => {
  it('devuelve los siete días aunque falten cinco', () => {
    const rhythm = weeklyRhythm([walk(2026, 3, 10, 7, 0, 45)]);
    expect(rhythm).toHaveLength(7);
    expect(rhythm.map((day) => day.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('suma los minutos en el día que toca', () => {
    // 10 de marzo de 2026 es martes; el 12, jueves.
    const rhythm = weeklyRhythm([
      walk(2026, 3, 10, 7, 0, 45),
      walk(2026, 3, 17, 7, 0, 30),
      walk(2026, 3, 12, 20, 0, 60),
    ]);

    expect(rhythm[2]).toEqual({ weekday: 2, walks: 2, minutes: 75 });
    expect(rhythm[4]).toEqual({ weekday: 4, walks: 1, minutes: 60 });
    expect(rhythm[0]).toEqual({ weekday: 0, walks: 0, minutes: 0 });
  });

  it('el paseo de las 23:30 cuenta en su día y no en el siguiente', () => {
    /* Si el día saliera de dividir el instante entre 86 400 000, en Madrid en
       verano este martes se contaría como miércoles. */
    const rhythm = weeklyRhythm([walk(2026, 7, 14, 23, 30, 40)]);
    expect(rhythm[2]?.walks).toBe(1);
    expect(rhythm[3]?.walks).toBe(0);
  });
});

describe('con quién se sale', () => {
  it('cuenta semanas distintas además de paseos', () => {
    /* Cinco paseos pueden ser cinco semanas o una tarde de sábado. Solo lo
       primero es una costumbre, y son preguntas distintas. */
    const tally = companionTally([
      walk(2026, 3, 7, 10, 0, 40, { companions: met('rocky') }),
      walk(2026, 3, 7, 18, 0, 40, { companions: met('rocky') }),
      walk(2026, 3, 14, 10, 0, 40, { companions: met('rocky') }),
    ]);

    expect(tally[0]?.walks).toBe(3);
    expect(tally[0]?.weeks).toBe(2);
  });

  it('ordena por número de paseos', () => {
    const tally = companionTally([
      walk(2026, 3, 3, 7, 0, 45, { companions: met('rocky', 'lola') }),
      walk(2026, 3, 10, 7, 0, 45, { companions: met('rocky') }),
    ]);

    expect(tally.map((entry) => entry.petId)).toEqual(['rocky', 'lola']);
  });

  it('un 👎 se guarda en la pareja que lo tuvo y no en las demás', () => {
    /* Es la regla que hace que el historial no ensucie a quien no hizo nada.
       Con una nota global del paseo, Lola y Toby heredarían el problema de
       Rocky y la aplicación dejaría de proponerlos a los tres. */
    const tally = companionTally([
      walk(2026, 3, 10, 7, 0, 45, {
        companions: [
          { petId: 'rocky', outcome: 'bad' },
          { petId: 'lola', outcome: 'good' },
          { petId: 'toby', outcome: null },
        ],
      }),
    ]);

    const negatives = Object.fromEntries(tally.map((entry) => [entry.petId, entry.negatives]));
    expect(negatives).toEqual({ rocky: 1, lola: 0, toby: 0 });
  });
});

describe('lo que el algoritmo lee del historial', () => {
  it('traduce el 👎 a lo que descuenta la afinidad', () => {
    const history = pairHistoryFrom([
      walk(2026, 3, 10, 7, 0, 45, {
        companions: [
          { petId: 'rocky', outcome: 'bad' },
          { petId: 'lola', outcome: 'good' },
        ],
      }),
    ]);

    expect(history.get('rocky')).toEqual({ hadNegativeFeedback: true });
    expect(history.get('lola')).toEqual({ hadNegativeFeedback: false });
  });

  it('un 👎 sigue pesando aunque después vengan diez 👍', () => {
    /* Asimetría deliberada. Que diez paseos fueran bien no demuestra que el
       que fue mal no vaya a repetirse, y equivocarse hacia el otro lado lleva
       a dos perros que ya se llevaron mal a un sitio sin correa. */
    const walks = [
      walk(2026, 1, 6, 7, 0, 45, { companions: [{ petId: 'rocky', outcome: 'bad' }] }),
      ...Array.from({ length: 10 }, (_, index) =>
        walk(2026, 2, 3 + index, 7, 0, 45, { companions: met('rocky') }),
      ),
    ];

    expect(pairHistoryFrom(walks).get('rocky')?.hadNegativeFeedback).toBe(true);
  });

  it('quien no aparece en ningún paseo no tiene historial, y eso no es un 👍', () => {
    expect(pairHistoryFrom([]).get('rocky')).toBeUndefined();
  });
});

describe('proponer el paseo fijo', () => {
  const tuesdays = (count: number, companions = met('rocky')) =>
    Array.from({ length: count }, (_, index) =>
      walk(2026, 3, 3 + index * 7, 19, 0, 45, { companions }),
    );

  it('tres martes seguidos sí son un patrón', () => {
    const [candidate] = recurringCandidates(tuesdays(RECURRING_MIN_WEEKS));

    expect(candidate).toBeDefined();
    expect(candidate?.petId).toBe('rocky');
    expect(candidate?.weekday).toBe(2);
    expect(candidate?.weeks).toBe(3);
    expect(describeRecurring(candidate!)).toBe('los martes a las 19:00');
  });

  it('dos no bastan', () => {
    expect(recurringCandidates(tuesdays(2))).toEqual([]);
  });

  it('tres paseos en la misma semana no son un patrón', () => {
    /* El fallo más fácil de cometer: contar filas en vez de semanas. Un sábado
       con tres entradas dispararía «coincidís los sábados» a partir de una
       tarde. */
    /* Las tres dentro de la misma ventana horaria a propósito: separadas, la
       propia ventana las partiría en grupos y el test pasaría sin llegar a
       comprobar que se cuentan semanas. Un test que pasa por el motivo
       equivocado afirma que algo está protegido sin haberlo comprobado. */
    const sameWeek = [
      walk(2026, 3, 7, 10, 0, 40, { companions: met('rocky') }),
      walk(2026, 3, 7, 10, 20, 40, { companions: met('rocky') }),
      walk(2026, 3, 7, 10, 40, 40, { companions: met('rocky') }),
    ];

    expect(recurringCandidates(sameWeek)).toEqual([]);
  });

  it('tres martes sueltos a lo largo del año tampoco', () => {
    const scattered = [
      walk(2026, 1, 6, 19, 0, 45, { companions: met('rocky') }),
      walk(2026, 3, 10, 19, 0, 45, { companions: met('rocky') }),
      walk(2026, 6, 9, 19, 0, 45, { companions: met('rocky') }),
    ];

    expect(recurringCandidates(scattered)).toEqual([]);
  });

  it('el mismo día a horas incompatibles son dos costumbres, no una', () => {
    const split = [
      ...Array.from({ length: 3 }, (_, index) =>
        walk(2026, 3, 3 + index * 7, 7, 0, 45, { companions: met('rocky') }),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        walk(2026, 3, 3 + index * 7, 20, 0, 45, { companions: met('rocky') }),
      ),
    ];

    const candidates = recurringCandidates(split);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.startMinute).toBe(7 * 60);
  });

  it('media hora de diferencia sigue siendo la misma hora', () => {
    const drifting = [
      walk(2026, 3, 3, 19, 0, 45, { companions: met('rocky') }),
      walk(2026, 3, 10, 19, 30, 45, { companions: met('rocky') }),
      walk(2026, 3, 17, 19, 15, 45, { companions: met('rocky') }),
    ];

    const [candidate] = recurringCandidates(drifting);
    expect(candidate?.weeks).toBe(3);
    expect(candidate?.startMinute).toBe(19 * 60 + 15);
  });

  it('un solo 👎 cancela la propuesta aunque el patrón esté completo', () => {
    /* La regla que más importa de este módulo. Contar detecta el patrón
       igual de bien cuando la costumbre es mala, y proponer un paseo fijo con
       un perro que el tutor marcó como mal encuentro es la aplicación
       insistiendo en lo único que le dijeron que no. */
    const withOneBad = [
      ...tuesdays(2),
      walk(2026, 3, 17, 19, 0, 45, { companions: [{ petId: 'rocky', outcome: 'bad' }] }),
      ...Array.from({ length: 3 }, (_, index) =>
        walk(2026, 3, 24 + index * 7, 19, 0, 45, { companions: met('rocky') }),
      ),
    ];

    expect(recurringCandidates(withOneBad)).toEqual([]);
  });

  it('lo que falta por contestar no cancela nada', () => {
    /* `null` es «no ha contestado», no «regular». Tratarlo como un 👎 haría
       desaparecer las propuestas de quien no responde encuestas. */
    const unanswered = Array.from({ length: 3 }, (_, index) =>
      walk(2026, 3, 3 + index * 7, 19, 0, 45, {
        companions: [{ petId: 'rocky', outcome: null }],
      }),
    );

    expect(recurringCandidates(unanswered)).toHaveLength(1);
  });

  it('se queda con el sitio más repetido', () => {
    const mostly = [
      walk(2026, 3, 3, 19, 0, 45, { companions: met('rocky'), placeId: 'central' }),
      walk(2026, 3, 10, 19, 0, 45, { companions: met('rocky'), placeId: 'retiro' }),
      walk(2026, 3, 17, 19, 0, 45, { companions: met('rocky'), placeId: 'central' }),
    ];

    expect(recurringCandidates(mostly)[0]?.placeId).toBe('central');
  });

  it('salir por la calle es un sitio válido: null, no un parque inventado', () => {
    const street = Array.from({ length: 3 }, (_, index) =>
      walk(2026, 3, 3 + index * 7, 6, 0, 45, { companions: met('rocky'), placeId: null }),
    );

    expect(recurringCandidates(street)[0]?.placeId).toBeNull();
  });

  it('cada perro tiene su propio patrón', () => {
    const both = Array.from({ length: 3 }, (_, index) =>
      walk(2026, 3, 3 + index * 7, 19, 0, 45, { companions: met('rocky', 'lola') }),
    );

    expect(recurringCandidates(both).map((candidate) => candidate.petId).sort()).toEqual([
      'lola',
      'rocky',
    ]);
  });
});

describe('totales', () => {
  const history = [
    walk(2026, 3, 3, 7, 0, 45, { companions: met('rocky') }),
    walk(2026, 3, 3, 20, 0, 30, { companions: met('lola') }),
    walk(2026, 3, 10, 7, 0, 75, { companions: met('rocky') }),
  ];

  it('cuenta días naturales y no paseos', () => {
    const totals = walkTotals(history);
    expect(totals.walks).toBe(3);
    expect(totals.days).toBe(2);
  });

  it('suma los minutos y cuenta los que se pasaron', () => {
    const totals = walkTotals(history);
    expect(totals.minutes).toBe(150);
    expect(totals.overruns).toBe(1);
  });

  it('cuenta perros distintos, no apariciones', () => {
    expect(walkTotals(history).companions).toBe(2);
  });

  it('recorta contra un ahora que se le pasa, no contra el reloj del sistema', () => {
    /* Un test de fechas que dependa de `new Date()` falla un martes por la
       noche y no el resto de la semana, que es la peor forma de fallar. */
    const now = new Date(2026, 2, 12, 9, 0);
    expect(walkTotals(history, { sinceDays: 7, now }).walks).toBe(1);
    expect(walkTotals(history, { sinceDays: 30, now }).walks).toBe(3);
  });

  it('un historial vacío da ceros y no se rompe', () => {
    expect(walkTotals([])).toEqual({ walks: 0, minutes: 0, days: 0, overruns: 0, companions: 0 });
    expect(companionTally([])).toEqual([]);
    expect(recurringCandidates([])).toEqual([]);
  });
});

describe('nombres', () => {
  it('nombra los días en plural, que es como se nombra una costumbre', () => {
    expect(weekdayName(0)).toBe('domingo');
    expect(weekdayName(2)).toBe('martes');
    expect(weekdayName(6)).toBe('sábado');
  });
});
