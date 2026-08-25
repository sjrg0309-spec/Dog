/**
 * Puntos de encuentro: de «coincidimos» a «quedamos aquí, a esta hora».
 *
 * El resto del proyecto sabe decir que dos personas coinciden. Eso ya sirve de
 * algo, pero deja el último paso al usuario, y el último paso es el que no
 * ocurre: hay que escribirle a alguien, proponer un sitio, negociar la hora.
 * Este módulo lo resuelve entero. Dado un grupo de tutores con su rutina y su
 * casa, encuentra las franjas en las que varios salen a la vez y **elige dónde
 * quedar**.
 *
 * Tres decisiones sostienen el algoritmo:
 *
 *  1. **El punto se elige por la peor caminata, no por la media.** Es el mismo
 *     principio que la afinidad de grupo: un grupo vale lo que vale su peor
 *     pareja, y un punto de encuentro vale lo que la caminata más larga que
 *     obliga a hacer. Un centro geométrico minimiza la suma y puede dejar a uno
 *     andando el triple que el resto; ese es el que deja de venir a la tercera
 *     semana, y entonces el grupo se deshace.
 *
 *  2. **Se queda en un sitio, no en una coordenada.** El punto medio de cuatro
 *     casas cae normalmente en mitad de una calle, en un portal ajeno o en una
 *     rotonda. Así que los candidatos son los lugares del catálogo —parques,
 *     pipicanes— y el algoritmo elige entre ellos. Un punto de encuentro al que
 *     no se puede llegar y en el que no se puede soltar al perro no es un punto
 *     de encuentro.
 *
 *  3. **El ritmo no se mezcla.** Quien sale a correr a las seis y quien saca al
 *     perro a dar una vuelta a las seis coinciden en el reloj y no en el plan:
 *     juntarlos significa que uno de los dos no hace lo que iba a hacer. Es la
 *     clase de encuentro que se prueba una vez y no se repite, y proponerlo
 *     gasta la confianza que hace falta para los que sí valen.
 *
 * **Nada de esto revela dónde vive nadie.** Las casas entran para calcular y no
 * salen: una propuesta lleva el lugar, la hora y quiénes, y la caminata de cada
 * cual es un dato que solo se le enseña a esa persona. Publicar «Marta está a
 * 300 m del parque» es publicar aproximadamente su portal. Hay un test que
 * comprueba que ninguna coordenada de casa aparece en la salida.
 */

import { calculateAffinity } from './affinity.js';
import { distanceMeters } from './geo.js';
import { MINUTES_PER_DAY, expandAvailability } from './schedule.js';
import type { Availability, EnergyLevel, LatLng, MatchablePet } from './types.js';

/**
 * A qué va la gente cuando sale.
 *
 * El orden importa: es de menos a más intensidad, y se usa para decidir qué
 * animales aguantan cada ritmo.
 */
export const PACES = ['walk', 'jog', 'run'] as const;
export type Pace = (typeof PACES)[number];

export const PACE_LABEL: Record<Pace, string> = {
  walk: 'paseo',
  jog: 'trote',
  run: 'carrera',
};

/** Una franja de la rutina, con el ritmo al que se sale en ella. */
export type RoutineWindow = Availability & {
  /** Si falta, se asume paseo: es lo que hace casi todo el mundo. */
  pace?: Pace;
};

export type MeetupParticipant = {
  petId: string;
  pet: MatchablePet;
  /**
   * Dónde vive el tutor.
   *
   * Entra para calcular caminatas y **no sale**. Ver la cabecera del módulo.
   */
  home: LatLng;
  routine: readonly RoutineWindow[];
};

/** Un sitio del catálogo al que se puede ir a quedar. */
export type MeetupPlace = {
  id: string;
  name: string;
  point: LatLng;
};

export type MeetupProposal = {
  placeId: string;
  /** 0 = domingo, como en `Date#getDay`. */
  weekday: number;
  /** Minutos desde medianoche. */
  startMinute: number;
  endMinute: number;
  pace: Pace;
  /** Quiénes encajan en esta propuesta, siempre dos o más. */
  attendees: readonly string[];
  /**
   * La caminata más larga que este punto obliga a hacer a alguien del grupo.
   *
   * Es el número por el que se eligió el sitio, así que se devuelve para poder
   * explicarlo: «el que más lejos vive llega en diez minutos».
   */
  worstWalkMeters: number;
  /** Afinidad del grupo: el mínimo par a par, nunca el promedio. */
  affinity: number;
};

export type MeetupOptions = {
  /**
   * Lo máximo que se le pide andar a nadie para llegar.
   *
   * Mil doscientos metros son unos quince minutos a paso normal. Más que eso y
   * el trayecto deja de ser parte del paseo para convertirse en un
   * desplazamiento, que es cuando la gente empieza a no ir.
   */
  maxWalkMeters?: number;
  /** Por debajo de esto no hay encuentro que merezca la pena, solo un rato. */
  minMinutes?: number;
  /**
   * Afinidad mínima del grupo.
   *
   * 40 es el suelo de la banda «con supervisión» del algoritmo. Proponer por
   * debajo sería organizar el mal encuentro en lugar de evitarlo.
   */
  minAffinity?: number;
  /** Cuántas propuestas devolver como mucho. */
  limit?: number;
};

export const DEFAULT_MAX_WALK_M = 1200;
export const DEFAULT_MIN_MINUTES = 20;
export const DEFAULT_MIN_AFFINITY = 40;

/**
 * Qué animales aguantan cada ritmo.
 *
 * Sale de `energyLevel`, que ya existe y ya pesa 35 de los 100 puntos de
 * afinidad. Un perro de sofá apuntado a una carrera de las seis no es un
 * encuentro mediocre: es media hora tirando de una correa. Y el tutor puede
 * haber declarado la franja de buena fe —él sí corre—, así que alguien tiene
 * que mirar al otro extremo de la correa.
 */
export const PACE_MIN_ENERGY: Record<Pace, readonly EnergyLevel[]> = {
  walk: ['low', 'medium', 'high'],
  jog: ['medium', 'high'],
  run: ['high'],
};

export function paceSuitsPet(pet: MatchablePet, pace: Pace): boolean {
  return PACE_MIN_ENERGY[pace].includes(pet.energyLevel);
}

/** Intervalo de la semana con dueño y ritmo, ya troceado por `expandAvailability`. */
type Segment = {
  petId: string;
  start: number;
  end: number;
  pace: Pace;
};

function segmentsOf(participant: MeetupParticipant): Segment[] {
  const segments: Segment[] = [];
  for (const window of participant.routine) {
    const pace = window.pace ?? 'walk';
    /* Se expande de una en una para no perder de vista de qué franja venía
       cada intervalo: `expandAvailability` parte las que cruzan medianoche, y
       el ritmo viaja con la franja, no con el trozo. */
    for (const interval of expandAvailability([window])) {
      segments.push({ petId: participant.petId, start: interval.start, end: interval.end, pace });
    }
  }
  return segments;
}

/**
 * Ventanas en las que un mismo conjunto de personas está fuera a la vez.
 *
 * Barrido por los extremos: entre dos fronteras consecutivas el conjunto activo
 * no cambia, así que basta mirar quién cubre el punto medio de cada tramo. Para
 * cada conjunto se devuelve además su ventana **completa** —la intersección de
 * las franjas de sus miembros— y no solo el tramo elemental: si A y B se solapan
 * de 6:00 a 7:00 y C aparece de 6:30 a 6:45, {A,B} debe proponerse por su hora
 * entera y no por los quince minutos que sobran a cada lado.
 */
export function overlappingWindows(
  segments: readonly Segment[],
  minMinutes: number,
): { start: number; end: number; pace: Pace; petIds: string[] }[] {
  const found = new Map<string, { start: number; end: number; pace: Pace; petIds: string[] }>();

  for (const pace of PACES) {
    const ofPace = segments.filter((segment) => segment.pace === pace);
    if (ofPace.length < 2) continue;

    const edges = [...new Set(ofPace.flatMap((segment) => [segment.start, segment.end]))].sort(
      (a, b) => a - b,
    );

    for (let index = 0; index < edges.length - 1; index += 1) {
      const from = edges[index] as number;
      const to = edges[index + 1] as number;
      const middle = (from + to) / 2;

      const active = ofPace.filter((segment) => segment.start <= middle && segment.end > middle);
      if (active.length < 2) continue;

      /* La ventana entera del conjunto, no el tramo elemental. */
      const start = Math.max(...active.map((segment) => segment.start));
      const end = Math.min(...active.map((segment) => segment.end));
      if (end - start < minMinutes) continue;

      const petIds = [...new Set(active.map((segment) => segment.petId))].sort();
      if (petIds.length < 2) continue;

      const key = `${pace}|${start}|${end}|${petIds.join(',')}`;
      if (!found.has(key)) found.set(key, { start, end, pace, petIds });
    }
  }

  return [...found.values()];
}

/** Afinidad del grupo: el peor par. Y quién está en él, para poder soltarlo. */
function weakestPair(
  pets: readonly MatchablePet[],
): { score: number; worst: [string, string] | null } {
  let score = 100;
  let worst: [string, string] | null = null;

  for (let i = 0; i < pets.length; i += 1) {
    for (let j = i + 1; j < pets.length; j += 1) {
      const a = pets[i] as MatchablePet;
      const b = pets[j] as MatchablePet;
      const pair = calculateAffinity(a, b).score;
      if (pair < score) {
        score = pair;
        worst = [a.id, b.id];
      }
    }
  }
  return { score, worst };
}

/**
 * El sitio que minimiza la caminata más larga.
 *
 * Empates: primero la suma de todas las caminatas —entre dos sitios igual de
 * malos para el que peor lo tiene, gana el que sea mejor para el resto— y
 * después el identificador, para que la misma entrada devuelva siempre la
 * misma salida y los tests no dependan del orden del catálogo.
 */
export function bestPlaceFor(
  homes: readonly LatLng[],
  places: readonly MeetupPlace[],
  maxWalkMeters: number,
): { place: MeetupPlace; worstWalkMeters: number } | null {
  let best: { place: MeetupPlace; worst: number; total: number } | null = null;

  for (const place of places) {
    const walks = homes.map((home) => distanceMeters(home, place.point));
    const worst = Math.max(...walks);
    if (worst > maxWalkMeters) continue;
    const total = walks.reduce((sum, walk) => sum + walk, 0);

    if (
      !best ||
      worst < best.worst ||
      (worst === best.worst && total < best.total) ||
      (worst === best.worst && total === best.total && place.id < best.place.id)
    ) {
      best = { place, worst, total };
    }
  }

  return best ? { place: best.place, worstWalkMeters: Math.round(best.worst) } : null;
}

/**
 * Propone puntos de encuentro recurrentes.
 *
 * Cuando un grupo no encaja, se afloja **soltando a alguien**, nunca bajando el
 * listón: primero al que rompe la afinidad, y si el problema es la distancia, al
 * que vive más lejos. Es la diferencia entre proponer un encuentro peor y
 * proponer un encuentro más pequeño, y lo segundo es lo que la gente quiere.
 */
export function proposeMeetupPoints(
  participants: readonly MeetupParticipant[],
  places: readonly MeetupPlace[],
  options: MeetupOptions = {},
): MeetupProposal[] {
  const maxWalkMeters = options.maxWalkMeters ?? DEFAULT_MAX_WALK_M;
  const minMinutes = options.minMinutes ?? DEFAULT_MIN_MINUTES;
  const minAffinity = options.minAffinity ?? DEFAULT_MIN_AFFINITY;

  if (participants.length < 2 || places.length === 0) return [];

  const byId = new Map(participants.map((participant) => [participant.petId, participant]));
  const segments = participants.flatMap(segmentsOf);

  const proposals: MeetupProposal[] = [];

  for (const window of overlappingWindows(segments, minMinutes)) {
    /* Fuera los animales a los que ese ritmo no les pega. Va antes que todo lo
       demás: no tiene sentido buscarle sitio a un grupo que no debería salir
       junto a correr. */
    let members = window.petIds
      .map((petId) => byId.get(petId))
      .filter((participant): participant is MeetupParticipant => participant !== undefined)
      .filter((participant) => paceSuitsPet(participant.pet, window.pace));

    // --- Afinidad: se suelta al eslabón, no se baja el listón ---------------
    let affinity = 0;
    while (members.length >= 2) {
      const { score, worst } = weakestPair(members.map((member) => member.pet));
      if (score >= minAffinity || worst === null) {
        affinity = score;
        break;
      }
      /* De los dos del peor par se va el que peor encaja con el resto: soltar
         al azar rompería grupos que se salvaban soltando al otro. */
      const [first, second] = worst;
      const fit = (petId: string): number => {
        const others = members.filter((member) => member.petId !== petId);
        return weakestPair(others.map((member) => member.pet)).score;
      };
      const drop = fit(first) >= fit(second) ? first : second;
      members = members.filter((member) => member.petId !== drop);
      affinity = 0;
    }
    if (members.length < 2 || affinity < minAffinity) continue;

    // --- Sitio: se suelta al que vive más lejos ----------------------------
    let chosen: { place: MeetupPlace; worstWalkMeters: number } | null = null;
    let attendees = members;

    while (attendees.length >= 2) {
      chosen = bestPlaceFor(
        attendees.map((member) => member.home),
        places,
        maxWalkMeters,
      );
      if (chosen) break;

      /* Nadie llega. El más lejano del centro del grupo es quien lo impide. */
      const centre = averagePoint(attendees.map((member) => member.home));
      let farthest = attendees[0] as MeetupParticipant;
      for (const member of attendees) {
        if (distanceMeters(member.home, centre) > distanceMeters(farthest.home, centre)) {
          farthest = member;
        }
      }
      attendees = attendees.filter((member) => member.petId !== farthest.petId);
    }

    if (!chosen || attendees.length < 2) continue;

    /* Al soltar gente la afinidad solo puede subir, pero hay que recalcularla:
       devolver la del grupo grande describiría a un grupo que ya no existe. */
    const finalAffinity = weakestPair(attendees.map((member) => member.pet)).score;
    if (finalAffinity < minAffinity) continue;

    proposals.push({
      placeId: chosen.place.id,
      weekday: Math.floor(window.start / MINUTES_PER_DAY) % 7,
      startMinute: window.start % MINUTES_PER_DAY,
      endMinute: ((window.end - 1) % MINUTES_PER_DAY) + 1,
      pace: window.pace,
      attendees: attendees.map((member) => member.petId).sort(),
      worstWalkMeters: chosen.worstWalkMeters,
      affinity: finalAffinity,
    });
  }

  return rank(dedupe(proposals)).slice(0, options.limit ?? 10);
}

/** Media aritmética de unas coordenadas. Solo se usa para elegir a quién soltar. */
function averagePoint(points: readonly LatLng[]): LatLng {
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  return { lat, lng };
}

/**
 * Un mismo plan puede salir de varios tramos del barrido.
 *
 * Se queda el de más gente; a igualdad, el más largo. Enseñar dos veces el
 * mismo martes a las siete con un minuto de diferencia hace que la pantalla
 * parezca rota aunque el cálculo sea correcto.
 */
function dedupe(proposals: readonly MeetupProposal[]): MeetupProposal[] {
  const best = new Map<string, MeetupProposal>();
  for (const proposal of proposals) {
    const key = `${proposal.placeId}|${proposal.weekday}|${proposal.pace}|${proposal.attendees.join(',')}`;
    const current = best.get(key);
    const longer =
      current === null || current === undefined
        ? true
        : proposal.endMinute - proposal.startMinute > current.endMinute - current.startMinute;
    if (longer) best.set(key, proposal);
  }
  return [...best.values()];
}

/**
 * Más gente primero, y después la caminata más corta.
 *
 * La afinidad va después de las dos: un punto de encuentro no es una cita, es
 * una rutina, y una rutina la sostiene que sea cómoda ir y que haya alguien.
 */
function rank(proposals: readonly MeetupProposal[]): MeetupProposal[] {
  return [...proposals].sort(
    (a, b) =>
      b.attendees.length - a.attendees.length ||
      a.worstWalkMeters - b.worstWalkMeters ||
      b.affinity - a.affinity ||
      a.weekday - b.weekday ||
      a.startMinute - b.startMinute ||
      a.placeId.localeCompare(b.placeId),
  );
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const clock = (minuteOfDay: number): string =>
  `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;

/**
 * Agrupa las propuestas que son el mismo plan en días distintos.
 *
 * «Los martes a las 6:00» y «los jueves a las 6:00», con la misma gente y en el
 * mismo sitio, no son dos planes: es una rutina que ocurre dos veces. Enseñarlas
 * por separado convierte una lista corta y clara en una larga y repetida.
 */
export type RecurringMeetup = Omit<MeetupProposal, 'weekday'> & { weekdays: number[] };

export function groupByRoutine(proposals: readonly MeetupProposal[]): RecurringMeetup[] {
  const groups = new Map<string, RecurringMeetup>();

  for (const proposal of proposals) {
    const key = `${proposal.placeId}|${proposal.pace}|${proposal.startMinute}|${proposal.endMinute}|${proposal.attendees.join(',')}`;
    const current = groups.get(key);
    if (current) current.weekdays.push(proposal.weekday);
    else {
      const { weekday, ...rest } = proposal;
      groups.set(key, { ...rest, weekdays: [weekday] });
    }
  }

  for (const group of groups.values()) group.weekdays.sort((a, b) => a - b);
  return [...groups.values()];
}

/**
 * La propuesta en lenguaje llano.
 *
 * Dice cuándo, dónde y con cuántos. **No dice a qué distancia vive nadie**: la
 * caminata propia se le enseña a cada cual por separado, porque «Marta está a
 * 300 m» es aproximadamente el portal de Marta.
 */
export function describeMeetup(meetup: RecurringMeetup, placeName: string): string {
  const days =
    meetup.weekdays.length >= 5
      ? 'entre semana'
      : meetup.weekdays.length === 1
        ? `los ${DAY_NAMES[meetup.weekdays[0] as number]}`
        : `los ${meetup.weekdays.map((day) => DAY_NAMES[day]).join(' y ')}`;

  const who = meetup.attendees.length === 2 ? 'otra persona' : `${meetup.attendees.length - 1} personas`;

  return `${PACE_LABEL[meetup.pace]} ${days} a las ${clock(meetup.startMinute)} en ${placeName}, con ${who}`;
}
