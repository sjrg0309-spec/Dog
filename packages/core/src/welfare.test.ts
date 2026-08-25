/**
 * Los límites que existen para el animal, no para su tutor.
 *
 * Estos casos son la prueba de que la afirmación "el interés del animal manda"
 * es código y no una frase de la página de inicio: comprueban que un veredicto
 * de parada **vacía la lista de candidatos**, y no que se muestre un aviso
 * encima de una lista que sigue estando ahí.
 */

import { describe, expect, it } from 'vitest';

import {
  assessWelfare,
  groupWelfare,
  heatCeilingC,
  rankCandidates,
  classifyResults,
  sessionCeilingMinutes,
  findSpecies,
  makeAvailability,
  makePet,
  type Conditions,
} from './index.js';

const mild: Conditions = { temperatureC: 18, surface: 'grass', durationMinutes: 45 };

const dog = findSpecies('dog')!;
const ferret = findSpecies('ferret')!;

describe('calor', () => {
  it('un día suave no genera ningún motivo', () => {
    const verdict = assessWelfare(makePet(), mild);
    expect(verdict.level).toBe('ok');
    expect(verdict.reasons).toHaveLength(0);
  });

  it('a partir de cierto punto deja de proponerse, no se avisa', () => {
    const verdict = assessWelfare(makePet(), { ...mild, temperatureC: 34 });
    expect(verdict.level).toBe('stop');
    expect(verdict.recommendedMinutes).toBe(0);
    expect(verdict.reasons[0]?.code).toBe('too_hot');
  });

  it('el techo de un braquicéfalo es más bajo que el de su especie', () => {
    const flat = makePet({ healthFlags: ['brachycephalic'] });
    expect(heatCeilingC(flat, dog)).toBeLessThan(dog.care.comfortTempC.max);
  });

  it('lo que un perro aguanta puede ser demasiado para un bulldog el mismo día', () => {
    const conditions = { ...mild, temperatureC: 25 };
    // 25 °C es un día de verano corriente. Para un hocico chato no lo es, y esa
    // diferencia es justo la que una app centrada en el tutor no hace.
    expect(assessWelfare(makePet(), conditions).level).toBe('ok');
    expect(assessWelfare(makePet({ healthFlags: ['brachycephalic'] }), conditions).level).toBe(
      'stop',
    );
  });

  it('los descuentos se acumulan: sénior y sensible al calor bajan más que uno solo', () => {
    const one = heatCeilingC(makePet({ healthFlags: ['heat_sensitive'] }), dog);
    const two = heatCeilingC(
      makePet({ healthFlags: ['heat_sensitive'], ageMonths: 120 }),
      dog,
    );
    expect(two).toBeLessThan(one);
  });

  it('el asfalto caliente para el encuentro aunque el aire no llegue al techo', () => {
    // El suelo está mucho más caliente que el aire y quien lo pisa descalzo es él.
    const air = { ...mild, temperatureC: 28 };
    expect(assessWelfare(makePet(), { ...air, surface: 'grass' }).level).not.toBe('stop');
    expect(assessWelfare(makePet(), { ...air, surface: 'asphalt' }).level).toBe('stop');
  });

  it('bajo techo la temperatura de la calle no decide', () => {
    const verdict = assessWelfare(makePet({ speciesId: 'ferret' }), {
      temperatureC: 36,
      surface: 'indoor',
      durationMinutes: 20,
    });
    expect(verdict.level).toBe('ok');
  });

  it('el frío también para, no solo el calor', () => {
    const verdict = assessWelfare(makePet({ speciesId: 'guinea_pig' }), {
      ...mild,
      temperatureC: 2,
    });
    expect(verdict.reasons.map((reason) => reason.code)).toContain('too_cold');
  });
});

describe('sin pelo', () => {
  /*
   * La primera señal del catálogo que toca el frío en vez del calor, y entra
   * con las razas americanas: xoloitzcuintle, peruano sin pelo, pila argentino.
   * Un perro sin pelo aguanta bien el calor —de ahí viene— y **se enfría y se
   * quema** antes que cualquier otro, así que tratarlo como a los demás falla
   * justo al revés de lo que uno esperaría.
   */
  it('el suelo de temperatura es otro: diez grados', () => {
    /* El de la especie está puesto para un perro con pelaje —menos cinco grados
       es un día de invierno para un husky— y a esa temperatura un
       xoloitzcuintle sin abrigo lleva un rato tiritando. */
    const chilly: Conditions = { temperatureC: 6, surface: 'grass', durationMinutes: 30 };
    expect(assessWelfare(makePet(), chilly).reasons.map((reason) => reason.code)).not.toContain(
      'too_cold',
    );
    expect(
      assessWelfare(makePet({ healthFlags: ['hairless'] }), chilly).reasons.map(
        (reason) => reason.code,
      ),
    ).toContain('too_cold');
  });

  it('el sol le quema aunque no haga calor', () => {
    /* Veinte grados con sol de mediodía no dispara ningún techo, y le quema la
       piel igual. Por eso va aparte del calor y no colgando de él. */
    const sunny: Conditions = { temperatureC: 20, surface: 'grass', durationMinutes: 30 };
    const codes = assessWelfare(makePet({ healthFlags: ['hairless'] }), sunny).reasons.map(
      (reason) => reason.code,
    );
    expect(codes).toContain('hairless_sun');
    expect(assessWelfare(makePet(), sunny).reasons.map((reason) => reason.code)).not.toContain(
      'hairless_sun',
    );
  });

  it('no le baja el techo de calor: no es un perro frágil al calor', () => {
    /* Confundir «sin pelo» con «sensible al calor» le quitaría los paseos de
       verano a un perro que los lleva mejor que el resto. */
    expect(heatCeilingC(makePet({ healthFlags: ['hairless'] }), dog)).toBe(
      heatCeilingC(makePet(), dog),
    );
  });
});

describe('duración', () => {
  it('el techo de un hurón es mucho más corto que el de un perro', () => {
    expect(ferret.care.maxSessionMinutes).toBeLessThan(dog.care.maxSessionMinutes);
  });

  it('una tarde de dos horas se recorta a lo que el animal aguanta', () => {
    const verdict = assessWelfare(makePet({ speciesId: 'ferret' }), {
      temperatureC: 20,
      surface: 'indoor',
      durationMinutes: 120,
    });
    expect(verdict.recommendedMinutes).toBe(ferret.care.maxSessionMinutes);
    expect(verdict.reasons.map((reason) => reason.code)).toContain('too_long');
  });

  it('la recomendación nunca alarga lo que se pidió', () => {
    const verdict = assessWelfare(makePet(), { ...mild, durationMinutes: 15 });
    expect(verdict.recommendedMinutes).toBe(15);
  });

  it('un cachorro y un sénior aguantan menos que un adulto', () => {
    const adult = sessionCeilingMinutes(makePet({ ageMonths: 40 }), dog);
    expect(sessionCeilingMinutes(makePet({ ageMonths: 6 }), dog)).toBeLessThan(adult);
    expect(sessionCeilingMinutes(makePet({ ageMonths: 130 }), dog)).toBeLessThan(adult);
  });

  it('el tutor puede endurecer su propio techo', () => {
    const strict = sessionCeilingMinutes(makePet({ ownMaxSessionMinutes: 20 }), dog);
    expect(strict).toBe(20);
  });

  it('el tutor no puede ablandarlo', () => {
    // Un campo que pudiera subir el techo sería una forma elegante de que la
    // regla no existiera.
    const loose = sessionCeilingMinutes(makePet({ ownMaxSessionMinutes: 600 }), dog);
    expect(loose).toBe(dog.care.maxSessionMinutes);
  });
});

describe('estado del animal', () => {
  it('en recuperación no sale, haga el tiempo que haga', () => {
    const verdict = assessWelfare(makePet({ healthFlags: ['recovering'] }), mild);
    expect(verdict.level).toBe('stop');
    expect(verdict.reasons[0]?.code).toBe('recovering');
  });

  it('sin la pauta de vacunación, un parque abierto no', () => {
    expect(assessWelfare(makePet({ healthFlags: ['vaccination_pending'] }), mild).level).toBe(
      'stop',
    );
  });

  it('en una especie de grupo pequeño eso mismo es aviso, no parada', () => {
    // La diferencia es real: un encuentro controlado con un animal conocido no
    // es un parque lleno de desconocidos.
    const verdict = assessWelfare(
      makePet({ speciesId: 'ferret', healthFlags: ['vaccination_pending'] }),
      { temperatureC: 20, surface: 'indoor', durationMinutes: 20 },
    );
    expect(verdict.level).toBe('caution');
  });

  it('encadenar encuentros cansa aunque cada uno saliera bien', () => {
    const verdict = assessWelfare(makePet(), { ...mild, hoursSinceLastSession: 0.5 });
    expect(verdict.level).toBe('stop');
    expect(verdict.reasons.map((reason) => reason.code)).toContain('needs_rest');
  });

  it('pasado el descanso, ya no hay motivo', () => {
    const verdict = assessWelfare(makePet(), { ...mild, hoursSinceLastSession: 12 });
    expect(verdict.level).toBe('ok');
  });
});

describe('grupo', () => {
  it('el veredicto es el del que peor lo lleve', () => {
    const verdict = groupWelfare(
      [makePet(), makePet(), makePet({ healthFlags: ['recovering'] })],
      mild,
    );
    // No se hace porque a los otros dos les venga bien.
    expect(verdict.level).toBe('stop');
  });

  it('la duración del grupo es la del más limitado', () => {
    const verdict = groupWelfare([makePet({ ageMonths: 40 }), makePet({ ageMonths: 8 })], {
      ...mild,
      durationMinutes: 120,
    });
    expect(verdict.recommendedMinutes).toBeLessThan(120);
  });

  it('seis animales con el mismo calor son un motivo, no seis', () => {
    const hot = { ...mild, temperatureC: 25 };
    const flats = Array.from({ length: 6 }, () => makePet({ healthFlags: ['brachycephalic'] }));
    const codes = groupWelfare(flats, hot).reasons.map((reason) => reason.code);
    expect(codes.filter((code) => code === 'too_hot')).toHaveLength(1);
  });
});

describe('el bienestar manda sobre el descubrimiento', () => {
  const availability = [makeAvailability()];
  const viewer = (pet = makePet()) => ({ pet, availability });
  const others = [
    { pet: makePet(), availability },
    { pet: makePet(), availability },
  ];

  it('sin condiciones, el descubrimiento funciona como siempre', () => {
    const matches = rankCandidates(viewer(), others);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.welfare).toBeNull();
  });

  it('cuando al animal no le conviene salir, no hay lista que mostrar', () => {
    // Este es el caso que define de quién es la aplicación: no se devuelve la
    // lista con un aviso encima, se devuelve vacía.
    const matches = rankCandidates(viewer(), others, {
      conditions: { ...mild, temperatureC: 36 },
    });
    expect(matches).toEqual([]);
  });

  it('y el estado vacío dice el motivo de verdad', () => {
    const conditions = { ...mild, temperatureC: 36 };
    const reason = classifyResults(viewer(), others, [], conditions);
    // Decir "no hay nadie cerca" cuando el motivo es que hace 36 grados sería
    // mentirle al tutor sobre lo que pasa.
    expect(reason).toBe('welfare_stop');
  });

  it('un candidato al que no le conviene tampoco aparece', () => {
    const fragile = { pet: makePet({ healthFlags: ['recovering'] }), availability };
    const matches = rankCandidates(viewer(), [fragile], { conditions: mild });
    expect(matches).toEqual([]);
  });

  it('con aviso sí aparece, y lleva el recorte aplicado', () => {
    const matches = rankCandidates(viewer(), others, {
      conditions: { ...mild, durationMinutes: 600 },
    });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.welfare?.level).toBe('caution');
    expect(matches[0]?.welfare?.recommendedMinutes).toBe(dog.care.maxSessionMinutes);
  });
});

describe('la temperatura del suelo manda sobre la del aire', () => {
  const asphalt = { ...mild, surface: 'asphalt' } as const;

  it('con el suelo medido, un asfalto caliente para el encuentro', () => {
    const verdict = assessWelfare(makePet(), { ...asphalt, temperatureC: 24, groundTemperatureC: 51 });
    expect(verdict.reasons.map((reason) => reason.code)).toContain('hot_ground');
    expect(verdict.level).toBe('stop');
  });

  /**
   * El caso que el umbral del aire dejaba pasar.
   *
   * Un mediodía despejado de abril: el aire no llega a 28, así que la regla
   * anterior decía que no pasaba nada, y el asfalto ya estaba por encima de los
   * cincuenta grados. Este test es el motivo entero del cambio.
   */
  it('para aunque el aire esté por debajo del umbral viejo', () => {
    const before = assessWelfare(makePet(), { ...asphalt, temperatureC: 24 });
    const after = assessWelfare(makePet(), { ...asphalt, temperatureC: 24, groundTemperatureC: 50 });
    expect(before.reasons.map((reason) => reason.code)).not.toContain('hot_ground');
    expect(after.reasons.map((reason) => reason.code)).toContain('hot_ground');
  });

  /** Y el que paraba de más: una noche de agosto, con el asfalto ya frío. */
  it('no para de noche por un umbral de aire que ya no significa nada', () => {
    const verdict = assessWelfare(makePet(), {
      ...asphalt,
      temperatureC: 29,
      groundTemperatureC: 30,
    });
    expect(verdict.reasons.map((reason) => reason.code)).not.toContain('hot_ground');
  });

  it('sin dato del suelo sigue valiendo el criterio del aire', () => {
    const verdict = assessWelfare(makePet(), { ...asphalt, temperatureC: 29 });
    expect(verdict.reasons.map((reason) => reason.code)).toContain('hot_ground');
  });

  it('null no se lee como suelo frío', () => {
    const verdict = assessWelfare(makePet(), {
      ...asphalt,
      temperatureC: 29,
      groundTemperatureC: null,
    });
    expect(verdict.reasons.map((reason) => reason.code)).toContain('hot_ground');
  });

  it('bajo techo el suelo no dispara nada', () => {
    const verdict = assessWelfare(makePet(), {
      ...mild,
      surface: 'indoor',
      groundTemperatureC: 55,
    });
    expect(verdict.reasons.map((reason) => reason.code)).not.toContain('hot_ground');
  });
});
