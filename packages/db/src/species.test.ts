/**
 * Las reglas de especie, comprobadas en la base de datos.
 *
 * No basta con que el algoritmo del cliente las respete: un cliente móvil se
 * desensambla en cinco minutos. Lo que impide de verdad que alguien apunte un
 * hurón a una quedada de conejos es un disparador en Postgres, y estos casos
 * son la prueba de que existe.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asService, asUser, createPool, type Db } from './client.js';
import { SEED_IDS, seed } from './seed.js';

const { profiles: P, pets: A, playdates: E } = SEED_IDS;

let db: Db;

beforeAll(async () => {
  db = createPool();
  await seed(db);
}, 60_000);

afterAll(async () => {
  await db?.end();
});

describe('catálogo de especies', () => {
  it('cubre los tres modelos sociales', async () => {
    const rows = await asUser(db, null, async (client) =>
      (
        await client.query(
          'select social_model, count(*)::int as total from public.species group by 1 order by 1',
        )
      ).rows,
    );

    const models = Object.fromEntries(rows.map((row) => [row.social_model, row.total]));
    expect(models.pack).toBeGreaterThan(0);
    expect(models.small_group).toBeGreaterThan(0);
    // Si esta faltase, media aplicación sería una ficha muerta.
    expect(models.solitary).toBeGreaterThan(0);
  });

  it('es legible sin cuenta: hace falta para elegir especie al registrarse', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query('select id from public.species')).rows,
    );
    expect(rows.length).toBeGreaterThan(10);
  });

  it('ningún estado legal existe sin su fuente', async () => {
    // Un dato legal sin procedencia no debería poder guardarse: la aplicación no
    // da asesoramiento, solo repite lo que dice una norma concreta.
    const rows = await asUser(db, null, async (client) =>
      (
        await client.query(
          `select species_id from public.species_legal_status
           where source is null or length(trim(source)) = 0`,
        )
      ).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it('el perro es la única especie con modelo de manada', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query(`select id from public.species where social_model = 'pack'`)).rows,
    );
    expect(rows.map((row) => row.id)).toEqual(['dog']);
  });

  it('los umbrales de juvenil son propios de cada especie', async () => {
    const rows = await asUser(db, null, async (client) =>
      (
        await client.query(
          `select id, juvenile_until_months from public.species where id in ('dog','rat','greek_tortoise')`,
        )
      ).rows,
    );

    const months = Object.fromEntries(rows.map((row) => [row.id, row.juvenile_until_months]));
    // Una rata es adulta a los tres meses y una tortuga sigue siendo juvenil a
    // los cinco años. Un umbral único haría cachorro perpetuo a media fauna.
    expect(months.rat).toBeLessThan(months.dog);
    expect(months.greek_tortoise).toBeGreaterThan(months.dog);
  });
});

describe('especies excluidas', () => {
  it('no se puede registrar una cotorra argentina', async () => {
    // Está en el catálogo de especies exóticas invasoras: su tenencia está
    // prohibida, así que la aplicación no le abre ficha.
    await expect(
      asUser(db, P.marta, async (client) =>
        client.query(
          `insert into public.pets (owner_id, species_id, name) values ($1, 'monk_parakeet', 'Coti')`,
          [P.marta],
        ),
      ),
    ).rejects.toThrow(/excluida/i);
  });

  it('sí se puede registrar una especie pendiente del listado positivo', async () => {
    // Prohibirlo sería decidir por el usuario sobre una norma todavía en
    // desarrollo. Se registra y se muestra el aviso.
    const inserted = await asUser(db, P.sara, async (client) =>
      (
        await client.query(
          `insert into public.pets (owner_id, species_id, name) values ($1, 'bearded_dragon', 'Pogo') returning id`,
          [P.sara],
        )
      ).rowCount,
    );

    expect(inserted).toBe(1);
  });

  it('la función de registrabilidad distingue excluida de pendiente', async () => {
    const rows = await asUser(db, null, async (client) =>
      (
        await client.query(
          `select public.species_is_registrable('monk_parakeet') as parakeet,
                  public.species_is_registrable('bearded_dragon') as dragon,
                  public.species_is_registrable('dog') as dog`,
        )
      ).rows,
    );

    expect(rows[0]).toMatchObject({ parakeet: false, dragon: true, dog: true });
  });
});

describe('encuentros: solo misma especie, y solo si socializa', () => {
  it('no se puede crear una quedada de una especie solitaria', async () => {
    await expect(
      asUser(db, P.lucia, async (client) =>
        client.query(
          `insert into public.playdates
             (host_id, species_id, kind, title, point, starts_at, ends_at, public_slug)
           values ($1, 'cat', 'scheduled', 'Quedada de gatos en el parque',
             public.make_point(40.41,-3.70), now() + interval '1 day',
             now() + interval '1 day' + interval '1 hour', 'quedada-gatos')`,
          [P.lucia],
        ),
      ),
    ).rejects.toThrow(/no participa en encuentros/i);
  });

  it('no se puede apuntar un animal de otra especie a una quedada', async () => {
    // La quedada de la mañana es de perros. Un hurón no entra, y esto se
    // comprueba en la base porque es una regla de seguridad física.
    await expect(
      asUser(db, P.ines, async (client) =>
        client.query(
          `insert into public.playdate_rsvps (playdate_id, pet_id, profile_id)
           values ($1, $2, $3)`,
          [E.manana, A.lola, P.ines],
        ),
      ),
    ).rejects.toThrow(/quedada es de/i);
  });

  it('sí se puede apuntar un animal de la misma especie', async () => {
    const inserted = await asUser(db, P.pablo, async (client) =>
      (
        await client.query(
          `insert into public.playdate_rsvps (playdate_id, pet_id, profile_id)
           values ($1, $2, $3) returning pet_id`,
          [E.manana, A.bruno, P.pablo],
        )
      ).rowCount,
    );

    expect(inserted).toBe(1);
  });

  it('las especies solitarias nunca entran al descubrimiento', async () => {
    const rows = await asService(db, async (client) =>
      (
        await client.query(
          `select public.pet_is_matchable($1) as cat,
                  public.pet_is_matchable($2) as dog,
                  public.pet_is_matchable($3) as ferret`,
          [A.misi, A.nina, A.lola],
        )
      ).rows,
    );

    // El gato tiene la ficha entera: no entra porque su especie no socializa,
    // no porque le falten datos.
    expect(rows[0]).toMatchObject({ cat: false, dog: true, ferret: true });
  });
});

describe('comunidad y servicios: lo que sí tienen las especies solitarias', () => {
  it('un tutor de reptiles encuentra su comunidad sin cuenta', async () => {
    const rows = await asUser(db, null, async (client) =>
      (
        await client.query(
          `select * from public.communities_nearby(40.4168, -3.7038, 'leopard_gecko', 40000)`,
        )
      ).rows,
    );

    expect(rows.map((row) => row.species_id)).toContain('leopard_gecko');
  });

  it('las comunidades generales del barrio salen para cualquier especie', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query(`select * from public.communities_nearby(40.4168, -3.7038, 'cat', 40000)`))
        .rows,
    );

    expect(rows.length).toBeGreaterThan(0);
    // No aparecen las de otras especies concretas.
    expect(rows.every((row) => row.species_id === null || row.species_id === 'cat')).toBe(true);
  });

  it('el directorio de servicios filtra por la especie que de verdad atienden', async () => {
    const forGecko = await asUser(db, null, async (client) =>
      (
        await client.query(
          `select name from public.services_nearby(40.4168, -3.7038, 'leopard_gecko', null, 40000)`,
        )
      ).rows.map((row) => row.name),
    );

    // Mandar un gecko a una peluquería canina es peor que no tener directorio.
    expect(forGecko.join(' ')).toContain('Exóticos');
    expect(forGecko.join(' ')).not.toContain('Peluquería');
  });

  it('las urgencias salen primero: es el orden que importa con prisa', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query(`select * from public.services_nearby(40.4168, -3.7038, 'dog', null, 40000)`))
        .rows,
    );

    expect(rows[0]?.is_24h).toBe(true);
  });

  it('el directorio se consulta sin cuenta', async () => {
    // Buscar un veterinario de urgencias no debería exigir registrarse.
    const rows = await asUser(db, null, async (client) =>
      (await client.query('select id from public.services')).rows,
    );

    expect(rows.length).toBeGreaterThan(0);
  });

  it('nadie puede leer a los miembros de una comunidad a la que no pertenece', async () => {
    const rows = await asUser(db, P.marta, async (client) =>
      (
        await client.query('select profile_id from public.community_members where community_id = $1', [
          SEED_IDS.communities.reptiles,
        ])
      ).rows,
    );

    expect(rows).toHaveLength(0);
  });
});
