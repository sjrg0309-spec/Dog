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

import { findSpecies } from '@coincide/core';

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
const kira = MY_PETS[1]!;

describe('la demo enseña lo que la aplicación abre de verdad', () => {
  it('solo hay perros, porque solo se pueden registrar perros', () => {
    const species = new Set([...MY_PETS, ...OTHER_PETS].map((pet) => pet.speciesId));
    expect([...species]).toEqual(['dog']);
  });

  it('el tutor tiene dos perros a los que hoy les conviene algo distinto', () => {
    // Es el caso que hace visible la capa de bienestar, y es mucho más
    // frecuente que el de dos especies distintas.
    expect(MY_PETS).toHaveLength(2);
    expect(kira.healthFlags).toContain('brachycephalic');
    expect(nina.healthFlags ?? []).toHaveLength(0);
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

  it('el segundo perro del tutor también descubre, con su propia lista', () => {
    // No es la misma que la de Nina: Kira es pequeña, tranquila y de otro
    // carácter, así que el veto por diferencia de tamaño la deja con menos.
    const paraNina = discover(nina, MILD).entries.map((entry) => entry.pet.name);
    const paraKira = discover(kira, MILD).entries.map((entry) => entry.pet.name);

    expect(paraNina.length).toBeGreaterThan(0);
    expect(paraKira).not.toEqual(paraNina);
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
    // El filtro sigue vivo aunque hoy todos los espacios sean de perros: es lo
    // que impedirá ofrecer un patio canino para presentar conejos el día que la
    // aplicación se abra a otra especie.
    expect(spotsFor('dog').length).toBeGreaterThan(0);
    expect(spotsFor('rabbit')).toHaveLength(0);
  });
});

describe('comunidad y servicios: lo que hay además de las quedadas', () => {
  it('un tutor de perro encuentra su comunidad y la general del barrio', () => {
    const list = communitiesFor('dog');
    expect(list.some((community) => community.speciesId === 'dog')).toBe(true);
    expect(list.some((community) => community.speciesId === null)).toBe(true);
  });

  it('el directorio filtra por la especie que de verdad atienden', () => {
    // Sigue vivo aunque hoy todo el directorio sea canino: es lo que impedirá
    // mandar un gecko a una peluquería de perros el día que se abra.
    expect(servicesFor('dog').length).toBeGreaterThan(0);
    expect(servicesFor('leopard_gecko')).toHaveLength(0);
  });

  it('las urgencias salen primero: es el orden que importa con prisa', () => {
    expect(servicesFor('dog')[0]?.is24h).toBe(true);
  });

  it('toda mascota de la demo tiene algo además del descubrimiento', () => {
    for (const pet of [...MY_PETS, ...OTHER_PETS]) {
      const offer = communitiesFor(pet.speciesId).length + servicesFor(pet.speciesId).length;
      expect(offer, `${pet.name} se queda sin nada`).toBeGreaterThan(0);
      expect(petHasMeetups(pet)).toBe(true);
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

  it('a 26 grados uno de los dos perros del tutor sale y el otro no', () => {
    // Es el mismo día, el mismo barrio y la misma especie. Lo único que cambia
    // es de qué animal hablamos, y eso basta para que la respuesta sea distinta.
    const warm = { temperatureC: 26, surface: 'grass', durationMinutes: 45 } as const;

    expect(discover(nina, warm).welfare.level).toBe('ok');
    expect(discover(kira, warm).welfare.level).toBe('stop');
    expect(discover(kira, warm).entries).toEqual([]);
    // Y la lista de Nina sigue llena: no se ha vaciado la aplicación entera.
    expect(discover(nina, warm).entries.length).toBeGreaterThan(0);
  });

  it('a 18 grados los dos salen', () => {
    expect(discover(nina, MILD).welfare.level).toBe('ok');
    expect(discover(kira, MILD).welfare.level).toBe('ok');
  });

  it('el veredicto se devuelve siempre, también cuando hay lista', () => {
    // La pantalla tiene que poder decir "se puede, con cuidado" sin deducirlo de
    // que la lista no esté vacía.
    expect(discover(nina, MILD).welfare.level).toBe('ok');
    expect(discover(nina, hot).welfare.level).toBe('stop');
  });

  it('cada quedada declara sus minutos de contacto', () => {
    const list = playdatesFor('dog');
    expect(list.length).toBeGreaterThan(0);
    for (const playdate of list) {
      expect(playdate.sessionMinutes, playdate.title).toBeGreaterThan(0);
    }
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
