/**
 * Tests de los puntos de encuentro.
 *
 * El caso que da nombre a todo esto es el primero: alguien que sale a correr a
 * las seis de la mañana y quiere saber con quién. Lo demás son las formas de
 * equivocarse al resolverlo —elegir un sitio que deja a uno andando el triple,
 * juntar a un corredor con quien pasea, o publicar sin querer dónde vive la
 * gente—.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_WALK_M,
  bestPlaceFor,
  describeMeetup,
  groupByRoutine,
  overlappingWindows,
  paceSuitsPet,
  proposeMeetupPoints,
} from './meetups.js';
import type { MeetupParticipant, MeetupPlace } from './meetups.js';
import type { MatchablePet } from './types.js';

/* Un barrio pequeño: unos cientos de metros entre casa y casa. A esta latitud
   0,001° son unos 111 m en latitud y unos 85 m en longitud. */
const BASE = { lat: 40.42, lng: -3.7 };
const at = (northMetres: number, eastMetres: number) => ({
  lat: BASE.lat + northMetres / 111_320,
  lng: BASE.lng + eastMetres / (111_320 * Math.cos((BASE.lat * Math.PI) / 180)),
});

const PLACES: MeetupPlace[] = [
  { id: 'parque-centro', name: 'Parque Central', point: at(0, 0) },
  { id: 'parque-norte', name: 'Parque Norte', point: at(900, 0) },
  { id: 'parque-lejos', name: 'Parque del Río', point: at(0, 4000) },
];

const pet = (id: string, overrides: Partial<MatchablePet> = {}): MatchablePet => ({
  id,
  speciesId: 'dog',
  size: 'medium',
  ageMonths: 48,
  sex: 'female',
  energyLevel: 'high',
  playStyles: ['chase'],
  trustCircle: ['loves_everyone'],
  ...overrides,
});

/** «Salgo a correr a las 6:00, de lunes a viernes.» */
const runsAtSix = (weekdays: number[] = [1, 2, 3, 4, 5]) =>
  weekdays.map((weekday) => ({
    weekday,
    startTime: '06:00',
    endTime: '07:00',
    pace: 'run' as const,
  }));

const participant = (
  id: string,
  home: { lat: number; lng: number },
  routine: MeetupParticipant['routine'],
  petOverrides: Partial<MatchablePet> = {},
): MeetupParticipant => ({ petId: id, pet: pet(id, petOverrides), home, routine });

describe('el caso de las seis de la mañana', () => {
  const vecinos = [
    participant('ana', at(200, 100), runsAtSix()),
    participant('bruno', at(-150, 250), runsAtSix()),
    participant('carla', at(100, -300), runsAtSix()),
  ];

  it('propone un punto de encuentro para quienes corren a la misma hora', () => {
    const proposals = proposeMeetupPoints(vecinos, PLACES);
    expect(proposals.length).toBeGreaterThan(0);
    const first = proposals[0];
    expect(first?.pace).toBe('run');
    expect(first?.startMinute).toBe(6 * 60);
    expect(first?.attendees).toEqual(['ana', 'bruno', 'carla']);
  });

  it('elige el sitio al que llegan todos, no el más céntrico del mapa', () => {
    const proposals = proposeMeetupPoints(vecinos, PLACES);
    expect(proposals[0]?.placeId).toBe('parque-centro');
  });

  it('agrupa los cinco días en una sola rutina y no en cinco planes', () => {
    const routines = groupByRoutine(proposeMeetupPoints(vecinos, PLACES, { limit: 50 }));
    const weekly = routines.find((routine) => routine.weekdays.length === 5);
    expect(weekly).toBeDefined();
    expect(weekly?.weekdays).toEqual([1, 2, 3, 4, 5]);
  });

  it('lo cuenta en una frase que no hace falta descifrar', () => {
    const routines = groupByRoutine(proposeMeetupPoints(vecinos, PLACES, { limit: 50 }));
    const weekly = routines.find((routine) => routine.weekdays.length === 5);
    expect(describeMeetup(weekly!, 'Parque Central')).toBe(
      'carrera entre semana a las 06:00 en Parque Central, con 2 personas',
    );
  });
});

describe('el sitio se elige por la peor caminata', () => {
  /**
   * El caso que separa el mínimax de la media.
   *
   * Tres personas juntas y una cuarta apartada. El centro geométrico está cerca
   * del trío y deja a la cuarta andando mucho más que los demás: minimiza la
   * suma y reparte fatal. La que minimiza el peor trayecto queda entre medias, y
   * es la que sostiene una rutina semanal.
   */
  it('prefiere repartir el esfuerzo antes que minimizar el total', () => {
    const homes = [at(0, 0), at(50, 0), at(-50, 0), at(800, 0)];
    const places: MeetupPlace[] = [
      { id: 'junto-al-trio', name: 'Junto al trío', point: at(0, 0) },
      { id: 'en-medio', name: 'En medio', point: at(400, 0) },
    ];
    const best = bestPlaceFor(homes, places, DEFAULT_MAX_WALK_M);
    expect(best?.place.id).toBe('en-medio');
  });

  it('descarta los sitios a los que alguien no llega andando', () => {
    const homes = [at(0, 0), at(100, 0)];
    const best = bestPlaceFor(homes, [PLACES[2] as MeetupPlace], DEFAULT_MAX_WALK_M);
    expect(best).toBeNull();
  });

  it('devuelve siempre el mismo sitio ante un empate', () => {
    const homes = [at(0, 0)];
    const tied: MeetupPlace[] = [
      { id: 'zeta', name: 'Zeta', point: at(100, 0) },
      { id: 'alfa', name: 'Alfa', point: at(-100, 0) },
    ];
    expect(bestPlaceFor(homes, tied, DEFAULT_MAX_WALK_M)?.place.id).toBe(
      bestPlaceFor(homes, [...tied].reverse(), DEFAULT_MAX_WALK_M)?.place.id,
    );
  });

  it('suelta al que vive lejos antes que renunciar al encuentro', () => {
    const grupo = [
      participant('ana', at(100, 0), runsAtSix([1])),
      participant('bruno', at(-100, 0), runsAtSix([1])),
      participant('lejana', at(0, 6000), runsAtSix([1])),
    ];
    const proposals = proposeMeetupPoints(grupo, PLACES);
    expect(proposals[0]?.attendees).toEqual(['ana', 'bruno']);
  });
});

describe('el ritmo no se mezcla', () => {
  it('no junta a quien corre con quien pasea a la misma hora', () => {
    const grupo = [
      participant('corredora', at(100, 0), runsAtSix([1])),
      participant('paseante', at(-100, 0), [
        { weekday: 1, startTime: '06:00', endTime: '07:00', pace: 'walk' },
      ]),
    ];
    expect(proposeMeetupPoints(grupo, PLACES)).toEqual([]);
  });

  it('sí junta a dos que pasean a la misma hora', () => {
    const walk = (weekday: number) => [
      { weekday, startTime: '06:00', endTime: '07:00', pace: 'walk' as const },
    ];
    const grupo = [
      participant('una', at(100, 0), walk(1), { energyLevel: 'low' }),
      participant('otra', at(-100, 0), walk(1), { energyLevel: 'low' }),
    ];
    expect(proposeMeetupPoints(grupo, PLACES).length).toBe(1);
  });

  it('una franja sin ritmo declarado es un paseo', () => {
    const grupo = [
      participant('una', at(100, 0), [{ weekday: 1, startTime: '06:00', endTime: '07:00' }]),
      participant('otra', at(-100, 0), [{ weekday: 1, startTime: '06:00', endTime: '07:00' }]),
    ];
    expect(proposeMeetupPoints(grupo, PLACES)[0]?.pace).toBe('walk');
  });
});

describe('al otro extremo de la correa', () => {
  /**
   * El tutor declara su rutina de buena fe: él sí corre. Quien no puede es el
   * perro, y nadie más va a mirar por él.
   */
  it('un perro de sofá no entra en una carrera aunque su tutor la declare', () => {
    expect(paceSuitsPet(pet('x', { energyLevel: 'low' }), 'run')).toBe(false);
    expect(paceSuitsPet(pet('x', { energyLevel: 'low' }), 'walk')).toBe(true);
  });

  it('y por eso no se le propone el encuentro', () => {
    const grupo = [
      participant('corredor', at(100, 0), runsAtSix([1])),
      participant('sofa', at(-100, 0), runsAtSix([1]), { energyLevel: 'low' }),
      participant('otro-sofa', at(0, 120), runsAtSix([1]), { energyLevel: 'low' }),
    ];
    /* Quedan solo los de sofá fuera y el corredor solo: no hay encuentro. */
    expect(proposeMeetupPoints(grupo, PLACES)).toEqual([]);
  });

  it('el trote admite exploradores, la carrera no', () => {
    expect(paceSuitsPet(pet('x', { energyLevel: 'medium' }), 'jog')).toBe(true);
    expect(paceSuitsPet(pet('x', { energyLevel: 'medium' }), 'run')).toBe(false);
  });
});

describe('la afinidad suelta al eslabón, no baja el listón', () => {
  it('quita al incompatible y propone el grupo que sí funciona', () => {
    const grupo = [
      participant('grande-a', at(100, 0), runsAtSix([1]), { size: 'giant' }),
      participant('grande-b', at(-100, 0), runsAtSix([1]), { size: 'giant' }),
      /* Un mini con dos gigantes: diferencia de talla ≥ 3, veto duro. */
      participant('mini', at(0, 150), runsAtSix([1]), { size: 'mini' }),
    ];
    const proposals = proposeMeetupPoints(grupo, PLACES);
    expect(proposals[0]?.attendees).toEqual(['grande-a', 'grande-b']);
  });

  it('nunca devuelve un grupo por debajo del suelo de afinidad', () => {
    const grupo = [
      participant('mini', at(100, 0), runsAtSix([1]), { size: 'mini' }),
      participant('gigante', at(-100, 0), runsAtSix([1]), { size: 'giant' }),
    ];
    expect(proposeMeetupPoints(grupo, PLACES)).toEqual([]);
  });

  it('la afinidad devuelta es la del grupo final, no la del grupo de partida', () => {
    const grupo = [
      participant('grande-a', at(100, 0), runsAtSix([1]), { size: 'giant' }),
      participant('grande-b', at(-100, 0), runsAtSix([1]), { size: 'giant' }),
      participant('mini', at(0, 150), runsAtSix([1]), { size: 'mini' }),
    ];
    const proposal = proposeMeetupPoints(grupo, PLACES)[0];
    expect(proposal?.affinity).toBeGreaterThanOrEqual(60);
  });
});

describe('ventanas de solapamiento', () => {
  it('encuentra la franja entera y no solo el trozo compartido con un tercero', () => {
    /* A y B de 6:00 a 7:00; C aparece de 6:30 a 6:45. La pareja tiene que salir
       con su hora completa, no con los quince minutos del medio. */
    const segments = [
      { petId: 'a', start: 360, end: 420, pace: 'run' as const },
      { petId: 'b', start: 360, end: 420, pace: 'run' as const },
      { petId: 'c', start: 390, end: 405, pace: 'run' as const },
    ];
    const windows = overlappingWindows(segments, 20);
    const pair = windows.find((window) => window.petIds.join() === 'a,b');
    expect(pair).toMatchObject({ start: 360, end: 420 });
  });

  it('descarta los solapamientos demasiado cortos para quedar', () => {
    const segments = [
      { petId: 'a', start: 360, end: 370, pace: 'walk' as const },
      { petId: 'b', start: 365, end: 380, pace: 'walk' as const },
    ];
    expect(overlappingWindows(segments, 20)).toEqual([]);
  });

  it('una sola persona no es un encuentro', () => {
    const segments = [{ petId: 'a', start: 360, end: 420, pace: 'walk' as const }];
    expect(overlappingWindows(segments, 20)).toEqual([]);
  });
});

describe('privacidad', () => {
  /**
   * La comprobación que justifica el diseño entero.
   *
   * Las casas entran para calcular y no salen. Publicar «Bruno está a 180 m del
   * parque» es publicar aproximadamente su portal, y una app donde quedas con
   * desconocidos no puede permitirse eso ni de lejos.
   */
  it('ninguna coordenada de casa aparece en la salida', () => {
    const vecinos = [
      participant('ana', at(200, 100), runsAtSix([1])),
      participant('bruno', at(-150, 250), runsAtSix([1])),
    ];
    const serialised = JSON.stringify(proposeMeetupPoints(vecinos, PLACES));

    for (const vecino of vecinos) {
      expect(serialised).not.toContain(String(vecino.home.lat));
      expect(serialised).not.toContain(String(vecino.home.lng));
    }
  });

  it('la frase no dice a qué distancia vive nadie', () => {
    const vecinos = [
      participant('ana', at(200, 100), runsAtSix([1])),
      participant('bruno', at(-150, 250), runsAtSix([1])),
    ];
    const routines = groupByRoutine(proposeMeetupPoints(vecinos, PLACES));
    const text = describeMeetup(routines[0]!, 'Parque Central');
    expect(text).not.toMatch(/\d+\s*m\b/);
    expect(text).not.toContain('ana');
    expect(text).not.toContain('bruno');
  });
});

describe('casos de borde', () => {
  it('con una sola persona no hay nada que proponer', () => {
    expect(proposeMeetupPoints([participant('sola', at(0, 0), runsAtSix())], PLACES)).toEqual([]);
  });

  it('sin lugares en el catálogo no se inventa una coordenada', () => {
    const vecinos = [
      participant('ana', at(100, 0), runsAtSix([1])),
      participant('bruno', at(-100, 0), runsAtSix([1])),
    ];
    expect(proposeMeetupPoints(vecinos, [])).toEqual([]);
  });

  it('una franja que cruza medianoche cuenta en el día en que empieza', () => {
    const nocturnos = [
      participant('una', at(100, 0), [
        { weekday: 2, startTime: '23:30', endTime: '00:30', pace: 'walk' },
      ]),
      participant('otra', at(-100, 0), [
        { weekday: 2, startTime: '23:30', endTime: '00:30', pace: 'walk' },
      ]),
    ];
    const proposal = proposeMeetupPoints(nocturnos, PLACES)[0];
    expect(proposal?.weekday).toBe(2);
    expect(proposal?.startMinute).toBe(23 * 60 + 30);
  });

  it('es determinista: la misma entrada devuelve la misma salida', () => {
    const vecinos = [
      participant('ana', at(200, 100), runsAtSix()),
      participant('bruno', at(-150, 250), runsAtSix()),
      participant('carla', at(100, -300), runsAtSix()),
    ];
    const once = JSON.stringify(proposeMeetupPoints(vecinos, PLACES));
    const twice = JSON.stringify(proposeMeetupPoints([...vecinos].reverse(), PLACES));
    expect(once).toBe(twice);
  });
});
