import { beforeEach, describe, expect, it } from 'vitest';

import {
  BAND_THRESHOLDS,
  PLAY_STYLE_MATRIX,
  WEIGHTS,
  bandFor,
  calculateAffinity,
} from './affinity.js';
import { makePet, makeRandom, randomPet, randomPetOfSpecies, resetPetIds } from './fixtures.js';
import { PLAY_STYLES, SPECIES, findSpecies } from './species.js';

beforeEach(resetPetIds);

describe('especie: el primer filtro, antes de cualquier puntuación', () => {
  it('bloquea el encuentro entre especies distintas', () => {
    const dog = makePet({ speciesId: 'dog' });
    const ferret = makePet({ speciesId: 'ferret' });

    const result = calculateAffinity(dog, ferret);

    expect(result.vetoed).toBe(true);
    expect(result.vetoKind).toBe('different_species');
    expect(result.score).toBe(0);
  });

  it('explica la relación de depredador y presa cuando existe', () => {
    // Un hurón fue criado durante siglos para cazar conejos. Ninguna puntuación
    // de temperamento debería poder ponerlos en el mismo sitio.
    const ferret = makePet({ speciesId: 'ferret' });
    const rabbit = makePet({ speciesId: 'rabbit' });

    const result = calculateAffinity(ferret, rabbit);

    expect(result.vetoKind).toBe('different_species');
    expect(result.vetoReasons.join(' ')).toMatch(/depredador y presa/i);
  });

  it('bloquea perro con conejo y perro con cobaya', () => {
    for (const prey of ['rabbit', 'guinea_pig', 'rat', 'hamster', 'canary', 'budgerigar']) {
      const result = calculateAffinity(
        makePet({ speciesId: 'dog' }),
        makePet({ speciesId: prey }),
      );
      expect(result.vetoed, `perro con ${prey}`).toBe(true);
      expect(result.vetoReasons.join(' ')).toMatch(/depredador y presa/i);
    }
  });

  it('bloquea a las especies solitarias aunque sean de la misma especie', () => {
    // Llevar un gato a conocer a otro gato es estresarlo, no darle compañía.
    const result = calculateAffinity(
      makePet({ speciesId: 'cat' }),
      makePet({ speciesId: 'cat' }),
    );

    expect(result.vetoed).toBe(true);
    expect(result.vetoKind).toBe('solitary_species');
    expect(result.vetoReasons.join(' ')).toMatch(/territoriales/i);
  });

  it('el hámster sirio se bloquea por su biología, no por una limitación de la app', () => {
    const result = calculateAffinity(
      makePet({ speciesId: 'hamster' }),
      makePet({ speciesId: 'hamster' }),
    );

    expect(result.vetoKind).toBe('solitary_species');
    expect(result.vetoReasons.join(' ')).toMatch(/solitario/i);
  });

  it('sí permite evaluar a las especies que socializan', () => {
    for (const speciesId of ['dog', 'ferret', 'rabbit', 'guinea_pig', 'rat']) {
      const shape = { speciesId, size: 'medium', energyLevel: 'medium' } as const;
      const result = calculateAffinity(makePet(shape), makePet(shape));
      expect(result.vetoed, speciesId).toBe(false);
      expect(result.score, speciesId).toBeGreaterThan(0);
    }
  });

  it('una especie desconocida no se evalúa a la ligera', () => {
    const result = calculateAffinity(
      makePet({ speciesId: 'dragon' }),
      makePet({ speciesId: 'dragon' }),
    );

    expect(result.vetoed).toBe(true);
    expect(result.vetoKind).toBe('safety');
  });
});

describe('vetos de seguridad dentro de la especie', () => {
  it('bloquea una diferencia de tres tallas por riesgo de lesión', () => {
    const result = calculateAffinity(
      makePet({ size: 'mini' }),
      makePet({ size: 'giant' }),
    );

    expect(result.vetoKind).toBe('safety');
    expect(result.vetoReasons.join(' ')).toContain('tamaño');
  });

  it('respeta "solo de mi tamaño" a partir de dos escalones', () => {
    const picky = makePet({ size: 'small', trustCircle: ['same_size_only'] });

    expect(calculateAffinity(picky, makePet({ size: 'medium' })).vetoed).toBe(false);
    expect(calculateAffinity(picky, makePet({ size: 'large' })).vetoed).toBe(true);
  });

  it('aplica el veto aunque quien lo declara sea el otro', () => {
    const picky = makePet({ size: 'large', trustCircle: ['same_size_only'] });
    const other = makePet({ size: 'small' });

    expect(calculateAffinity(other, picky).vetoed).toBe(true);
    expect(calculateAffinity(picky, other).vetoed).toBe(true);
  });

  it('usa el umbral de juvenil de cada especie, no el del perro', () => {
    // Una rata es adulta a los tres meses; un perro sigue siendo cachorro al año.
    // Con un umbral único, media fauna del catálogo sería cachorro perpetuo.
    const intolerantRat = makePet({
      speciesId: 'rat',
      trustCircle: ['no_hyper_juveniles'],
    });
    const adultRat = makePet({ speciesId: 'rat', ageMonths: 4, energyLevel: 'high' });
    const juvenileRat = makePet({ speciesId: 'rat', ageMonths: 2, energyLevel: 'high' });

    expect(calculateAffinity(intolerantRat, adultRat).vetoed).toBe(false);
    expect(calculateAffinity(intolerantRat, juvenileRat).vetoed).toBe(true);

    const intolerantDog = makePet({ trustCircle: ['no_hyper_juveniles'] });
    const youngDog = makePet({ ageMonths: 8, energyLevel: 'high' });
    expect(calculateAffinity(intolerantDog, youngDog).vetoed).toBe(true);
  });

  it('el veto es sobre juveniles muy activos, no sobre cada uno por separado', () => {
    const intolerant = makePet({ trustCircle: ['no_hyper_juveniles'] });

    expect(calculateAffinity(intolerant, makePet({ ageMonths: 8, energyLevel: 'low' })).vetoed).toBe(
      false,
    );
    expect(
      calculateAffinity(intolerant, makePet({ ageMonths: 40, energyLevel: 'high' })).vetoed,
    ).toBe(false);
  });

  it('una mascota no se empareja consigo misma', () => {
    const pet = makePet();
    expect(calculateAffinity(pet, pet).vetoKind).toBe('self');
  });
});

describe('actividad — 35 puntos, el eje de mayor peso', () => {
  const withEnergy = (energyLevel: 'low' | 'medium' | 'high') =>
    makePet({ energyLevel, size: 'medium', playStyles: ['chase'] });

  it('el mismo nivel suma el peso completo', () => {
    expect(calculateAffinity(withEnergy('high'), withEnergy('high')).breakdown.energy).toBe(
      WEIGHTS.energy,
    );
  });

  it('un escalón de diferencia suma 20', () => {
    expect(calculateAffinity(withEnergy('low'), withEnergy('medium')).breakdown.energy).toBe(20);
  });

  it('tranquilo con incansable casi no suma', () => {
    expect(calculateAffinity(withEnergy('low'), withEnergy('high')).breakdown.energy).toBe(5);
  });
});

describe('estilo de juego — matriz multiespecie', () => {
  it('la matriz cubre el vocabulario completo y es simétrica', () => {
    for (const a of PLAY_STYLES) {
      for (const b of PLAY_STYLES) {
        expect(PLAY_STYLE_MATRIX[a]?.[b], `${a}×${b}`).toBeDefined();
        expect(PLAY_STYLE_MATRIX[a][b]).toBe(PLAY_STYLE_MATRIX[b][a]);
      }
    }
  });

  it('la diagonal vale uno', () => {
    for (const style of PLAY_STYLES) {
      expect(PLAY_STYLE_MATRIX[style][style]).toBe(1);
    }
  });

  it('lucha y estar juntos sin más es el par que más choca', () => {
    const values = PLAY_STYLES.flatMap((a) =>
      PLAY_STYLES.filter((b) => a !== b).map((b) => PLAY_STYLE_MATRIX[a][b]),
    );
    expect(PLAY_STYLE_MATRIX.wrestle.side_by_side).toBe(Math.min(...values));
  });

  it('acicalarse y estar juntos combinan muy bien: es como socializa un conejo', () => {
    expect(PLAY_STYLE_MATRIX.grooming.side_by_side).toBeGreaterThanOrEqual(0.7);
  });

  it('toma el máximo y no el promedio: al animal versátil no se le penaliza', () => {
    const versatile = makePet({ playStyles: [...PLAY_STYLES] });
    const chaser = makePet({ playStyles: ['chase'] });

    expect(calculateAffinity(versatile, chaser).breakdown.playStyle).toBe(WEIGHTS.playStyle);
  });

  it('sin estilo declarado puntúa neutro, no cero', () => {
    const unknown = makePet({ playStyles: [] });
    expect(calculateAffinity(unknown, makePet()).breakdown.playStyle).toBe(WEIGHTS.playStyle * 0.5);
  });

  it('cada especie declara los estilos que le aplican y todos están en la matriz', () => {
    for (const species of SPECIES) {
      for (const style of species.applicablePlayStyles) {
        expect(PLAY_STYLE_MATRIX[style], `${species.id} → ${style}`).toBeDefined();
      }
    }
  });

  it('a un conejo no se le pregunta por lucha libre', () => {
    const rabbit = findSpecies('rabbit');
    expect(rabbit?.applicablePlayStyles).not.toContain('wrestle');
    // Y a un reptil no se le pregunta nada: no juega.
    expect(findSpecies('bearded_dragon')?.applicablePlayStyles).toHaveLength(0);
  });
});

describe('tamaño y círculo de confianza', () => {
  it('el tamaño reparte 25, 18 y 8 según la distancia', () => {
    expect(calculateAffinity(makePet(), makePet()).breakdown.size).toBe(WEIGHTS.size);
    expect(
      calculateAffinity(makePet({ size: 'medium' }), makePet({ size: 'large' })).breakdown.size,
    ).toBe(18);
    expect(
      calculateAffinity(makePet({ size: 'small' }), makePet({ size: 'large' })).breakdown.size,
    ).toBe(8);
  });

  it('dos abiertos puntúan el máximo y dos tímidos el mínimo', () => {
    const open = () => makePet({ trustCircle: ['loves_everyone'] });
    const shy = () => makePet({ trustCircle: ['shy_at_first'] });

    expect(calculateAffinity(open(), open()).breakdown.trust).toBe(WEIGHTS.trust);
    expect(calculateAffinity(shy(), shy()).breakdown.trust).toBe(4);
    expect(calculateAffinity(open(), shy()).breakdown.trust).toBe(7);
  });

  it('no declarar nada no es lo mismo que ser tímido', () => {
    const undeclared = calculateAffinity(makePet(), makePet()).breakdown.trust;
    const shy = calculateAffinity(
      makePet({ trustCircle: ['shy_at_first'] }),
      makePet({ trustCircle: ['shy_at_first'] }),
    ).breakdown.trust;

    expect(undeclared).toBeGreaterThan(shy);
  });
});

describe('modificadores', () => {
  it('penaliza al tímido frente al intenso, aunque el resto encaje', () => {
    const shy = makePet({
      trustCircle: ['shy_at_first'],
      energyLevel: 'high',
      playStyles: ['wrestle'],
    });
    const rough = makePet({ energyLevel: 'high', playStyles: ['wrestle'] });

    const result = calculateAffinity(shy, rough);
    expect(result.breakdown.modifiers).toBeLessThanOrEqual(-10);
    expect(result.reasons.join(' ')).toContain('supervisión');
  });

  it('la preferencia de sexo resta pero no veta', () => {
    const picky = makePet({ trustCircle: ['prefers_females'], sex: 'female' });
    const result = calculateAffinity(picky, makePet({ sex: 'male' }));

    expect(result.vetoed).toBe(false);
    expect(result.breakdown.modifiers).toBe(-8);
  });

  it('un encuentro anterior malo resta quince', () => {
    const a = makePet();
    const b = makePet();

    expect(
      calculateAffinity(a, b).score - calculateAffinity(a, b, { hadNegativeFeedback: true }).score,
    ).toBe(15);
  });
});

describe('bandas y límites', () => {
  it('los umbrales caen del lado correcto', () => {
    expect(bandFor(BAND_THRESHOLDS.great)).toBe('great');
    expect(bandFor(BAND_THRESHOLDS.great - 1)).toBe('good');
    expect(bandFor(BAND_THRESHOLDS.good)).toBe('good');
    expect(bandFor(BAND_THRESHOLDS.good - 1)).toBe('supervised');
    expect(bandFor(BAND_THRESHOLDS.supervised)).toBe('supervised');
    expect(bandFor(BAND_THRESHOLDS.supervised - 1)).toBe('incompatible');
  });

  it('dos animales idénticos de una especie social son un gran match', () => {
    const shape = {
      speciesId: 'ferret',
      size: 'medium',
      energyLevel: 'medium',
      playStyles: ['chase'],
      trustCircle: ['loves_everyone'],
    } as const;

    const result = calculateAffinity(makePet(shape), makePet(shape));
    expect(result.score).toBe(100);
    expect(result.band).toBe('great');
  });

  it('la puntuación nunca sale de 0–100 ni con modificadores apilados', () => {
    const random = makeRandom(20260823);
    for (let i = 0; i < 400; i += 1) {
      const score = calculateAffinity(
        randomPetOfSpecies(random, `a${i}`, 'dog'),
        randomPetOfSpecies(random, `b${i}`, 'dog'),
        { hadNegativeFeedback: random() < 0.5 },
      ).score;

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(score)).toBe(true);
    }
  });
});

describe('simetría', () => {
  /**
   * La propiedad más importante de todo el algoritmo. Si A ve a B como buen
   * match y B no ve a A, el usuario percibe un fallo imposible de explicar y
   * casi imposible de diagnosticar después.
   */
  it('A→B da lo mismo que B→A sobre entradas de cualquier especie', () => {
    const random = makeRandom(1312);

    for (let i = 0; i < 1000; i += 1) {
      const a = randomPet(random, `a${i}`);
      const b = randomPet(random, `b${i}`);
      const history = { hadNegativeFeedback: random() < 0.2 };

      const forward = calculateAffinity(a, b, history);
      const backward = calculateAffinity(b, a, history);

      expect(backward.score, `asimetría entre ${a.speciesId} y ${b.speciesId}`).toBe(forward.score);
      expect(backward.vetoed).toBe(forward.vetoed);
      expect(backward.vetoKind).toBe(forward.vetoKind);
      expect(backward.band).toBe(forward.band);
    }
  });

  it('también dentro de una misma especie social', () => {
    const random = makeRandom(99);
    for (const speciesId of ['dog', 'ferret', 'rabbit', 'guinea_pig', 'rat']) {
      for (let i = 0; i < 100; i += 1) {
        const a = randomPetOfSpecies(random, `a${i}`, speciesId);
        const b = randomPetOfSpecies(random, `b${i}`, speciesId);
        expect(calculateAffinity(b, a).score).toBe(calculateAffinity(a, b).score);
      }
    }
  });
});
