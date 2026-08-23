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

import { findSpecies, type Conditions } from '@coincide/core';

import {
  allPlaydates,
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

/** Un día templado en hierba: condiciones en las que nada debería impedir salir. */
const MILD = { temperatureC: 18, surface: 'grass', durationMinutes: 45 } as const;

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
    const { entries } = discover(nina, MILD);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.pet.speciesId === 'dog')).toBe(true);
  });

  it('una gata no descubre a nadie, y no por falta de datos', () => {
    const { entries, otherSpeciesNearby } = discover(misi, MILD);
    expect(entries).toHaveLength(0);
    // La ficha de Misi está completa: tiene talla, energía, estilos y confianza.
    expect(misi.size).toBeTruthy();
    expect(petHasMeetups(misi)).toBe(false);
    // Y hay animales cerca: el vacío es de su especie, no del barrio.
    expect(otherSpeciesNearby).toBeGreaterThan(0);
  });

  it('los de otra especie se cuentan aparte de los vetados por seguridad', () => {
    const { safetyVetoed, otherSpeciesNearby } = discover(nina, MILD);
    const dogs = OTHER_PETS.filter((pet) => pet.speciesId === 'dog').length;

    expect(otherSpeciesNearby).toBe(OTHER_PETS.length - dogs);
    // Un veto de seguridad es una decisión sobre este par concreto; ser de otra
    // especie no lo es. Sumarlos daría un número que no significa nada.
    expect(safetyVetoed).toBeLessThanOrEqual(dogs);
  });

  it('nadie se descubre a sí mismo', () => {
    const { entries } = discover(nina, MILD);
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

describe('el interés del animal manda sobre el plan del tutor', () => {
  const hot = { temperatureC: 34, surface: 'grass', durationMinutes: 45 } as const;
  const asphalt = { temperatureC: 29, surface: 'asphalt', durationMinutes: 45 } as const;

  it('a 34 grados no se propone a nadie, y el estado vacío lo dice', () => {
    const { entries, emptyReason } = discover(nina, hot);
    // Ni una tarjeta con un aviso encima: ninguna tarjeta.
    expect(entries).toEqual([]);
    expect(emptyReason).toBe('welfare_stop');
  });

  it('el asfalto caliente para la lista aunque el aire no llegue al techo', () => {
    expect(discover(nina, asphalt).entries).toEqual([]);
  });

  it('un día templado sí devuelve candidatos', () => {
    expect(discover(nina, MILD).entries.length).toBeGreaterThan(0);
  });

  it('el bulldog deja de aparecer antes que los demás perros', () => {
    // 25 grados es un día de verano corriente. Para Nina no cambia nada; para
    // Kira, que es de hocico chato, es el punto en el que deja de convenirle.
    const warm = { temperatureC: 25, surface: 'grass', durationMinutes: 45 } as const;
    const names = (conditions: Conditions) =>
      discover(nina, conditions).entries.map((entry) => entry.pet.name);

    expect(names(MILD)).toContain('Kira');
    expect(names(warm)).not.toContain('Kira');
    // Y el resto sigue ahí: no se ha vaciado la lista, se ha quitado a quien no
    // debía estar en ella.
    expect(names(warm).length).toBeGreaterThan(0);
  });

  it('quien descansa se cuenta aparte de quien no encaja', () => {
    const warm = { temperatureC: 25, surface: 'grass', durationMinutes: 45 } as const;
    const { restingNearby } = discover(nina, warm);
    expect(restingNearby).toBeGreaterThan(0);
  });

  it('el veredicto se devuelve siempre, también cuando hay lista', () => {
    // La pantalla tiene que poder decir "se puede, con cuidado" sin deducirlo de
    // que la lista no esté vacía.
    expect(discover(nina, MILD).welfare.level).toBe('ok');
    expect(discover(nina, hot).welfare.level).toBe('stop');
  });

  it('una tarde de hurones se propone en sesiones, no de una vez', () => {
    const tarde = playdatesFor('ferret')[0];
    expect(tarde).toBeDefined();
    // Dos horas de evento, veinte minutos de contacto.
    expect(tarde!.sessionMinutes).toBeLessThanOrEqual(20);
    expect(tarde!.endsAt.getTime() - tarde!.startsAt.getTime()).toBeGreaterThan(
      tarde!.sessionMinutes * 60_000,
    );
  });

  it('ninguna quedada propone más contacto del que aguanta su especie', () => {
    for (const playdate of allPlaydates()) {
      const species = findSpecies(playdate.speciesId)!;
      expect(
        playdate.sessionMinutes,
        `${playdate.title} propone más de lo que aguanta un ${species.commonName.toLowerCase()}`,
      ).toBeLessThanOrEqual(species.care.maxSessionMinutes);
    }
  });
});
