/**
 * Los paseos que ya ocurrieron: el resumen de uno y el historial de todos.
 *
 * El resto del producto mira hacia delante —con quién coincides, quién está
 * fuera ahora, dónde quedar—. Esto mira hacia atrás, y sirve para tres cosas
 * concretas que no se pueden hacer sin recordar:
 *
 *  1. **Cerrar el paseo.** Un check-in que se apaga sin más deja al tutor sin
 *     saber qué pasó y a la aplicación sin saber si fue bien. El resumen
 *     pregunta una sola cosa —qué tal con cada perro— y esa respuesta entra en
 *     el algoritmo como `PairHistory`, así que **cambia a quién se propone
 *     mañana**. Sin eso, el 👍/👎 sería un adorno.
 *  2. **Ver el ritmo de verdad.** El horario declarado en el registro es una
 *     intención; el historial es lo que pasó. Cuando no coinciden, manda el
 *     segundo.
 *  3. **Proponer el paseo fijo.** «Coincidís los martes a las siete, ¿lo
 *     hacéis fijo?» solo se puede decir si alguien contó los martes.
 *
 * ## Tres cosas que este módulo NO hace, y son decisiones
 *
 * **No hay distancia ni recorrido.** La tentación es obvia —cualquier
 * aplicación de paseos enseña «3,2 km» y un trazado sobre el mapa— y aquí
 * sería inventárselo: lo que la aplicación registra es un check-in con su hora
 * de entrada y de salida, no una traza de GPS. Un kilometraje derivado de eso
 * sería un número con pinta de dato y sin nada detrás. Y aunque se registrara,
 * chocaría de frente con la regla que gobierna la privacidad de este producto:
 * **el radar ancla al lugar y nunca a la persona**, no hay punto azul siguiendo
 * a nadie, y un recorrido guardado es exactamente el rastro que esa regla
 * existe para no tener. Así que se cuenta el tiempo y el sitio, que es lo que
 * de verdad se sabe.
 *
 * **No hay rachas, ni medallas, ni «llevas 12 días seguidos».** Es lo más
 * fácil de añadir y lo que peor encaja: premiar la constancia empuja a sacar al
 * perro un día que no le conviene para no romper el número, y este producto
 * tiene una capa entera dedicada a decir «hoy no». Un contador de rachas y un
 * veto de calor son dos partes de la misma aplicación diciéndose que no.
 *
 * **No hay nota media del paseo.** El 👍/👎 va **por pareja**, no por salida.
 * Si en un paseo hubo tres perros y uno fue un problema, una valoración global
 * ensuciaría los tres pares y la aplicación dejaría de proponer a dos perros
 * que no hicieron nada. La afinidad se calcula par a par, así que el historial
 * también tiene que guardarse par a par.
 */

import { formatTime } from './schedule.js';
import type { PairHistory } from './types.js';
import type { Surface, WelfareLevel } from './welfare.js';

/** Lo que el tutor contesta sobre **una pareja concreta** del paseo. */
export type WalkOutcome = 'good' | 'bad';

export type WalkCompanion = {
  petId: string;
  /** `null` = todavía no ha contestado. No es lo mismo que «regular». */
  outcome: WalkOutcome | null;
};

/**
 * Un paseo que ocurrió.
 *
 * Las horas van en instantes ISO y no en hora de pared, al revés que
 * `Availability`. La diferencia es deliberada y evita el caso que rompe a
 * medio mundo: un paseo de 23:30 a 00:15 **cruza la medianoche**, y como
 * instante eso son cuarenta y cinco minutos sin ningún caso especial. Un
 * horario semanal sí necesita esa aritmética —por eso `toWeeklyIntervals` la
 * tiene— porque describe todos los martes y no un martes.
 */
export type WalkRecord = {
  id: string;
  /** El animal que salió. Un tutor con dos perros tiene dos historiales. */
  petId: string;
  /** El área pet-friendly donde estuvo el check-in, o `null` si fue por la calle. */
  placeId: string | null;
  startedAt: string;
  endedAt: string;
  /**
   * Lo que la capa de bienestar propuso **al salir**, no lo que se sabe ahora.
   *
   * Se guarda con el paseo a propósito: releer el veredicto con la temperatura
   * de hoy cambiaría el pasado, y entonces el historial dejaría de servir para
   * lo único para lo que sirve, que es comparar lo que se propuso con lo que
   * se hizo.
   */
  recommendedMinutes: number;
  welfareLevel: WelfareLevel;
  /** `null` cuando se salió sin saber qué tiempo hacía. Nunca cero por defecto. */
  temperatureC: number | null;
  surface: Surface;
  companions: readonly WalkCompanion[];
};

/**
 * Margen antes de decir que un paseo se pasó del rato propuesto.
 *
 * Cinco minutos, porque nadie apaga un check-in en el segundo exacto y porque
 * el aviso tiene que significar algo: si salta con dos minutos de más, se
 * aprende a ignorarlo y entonces no salta cuando son cuarenta.
 */
export const OVERRUN_GRACE_MINUTES = 5;

/** Semanas seguidas que hacen de una coincidencia un patrón. */
export const RECURRING_MIN_WEEKS = 3;

/**
 * Cuánto pueden separarse dos salidas y seguir siendo «la misma hora».
 *
 * Tres cuartos de hora: quien sale a las 19:00 un martes y a las 19:30 el
 * siguiente sigue teniendo el paseo de después del trabajo. Quien sale a las
 * 07:00 y a las 20:00 los martes no tiene un patrón, tiene dos.
 */
export const RECURRING_WINDOW_MINUTES = 45;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const DAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

/** «los martes». En plural, porque nombra la costumbre y no una fecha. */
export function weekdayName(weekday: number): string {
  return DAY_NAMES[((weekday % 7) + 7) % 7] ?? '';
}

/**
 * Cuánto duró, en minutos.
 *
 * Se redondea al minuto y **no se admite negativo**: un final anterior al
 * comienzo es un dato roto, y devolver un número negativo lo colaría en las
 * sumas como si fuera un paseo que resta tiempo. Cero es lo que de verdad
 * sabemos de un registro así.
 */
export function walkMinutes(walk: WalkRecord): number {
  const start = Date.parse(walk.startedAt);
  const end = Date.parse(walk.endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / MS_PER_MINUTE));
}

/**
 * El día natural del paseo, como número de días desde 1970.
 *
 * Se construye desde el **calendario local** —año, mes, día— y no dividiendo
 * el instante entre 86 400 000. Suena a lo mismo y no lo es: con la división,
 * un paseo de las 23:30 en Madrid en verano cae en el día siguiente, porque el
 * instante ya está en UTC. Quien pasea a las once y media de la noche es
 * exactamente el usuario que este producto dice atender, así que ese caso no
 * puede salir mal.
 */
function localDayIndex(iso: string): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return Number.NaN;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

/**
 * En qué semana cae, con las semanas empezando en lunes.
 *
 * El 1 de enero de 1970 fue jueves, así que el día 0 es un jueves y hay que
 * correrlo tres días para que la división caiga en lunes.
 */
function weekIndex(iso: string): number {
  return Math.floor((localDayIndex(iso) + 3) / 7);
}

/** Minuto del día en el que empezó, en hora local. */
function startMinuteOfDay(walk: WalkRecord): number {
  const date = new Date(walk.startedAt);
  return date.getHours() * 60 + date.getMinutes();
}

export type WalkSummary = {
  minutes: number;
  recommendedMinutes: number;
  /**
   * Minutos por encima de lo propuesto, con el margen ya descontado.
   *
   * Cero cuando no se pasó. No es un reproche y la interfaz no lo presenta
   * como tal: es el único número del resumen que habla del animal y no del
   * plan de su tutor.
   */
  overrunMinutes: number;
  companionCount: number;
  /** Parejas que todavía esperan un 👍/👎. */
  pendingOutcomes: number;
  /** Parejas marcadas con 👎. Son las que cambian el algoritmo. */
  negativeOutcomes: number;
};

export function summarizeWalk(walk: WalkRecord): WalkSummary {
  const minutes = walkMinutes(walk);
  const over = minutes - walk.recommendedMinutes - OVERRUN_GRACE_MINUTES;

  return {
    minutes,
    recommendedMinutes: walk.recommendedMinutes,
    overrunMinutes: over > 0 ? minutes - walk.recommendedMinutes : 0,
    companionCount: walk.companions.length,
    pendingOutcomes: walk.companions.filter((companion) => companion.outcome === null).length,
    negativeOutcomes: walk.companions.filter((companion) => companion.outcome === 'bad').length,
  };
}

export type RhythmDay = {
  /** 0 = domingo … 6 = sábado, igual que `Availability` y `Date#getDay`. */
  weekday: number;
  walks: number;
  minutes: number;
};

/**
 * Cuánto se sale cada día de la semana.
 *
 * Devuelve siempre los siete días, incluidos los que están a cero: un día que
 * falta de la lista se dibuja como si no existiera, y el hueco del jueves es
 * justo lo que hace legible el resto.
 */
export function weeklyRhythm(walks: readonly WalkRecord[]): RhythmDay[] {
  const days: RhythmDay[] = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    walks: 0,
    minutes: 0,
  }));

  for (const walk of walks) {
    const date = new Date(walk.startedAt);
    if (Number.isNaN(date.getTime())) continue;
    const day = days[date.getDay()];
    if (!day) continue;
    day.walks += 1;
    day.minutes += walkMinutes(walk);
  }

  return days;
}

export type CompanionTally = {
  petId: string;
  walks: number;
  /** Semanas distintas en las que os habéis visto. Dos paseos el mismo martes son una. */
  weeks: number;
  minutes: number;
  /** El más reciente, en ISO. */
  lastAt: string;
  negatives: number;
};

/**
 * Con quién se sale, ordenado por cuántas veces.
 *
 * Cuenta **semanas distintas** además de paseos porque son preguntas
 * diferentes: cinco paseos pueden ser cinco semanas o una tarde de sábado con
 * cinco entradas, y solo la primera es una costumbre.
 */
export function companionTally(walks: readonly WalkRecord[]): CompanionTally[] {
  const tally = new Map<string, CompanionTally & { weekSet: Set<number> }>();

  for (const walk of walks) {
    const minutes = walkMinutes(walk);
    const week = weekIndex(walk.startedAt);

    for (const companion of walk.companions) {
      const current = tally.get(companion.petId) ?? {
        petId: companion.petId,
        walks: 0,
        weeks: 0,
        minutes: 0,
        lastAt: walk.startedAt,
        negatives: 0,
        weekSet: new Set<number>(),
      };

      current.walks += 1;
      current.minutes += minutes;
      current.weekSet.add(week);
      if (companion.outcome === 'bad') current.negatives += 1;
      if (Date.parse(walk.startedAt) > Date.parse(current.lastAt)) current.lastAt = walk.startedAt;

      tally.set(companion.petId, current);
    }
  }

  return [...tally.values()]
    .map(({ weekSet, ...rest }) => ({ ...rest, weeks: weekSet.size }))
    .sort((a, b) => b.walks - a.walks || Date.parse(b.lastAt) - Date.parse(a.lastAt));
}

/**
 * El historial, traducido a lo que el algoritmo sabe leer.
 *
 * Esta función es la que convierte el resumen en algo más que una pantalla:
 * `calculateAffinity` descuenta quince puntos con `hadNegativeFeedback`, así
 * que un 👎 aquí puede sacar a un perro de la banda en la que se propone.
 *
 * **Un 👎 pesa aunque haya diez 👍 después**, y esa asimetría es a propósito.
 * Los dos hechos no son del mismo tipo: que diez paseos fueran bien no
 * demuestra que el que fue mal no vaya a repetirse, y el coste de equivocarse
 * no es simétrico —proponer de menos deja a alguien sin un paseo; proponer de
 * más lleva a dos perros que ya se llevaron mal a un sitio sin correa—.
 */
export function pairHistoryFrom(walks: readonly WalkRecord[]): Map<string, PairHistory> {
  const history = new Map<string, PairHistory>();

  for (const { petId, negatives } of companionTally(walks)) {
    history.set(petId, { hadNegativeFeedback: negatives > 0 });
  }

  return history;
}

export type RecurringCandidate = {
  petId: string;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  /** Minuto del día, ya en la mediana del grupo. */
  startMinute: number;
  /** Semanas seguidas que sostienen el patrón. */
  weeks: number;
  /** El sitio más repetido de esas salidas, o `null` si fue por la calle. */
  placeId: string | null;
};

/**
 * «Coincidís los martes a las siete. ¿Lo hacéis fijo?»
 *
 * Tres reglas, y cada una tapa una forma distinta de proponer una tontería:
 *
 *  1. **Semanas seguidas, no paseos.** Tres salidas el mismo sábado no son una
 *     costumbre, son un sábado. Y tres martes de enero, marzo y junio tampoco:
 *     se busca la racha más larga de semanas consecutivas, no el total.
 *  2. **A la misma hora.** El martes por sí solo no dice nada si uno fue a las
 *     siete de la mañana y otro a las ocho de la tarde.
 *  3. **Sin ningún 👎.** Es la que más importa. Un patrón se detecta contando,
 *     y contar no distingue «nos vemos todos los martes porque nos va bien» de
 *     «nos cruzamos todos los martes y fue un desastre». Proponer un paseo fijo
 *     con un perro que el tutor marcó como mal encuentro sería la aplicación
 *     insistiendo en lo único que le dijeron que no.
 */
export function recurringCandidates(
  walks: readonly WalkRecord[],
  options: { minWeeks?: number } = {},
): RecurringCandidate[] {
  const minWeeks = options.minWeeks ?? RECURRING_MIN_WEEKS;

  type Entry = { week: number; minute: number; placeId: string | null; bad: boolean };
  const groups = new Map<string, Entry[]>();

  for (const walk of walks) {
    const date = new Date(walk.startedAt);
    if (Number.isNaN(date.getTime())) continue;

    for (const companion of walk.companions) {
      const key = `${companion.petId}|${date.getDay()}`;
      const entries = groups.get(key) ?? [];
      entries.push({
        week: weekIndex(walk.startedAt),
        minute: startMinuteOfDay(walk),
        placeId: walk.placeId,
        bad: companion.outcome === 'bad',
      });
      groups.set(key, entries);
    }
  }

  const candidates: RecurringCandidate[] = [];

  for (const [key, entries] of groups) {
    const [petId = '', weekdayText = '0'] = key.split('|');
    const weekday = Number(weekdayText);

    /* Un solo 👎 en este día con este perro y el grupo entero se cae. No se
       descuenta esa salida y se sigue contando: lo que invalida el patrón es
       que la pareja no funcionó, no que faltara un martes. */
    if (entries.some((entry) => entry.bad)) continue;

    for (const cluster of clusterByStart(entries)) {
      const run = longestRun([...new Set(cluster.map((entry) => entry.week))]);
      if (run < minWeeks) continue;

      candidates.push({
        petId,
        weekday,
        startMinute: median(cluster.map((entry) => entry.minute)),
        weeks: run,
        placeId: mostCommonPlace(cluster.map((entry) => entry.placeId)),
      });
    }
  }

  return candidates.sort((a, b) => b.weeks - a.weeks || a.weekday - b.weekday);
}

/**
 * Parte las salidas de un día en grupos que caben en la misma ventana horaria.
 *
 * Recorrido en orden y cortando cuando la siguiente se aleja más de la ventana
 * **de la primera del grupo**, no de la anterior: encadenando por la anterior,
 * diez salidas separadas de cuarenta minutos formarían un solo grupo de siete
 * horas, que es exactamente lo que la ventana existe para impedir.
 */
function clusterByStart<T extends { minute: number }>(entries: readonly T[]): T[][] {
  const sorted = [...entries].sort((a, b) => a.minute - b.minute);
  const clusters: T[][] = [];

  for (const entry of sorted) {
    const current = clusters[clusters.length - 1];
    const anchor = current?.[0];
    if (current && anchor && entry.minute - anchor.minute <= RECURRING_WINDOW_MINUTES) {
      current.push(entry);
    } else {
      clusters.push([entry]);
    }
  }

  return clusters;
}

/** La racha más larga de números consecutivos. */
function longestRun(weeks: readonly number[]): number {
  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous: number | null = null;

  for (const week of sorted) {
    run = previous !== null && week === previous + 1 ? run + 1 : 1;
    previous = week;
    if (run > best) best = run;
  }

  return best;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

function mostCommonPlace(places: readonly (string | null)[]): string | null {
  const counts = new Map<string | null, number>();
  for (const place of places) counts.set(place, (counts.get(place) ?? 0) + 1);

  let best: string | null = null;
  let bestCount = 0;
  for (const [place, count] of counts) {
    if (count > bestCount) {
      best = place;
      bestCount = count;
    }
  }

  return best;
}

/** «los martes a las 19:00». Lo que se pega en la propuesta, ya en español. */
export function describeRecurring(candidate: RecurringCandidate): string {
  return `los ${weekdayName(candidate.weekday)} a las ${formatTime(candidate.startMinute)}`;
}

export type WalkTotals = {
  walks: number;
  minutes: number;
  /** Días naturales distintos con al menos una salida. */
  days: number;
  /** Salidas que se pasaron del rato propuesto. */
  overruns: number;
  /** Perros distintos con los que se ha coincidido. */
  companions: number;
};

/**
 * El total de un periodo.
 *
 * `sinceDays` recorta contra `now` para poder decir «este mes» sin que la
 * pantalla tenga que filtrar por su cuenta y sin depender del reloj del
 * sistema en los tests, que es lo que hace que un test de fechas falle un
 * martes a las once de la noche y no el resto de la semana.
 */
export function walkTotals(
  walks: readonly WalkRecord[],
  options: { sinceDays?: number; now?: Date } = {},
): WalkTotals {
  const now = options.now ?? new Date();
  const cutoff =
    options.sinceDays === undefined ? null : now.getTime() - options.sinceDays * MS_PER_DAY;

  const within = walks.filter((walk) => {
    const started = Date.parse(walk.startedAt);
    if (!Number.isFinite(started)) return false;
    return cutoff === null || started >= cutoff;
  });

  const days = new Set(within.map((walk) => localDayIndex(walk.startedAt)));
  const companions = new Set(
    within.flatMap((walk) => walk.companions.map((companion) => companion.petId)),
  );

  return {
    walks: within.length,
    minutes: within.reduce((total, walk) => total + walkMinutes(walk), 0),
    days: days.size,
    overruns: within.filter((walk) => summarizeWalk(walk).overrunMinutes > 0).length,
    companions: companions.size,
  };
}
