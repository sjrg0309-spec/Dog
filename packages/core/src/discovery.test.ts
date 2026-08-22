import { beforeEach, describe, expect, it } from 'vitest';

import { classifyResults, rankCandidates, type DiscoveryCandidate } from './discovery.js';
import { makeAvailability, makeDog, resetDogIds } from './fixtures.js';

beforeEach(resetDogIds);

const MORNING = [makeAvailability({ weekday: 1, startTime: '07:00', endTime: '08:00' })];
const EVENING = [makeAvailability({ weekday: 1, startTime: '19:00', endTime: '20:00' })];

const PARK = { lat: 40.4153, lng: -3.6844 };
const FAR = { lat: 40.4553, lng: -3.7444 };

const viewer = () => ({
  dog: makeDog({ size: 'medium', energyLevel: 'explorer', playStyles: ['chase'] }),
  availability: MORNING,
  location: PARK,
});

describe('orden del descubrimiento', () => {
  it('los vetados no aparecen nunca, por muy cerca que estén', () => {
    const me = viewer();
    // Dos vetos distintos: uno por riesgo de lesión (tres tallas de diferencia)
    // y otro por el límite que el tutor declaró.
    const giant: DiscoveryCandidate = {
      dog: makeDog({ size: 'giant', trustCircle: ['same_size_only'] }),
      availability: MORNING,
      location: PARK,
    };
    const tiny: DiscoveryCandidate = {
      dog: makeDog({ size: 'mini' }),
      availability: MORNING,
      location: PARK,
    };
    const meTiny = { ...me, dog: makeDog({ size: 'giant' }) };

    // Un veto es un límite de seguridad, no una puntuación baja que se pueda
    // compensar estando al lado.
    expect(rankCandidates(me, [giant])).toHaveLength(0);
    expect(rankCandidates(me, [giant], { includeIncompatible: true })).toHaveLength(0);
    expect(rankCandidates(meTiny, [tiny], { includeIncompatible: true })).toHaveLength(0);
  });

  it('a igualdad de afinidad y distancia, gana quien coincide de horario', () => {
    const me = viewer();
    const shape = { size: 'medium', energyLevel: 'explorer', playStyles: ['chase'] } as const;

    const sameSchedule: DiscoveryCandidate = {
      dog: makeDog(shape),
      availability: MORNING,
      location: PARK,
    };
    const otherSchedule: DiscoveryCandidate = {
      dog: makeDog(shape),
      availability: EVENING,
      location: PARK,
    };

    const ranked = rankCandidates(me, [otherSchedule, sameSchedule]);
    expect(ranked[0]?.dogId).toBe(sameSchedule.dog.id);
  });

  it('a igualdad de todo lo demás, gana quien está más cerca', () => {
    const me = viewer();
    const shape = { size: 'medium', energyLevel: 'explorer', playStyles: ['chase'] } as const;

    const near: DiscoveryCandidate = { dog: makeDog(shape), availability: MORNING, location: PARK };
    const far: DiscoveryCandidate = { dog: makeDog(shape), availability: MORNING, location: FAR };

    const ranked = rankCandidates(me, [far, near]);
    expect(ranked[0]?.dogId).toBe(near.dog.id);
  });

  it('los tres ejes viajan por separado hasta la interfaz', () => {
    const me = viewer();
    const candidate: DiscoveryCandidate = {
      dog: makeDog({ size: 'medium', energyLevel: 'explorer', playStyles: ['chase'] }),
      availability: MORNING,
      location: PARK,
    };

    const [match] = rankCandidates(me, [candidate]);

    // Nunca se funden en un solo porcentaje: un perro mediocre pero cercano no
    // puede presentarse como "95 % compatible".
    expect(match?.affinity.score).toBeDefined();
    expect(match?.schedule.score).toBeDefined();
    expect(match?.proximity).toBeDefined();
    expect(match?.affinity.score).not.toBe(match?.rankScore);
  });

  it('explica en lenguaje llano por qué coinciden', () => {
    const me = viewer();
    const candidate: DiscoveryCandidate = {
      dog: makeDog({ size: 'medium', energyLevel: 'explorer', playStyles: ['chase'] }),
      availability: MORNING,
      location: PARK,
    };

    const [match] = rankCandidates(me, [candidate]);
    expect(match?.scheduleSummary).toContain('Coincidís');
    expect(match?.affinity.reasons.length).toBeGreaterThan(0);
  });

  it('no se devuelve a sí mismo', () => {
    const me = viewer();
    const self: DiscoveryCandidate = { dog: me.dog, availability: MORNING, location: PARK };

    expect(rankCandidates(me, [self])).toHaveLength(0);
  });

  it('funciona sin ubicación: la coincidencia horaria sigue sirviendo', () => {
    // Este es el caso de un usuario que denegó el permiso de ubicación. La app
    // debe seguir siendo útil, no quedarse en blanco.
    const me = { ...viewer(), location: null };
    const candidate: DiscoveryCandidate = {
      dog: makeDog({ size: 'medium', energyLevel: 'explorer', playStyles: ['chase'] }),
      availability: MORNING,
      location: null,
    };

    const [match] = rankCandidates(me, [candidate]);
    expect(match).toBeDefined();
    expect(match?.distanceMeters).toBeNull();
    expect(match?.proximity).toBe(0);
    expect(match?.schedule.totalMinutes).toBe(60);
  });

  it('es determinista ante empates', () => {
    const me = viewer();
    const shape = { size: 'medium', energyLevel: 'explorer', playStyles: ['chase'] } as const;
    const candidates: DiscoveryCandidate[] = [
      { dog: makeDog(shape), availability: MORNING, location: PARK },
      { dog: makeDog(shape), availability: MORNING, location: PARK },
      { dog: makeDog(shape), availability: MORNING, location: PARK },
    ];

    const first = rankCandidates(me, candidates).map((match) => match.dogId);
    const second = rankCandidates(me, [...candidates].reverse()).map((match) => match.dogId);

    // Una lista que baila entre recargas se percibe como un fallo.
    expect(first).toEqual(second);
  });

  it('oculta por debajo del umbral salvo que se pida lo contrario', () => {
    const me = viewer();
    const poor: DiscoveryCandidate = {
      dog: makeDog({ size: 'small', energyLevel: 'couch', playStyles: ['calm_walk'] }),
      availability: EVENING,
      location: FAR,
    };

    expect(rankCandidates(me, [poor], { minAffinity: 90 })).toHaveLength(0);
    expect(rankCandidates(me, [poor], { minAffinity: 90, includeIncompatible: true })).toHaveLength(
      1,
    );
  });
});

describe('estados vacíos — decir la verdad en vez de rellenar', () => {
  it('distingue no haber nadie de que nadie encaje', () => {
    const me = viewer();

    expect(classifyResults(me, [], [])).toBe('no_candidates');

    const incompatible: DiscoveryCandidate = {
      dog: makeDog({ size: 'small', energyLevel: 'couch', playStyles: ['calm_walk'] }),
      availability: MORNING,
      location: PARK,
    };
    const matches = rankCandidates(me, [incompatible], { minAffinity: 95 });
    expect(classifyResults(me, [incompatible], matches)).toBe('all_incompatible');
  });

  it('distingue el caso de no coincidir nunca de horario', () => {
    const me = viewer();
    const nightOwl: DiscoveryCandidate = {
      dog: makeDog({ size: 'small', energyLevel: 'couch', playStyles: ['calm_walk'] }),
      availability: EVENING,
      location: FAR,
    };

    const matches = rankCandidates(me, [nightOwl], { minAffinity: 95 });
    expect(classifyResults(me, [nightOwl], matches)).toBe('no_schedule_overlap');
  });

  it('reconoce cuando sí hay resultados', () => {
    const me = viewer();
    const good: DiscoveryCandidate = {
      dog: makeDog({ size: 'medium', energyLevel: 'explorer', playStyles: ['chase'] }),
      availability: MORNING,
      location: PARK,
    };

    const matches = rankCandidates(me, [good]);
    expect(classifyResults(me, [good], matches)).toBe('has_matches');
  });
});
