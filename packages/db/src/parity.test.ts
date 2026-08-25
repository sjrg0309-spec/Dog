/**
 * Paridad entre el cálculo del servidor y el del cliente.
 *
 * Dos implementaciones de la misma regla acaban divergiendo salvo que algo lo
 * impida. Estos tests son ese algo: comparan SQL y TypeScript sobre las mismas
 * entradas, para que la aplicación no pueda dar una respuesta y la base otra a
 * la misma pregunta.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { scheduleOverlap, splitCost, toWeeklyIntervals } from '@petnav/core';
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

describe('proyección de franjas horarias', () => {
  const cases = [
    { weekday: 1, startTime: '07:00', endTime: '08:00', label: 'franja normal' },
    { weekday: 1, startTime: '23:30', endTime: '00:30', label: 'cruce de medianoche' },
    { weekday: 6, startTime: '23:00', endTime: '01:00', label: 'envoltura de la semana' },
    { weekday: 0, startTime: '00:00', endTime: '23:59', label: 'día casi completo' },
    { weekday: 3, startTime: '13:15', endTime: '13:45', label: 'media hora suelta' },
  ];

  it.each(cases)('SQL y TypeScript coinciden: $label', async (input) => {
    const fromSql = await asService(db, async (client) =>
      (
        await client.query(
          'select interval_start, interval_end from public.availability_intervals($1, $2, $3)',
          [input.weekday, input.startTime, input.endTime],
        )
      ).rows.map((row) => ({ start: row.interval_start, end: row.interval_end })),
    );

    const fromTypeScript = toWeeklyIntervals({
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
    }).map(({ start, end }) => ({ start, end }));

    const sort = <T extends { start: number }>(items: T[]) =>
      [...items].sort((a, b) => a.start - b.start);

    expect(sort(fromSql)).toEqual(sort(fromTypeScript));
  });
});

describe('solapamiento de agendas', () => {
  it('SQL y TypeScript dan los mismos minutos para el grupo de la mañana', async () => {
    const [sql] = await asService(db, async (client) =>
      (await client.query('select * from public.schedule_overlap_minutes($1, $2)', [A.nina, A.toby]))
        .rows,
    );

    const weekdayMorning = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      startTime: '07:00',
      endTime: '07:45',
      placeId: SEED_IDS.places.central,
    }));
    const typescript = scheduleOverlap(weekdayMorning, weekdayMorning);

    expect(sql.total_minutes).toBe(typescript.totalMinutes);
    expect(sql.shared_place_minutes).toBe(typescript.sharedPlaceMinutes);
    expect([...sql.days].sort()).toEqual(typescript.days);
  });

  it('SQL y TypeScript coinciden también cruzando medianoche', async () => {
    // Rocky 23:00–00:30 y Bruno 23:20–00:10, tres días por semana. Si el
    // servidor y el cliente discrepasen aquí, la aplicación diría una cosa y la
    // base otra sobre la misma pregunta.
    const [sql] = await asService(db, async (client) =>
      (await client.query('select * from public.schedule_overlap_minutes($1, $2)', [
        A.rocky,
        A.bruno,
      ])).rows,
    );

    const nightly = (startTime: string, endTime: string) =>
      [2, 4, 6].map((weekday) => ({ weekday, startTime, endTime, placeId: SEED_IDS.places.berlin }));

    expect(sql.total_minutes).toBe(
      scheduleOverlap(nightly('23:00', '00:30'), nightly('23:20', '00:10')).totalMinutes,
    );
  });
});

describe('reparto del coste', () => {
  it('el disparador reparte igual que el cliente y la suma cuadra', async () => {
    for (const [total, people] of [
      [4000, 3],
      [1000, 7],
      [999, 4],
      [100, 1],
    ] as const) {
      const shares = await asService(db, async (client) => {
        const { rows } = await client.query(
          `insert into public.spot_bookings
             (spot_id, organizer_id, starts_at, ends_at, total_price_cents)
           values ($1, $2, now() + interval '9 days', now() + interval '9 days' + interval '1 hour', $3)
           returning id`,
          [SEED_IDS.spots.patio, P.marta, total],
        );
        const bookingId = rows[0].id;

        // Los participantes se crean aquí en lugar de tomarse de la semilla.
        // Antes se hacía con `Object.values(A).slice(0, people)`, así que el
        // caso de siete personas dependía de que la semilla tuviera al menos
        // siete mascotas: al reducirla a cinco perros, el reparto que se
        // comprobaba dejó de ser el que decía el nombre del caso. El número de
        // participantes es del test, no de la semilla.
        const petIds: string[] = [];
        for (let index = 0; index < people; index += 1) {
          const pet = await client.query(
            `insert into public.pets (owner_id, species_id, name)
             values ($1, 'dog', $2) returning id`,
            [P.marta, `Reparto ${total}-${index}`],
          );
          petIds.push(pet.rows[0].id);
        }
        for (const petId of petIds) {
          await client.query(
            `insert into public.booking_participants (booking_id, pet_id, profile_id)
             values ($1, $2, $3)`,
            [bookingId, petId, P.marta],
          );
        }

        return (
          await client.query(
            'select share_cents from public.booking_participants where booking_id = $1 order by pet_id',
            [bookingId],
          )
        ).rows.map((row) => row.share_cents);
      });

      expect(shares).toEqual(splitCost(total, people));
      expect(shares.reduce((sum: number, share: number) => sum + share, 0)).toBe(total);
    }
  });
});

describe('consultas geoespaciales', () => {
  it('el radar solo devuelve a quien está dentro del radio', async () => {
    const near = await asUser(db, P.marta, async (client) =>
      (await client.query('select * from public.presence_nearby(40.4098, -3.6939, 2000)')).rows,
    );

    // Toby está en Parque Central; Kira, a seis kilómetros en Parque Berlín.
    //
    // Aquí decía `A.canela`, que no existe en la semilla: era `undefined`, y
    // `not.toContain(undefined)` se cumple siempre. El test pasaba sin
    // comprobar la mitad que le da sentido —que el radio deja fuera a alguien—.
    expect(near.map((row) => row.pet_id)).toContain(A.toby);
    expect(near.map((row) => row.pet_id)).not.toContain(A.kira);
  });

  it('una presencia caducada desaparece del radar en el acto', async () => {
    const visible = await asService(db, async (client) => {
      await client.query(
        `update public.live_presence
           set last_seen_at = now() - interval '2 hours',
               expires_at = now() - interval '1 minute'
         where pet_id = $1`,
        [A.toby],
      );
      return (await client.query('select * from public.presence_nearby(40.4098, -3.6939, 2000)'))
        .rows;
    });

    expect(visible.map((row) => row.pet_id)).not.toContain(A.toby);
  });

  it('la ubicación de los tokens se guarda degradada, la escriba quien la escriba', async () => {
    // La garantía no depende de que el cliente se acuerde de redondear.
    const [row] = await asService(db, async (client) => {
      await client.query(
        `insert into public.device_tokens (profile_id, expo_push_token, platform, coarse_point)
         values ($1, 'ExponentPushToken[parity-test]', 'ios', public.make_point(40.412345, -3.698765))`,
        [P.marta],
      );
      return (
        await client.query(
          `select extensions.st_y(coarse_point::extensions.geometry) as lat,
                  extensions.st_x(coarse_point::extensions.geometry) as lng
             from public.device_tokens where expo_push_token = 'ExponentPushToken[parity-test]'`,
        )
      ).rows;
    });

    expect(row.lat).toBeCloseTo(40.41, 6);
    expect(row.lng).toBeCloseTo(-3.7, 6);
  });

  it('los parques cercanos salen ordenados por distancia', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query('select * from public.places_nearby(40.4098, -3.6939, 10000)')).rows,
    );

    const distances = rows.map((row) => row.distance_m);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(rows[0]?.name).toBe('Parque Central');
  });
});

describe('cumpleaños', () => {
  it('encuentra a los animales que cumplen dentro del plazo', async () => {
    const rows = await asService(db, async (client) => {
      // Se mueve la fecha de nacimiento de Nina a dentro de tres días,
      // conservando el año, para no depender de la fecha real de ejecución.
      await client.query(
        `update public.pets
           set birth_date = make_date(
             2021,
             extract(month from current_date + 3)::int,
             extract(day from current_date + 3)::int
           )
         where id = $1`,
        [A.nina],
      );
      return (await client.query('select * from public.pets_with_birthday(7)')).rows;
    });

    expect(rows.map((row) => row.pet_id)).toContain(A.nina);
  });
});
