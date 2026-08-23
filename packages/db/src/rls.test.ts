/**
 * RLS como test de seguridad.
 *
 * Leer las políticas y darlas por buenas no demuestra nada. Lo único que
 * demuestra que los datos de un usuario están separados de los de otro es
 * preguntárselo a la base de datos siendo ese otro usuario, que es lo que hace
 * cada caso de aquí.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asService, asUser, createPool, type Db } from './client.js';
import { SEED_IDS, seed } from './seed.js';

const { profiles: P, pets: A, spots: S, playdates: E } = SEED_IDS;

let db: Db;

beforeAll(async () => {
  db = createPool();
  await seed(db);
}, 60_000);

afterAll(async () => {
  await db?.end();
});

describe('visitante sin cuenta', () => {
  it('lee las quedadas públicas: ese enlace es como se propaga la aplicación', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query('select id, title from public.playdates')).rows,
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.id)).toContain(E.manana);
  });

  it('lee los parques, que la web indexa', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query('select id from public.places')).rows,
    );
    expect(rows.length).toBe(4);
  });

  it('no puede leer perfiles ni animales directamente', async () => {
    const { profiles, dogs } = await asUser(db, null, async (client) => ({
      profiles: (await client.query('select id from public.profiles')).rows,
      dogs: (await client.query('select id from public.pets')).rows,
    }));

    expect(profiles).toHaveLength(0);
    expect(dogs).toHaveLength(0);
  });

  it('no puede leer la tabla de espacios, solo la vista pública', async () => {
    const { table, view } = await asUser(db, null, async (client) => ({
      table: (await client.query('select id from public.spots')).rows,
      view: (await client.query('select id, approximate_point from public.public_spots')).rows,
    }));

    expect(table).toHaveLength(0);
    expect(view.length).toBeGreaterThan(0);
  });
});

describe('separación entre tutores', () => {
  it('un tutor no lee los pings del collar de otro, en ninguna consulta', async () => {
    // El caso más delicado de todo el esquema: los pings son el rastro diario
    // de una persona, no solo de su animal.
    const rows = await asUser(db, P.carlos, async (client) =>
      (await client.query('select id from public.tracker_pings where pet_id = $1', [A.nina])).rows,
    );

    expect(rows).toHaveLength(0);
  });

  it('el tutor sí lee los pings de su propio animal', async () => {
    const rows = await asUser(db, P.marta, async (client) =>
      (await client.query('select id from public.tracker_pings where pet_id = $1', [A.nina])).rows,
    );

    expect(rows.length).toBeGreaterThan(0);
  });

  it('un tutor no lee las geocercas ni los dispositivos de otro', async () => {
    const { fences, devices } = await asUser(db, P.pablo, async (client) => ({
      fences: (await client.query('select id from public.geofences')).rows,
      devices: (await client.query('select id from public.tracker_devices')).rows,
    }));

    expect(fences).toHaveLength(0);
    expect(devices).toHaveLength(0);
  });

  it('un desconocido no navega la agenda de paseo de otro', async () => {
    // Publicar el horario de paseo de alguien es publicar su rutina diaria.
    const rows = await asUser(db, P.pablo, async (client) =>
      (await client.query('select id from public.pet_availability where pet_id = $1', [A.nina]))
        .rows,
    );

    expect(rows).toHaveLength(0);
  });

  it('un amigo aceptado sí ve la agenda', async () => {
    // Marta y Carlos son amigos en la semilla.
    const rows = await asUser(db, P.carlos, async (client) =>
      (await client.query('select id from public.pet_availability where pet_id = $1', [A.nina]))
        .rows,
    );

    expect(rows.length).toBeGreaterThan(0);
  });

  it('un tutor no puede modificar el animal de otro', async () => {
    const updated = await asUser(db, P.pablo, async (client) =>
      (await client.query('update public.pets set name = $2 where id = $1 returning id', [
        A.nina,
        'Secuestrada',
      ])).rowCount,
    );

    expect(updated).toBe(0);
  });

  it('un tutor no puede cancelar la quedada de otro', async () => {
    const updated = await asUser(db, P.pablo, async (client) =>
      (await client.query(
        `update public.playdates set status = 'cancelled' where id = $1 returning id`,
        [E.manana],
      )).rowCount,
    );

    expect(updated).toBe(0);
  });

  it('un tutor no puede apuntar a la quedada un animal que no es suyo', async () => {
    await expect(
      asUser(db, P.pablo, async (client) =>
        client.query(
          `insert into public.playdate_rsvps (playdate_id, pet_id, profile_id)
           values ($1, $2, $3)`,
          [E.gigantes, A.nina, P.pablo],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe('columnas que la vista pública no debe exponer', () => {
  it('el código del chip nunca sale en public_pets, solo la insignia', async () => {
    const columns = await asService(db, async (client) =>
      (
        await client.query(
          `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = 'public_pets'`,
        )
      ).rows.map((row) => row.column_name),
    );

    // Conocer el código del chip es un paso hacia reclamar un animal ajeno.
    expect(columns).not.toContain('microchip_code');
    expect(columns).toContain('is_microchip_verified');
    // Tampoco la fecha de nacimiento exacta: la edad en meses basta.
    expect(columns).not.toContain('birth_date');
    expect(columns).toContain('age_months');
  });

  it('el teléfono no sale en public_profiles', async () => {
    const columns = await asService(db, async (client) =>
      (
        await client.query(
          `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = 'public_profiles'`,
        )
      ).rows.map((row) => row.column_name),
    );

    expect(columns).not.toContain('contact_phone');
    expect(columns).toContain('is_phone_verified');
  });

  it('la dirección exacta del espacio no sale en la vista pública', async () => {
    const columns = await asService(db, async (client) =>
      (
        await client.query(
          `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = 'public_spots'`,
        )
      ).rows.map((row) => row.column_name),
    );

    expect(columns).not.toContain('address');
    expect(columns).toContain('approximate_point');
  });

  it('quien no ha confirmado reserva no ve la dirección del espacio', async () => {
    const rows = await asUser(db, P.pablo, async (client) =>
      (await client.query('select address from public.spots where id = $1', [S.patio])).rows,
    );

    expect(rows).toHaveLength(0);
  });

  it('el anfitrión sí ve su propio espacio completo', async () => {
    const rows = await asUser(db, P.ines, async (client) =>
      (await client.query('select address from public.spots where id = $1', [S.patio])).rows,
    );

    expect(rows[0]?.address).toContain('Madrid');
  });
});

describe('coincidencia de horarios sin exponer la agenda', () => {
  it('devuelve el agregado a quien es dueño del animal', async () => {
    const rows = await asUser(db, P.marta, async (client) =>
      (await client.query('select * from public.schedule_matches($1)', [A.nina])).rows,
    );

    const toby = rows.find((row) => row.pet_id === A.toby);
    expect(toby).toBeDefined();
    // Cinco días de lunes a viernes, 45 minutos cada uno.
    expect(toby.total_minutes).toBe(225);
    expect(toby.shared_place_minutes).toBe(225);
    // Solo el agregado: ni una franja concreta.
    expect(Object.keys(toby)).toEqual(['pet_id', 'total_minutes', 'shared_place_minutes', 'days']);
  });

  it('no puede usarse como buscador de rutinas ajenas', async () => {
    await expect(
      asUser(db, P.pablo, async (client) =>
        client.query('select * from public.schedule_matches($1)', [A.nina]),
      ),
    ).rejects.toThrow(/Solo el tutor/);
  });

  it('encuentra la coincidencia de los dos paseos de medianoche', async () => {
    // Rocky sale 23:00–00:30 y Bruno 23:20–00:10, tres días por semana. Es el
    // caso que justifica todo el cálculo de cruce de medianoche, y el que un
    // cálculo ingenuo dejaría fuera.
    const rows = await asUser(db, P.diego, async (client) =>
      (await client.query('select * from public.schedule_matches($1)', [A.rocky])).rows,
    );

    const bruno = rows.find((row) => row.pet_id === A.bruno);
    expect(bruno).toBeDefined();
    expect(bruno.total_minutes).toBe(3 * 50);
  });
});

describe('el fan-out de notificaciones no es accesible desde un cliente', () => {
  it('un usuario autenticado no puede ejecutarlo', async () => {
    await expect(
      asUser(db, P.marta, async (client) =>
        client.query('select * from public.push_targets_in_radius(40.4098, -3.6939, 2000)'),
      ),
    ).rejects.toThrow(/permission denied|permiso/i);
  });

  it('el rol de servicio sí, y devuelve solo a quien está en el radio', async () => {
    const rows = await asService(db, async (client) =>
      (await client.query('select * from public.push_targets_in_radius(40.4098, -3.6939, 2000)'))
        .rows,
    );

    const tokens = rows.map((row) => row.expo_push_token);
    expect(tokens).toContain('ExponentPushToken[marta-0001]');
    expect(tokens).toContain('ExponentPushToken[carlos-0002]');
    // Inés está en Las Rozas, a más de treinta kilómetros.
    expect(tokens).not.toContain('ExponentPushToken[ines-0004]');
  });
});
