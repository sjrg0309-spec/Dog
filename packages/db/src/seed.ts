/**
 * Datos de semilla.
 *
 * Están construidos para que la aplicación se vea como se verá de verdad, no
 * para rellenar. En particular incluyen los dos casos que definen el producto:
 *
 *  - Un grupo que coincide de lunes a viernes a las 7:00 en el mismo parque,
 *    que es el descubrimiento por horario funcionando con la app vacía.
 *  - Dos personas que pasean pasada la medianoche. Son las que más solas
 *    pasean y las que un cálculo ingenuo dejaría fuera.
 *
 * Los identificadores son fijos para que la semilla sea reproducible y para
 * poder enlazar a una quedada concreta desde un test.
 */

import type { Db } from './client.js';

export const SEED_IDS = {
  profiles: {
    marta: '10000000-0000-4000-8000-000000000001',
    carlos: '10000000-0000-4000-8000-000000000002',
    lucia: '10000000-0000-4000-8000-000000000003',
    diego: '10000000-0000-4000-8000-000000000004',
    ines: '10000000-0000-4000-8000-000000000005',
    pablo: '10000000-0000-4000-8000-000000000006',
  },
  dogs: {
    nina: '20000000-0000-4000-8000-000000000001',
    toby: '20000000-0000-4000-8000-000000000002',
    rocky: '20000000-0000-4000-8000-000000000003',
    luna: '20000000-0000-4000-8000-000000000004',
    simba: '20000000-0000-4000-8000-000000000005',
    kira: '20000000-0000-4000-8000-000000000006',
    bruno: '20000000-0000-4000-8000-000000000007',
  },
  places: {
    central: '30000000-0000-4000-8000-000000000001',
    retiro: '30000000-0000-4000-8000-000000000002',
    dehesa: '30000000-0000-4000-8000-000000000003',
    berlin: '30000000-0000-4000-8000-000000000004',
  },
  spots: {
    patio: '40000000-0000-4000-8000-000000000001',
    finca: '40000000-0000-4000-8000-000000000002',
  },
  playdates: {
    manana: '50000000-0000-4000-8000-000000000001',
    gigantes: '50000000-0000-4000-8000-000000000002',
    nocturna: '50000000-0000-4000-8000-000000000003',
  },
} as const;

const P = SEED_IDS.profiles;
const D = SEED_IDS.dogs;
const L = SEED_IDS.places;
const S = SEED_IDS.spots;
const E = SEED_IDS.playdates;

export async function seed(db: Db): Promise<void> {
  await db.query('begin');
  try {
    await db.query(`
      truncate table
        public.booking_participants, public.spot_bookings, public.spots,
        public.playdate_feedback, public.playdate_rsvps, public.live_presence,
        public.playdates, public.geofences, public.tracker_pings,
        public.tracker_devices, public.device_tokens, public.dog_availability,
        public.dogs, public.friendships, public.places, public.profiles
      restart identity cascade;
      delete from auth.users;
    `);

    await db.query(
      `insert into auth.users (id, email) values
        ($1,'marta@example.test'), ($2,'carlos@example.test'), ($3,'lucia@example.test'),
        ($4,'diego@example.test'), ($5,'ines@example.test'), ($6,'pablo@example.test')`,
      [P.marta, P.carlos, P.lucia, P.diego, P.ines, P.pablo],
    );

    await db.query(
      `insert into public.profiles (id, display_name, contact_phone, phone_verified_at, bio) values
        ($1,'Marta R.','+34600000001', now(), 'Salgo temprano, antes de la oficina.'),
        ($2,'Carlos M.','+34600000002', now(), 'Runner con perro. Buscamos compañía a buen ritmo.'),
        ($3,'Lucía P.','+34600000003', null, 'Trabajo por turnos, paseo de noche.'),
        ($4,'Diego S.','+34600000004', now(), 'Recién llegado al barrio.'),
        ($5,'Inés L.','+34600000005', now(), 'Tengo un patio cerrado que alquilo por horas.'),
        ($6,'Pablo G.','+34600000006', null, 'Cachorro en plena socialización.')`,
      [P.marta, P.carlos, P.lucia, P.diego, P.ines, P.pablo],
    );

    await db.query(
      `insert into public.places
        (id, name, kind, point, is_fenced, has_double_gate, has_water, has_shade, has_small_dog_area)
       values
        ($1,'Parque Central','dog_park', public.make_point(40.4098,-3.6939), true, true, true, true, true),
        ($2,'Parque del Retiro','park', public.make_point(40.4153,-3.6844), false, false, true, true, false),
        ($3,'Dehesa de la Villa','park', public.make_point(40.4592,-3.7290), false, false, false, true, false),
        ($4,'Parque Berlín','dog_park', public.make_point(40.4562,-3.6764), true, false, true, false, true)`,
      [L.central, L.retiro, L.dehesa, L.berlin],
    );

    // Temperamentos elegidos para que el algoritmo produzca los tres casos que
    // la interfaz tiene que saber mostrar: gran match, match con supervisión y
    // veto por seguridad.
    await db.query(
      `insert into public.dogs
        (id, owner_id, name, breeds, birth_date, size, weight_kg, sex, is_neutered,
         energy_level, play_styles, trust_circle, is_leash_reactive, microchip_code,
         microchip_verified_at, bio)
       values
        ($1,$8,'Nina','{"Border Collie"}','2021-04-12','medium',18.5,'female',true,
          'sprinter','{chase,toys}','{loves_everyone}',false,'941000012345678', now(),
          'Le obsesiona la pelota. No para.'),
        ($2,$9,'Toby','{"Mestizo"}','2020-09-30','medium',21.0,'male',true,
          'sprinter','{chase,wrestle}','{loves_everyone}',false,'941000023456789', now(),
          'Corre con quien haga falta.'),
        ($3,$10,'Rocky','{"Galgo español"}','2019-02-08','large',28.0,'male',true,
          'explorer','{chase,calm_walk}','{shy_at_first}',true,'941000034567890', null,
          'Tímido al principio, luego no hay quien lo pare.'),
        ($4,$11,'Luna','{"Podenco"}','2022-06-21','small',9.0,'female',true,
          'explorer','{chase}','{same_size_only}',false,'941000045678901', now(),
          'Pequeña pero incansable. Mejor con perros de su talla.'),
        ($5,$12,'Simba','{"Golden Retriever"}','2018-11-03','large',32.0,'male',false,
          'couch','{calm_walk,toys}','{loves_everyone,no_hyper_puppies}',false,'941000056789012', now(),
          'Paseos tranquilos y largos. Nada de cachorros saltando encima.'),
        ($6,$13,'Kira','{"Bulldog francés"}','2023-01-17','small',11.0,'female',true,
          'couch','{toys,calm_walk}','{shy_at_first}',false,null, null,
          'Se cansa enseguida. Le va el paseo corto y la sombra.'),
        ($7,$14,'Bruno','{"Pastor alemán"}','2025-12-05','large',24.0,'male',false,
          'sprinter','{wrestle,chase}','{loves_everyone}',false,'941000078901234', null,
          'Cachorro en plena socialización. Mucha energía.')`,
      [
        D.nina, D.toby, D.rocky, D.luna, D.simba, D.kira, D.bruno,
        P.marta, P.carlos, P.diego, P.marta, P.ines, P.lucia, P.pablo,
      ],
    );

    // --- Horarios -----------------------------------------------------------
    // Grupo de la mañana: coinciden de lunes a viernes en el mismo parque. Es
    // el descubrimiento por horario funcionando sin que nadie esté conectado.
    const weekdayMorning = [1, 2, 3, 4, 5];
    for (const dogId of [D.nina, D.toby, D.rocky]) {
      for (const weekday of weekdayMorning) {
        await db.query(
          `insert into public.dog_availability (dog_id, weekday, start_time, end_time, place_id)
           values ($1,$2,'07:00','07:45',$3)`,
          [dogId, weekday, L.central],
        );
      }
    }

    // El caso que hace útil la app a cualquier hora: dos paseos que empiezan
    // antes de medianoche y terminan después.
    for (const [dogId, start, end] of [
      [D.luna, '23:00', '00:30'],
      [D.kira, '23:20', '00:10'],
    ] as const) {
      for (const weekday of [2, 4, 6]) {
        await db.query(
          `insert into public.dog_availability (dog_id, weekday, start_time, end_time, place_id)
           values ($1,$2,$3,$4,$5)`,
          [dogId, weekday, start, end, L.berlin],
        );
      }
    }

    for (const dogId of [D.simba, D.bruno]) {
      for (const weekday of [0, 6]) {
        await db.query(
          `insert into public.dog_availability (dog_id, weekday, start_time, end_time, place_id)
           values ($1,$2,'10:00','12:00',$3)`,
          [dogId, weekday, L.retiro],
        );
      }
    }

    await db.query(
      `insert into public.friendships (requester_id, addressee_id, status)
       values ($1,$2,'accepted'), ($1,$3,'accepted'), ($2,$4,'pending')`,
      [P.marta, P.carlos, P.diego, P.lucia],
    );

    // --- Espacios privados --------------------------------------------------
    await db.query(
      `insert into public.spots
        (id, host_id, title, description, point, address, size_m2, is_fenced,
         fence_height_cm, has_water, has_shade, max_dogs, price_per_slot_cents,
         slot_minutes, rules, cancellation_policy, public_slug)
       values
        ($1,$3,'Patio cercado en Chamberí',
          'Patio privado de 200 m² con valla de dos metros. Un grupo cada vez.',
          public.make_point(40.4370,-3.7038),'Calle de Ejemplo 12, Madrid',200,true,200,true,true,
          6, 4000, 120,'Traer bolsas. No dejar juguetes.','Gratis hasta 24 h antes.','patio-chamberi'),
        ($2,$3,'Finca vallada en Las Rozas',
          'Media hectárea vallada, ideal para perros que no pueden ir sueltos al parque.',
          public.make_point(40.4920,-3.8730),'Camino de Ejemplo s/n, Las Rozas',5000,true,180,true,true,
          10, 6000, 90,'Perros reactivos bienvenidos.','50 % hasta 48 h antes.','finca-las-rozas')`,
      [S.patio, S.finca, P.ines],
    );

    // --- Quedadas -----------------------------------------------------------
    await db.query(
      `insert into public.playdates
        (id, host_id, host_dog_id, kind, title, description, place_id, point,
         starts_at, ends_at, visibility, admits_sizes, admits_energy, leashed,
         max_dogs, public_slug)
       values
        ($1,$4,$7,'scheduled','Paseo de la mañana en Parque Central',
          'Salimos a las siete, como cada día. Ritmo alto: los nuestros corren.',
          $10, public.make_point(40.4098,-3.6939),
          now() + interval '1 day', now() + interval '1 day' + interval '45 minutes',
          'public','{medium,large}','{explorer,sprinter}', false, 8,'paseo-manana-central'),
        ($2,$5,$8,'scheduled','Quedada de perros gigantes en el Retiro',
          'Solo perros grandes y gigantes. Paseo tranquilo y sombra.',
          $11, public.make_point(40.4153,-3.6844),
          now() + interval '3 days', now() + interval '3 days' + interval '2 hours',
          'public','{large,giant}','{couch,explorer}', true, 12,'gigantes-retiro'),
        ($3,$6,$9,'scheduled','Caminata nocturna por Parque Berlín',
          'Para quienes paseamos cuando ya no hay nadie. Perros pequeños.',
          $12, public.make_point(40.4562,-3.6764),
          now() + interval '2 days', now() + interval '2 days' + interval '90 minutes',
          'public','{mini,small}','{couch,explorer}', false, 6,'nocturna-berlin')`,
      [
        E.manana, E.gigantes, E.nocturna,
        P.marta, P.ines, P.lucia,
        D.nina, D.simba, D.kira,
        L.central, L.retiro, L.berlin,
      ],
    );

    await db.query(
      `insert into public.playdate_rsvps (playdate_id, dog_id, profile_id, status, affinity_at_join)
       values ($1,$2,$3,'going',100), ($1,$4,$5,'going',92), ($6,$7,$8,'going',74)`,
      [E.manana, D.nina, P.marta, D.toby, P.carlos, E.gigantes, D.bruno, P.pablo],
    );

    // Una reserva en grupo ya formada, con el coste repartido por el disparador.
    const bookingId = '60000000-0000-4000-8000-000000000001';
    await db.query(
      `insert into public.spot_bookings
        (id, spot_id, organizer_id, starts_at, ends_at, total_price_cents,
         group_affinity_min, status)
       values ($1,$2,$3, now() + interval '5 days', now() + interval '5 days' + interval '2 hours',
         4000, 81, 'collecting')`,
      [bookingId, S.patio, P.marta],
    );
    await db.query(
      `insert into public.booking_participants (booking_id, dog_id, profile_id, status)
       values ($1,$2,$5,'going'), ($1,$3,$6,'going'), ($1,$4,$7,'going')`,
      [bookingId, D.nina, D.toby, D.rocky, P.marta, P.carlos, P.diego],
    );

    // --- Radar, collares y notificaciones -----------------------------------
    // Toby está paseando ahora mismo: sin esto el radar de la aplicación
    // arrancaría vacío y no se podría ver funcionando.
    await db.query(
      `insert into public.live_presence
        (dog_id, profile_id, playdate_id, place_id, point, expires_at, source)
       values
        ($1,$2,null,$3, public.make_point(40.4098,-3.6939), now() + interval '75 minutes','manual'),
        ($4,$5,null,$6, public.make_point(40.4562,-3.6764), now() + interval '40 minutes','geofence')`,
      [D.toby, P.carlos, L.central, D.kira, P.lucia, L.berlin],
    );

    // La ubicación entra sin degradar a propósito: el disparador de la tabla la
    // redondea igualmente, y un test lo comprueba.
    await db.query(
      `insert into public.device_tokens (profile_id, expo_push_token, platform, coarse_point)
       values
        ($1,'ExponentPushToken[marta-0001]','ios', public.make_point(40.40981,-3.69394)),
        ($2,'ExponentPushToken[carlos-0002]','android', public.make_point(40.41120,-3.69610)),
        ($3,'ExponentPushToken[lucia-0003]','ios', public.make_point(40.45623,-3.67641)),
        ($4,'ExponentPushToken[ines-0004]','android', public.make_point(40.49200,-3.87300))`,
      [P.marta, P.carlos, P.lucia, P.ines],
    );

    const phoneDevice = '70000000-0000-4000-8000-000000000001';
    const collarDevice = '70000000-0000-4000-8000-000000000002';
    await db.query(
      `insert into public.tracker_devices (id, dog_id, vendor, external_id, label)
       values ($1,$3,'phone','marta-iphone','Teléfono de Marta'),
              ($2,$4,'webhook','toby-collar','Collar de Toby (webhook)')`,
      [phoneDevice, collarDevice, D.nina, D.toby],
    );

    await db.query(
      `insert into public.tracker_pings (device_id, dog_id, point, accuracy_m, battery_pct, recorded_at)
       values
        ($1,$3, public.make_point(40.4099,-3.6941), 8, 82, now() - interval '20 minutes'),
        ($1,$3, public.make_point(40.4101,-3.6935), 6, 81, now() - interval '10 minutes'),
        ($2,$4, public.make_point(40.4097,-3.6940), 12, 64, now() - interval '5 minutes')`,
      [phoneDevice, collarDevice, D.nina, D.toby],
    );

    await db.query(
      `insert into public.geofences (dog_id, place_id, center, radius_m, auto_checkin)
       values ($1,$2, public.make_point(40.4098,-3.6939), 150, true)`,
      [D.nina, L.central],
    );

    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}
