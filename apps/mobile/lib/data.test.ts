/**
 * La capa de datos del móvil, comprobada.
 *
 * No prueba el algoritmo —eso ya lo hacen los 104 casos de `@coincide/core`—,
 * sino las decisiones de producto que viven aquí y que ningún otro paquete
 * conoce: que una especie solitaria no entra al descubrimiento, que el radar no
 * enseña animales de otra especie, y que los tutores de esas especies sí tienen
 * comunidad y servicios.
 *
 * Es justo la capa donde una regresión no rompe nada visible y aparece como una
 * quedada de conejos con un hurón dentro.
 */

import { describe, expect, it } from 'vitest';

import {
  communitiesFor,
  discover,
  petById,
  petHasMeetups,
  playdatesFor,
  servicesFor,
  speciesOf,
  spotsFor,
  walkingNow,
} from './data';
import { MY_PETS, OTHER_PETS } from './demo-data';

const nina = MY_PETS[0]!;
const misi = MY_PETS[1]!;

describe('la demo cubre los tres modelos sociales', () => {
  it('tiene animales de manada, de grupo pequeño y solitarios', () => {
    const models = new Set([...MY_PETS, ...OTHER_PETS].map((pet) => pet.speciesId));
    expect(models).toContain('dog');
    expect(models).toContain('ferret');
    expect(models).toContain('rabbit');
    // Si estas faltaran, sería facilísimo construir pantallas que solo
    // funcionan para perros sin que nadie se diera cuenta.
    expect(models).toContain('cat');
    expect(models).toContain('leopard_gecko');
  });

  it('cada mascota de la demo existe en el catálogo de especies', () => {
    for (const pet of [...MY_PETS, ...OTHER_PETS]) {
      // Una especie inventada en la demo se colaría en la interfaz como un
      // identificador en bruto, y nadie lo vería hasta la captura de pantalla.
      expect(speciesOf(pet), `${pet.name} usa una especie que no existe`).not.toBeNull();
      expect(petById(pet.id)).not.toBeNull();
    }
  });
});

describe('descubrimiento', () => {
  it('una perra ve solo perros', () => {
    const { entries } = discover(nina);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.pet.speciesId === 'dog')).toBe(true);
  });

  it('una gata no descubre a nadie, y no por falta de datos', () => {
    const { entries, otherSpeciesNearby } = discover(misi);
    expect(entries).toHaveLength(0);
    // La ficha de Misi está completa: tiene talla, energía, estilos y confianza.
    expect(misi.size).toBeTruthy();
    expect(petHasMeetups(misi)).toBe(false);
    // Y hay animales cerca: el vacío es de su especie, no del barrio.
    expect(otherSpeciesNearby).toBeGreaterThan(0);
  });

  it('los de otra especie se cuentan aparte de los vetados por seguridad', () => {
    const { safetyVetoed, otherSpeciesNearby } = discover(nina);
    const dogs = OTHER_PETS.filter((pet) => pet.speciesId === 'dog').length;

    expect(otherSpeciesNearby).toBe(OTHER_PETS.length - dogs);
    // Un veto de seguridad es una decisión sobre este par concreto; ser de otra
    // especie no lo es. Sumarlos daría un número que no significa nada.
    expect(safetyVetoed).toBeLessThanOrEqual(dogs);
  });

  it('nadie se descubre a sí mismo', () => {
    const { entries } = discover(nina);
    expect(entries.some((entry) => entry.pet.id === nina.id)).toBe(false);
  });
});

describe('radar', () => {
  it('solo enseña animales de la misma especie', () => {
    const out = walkingNow('dog');
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((pet) => pet.speciesId === 'dog')).toBe(true);
  });

  it('para una especie solitaria no hay nadie fuera', () => {
    // Enseñarle a un tutor de gato que hay otro gato a doscientos metros no es
    // una oportunidad: es un encuentro que no debería ocurrir.
    expect(walkingNow('cat')).toHaveLength(0);
  });
});

describe('quedadas y espacios', () => {
  it('cada quedada es de una sola especie', () => {
    for (const speciesId of ['dog', 'ferret', 'rabbit']) {
      const list = playdatesFor(speciesId);
      expect(list.every((playdate) => playdate.speciesId === speciesId)).toBe(true);
    }
  });

  it('no hay ninguna quedada de una especie que no socializa', () => {
    expect(playdatesFor('cat')).toHaveLength(0);
    expect(playdatesFor('leopard_gecko')).toHaveLength(0);
  });

  it('un espacio declara a qué especies sirve', () => {
    // Un patio pensado para perros no es sitio para presentar conejos.
    expect(spotsFor('dog').map((spot) => spot.id)).not.toEqual(
      spotsFor('rabbit').map((spot) => spot.id),
    );
    expect(spotsFor('rabbit').length).toBeGreaterThan(0);
  });
});

describe('comunidad y servicios: lo que sí tienen las especies solitarias', () => {
  it('un tutor de gecko encuentra su comunidad y la general del barrio', () => {
    const list = communitiesFor('leopard_gecko');
    expect(list.some((community) => community.speciesId === 'leopard_gecko')).toBe(true);
    expect(list.some((community) => community.speciesId === null)).toBe(true);
    // Y no ve las de otras especies concretas.
    expect(
      list.every(
        (community) =>
          community.speciesId === null || community.speciesId === 'leopard_gecko',
      ),
    ).toBe(true);
  });

  it('el directorio filtra por la especie que de verdad atienden', () => {
    const forGecko = servicesFor('leopard_gecko').map((service) => service.name);
    // Mandar un gecko a una peluquería canina es peor que no tener directorio.
    expect(forGecko.join(' ')).toContain('Exóticos');
    expect(forGecko.join(' ')).not.toContain('Peluquería');
  });

  it('las urgencias salen primero: es el orden que importa con prisa', () => {
    expect(servicesFor('dog')[0]?.is24h).toBe(true);
  });

  it('toda especie solitaria tiene algo que ofrecer a su tutor', () => {
    for (const pet of [...MY_PETS, ...OTHER_PETS].filter((entry) => !petHasMeetups(entry))) {
      const offer = communitiesFor(pet.speciesId).length + servicesFor(pet.speciesId).length;
      // Si esto fallara, esa especie tendría una ficha bonita y ningún motivo
      // para volver a abrir la aplicación.
      expect(offer, `${pet.name} (${pet.speciesId}) se queda sin nada`).toBeGreaterThan(0);
    }
  });
});
