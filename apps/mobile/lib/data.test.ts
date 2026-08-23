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
  bark,
  countOutsideRadius,
  feedSnapshot,
  react,
  scopePosts,
  SEED_POSTS,
  totalReactions,
} from './posts';

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
import { MY_PETS, OTHER_PETS, PLACES } from './demo-data';
import { petFriendlyPlaces, placeAt } from './geofence';
import { SEED_POSTS as SEED_FEED, timeAgo } from './posts';

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

describe('el radar solo funciona en zonas pet-friendly', () => {
  it('dentro de un parque hay zona', () => {
    const place = placeAt({ lat: PLACES.central.lat, lng: PLACES.central.lng });
    expect(place?.name).toBe('Parque Central');
  });

  it('en casa no hay zona', () => {
    // Es el caso que define la regla: desde el portal no se puede encender el
    // radar, porque lo que se comparte es el lugar y tu portal no es un sitio al
    // que nadie pueda ir.
    expect(placeAt({ lat: 40.38, lng: -3.75 })).toBeNull();
  });

  it('justo fuera del radio tampoco', () => {
    // 250 m de radio: a medio kilómetro del centro ya no se está dentro.
    const lejos = { lat: PLACES.central.lat + 0.005, lng: PLACES.central.lng };
    expect(placeAt(lejos)).toBeNull();
  });

  it('gana la zona más pequeña que contiene el punto', () => {
    // La terraza está dentro del radio de ningún parque en la demo, pero la
    // regla se comprueba igual: si dos zonas contuvieran el punto, la respuesta
    // útil es la más específica.
    const zonas = petFriendlyPlaces();
    const laMasPequena = zonas.reduce((a, b) => (a.radiusM <= b.radiusM ? a : b));
    const place = placeAt({ lat: laMasPequena.lat, lng: laMasPequena.lng });
    expect(place?.id).toBe(laMasPequena.id);
  });

  it('todas las zonas declaran un radio razonable', () => {
    for (const place of petFriendlyPlaces()) {
      expect(place.radiusM, place.name).toBeGreaterThanOrEqual(10);
      expect(place.radiusM, place.name).toBeLessThanOrEqual(2000);
    }
  });
});

describe('publicaciones', () => {
  it('el feed trae publicaciones de varios perros', () => {
    const petIds = new Set(SEED_FEED.map((post) => post.petId));
    expect(petIds.size).toBeGreaterThan(1);
  });

  it('ninguna publicación se queda sin describir la foto', () => {
    // Una imagen sin texto alternativo no la ve todo el mundo, y esta aplicación
    // eligió su tipografía por accesibilidad: dejarlo opcional sería
    // contradecirse.
    for (const post of SEED_FEED) {
      expect(post.imageAlt.trim().length, post.petName).toBeGreaterThanOrEqual(3);
    }
  });

  it('cada publicación es de un perro que existe', () => {
    const known = new Set([...MY_PETS, ...OTHER_PETS].map((pet) => pet.id));
    for (const post of SEED_FEED) {
      expect(known.has(post.petId), `${post.petName} no está en el catálogo`).toBe(true);
    }
  });

  it('el tiempo relativo no da falsa precisión', () => {
    const now = new Date('2026-08-23T12:00:00Z');
    expect(timeAgo(new Date('2026-08-23T11:59:50Z'), now)).toBe('ahora');
    expect(timeAgo(new Date('2026-08-23T11:30:00Z'), now)).toBe('hace 30 min');
    expect(timeAgo(new Date('2026-08-23T09:00:00Z'), now)).toBe('hace 3 h');
    expect(timeAgo(new Date('2026-08-22T12:00:00Z'), now)).toBe('ayer');
    expect(timeAgo(new Date('2026-08-20T12:00:00Z'), now)).toBe('hace 3 días');
  });
});

/**
 * El feed de vecindario.
 *
 * Las dos pestañas tienen que ser distintas de verdad, no el mismo feed con dos
 * rótulos, y el radio tiene que recortar. Si alguna de las dos cosas deja de
 * cumplirse, la pantalla sigue funcionando y el producto deja de ser de barrio.
 */
describe('el alcance del feed', () => {
  const HERE = { lat: 40.4098, lng: -3.6939 };

  it('«siguiendo» solo trae a quien se sigue, y es menos que el total', () => {
    const following = scopePosts(SEED_POSTS, 'following', HERE, 5000);
    expect(following.length).toBeGreaterThan(0);
    expect(following.length).toBeLessThan(SEED_POSTS.length);
  });

  it('«cerca de mí» trae a quien no se sigue si está en el radio', () => {
    const nearby = scopePosts(SEED_POSTS, 'nearby', HERE, 5000);
    const following = new Set(
      scopePosts(SEED_POSTS, 'following', HERE, 5000).map((entry) => entry.post.id),
    );
    // Ese es el punto entero de la pestaña: enseñar el barrio, no la agenda.
    expect(nearby.some((entry) => !following.has(entry.post.id))).toBe(true);
  });

  it('el radio recorta de verdad, y lo recortado se puede contar', () => {
    const near = scopePosts(SEED_POSTS, 'nearby', HERE, 5000);
    const wide = scopePosts(SEED_POSTS, 'nearby', HERE, 10000);
    expect(wide.length).toBeGreaterThan(near.length);
    // Y el número que la pantalla enseña cuadra con lo que falta.
    expect(countOutsideRadius(SEED_POSTS, HERE, 5000)).toBe(
      SEED_POSTS.filter((post) => post.point !== null).length - near.length,
    );
  });

  it('«siguiendo» ignora el radio: se sigue a quien se sigue, esté donde esté', () => {
    expect(scopePosts(SEED_POSTS, 'following', HERE, 1).length).toBe(
      scopePosts(SEED_POSTS, 'following', HERE, 999_999).length,
    );
  });

  it('una publicación sin lugar no entra en el feed de vecindario', () => {
    const homeless = { ...SEED_POSTS[0]!, id: 'sin-lugar', point: null };
    const scoped = scopePosts([homeless], 'nearby', HERE, 999_999);
    // Sin coordenadas no se puede afirmar que esté cerca. Colarla con distancia
    // cero sería inventarse el dato más importante de la pestaña.
    expect(scoped).toHaveLength(0);
  });
});

/**
 * Las reacciones son excluyentes.
 *
 * Sin esta regla una foto podría acabar con «5 lamidos y 5 colas» de las mismas
 * cinco personas, y el número dejaría de significar nada.
 */
describe('reacciones', () => {
  it('poner una quita la anterior y los totales cuadran', () => {
    const post = SEED_POSTS.find((candidate) => candidate.myReaction === null);
    expect(post).toBeDefined();
    const before = totalReactions(post!);

    react(post!.id, 'lick');
    const afterFirst = feedSnapshot().find((p) => p.id === post!.id)!;
    expect(afterFirst.myReaction).toBe('lick');
    expect(totalReactions(afterFirst)).toBe(before + 1);

    react(post!.id, 'wag');
    const afterSwap = feedSnapshot().find((p) => p.id === post!.id)!;
    expect(afterSwap.myReaction).toBe('wag');
    // Cambiar de reacción no suma otra: sigue siendo una persona.
    expect(totalReactions(afterSwap)).toBe(before + 1);

    react(post!.id, 'wag');
    const afterRemove = feedSnapshot().find((p) => p.id === post!.id)!;
    expect(afterRemove.myReaction).toBeNull();
    expect(totalReactions(afterRemove)).toBe(before);
  });

  it('ladrar no se puede deshacer ni repetir', () => {
    const target = feedSnapshot().find((post) => !post.barkedByMe)!;
    const before = target.barkCount;

    bark(target.id);
    bark(target.id);

    const after = feedSnapshot().find((post) => post.id === target.id)!;
    // Compartir manda la publicación a gente que no la tenía. Retirarla del feed
    // de otro no está en tu mano, así que el botón no puede fingir que sí.
    expect(after.barkCount).toBe(before + 1);
    expect(after.barkedByMe).toBe(true);
  });
});
