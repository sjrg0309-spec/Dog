import { beforeEach, describe, expect, it } from 'vitest';

import { calculateAffinity } from './affinity.js';
import { makePet, resetPetIds } from './fixtures.js';
import { formGroup, formatCents, groupAffinity, splitCost } from './group.js';

beforeEach(resetPetIds);

describe('afinidad de grupo', () => {
  it('un grupo de menos de dos animales no tiene pareja que pueda fallar', () => {
    expect(groupAffinity([]).min).toBe(100);
    expect(groupAffinity([makePet()]).min).toBe(100);
  });

  /**
   * La decisión de diseño central del módulo, y por eso tiene su propio test:
   * un promedio alto puede esconder una pareja que arruina el paseo.
   */
  it('el titular es el mínimo, no el promedio', () => {
    const twinA = makePet({ size: 'medium', energyLevel: 'high', playStyles: ['chase'] });
    const twinB = makePet({ size: 'medium', energyLevel: 'high', playStyles: ['chase'] });
    const misfit = makePet({ size: 'medium', energyLevel: 'low', playStyles: ['calm_walk'] });

    const affinity = groupAffinity([twinA, twinB, misfit]);

    expect(affinity.min).toBeLessThan(affinity.mean);
    // El promedio sube gracias al par perfecto; el mínimo no se deja engañar.
    expect(affinity.mean).toBeGreaterThan(60);
    expect(affinity.min).toBeLessThan(60);
  });

  it('nombra el eslabón más débil para poder mostrarlo', () => {
    const twinA = makePet({ energyLevel: 'high', playStyles: ['chase'] });
    const twinB = makePet({ energyLevel: 'high', playStyles: ['chase'] });
    const misfit = makePet({ energyLevel: 'low', playStyles: ['calm_walk'] });

    const { weakestPair } = groupAffinity([twinA, twinB, misfit]);

    expect(weakestPair).not.toBeNull();
    expect([weakestPair?.a, weakestPair?.b]).toContain(misfit.id);
  });

  it('calcula todas las parejas sin repetir', () => {
    const dogs = [makePet(), makePet(), makePet(), makePet()];
    // 4 animales = 6 parejas.
    expect(groupAffinity(dogs).pairs).toHaveLength(6);
  });

  it('un solo veto invalida el grupo entero', () => {
    const mini = makePet({ size: 'mini' });
    const medium = makePet({ size: 'medium' });
    const giant = makePet({ size: 'giant' });

    const affinity = groupAffinity([mini, medium, giant]);
    expect(affinity.hasVeto).toBe(true);
    expect(affinity.min).toBe(0);
    expect(affinity.band).toBe('incompatible');
  });

  it('el historial negativo llega hasta el grupo', () => {
    const a = makePet();
    const b = makePet();

    const clean = groupAffinity([a, b]);
    const withHistory = groupAffinity([a, b], () => ({ hadNegativeFeedback: true }));

    expect(withHistory.min).toBe(clean.min - 15);
  });
});

describe('formación de grupo para un spot', () => {
  // Fábrica y no constante: `resetPetIds` corre antes de cada test, así que un
  // anfitrión creado al recolectar reciclaría su id con el primer candidato.
  const makeHost = () => makePet({ size: 'medium', energyLevel: 'medium', playStyles: ['chase'] });

  it('nunca supera el aforo, contando al anfitrión', () => {
    const host = makeHost();
    const candidates = Array.from({ length: 10 }, () =>
      makePet({ size: 'medium', energyLevel: 'medium', playStyles: ['chase'] }),
    );

    const group = formGroup(host, candidates, { maxPets: 4 });
    expect(group.pets).toHaveLength(4);
    expect(group.pets[0]).toBe(host);
  });

  it('deja fuera a los incompatibles por seguridad y explica por qué', () => {
    const compatible = makePet({ size: 'medium', energyLevel: 'medium', playStyles: ['chase'] });
    const dangerous = makePet({ size: 'giant', energyLevel: 'high', playStyles: ['wrestle'] });
    const mini = makePet({ size: 'mini' });

    const group = formGroup(mini, [compatible, dangerous], { maxPets: 6 });

    expect(group.pets.map((pet) => pet.id)).not.toContain(dangerous.id);
    expect(group.rejected.some((entry) => entry.petId === dangerous.id)).toBe(true);
    expect(group.rejected.find((entry) => entry.petId === dangerous.id)?.reason).toContain(
      'seguridad',
    );
  });

  it('respeta el umbral mínimo de afinidad', () => {
    const mediocre = makePet({ size: 'medium', energyLevel: 'low', playStyles: ['calm_walk'] });

    const permissive = formGroup(makeHost(), [mediocre], { maxPets: 4, minAffinity: 0 });
    const strict = formGroup(makeHost(), [mediocre], { maxPets: 4, minAffinity: 90 });

    expect(permissive.pets).toHaveLength(2);
    expect(strict.pets).toHaveLength(1);
    expect(strict.rejected[0]?.reason).toContain('afinidad');
  });

  it('prefiere al candidato que menos daña el mínimo', () => {
    const perfect = makePet({ size: 'medium', energyLevel: 'medium', playStyles: ['chase'] });
    const passable = makePet({ size: 'large', energyLevel: 'high', playStyles: ['toys'] });

    const group = formGroup(makeHost(), [passable, perfect], { maxPets: 2 });

    expect(group.pets[1]?.id).toBe(perfect.id);
  });

  it('el grupo resultante cumple el umbral que declara', () => {
    const candidates = [
      makePet({ size: 'medium', energyLevel: 'medium', playStyles: ['chase'] }),
      makePet({ size: 'large', energyLevel: 'medium', playStyles: ['wrestle'] }),
      makePet({ size: 'small', energyLevel: 'low', playStyles: ['calm_walk'] }),
      makePet({ size: 'medium', energyLevel: 'high', playStyles: ['chase', 'toys'] }),
    ];

    const group = formGroup(makeHost(), candidates, { maxPets: 6, minAffinity: 60 });
    expect(group.affinity.min).toBeGreaterThanOrEqual(60);
    expect(group.affinity.hasVeto).toBe(false);
  });

  it('es determinista: la misma entrada da siempre el mismo grupo', () => {
    const candidates = Array.from({ length: 6 }, (_, index) =>
      makePet({
        size: index % 2 === 0 ? 'medium' : 'large',
        energyLevel: 'medium',
        playStyles: ['chase'],
      }),
    );

    const host = makeHost();
    const first = formGroup(host, candidates, { maxPets: 4 });
    const second = formGroup(host, candidates, { maxPets: 4 });

    expect(first.pets.map((pet) => pet.id)).toEqual(second.pets.map((pet) => pet.id));
  });

  it('el anfitrión nunca se cuenta dos veces aunque venga en los candidatos', () => {
    const host = makeHost();
    const group = formGroup(host, [host, makePet()], { maxPets: 4 });
    const ids = group.pets.map((pet) => pet.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('reparto del coste — no puede perderse un céntimo', () => {
  it('reparte exacto cuando divide', () => {
    expect(splitCost(4000, 4)).toEqual([1000, 1000, 1000, 1000]);
  });

  it('reparte el resto de uno en uno y la suma cuadra', () => {
    const shares = splitCost(4000, 3);
    expect(shares).toEqual([1334, 1333, 1333]);
    expect(shares.reduce((total, share) => total + share, 0)).toBe(4000);
  });

  it('la suma cuadra para cualquier importe y número de participantes', () => {
    for (let total = 0; total <= 500; total += 7) {
      for (let people = 1; people <= 9; people += 1) {
        const shares = splitCost(total, people);
        expect(shares).toHaveLength(people);
        expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
        // Nadie paga más de un céntimo por encima de otro.
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rechaza entradas que no son céntimos enteros', () => {
    expect(() => splitCost(10.5, 2)).toThrow();
    expect(() => splitCost(-100, 2)).toThrow();
    expect(() => splitCost(1000, 0)).toThrow();
  });

  it('formatea céntimos para la interfaz', () => {
    expect(formatCents(1050)).toBe('10,50 €');
    expect(formatCents(1334)).toBe('13,34 €');
    expect(formatCents(5)).toBe('0,05 €');
    expect(formatCents(0)).toBe('0,00 €');
  });
});

describe('coherencia con el cálculo por parejas', () => {
  it('un grupo de dos coincide con la afinidad de esa pareja', () => {
    const a = makePet({ size: 'small', energyLevel: 'low' });
    const b = makePet({ size: 'medium', energyLevel: 'medium' });

    expect(groupAffinity([a, b]).min).toBe(calculateAffinity(a, b).score);
  });
});
