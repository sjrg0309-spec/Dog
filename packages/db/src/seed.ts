/**
 * Datos de semilla.
 *
 * Están construidos para que la aplicación se vea como se verá de verdad, no
 * para rellenar. Cubren a propósito los tres modelos sociales, porque si la
 * semilla fuese solo de perros el resto del catálogo quedaría sin probar y sin
 * mirar:
 *
 *  - `pack`        Tres perros que coinciden de lunes a viernes a las 7:00 en el
 *                  mismo parque. Es el descubrimiento por horario funcionando
 *                  con la aplicación vacía.
 *  - `small_group` Dos hurones y dos conejos, con sus quedadas propias: sesiones
 *                  cortas en terreno neutral, no sueltas de parque.
 *  - `solitary`    Un gato, un gecko y un betta. No tienen encuentros, y tienen
 *                  comunidad, veterinarios especializados y lugares que los
 *                  admiten. Sin esto, media aplicación sería una ficha muerta.
 *
 * Y dos personas que pasean pasada la medianoche, que son las que más solas
 * pasean y las que un cálculo ingenuo dejaría fuera.
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
    sara: '10000000-0000-4000-8000-000000000007',
    alvaro: '10000000-0000-4000-8000-000000000008',
  },
  pets: {
    nina: '20000000-0000-4000-8000-000000000001',
    toby: '20000000-0000-4000-8000-000000000002',
    rocky: '20000000-0000-4000-8000-000000000003',
    bruno: '20000000-0000-4000-8000-000000000004',
    /** Bulldog francés: el animal al que los límites de bienestar le afectan. */
    kira: '20000000-0000-4000-8000-00000000000c',
    // Hurones
    lola: '20000000-0000-4000-8000-000000000005',
    pipo: '20000000-0000-4000-8000-000000000006',
    // Conejos
    trufa: '20000000-0000-4000-8000-000000000007',
    canela: '20000000-0000-4000-8000-000000000008',
    // Solitarias
    misi: '20000000-0000-4000-8000-000000000009',
    kiwi: '20000000-0000-4000-8000-00000000000a',
    azul: '20000000-0000-4000-8000-00000000000b',
  },
  places: {
    central: '30000000-0000-4000-8000-000000000001',
    retiro: '30000000-0000-4000-8000-000000000002',
    berlin: '30000000-0000-4000-8000-000000000003',
    cafe: '30000000-0000-4000-8000-000000000004',
  },
  spots: {
    patio: '40000000-0000-4000-8000-000000000001',
    sala: '40000000-0000-4000-8000-000000000002',
  },
  playdates: {
    manana: '50000000-0000-4000-8000-000000000001',
    hurones: '50000000-0000-4000-8000-000000000002',
    conejos: '50000000-0000-4000-8000-000000000003',
    nocturna: '50000000-0000-4000-8000-000000000004',
  },
  communities: {
    reptiles: '80000000-0000-4000-8000-000000000001',
    gatos: '80000000-0000-4000-8000-000000000002',
    conejos: '80000000-0000-4000-8000-000000000003',
  },
} as const;

/**
 * Ancla una hora concreta de un día futuro, en hora local de Madrid.
 *
 * Con desplazamientos relativos (`now() + interval '1 day'`) un "paseo de la
 * mañana" acaba mostrándose a la una y once de la madrugada, según cuándo se
 * ejecute la semilla. Los datos de demostración tienen que ser creíbles.
 */
const atLocalTime = (daysAhead: number, hours: number, minutes = 0) =>
  `((date_trunc('day', (now() at time zone 'Europe/Madrid'))
      + interval '${daysAhead} days'
      + interval '${hours} hours'
      + interval '${minutes} minutes') at time zone 'Europe/Madrid')`;

const P = SEED_IDS.profiles;
const A = SEED_IDS.pets;
const L = SEED_IDS.places;
const S = SEED_IDS.spots;
const E = SEED_IDS.playdates;
const C = SEED_IDS.communities;

export async function seed(db: Db): Promise<void> {
  await db.query('begin');
  try {
    await db.query(`
      truncate table
        public.community_members, public.communities, public.services,
        public.booking_participants, public.spot_bookings, public.spots,
        public.playdate_feedback, public.playdate_rsvps, public.live_presence,
        public.playdates, public.geofences, public.tracker_pings,
        public.tracker_devices, public.device_tokens, public.pet_availability,
        public.pets, public.friendships, public.places, public.profiles
      restart identity cascade;
      delete from auth.users;
    `);

    await db.query(
      `insert into auth.users (id, email) values
        ($1,'marta@example.test'), ($2,'carlos@example.test'), ($3,'lucia@example.test'),
        ($4,'diego@example.test'), ($5,'ines@example.test'), ($6,'pablo@example.test'),
        ($7,'sara@example.test'), ($8,'alvaro@example.test')`,
      [P.marta, P.carlos, P.lucia, P.diego, P.ines, P.pablo, P.sara, P.alvaro],
    );

    await db.query(
      `insert into public.profiles (id, display_name, contact_phone, phone_verified_at, bio) values
        ($1,'Marta R.','+34600000001', now(), 'Salgo temprano, antes de la oficina.'),
        ($2,'Carlos M.','+34600000002', now(), 'Runner con perro. Buscamos compañía a buen ritmo.'),
        ($3,'Lucía P.','+34600000003', null, 'Trabajo por turnos. Mi gata manda en casa.'),
        ($4,'Diego S.','+34600000004', now(), 'Recién llegado al barrio.'),
        ($5,'Inés L.','+34600000005', now(), 'Dos hurones y una sala que alquilo por horas.'),
        ($6,'Pablo G.','+34600000006', null, 'Cachorro en plena socialización.'),
        ($7,'Sara V.','+34600000007', now(), 'Reptiles. Busco veterinario de exóticos de guardia.'),
        ($8,'Álvaro T.','+34600000008', now(), 'Dos conejas. Aprendiendo a hacer bien las presentaciones.')`,
      [P.marta, P.carlos, P.lucia, P.diego, P.ines, P.pablo, P.sara, P.alvaro],
    );

    await db.query(
      `insert into public.places
        (id, name, kind, point, is_fenced, has_double_gate, has_water, has_shade,
         has_small_pet_area, admits_species)
       values
        ($1,'Parque Central','dog_park', public.make_point(40.4098,-3.6939), true, true, true, true, true, '{dog}'),
        ($2,'Parque del Retiro','park', public.make_point(40.4153,-3.6844), false, false, true, true, false, '{dog}'),
        ($3,'Parque Berlín','dog_park', public.make_point(40.4562,-3.6764), true, false, true, false, true, '{dog}'),
        -- Un lugar que no es un parque canino: aquí es donde se nota que la
        -- aplicación no va solo de perros.
        ($4,'Café Bigotes','cafe', public.make_point(40.4281,-3.7038), false, false, true, true, false,
          '{dog,cat,ferret,rabbit}')`,
      [L.central, L.retiro, L.berlin, L.cafe],
    );

    // --- Mascotas -----------------------------------------------------------
    // Elegidas para producir los tres resultados que la interfaz tiene que saber
    // mostrar: gran match, match con supervisión y veto por seguridad.
    await db.query(
      `insert into public.pets
        (id, owner_id, species_id, name, breeds, birth_date, size, weight_kg, sex,
         is_neutered, energy_level, play_styles, trust_circle, is_leash_reactive,
         microchip_code, microchip_verified_at, bio, health_flags)
       values
        ($1,$12,'dog','Nina','{"Border Collie"}','2021-04-12','medium',18.5,'female',true,
          'high','{chase,toys}','{loves_everyone}',false,'941000012345678', now(),
          'Le obsesiona la pelota. No para.', '{}'),
        ($2,$13,'dog','Toby','{"Mestizo"}','2020-09-30','medium',21.0,'male',true,
          'high','{chase,wrestle}','{loves_everyone}',false,'941000023456789', now(),
          'Corre con quien haga falta.', '{}'),
        ($3,$14,'dog','Rocky','{"Galgo español"}','2019-02-08','large',28.0,'male',true,
          'medium','{chase,calm_walk}','{shy_at_first}',true,'941000034567890', null,
          'Tímido al principio, luego no hay quien lo pare.', '{joint_issues}'),
        ($4,$15,'dog','Bruno','{"Pastor alemán"}','2025-12-05','large',24.0,'male',false,
          'high','{wrestle,chase}','{loves_everyone}',false,'941000078901234', null,
          'Cachorro en plena socialización. Mucha energía.', '{vaccination_pending}'),

        ($5,$16,'ferret','Lola','{"Hurón estándar"}','2023-05-14','small',0.9,'female',true,
          'high','{chase,wrestle,forage}','{loves_everyone}',false,'941000045678901', now(),
          'No hay tubo por el que no se meta.', '{}'),
        ($6,$16,'ferret','Pipo','{"Hurón angora"}','2022-08-02','small',1.2,'male',true,
          'medium','{chase,forage,toys}','{shy_at_first}',false,'941000056789012', now(),
          'Duerme dieciocho horas y las seis restantes las aprovecha.', '{}'),

        ($7,$17,'rabbit','Trufa','{"Belier"}','2023-03-19','medium',2.4,'female',true,
          'medium','{grooming,side_by_side,forage}','{loves_everyone}',false,null, null,
          'Se acicala con quien la deje. Muy sociable para ser conejo.', '{}'),
        ($8,$17,'rabbit','Canela','{"Enano holandés"}','2024-01-25','small',1.3,'female',true,
          'low','{side_by_side,forage}','{shy_at_first}',false,null, null,
          'Necesita su tiempo. Las presentaciones con ella van despacio.', '{}'),

        ($9,$18,'cat','Misi','{"Común europeo"}','2019-06-30','medium',4.2,'female',true,
          'low','{chase,toys}','{shy_at_first}',false,'941000067890123', now(),
          'Territorial y feliz de serlo. No quiere conocer a nadie.', '{}'),
        ($10,$19,'leopard_gecko','Kiwi','{}','2022-11-11','mini',0.06,'male',false,
          'low','{}','{}',false,null, null,
          'Come grillos los martes y jueves. Nada más que contar, y está bien así.', '{}'),
        ($11,$18,'betta','Azul','{}','2025-02-01','mini',0.005,'male',false,
          'low','{}','{}',false,null, null,
          'Vive solo por definición de su especie.', '{}'),

        ($20,$13,'dog','Kira','{"Bulldog francés"}','2022-01-18','small',11.5,'female',true,
          'low','{toys,calm_walk}','{shy_at_first}',false,'941000089012345', now(),
          'Se cansa enseguida. Le va el paseo corto y la sombra.', '{brachycephalic,heat_sensitive}')`,
      [
        A.nina, A.toby, A.rocky, A.bruno, A.lola, A.pipo, A.trufa, A.canela,
        A.misi, A.kiwi, A.azul,
        P.marta, P.carlos, P.diego, P.pablo, P.ines, P.alvaro, P.lucia, P.sara,
        A.kira,
      ],
    );

    // --- Horarios -----------------------------------------------------------
    for (const petId of [A.nina, A.toby, A.rocky]) {
      for (const weekday of [1, 2, 3, 4, 5]) {
        await db.query(
          `insert into public.pet_availability (pet_id, weekday, start_time, end_time, place_id)
           values ($1,$2,'07:00','07:45',$3)`,
          [petId, weekday, L.central],
        );
      }
    }

    // El caso que hace útil la aplicación a cualquier hora: dos salidas que
    // empiezan antes de medianoche y terminan después.
    for (const [petId, start, end] of [
      [A.rocky, '23:00', '00:30'],
      [A.bruno, '23:20', '00:10'],
    ] as const) {
      for (const weekday of [2, 4, 6]) {
        await db.query(
          `insert into public.pet_availability (pet_id, weekday, start_time, end_time, place_id)
           values ($1,$2,$3,$4,$5)`,
          [petId, weekday, start, end, L.berlin],
        );
      }
    }

    // Los hurones y los conejos también tienen horario: sus encuentros se
    // organizan igual, en casa de alguien o en una sala, no en un parque.
    for (const petId of [A.lola, A.pipo, A.trufa, A.canela]) {
      for (const weekday of [0, 6]) {
        await db.query(
          `insert into public.pet_availability (pet_id, weekday, start_time, end_time, place_id)
           values ($1,$2,'17:00','19:00',null)`,
          [petId, weekday],
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
         fence_height_cm, has_water, has_shade, max_pets, price_per_slot_cents,
         slot_minutes, rules, cancellation_policy, public_slug)
       values
        ($1,$3,'Patio cercado en Chamberí',
          'Patio privado de 200 m² con valla de dos metros. Un grupo cada vez.',
          public.make_point(40.4370,-3.7038),'Calle de Ejemplo 12, Madrid',200,true,200,true,true,
          6, 4000, 120,'Traer bolsas. No dejar juguetes.','Gratis hasta 24 h antes.','patio-chamberi'),
        ($2,$3,'Sala neutral para presentaciones',
          'Sala interior de 20 m² sin olores previos, pensada para presentar conejos y hurones. Suelo lavable y separadores.',
          public.make_point(40.4405,-3.7012),'Calle de Ejemplo 30, Madrid',20,true,120,true,false,
          4, 1500, 60,'Traer transportín. Sesiones de 20 minutos con descanso.','Gratis hasta 12 h antes.','sala-presentaciones')`,
      [S.patio, S.sala, P.ines],
    );

    // --- Quedadas -----------------------------------------------------------
    await db.query(
      `insert into public.playdates
        (id, host_id, host_pet_id, species_id, kind, title, description, place_id, point,
         starts_at, ends_at, visibility, admits_sizes, admits_energy, leashed,
         max_pets, session_minutes, public_slug)
       values
        ($1,$5,$9,'dog','scheduled','Paseo de la mañana en Parque Central',
          'Salimos a las siete, como cada día. Ritmo alto: los nuestros corren.',
          $13, public.make_point(40.4098,-3.6939),
          ${atLocalTime(1, 7)}, ${atLocalTime(1, 7, 45)},
          'public','{medium,large}','{medium,high}', false, 8, 45,'paseo-manana-central'),

        ($2,$6,$10,'ferret','scheduled','Tarde de hurones en sala neutral',
          'Cuatro como mucho, sesiones de veinte minutos con descanso. Traed transportín y el moquillo al día.',
          null, public.make_point(40.4405,-3.7012),
          ${atLocalTime(2, 17)}, ${atLocalTime(2, 19)},
          -- Dos horas de tarde, veinte minutos de contacto. No es lo mismo, y el
          -- esquema ya no deja confundirlo.
          'public','{mini,small}','{medium,high}', false, 4, 20,'hurones-sala-neutral'),

        ($3,$7,$11,'rabbit','scheduled','Presentación de conejos, terreno neutral',
          'Espacio sin olores previos y supervisión constante. Si no se caen bien, se para y ya está: forzarlo acaba en peleas de verdad.',
          null, public.make_point(40.4405,-3.7012),
          ${atLocalTime(4, 18)}, ${atLocalTime(4, 19)},
          'public','{small,medium}','{low,medium}', false, 3, 20,'presentacion-conejos'),

        ($4,$8,$12,'dog','scheduled','Caminata nocturna por Parque Berlín',
          'Para quienes paseamos cuando ya no hay nadie.',
          $14, public.make_point(40.4562,-3.6764),
          ${atLocalTime(2, 22, 30)}, ${atLocalTime(3, 0)},
          'public','{medium,large}','{medium,high}', false, 6, 60,'nocturna-berlin')`,
      [
        E.manana, E.hurones, E.conejos, E.nocturna,
        P.marta, P.ines, P.alvaro, P.diego,
        A.nina, A.lola, A.trufa, A.rocky,
        L.central, L.berlin,
      ],
    );

    await db.query(
      `insert into public.playdate_rsvps (playdate_id, pet_id, profile_id, status, affinity_at_join)
       values ($1,$2,$3,'going',100), ($1,$4,$5,'going',92),
              ($6,$7,$8,'going',88), ($9,$10,$11,'going',71)`,
      [
        E.manana, A.nina, P.marta, A.toby, P.carlos,
        E.hurones, A.pipo, P.ines,
        E.conejos, A.canela, P.alvaro,
      ],
    );

    // --- Comunidad y servicios ---------------------------------------------
    // Es lo que hace que un tutor de gato o de gecko tenga motivo para volver a
    // abrir la aplicación.
    await db.query(
      `insert into public.communities (id, species_id, name, description, center, radius_m, created_by, public_slug)
       values
        ($1,'leopard_gecko','Reptiles de Madrid',
          'Dudas de temperatura, muda, alimentación y qué veterinario está de guardia el domingo.',
          public.make_point(40.4168,-3.7038), 30000, $4,'reptiles-madrid'),
        ($2,'cat','Gatos de Chamberí',
          'Vecinos con gato: veterinarios felinos, cuidadores para las vacaciones y colonias de la zona.',
          public.make_point(40.4370,-3.7038), 8000, $5,'gatos-chamberi'),
        ($3,'rabbit','Conejos en Madrid',
          'Presentaciones, dietas y las dos vacunas que de verdad hacen falta.',
          public.make_point(40.4168,-3.7038), 25000, $6,'conejos-madrid')`,
      [C.reptiles, C.gatos, C.conejos, P.sara, P.lucia, P.alvaro],
    );

    await db.query(
      `insert into public.community_members (community_id, profile_id) values
        ($1,$4), ($2,$5), ($3,$6), ($1,$5)`,
      [C.reptiles, C.gatos, C.conejos, P.sara, P.lucia, P.alvaro],
    );

    await db.query(
      `insert into public.services (name, kind, point, address, phone, species_served, is_24h, verified_at, created_by)
       values
        ('Urgencias Veterinarias 24h Madrid','emergency_vet', public.make_point(40.4302,-3.6989),
         'Calle de Ejemplo 4, Madrid','+34910000001','{dog,cat,ferret,rabbit}', true, now(), $1),
        ('Clínica de Exóticos Vetlab','exotic_vet', public.make_point(40.4211,-3.7098),
         'Calle de Ejemplo 18, Madrid','+34910000002','{ferret,rabbit,guinea_pig,leopard_gecko,bearded_dragon,budgerigar,greek_tortoise}', false, now(), $1),
        ('Centro Felino Chamberí','vet', public.make_point(40.4368,-3.7042),
         'Calle de Ejemplo 7, Madrid','+34910000003','{cat}', false, now(), $2),
        ('Peluquería Canina El Nudo','groomer', public.make_point(40.4099,-3.6951),
         'Calle de Ejemplo 21, Madrid','+34910000004','{dog}', false, null, $2)`,
      [P.sara, P.lucia],
    );

    // --- Radar, collares y notificaciones -----------------------------------
    await db.query(
      `insert into public.live_presence
        (pet_id, profile_id, playdate_id, place_id, point, expires_at, source)
       values
        ($1,$2,null,$3, public.make_point(40.4098,-3.6939), now() + interval '75 minutes','manual'),
        ($4,$5,null,$6, public.make_point(40.4562,-3.6764), now() + interval '40 minutes','geofence')`,
      [A.toby, P.carlos, L.central, A.rocky, P.diego, L.berlin],
    );

    // La ubicación entra sin degradar a propósito: el disparador de la tabla la
    // redondea igualmente, y un test lo comprueba.
    await db.query(
      `insert into public.device_tokens (profile_id, expo_push_token, platform, coarse_point)
       values
        ($1,'ExponentPushToken[marta-0001]','ios', public.make_point(40.40981,-3.69394)),
        ($2,'ExponentPushToken[carlos-0002]','android', public.make_point(40.41120,-3.69610)),
        ($3,'ExponentPushToken[diego-0003]','ios', public.make_point(40.45623,-3.67641)),
        ($4,'ExponentPushToken[ines-0004]','android', public.make_point(40.44050,-3.70120))`,
      [P.marta, P.carlos, P.diego, P.ines],
    );

    const phoneDevice = '70000000-0000-4000-8000-000000000001';
    const collarDevice = '70000000-0000-4000-8000-000000000002';
    await db.query(
      `insert into public.tracker_devices (id, pet_id, vendor, external_id, label)
       values ($1,$3,'phone','marta-iphone','Teléfono de Marta'),
              ($2,$4,'webhook','toby-collar','Collar de Toby (webhook)')`,
      [phoneDevice, collarDevice, A.nina, A.toby],
    );

    await db.query(
      `insert into public.tracker_pings (device_id, pet_id, point, accuracy_m, battery_pct, recorded_at)
       values
        ($1,$3, public.make_point(40.4099,-3.6941), 8, 82, now() - interval '20 minutes'),
        ($1,$3, public.make_point(40.4101,-3.6935), 6, 81, now() - interval '10 minutes'),
        ($2,$4, public.make_point(40.4097,-3.6940), 12, 64, now() - interval '5 minutes')`,
      [phoneDevice, collarDevice, A.nina, A.toby],
    );

    await db.query(
      `insert into public.geofences (pet_id, place_id, center, radius_m, auto_checkin)
       values ($1,$2, public.make_point(40.4098,-3.6939), 150, true)`,
      [A.nina, L.central],
    );

    // Una reserva en grupo ya formada, con el coste repartido por el disparador.
    const bookingId = '60000000-0000-4000-8000-000000000001';
    await db.query(
      `insert into public.spot_bookings
        (id, spot_id, organizer_id, starts_at, ends_at, total_price_cents,
         group_affinity_min, status)
       values ($1,$2,$3, ${atLocalTime(5, 17)}, ${atLocalTime(5, 19)}, 4000, 81, 'collecting')`,
      [bookingId, S.patio, P.marta],
    );
    await db.query(
      `insert into public.booking_participants (booking_id, pet_id, profile_id, status)
       values ($1,$2,$5,'going'), ($1,$3,$6,'going'), ($1,$4,$7,'going')`,
      [bookingId, A.nina, A.toby, A.rocky, P.marta, P.carlos, P.diego],
    );

    await db.query('commit');
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}
