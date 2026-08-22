import { beforeEach, describe, expect, it } from 'vitest';

import {
  BAND_THRESHOLDS,
  PLAY_STYLE_MATRIX,
  WEIGHTS,
  bandFor,
  calculateAffinity,
} from './affinity.js';
import { makeDog, makeRandom, randomDog, resetDogIds } from './fixtures.js';
import { PLAY_STYLES } from './types.js';

beforeEach(resetDogIds);

describe('vetos duros', () => {
  it('bloquea una diferencia de tres tallas por riesgo de lesión', () => {
    const mini = makeDog({ size: 'mini' });
    const giant = makeDog({ size: 'giant' });

    const result = calculateAffinity(mini, giant);

    expect(result.vetoed).toBe(true);
    expect(result.score).toBe(0);
    expect(result.band).toBe('incompatible');
    expect(result.vetoReasons.join(' ')).toContain('tamaño');
  });

  it('respeta "solo perros de mi tamaño" a partir de dos escalones', () => {
    const picky = makeDog({ size: 'small', trustCircle: ['same_size_only'] });

    // Un escalón sigue permitido: en la práctica admite al vecino de talla.
    expect(calculateAffinity(picky, makeDog({ size: 'medium' })).vetoed).toBe(false);
    expect(calculateAffinity(picky, makeDog({ size: 'large' })).vetoed).toBe(true);
  });

  it('el veto de tamaño aplica aunque quien lo declara sea el otro', () => {
    const picky = makeDog({ size: 'large', trustCircle: ['same_size_only'] });
    const other = makeDog({ size: 'small' });

    expect(calculateAffinity(other, picky).vetoed).toBe(true);
    expect(calculateAffinity(picky, other).vetoed).toBe(true);
  });

  it('bloquea cachorros de energía alta cuando el tutor lo ha declarado', () => {
    const intolerant = makeDog({ trustCircle: ['no_hyper_puppies'] });
    const hyperPuppy = makeDog({ ageMonths: 8, energyLevel: 'sprinter' });
    const calmPuppy = makeDog({ ageMonths: 8, energyLevel: 'couch' });
    const hyperAdult = makeDog({ ageMonths: 40, energyLevel: 'sprinter' });

    expect(calculateAffinity(intolerant, hyperPuppy).vetoed).toBe(true);
    // El veto es sobre cachorros hiperactivos, no sobre cachorros ni sobre
    // perros intensos por separado.
    expect(calculateAffinity(intolerant, calmPuppy).vetoed).toBe(false);
    expect(calculateAffinity(intolerant, hyperAdult).vetoed).toBe(false);
  });

  it('los doce meses son la frontera de cachorro', () => {
    const intolerant = makeDog({ trustCircle: ['no_hyper_puppies'] });

    expect(
      calculateAffinity(intolerant, makeDog({ ageMonths: 11, energyLevel: 'sprinter' })).vetoed,
    ).toBe(true);
    expect(
      calculateAffinity(intolerant, makeDog({ ageMonths: 12, energyLevel: 'sprinter' })).vetoed,
    ).toBe(false);
  });

  it('un veto no se compensa aunque todo lo demás encaje perfectamente', () => {
    const base = { energyLevel: 'explorer', playStyles: ['chase'], trustCircle: [] } as const;
    const mini = makeDog({ ...base, size: 'mini' });
    const giant = makeDog({ ...base, size: 'giant' });

    expect(calculateAffinity(mini, giant).score).toBe(0);
  });

  it('un perro no se empareja consigo mismo', () => {
    const dog = makeDog();
    expect(calculateAffinity(dog, dog).vetoed).toBe(true);
  });
});

describe('batería — 35 puntos, el eje de mayor peso', () => {
  const withEnergy = (energyLevel: 'couch' | 'explorer' | 'sprinter') =>
    makeDog({ energyLevel, size: 'medium', playStyles: ['chase'] });

  it('misma energía suma el peso completo', () => {
    const result = calculateAffinity(withEnergy('sprinter'), withEnergy('sprinter'));
    expect(result.breakdown.energy).toBe(WEIGHTS.energy);
  });

  it('un escalón de diferencia suma 20', () => {
    expect(calculateAffinity(withEnergy('couch'), withEnergy('explorer')).breakdown.energy).toBe(20);
  });

  it('sofá con velocista casi no suma: es el peor emparejamiento del producto', () => {
    expect(calculateAffinity(withEnergy('couch'), withEnergy('sprinter')).breakdown.energy).toBe(5);
  });
});

describe('estilo de juego — matriz, no coincidencia exacta', () => {
  it('la matriz es simétrica', () => {
    for (const a of PLAY_STYLES) {
      for (const b of PLAY_STYLES) {
        expect(PLAY_STYLE_MATRIX[a][b]).toBe(PLAY_STYLE_MATRIX[b][a]);
      }
    }
  });

  it('la diagonal vale uno', () => {
    for (const style of PLAY_STYLES) {
      expect(PLAY_STYLE_MATRIX[style][style]).toBe(1);
    }
  });

  it('lucha libre y caminata tranquila es el par que más choca', () => {
    const values = PLAY_STYLES.flatMap((a) =>
      PLAY_STYLES.filter((b) => a !== b).map((b) => PLAY_STYLE_MATRIX[a][b]),
    );
    expect(PLAY_STYLE_MATRIX.wrestle.calm_walk).toBe(Math.min(...values));
  });

  it('toma el máximo y no el promedio: al perro versátil no se le penaliza', () => {
    const versatile = makeDog({ playStyles: ['chase', 'wrestle', 'toys', 'calm_walk'] });
    const chaser = makeDog({ playStyles: ['chase'] });

    // Si se promediara, el versátil saldría peor que el especialista idéntico,
    // que es exactamente lo contrario de lo que debe pasar.
    expect(calculateAffinity(versatile, chaser).breakdown.playStyle).toBe(WEIGHTS.playStyle);
  });

  it('sin estilo declarado puntúa neutro, no cero', () => {
    const unknown = makeDog({ playStyles: [] });
    const chaser = makeDog({ playStyles: ['chase'] });

    expect(calculateAffinity(unknown, chaser).breakdown.playStyle).toBe(WEIGHTS.playStyle * 0.5);
  });
});

describe('tamaño — 25 puntos', () => {
  it('mismo tamaño suma el peso completo y un escalón suma 18', () => {
    expect(
      calculateAffinity(makeDog({ size: 'medium' }), makeDog({ size: 'medium' })).breakdown.size,
    ).toBe(WEIGHTS.size);
    expect(
      calculateAffinity(makeDog({ size: 'medium' }), makeDog({ size: 'large' })).breakdown.size,
    ).toBe(18);
    expect(
      calculateAffinity(makeDog({ size: 'small' }), makeDog({ size: 'large' })).breakdown.size,
    ).toBe(8);
  });
});

describe('círculo de confianza — 10 puntos', () => {
  it('dos abiertos puntúan el máximo y dos tímidos el mínimo', () => {
    const open = () => makeDog({ trustCircle: ['loves_everyone'] });
    const shy = () => makeDog({ trustCircle: ['shy_at_first'] });

    expect(calculateAffinity(open(), open()).breakdown.trust).toBe(WEIGHTS.trust);
    expect(calculateAffinity(shy(), shy()).breakdown.trust).toBe(4);
    expect(calculateAffinity(open(), shy()).breakdown.trust).toBe(7);
  });

  it('no declarar nada no es lo mismo que ser tímido', () => {
    const undeclared = makeDog({ trustCircle: [] });
    const shy = makeDog({ trustCircle: ['shy_at_first'] });

    const undeclaredPair = calculateAffinity(undeclared, makeDog({ trustCircle: [] }));
    const shyPair = calculateAffinity(shy, makeDog({ trustCircle: ['shy_at_first'] }));

    expect(undeclaredPair.breakdown.trust).toBeGreaterThan(shyPair.breakdown.trust);
  });
});

describe('modificadores', () => {
  it('penaliza al tímido frente al intenso, aunque el resto encaje', () => {
    const shy = makeDog({
      trustCircle: ['shy_at_first'],
      energyLevel: 'sprinter',
      playStyles: ['wrestle'],
    });
    const bruiser = makeDog({ energyLevel: 'sprinter', playStyles: ['wrestle'] });

    const result = calculateAffinity(shy, bruiser);
    expect(result.breakdown.modifiers).toBeLessThanOrEqual(-10);
    expect(result.reasons.join(' ')).toContain('supervisión');
  });

  it('la preferencia de sexo resta pero no veta', () => {
    const picky = makeDog({ trustCircle: ['prefers_females'], sex: 'female' });
    const male = makeDog({ sex: 'male' });

    const result = calculateAffinity(picky, male);
    expect(result.vetoed).toBe(false);
    expect(result.breakdown.modifiers).toBe(-8);
  });

  it('un encuentro anterior malo resta quince', () => {
    const a = makeDog();
    const b = makeDog();

    const neutral = calculateAffinity(a, b);
    const afterBadMeeting = calculateAffinity(a, b, { hadNegativeFeedback: true });

    expect(neutral.score - afterBadMeeting.score).toBe(15);
    expect(afterBadMeeting.reasons.join(' ')).toContain('no fue bien');
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

  it('dos perros idénticos son un gran match', () => {
    const shape = {
      size: 'medium',
      energyLevel: 'explorer',
      playStyles: ['chase'],
      trustCircle: ['loves_everyone'],
    } as const;

    const result = calculateAffinity(makeDog(shape), makeDog(shape));
    expect(result.score).toBe(100);
    expect(result.band).toBe('great');
  });

  it('la puntuación nunca sale de 0–100 ni con modificadores apilados', () => {
    const random = makeRandom(20260822);
    for (let i = 0; i < 400; i += 1) {
      const a = randomDog(random, `a${i}`);
      const b = randomDog(random, `b${i}`);
      const score = calculateAffinity(a, b, { hadNegativeFeedback: random() < 0.5 }).score;
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
  it('A→B da lo mismo que B→A sobre entradas generadas', () => {
    const random = makeRandom(1312);

    for (let i = 0; i < 1000; i += 1) {
      const a = randomDog(random, `a${i}`);
      const b = randomDog(random, `b${i}`);
      const history = { hadNegativeFeedback: random() < 0.2 };

      const forward = calculateAffinity(a, b, history);
      const backward = calculateAffinity(b, a, history);

      expect(backward.score, `asimetría entre ${JSON.stringify(a)} y ${JSON.stringify(b)}`).toBe(
        forward.score,
      );
      expect(backward.vetoed).toBe(forward.vetoed);
      expect(backward.band).toBe(forward.band);
    }
  });
});
