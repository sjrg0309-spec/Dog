/**
 * Los límites de bienestar, comprobados donde de verdad mandan.
 *
 * El cliente puede recortar una sesión de hurones a veinte minutos. Lo que
 * impide que alguien cree una de dos horas llamando a la API directamente es un
 * disparador, y estos casos son la prueba de que existe.
 *
 * También hay paridad: el techo que calcula Postgres y el que calcula
 * `packages/core` tienen que coincidir sobre las mismas mascotas. Si no
 * coincidieran, la aplicación propondría un rato y el servidor aceptaría otro,
 * y quien lo pagaría no es ninguno de los dos.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findSpecies, sessionCeilingMinutes, heatCeilingC, type HealthFlag } from '@coincide/core';

import { asService, asUser, createPool, type Db } from './client.js';
import { SEED_IDS, seed } from './seed.js';

const { profiles: P, pets: A } = SEED_IDS;

let db: Db;

beforeAll(async () => {
  db = createPool();
  await seed(db);
}, 60_000);

afterAll(async () => {
  await db?.end();
});

describe('el catálogo declara sus límites', () => {
  it('toda especie que socializa dice cuánto aguanta', async () => {
    const rows = await asUser(db, null, async (client) =>
      (
        await client.query(
          `select id from public.species
           where social_model <> 'solitary' and max_session_minutes = 0`,
        )
      ).rows,
    );
    // Una especie social sin techo es el hueco por el que se cuela una sesión
    // de cuatro horas.
    expect(rows).toHaveLength(0);
  });

  it('un hurón aguanta mucho menos seguido que un perro', async () => {
    const rows = await asUser(db, null, async (client) =>
      (
        await client.query(
          `select id, max_session_minutes from public.species where id in ('dog','ferret')`,
        )
      ).rows,
    );
    const minutes = Object.fromEntries(rows.map((row) => [row.id, row.max_session_minutes]));
    expect(minutes.ferret).toBeLessThan(minutes.dog);
  });

  it('la franja térmica de un reptil no es la de un perro', async () => {
    const rows = await asUser(db, null, async (client) =>
      (
        await client.query(
          `select id, comfort_temp_min_c, comfort_temp_max_c
           from public.species where id in ('dog','leopard_gecko')`,
        )
      ).rows,
    );
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId.leopard_gecko.comfort_temp_min_c).toBeGreaterThan(
      byId.dog.comfort_temp_min_c,
    );
  });
});

describe('la duración de una quedada la decide la especie', () => {
  it('no se puede proponer una sesión más larga de lo que aguanta', async () => {
    await expect(
      asUser(db, P.ines, async (client) =>
        client.query(
          `insert into public.playdates
             (host_id, species_id, kind, title, point, starts_at, ends_at,
              session_minutes, public_slug)
           values ($1, 'ferret', 'scheduled', 'Maratón de hurones',
             public.make_point(40.44,-3.70), now() + interval '1 day',
             now() + interval '1 day' + interval '3 hours', 120, 'maraton-hurones')`,
          [P.ines],
        ),
      ),
    ).rejects.toThrow(/demasiado seguida/i);
  });

  it('sí se puede una sesión dentro del límite, aunque el evento dure más', async () => {
    // Una tarde de dos horas con sesiones de veinte minutos y descanso es
    // exactamente como se hace bien. El esquema ya no confunde ambas cosas.
    const inserted = await asUser(db, P.ines, async (client) =>
      (
        await client.query(
          `insert into public.playdates
             (host_id, species_id, kind, title, point, starts_at, ends_at,
              session_minutes, public_slug)
           values ($1, 'ferret', 'scheduled', 'Tarde larga de hurones',
             public.make_point(40.44,-3.70), now() + interval '2 day',
             now() + interval '2 day' + interval '3 hours', 20, 'tarde-larga-hurones')
           returning id`,
          [P.ines],
        )
      ).rowCount,
    );
    expect(inserted).toBe(1);
  });

  it('subir la duración de una quedada existente también se comprueba', async () => {
    await expect(
      asUser(db, P.marta, async (client) =>
        client.query(
          `update public.playdates set session_minutes = 300 where id = $1`,
          [SEED_IDS.playdates.manana],
        ),
      ),
    ).rejects.toThrow(/demasiado seguida/i);
  });
});

describe('paridad entre Postgres y el algoritmo', () => {
  it('el techo de duración coincide para todas las mascotas de la semilla', async () => {
    const rows = await asService(db, async (client) =>
      (
        await client.query(
          `select p.id, p.species_id, p.health_flags, p.own_max_session_minutes,
                  (extract(year from age(p.birth_date)) * 12
                   + extract(month from age(p.birth_date)))::int as age_months,
                  public.pet_session_ceiling(p.id) as sql_ceiling
           from public.pets p
           join public.species s on s.id = p.species_id
           where s.social_model <> 'solitary'`,
        )
      ).rows,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const species = findSpecies(row.species_id)!;
      const ts = sessionCeilingMinutes(
        {
          speciesId: row.species_id,
          ageMonths: row.age_months,
          energyLevel: 'medium',
          healthFlags: row.health_flags as HealthFlag[],
          ownMaxSessionMinutes: row.own_max_session_minutes,
        },
        species,
      );
      expect(row.sql_ceiling, `techo de duración de ${row.id}`).toBe(ts);
    }
  });

  it('el techo térmico coincide para todas las mascotas de la semilla', async () => {
    const rows = await asService(db, async (client) =>
      (
        await client.query(
          `select p.id, p.species_id, p.health_flags, p.own_max_temp_c,
                  (extract(year from age(p.birth_date)) * 12
                   + extract(month from age(p.birth_date)))::int as age_months,
                  public.pet_heat_ceiling(p.id) as sql_ceiling
           from public.pets p where p.birth_date is not null`,
        )
      ).rows,
    );

    for (const row of rows) {
      const species = findSpecies(row.species_id)!;
      const ts = heatCeilingC(
        {
          speciesId: row.species_id,
          ageMonths: row.age_months,
          energyLevel: 'medium',
          healthFlags: row.health_flags as HealthFlag[],
          ownMaxTempC: row.own_max_temp_c,
        },
        species,
      );
      expect(row.sql_ceiling, `techo térmico de ${row.id}`).toBe(ts);
    }
  });

  it('el bulldog tiene un techo térmico más bajo que el border collie', async () => {
    // Es el caso concreto que separa una aplicación para el tutor de una para
    // el animal: el mismo día de julio no significa lo mismo para los dos.
    const rows = await asService(db, async (client) =>
      (
        await client.query(
          `select public.pet_heat_ceiling($1) as kira, public.pet_heat_ceiling($2) as nina`,
          [A.kira, A.nina],
        )
      ).rows,
    );
    expect(rows[0].kira).toBeLessThan(rows[0].nina);
  });
});

describe('disponibilidad de hoy', () => {
  it('quien está en recuperación no entra al descubrimiento de nadie', async () => {
    // El cambio y la comprobación van en la misma transacción a propósito:
    // `asService` revierte al terminar, así que la semilla queda intacta para
    // el resto de los ficheros en lugar de depender de una limpieza manual que
    // no se ejecuta si el caso falla antes.
    const rows = await asService(db, async (client) => {
      await client.query(`update public.pets set health_flags = '{recovering}' where id = $1`, [
        A.nina,
      ]);
      return (
        await client.query(
          `select public.pet_is_matchable($1) as matchable,
                  public.pet_is_available_today($1) as available`,
          [A.nina],
        )
      ).rows;
    });

    // La distinción importa: su ficha está completa y se lleva bien con todos.
    // No aparece porque hoy no le conviene, no porque sea incompatible.
    expect(rows[0]).toMatchObject({ matchable: true, available: false });
  });

  it('un cachorro sin pauta terminada tampoco', async () => {
    const rows = await asService(db, async (client) =>
      (await client.query(`select public.pet_is_available_today($1) as available`, [A.bruno])).rows,
    );
    expect(rows[0].available).toBe(false);
  });
});

describe('privacidad del bienestar', () => {
  it('la vista pública muestra el techo, no el motivo', async () => {
    const columns = await asUser(db, null, async (client) =>
      (
        await client.query(
          `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = 'public_pets'`,
        )
      ).rows.map((row) => row.column_name),
    );

    // Que una quedada dure veinte minutos es información que el grupo necesita.
    expect(columns).toContain('session_ceiling_minutes');
    // Que ese animal esté convaleciente, o en celo, es un dato de salud.
    expect(columns).not.toContain('health_flags');
  });

  it('nadie lee las circunstancias de salud del animal de otro', async () => {
    const rows = await asUser(db, P.sara, async (client) =>
      (await client.query('select health_flags from public.pets where id = $1', [A.kira])).rows,
    );
    expect(rows).toHaveLength(0);
  });
});
