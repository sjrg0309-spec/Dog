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
    nocturna: '50000000-0000-4000-8000-000000000004',
    sombra: '50000000-0000-4000-8000-000000000005',
  },
  posts: {
    ninaPelota: '60000000-0000-4000-8000-000000000001',
    tobyCharco: '60000000-0000-4000-8000-000000000002',
    rockySombra: '60000000-0000-4000-8000-000000000003',
    ninaKira: '60000000-0000-4000-8000-000000000004',
    kiraSombra: '60000000-0000-4000-8000-000000000005',
  },
  communities: {
    chamberi: '80000000-0000-4000-8000-000000000001',
    nocturnos: '80000000-0000-4000-8000-000000000002',
    barrio: '80000000-0000-4000-8000-000000000003',
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
        public.post_comments, public.post_likes, public.posts,
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
        ($1,$6,'dog','Nina','{"Border Collie"}','2021-04-12','medium',18.5,'female',true,
          'high','{chase,toys}','{loves_everyone}',false,'941000012345678', now(),
          'Le obsesiona la pelota. No para.', '{}'),
        ($2,$7,'dog','Toby','{"Mestizo"}','2020-09-30','medium',21.0,'male',true,
          'high','{chase,wrestle}','{loves_everyone}',false,'941000023456789', now(),
          'Corre con quien haga falta.', '{}'),
        ($3,$8,'dog','Rocky','{"Galgo español"}','2019-02-08','large',28.0,'male',true,
          'medium','{chase,calm_walk}','{shy_at_first}',true,'941000034567890', null,
          'Tímido al principio, luego no hay quien lo pare.', '{joint_issues}'),
        ($4,$9,'dog','Bruno','{"Pastor alemán"}','2025-12-05','large',24.0,'male',false,
          'high','{wrestle,chase}','{loves_everyone}',false,'941000078901234', null,
          'Cachorro en plena socialización. Mucha energía.', '{vaccination_pending}'),
        ($5,$7,'dog','Kira','{"Bulldog francés"}','2022-01-18','small',11.5,'female',true,
          'low','{toys,calm_walk}','{shy_at_first}',false,'941000089012345', now(),
          'Se cansa enseguida. Le va el paseo corto y la sombra.', '{brachycephalic,heat_sensitive}')`,
      [A.nina, A.toby, A.rocky, A.bruno, A.kira, P.marta, P.carlos, P.diego, P.pablo],
    );

    // --- Horarios -----------------------------------------------------------
    for (const petId of [A.nina, A.toby, A.rocky, A.kira]) {
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
        ($2,$3,'Jardín con sombra en Las Rozas',
          'Media hectárea vallada con arbolado, pensada para perros que no pueden ir sueltos al parque. Sombra de verdad a mediodía.',
          public.make_point(40.4920,-3.8730),'Calle de Ejemplo 30, Las Rozas',5000,true,180,true,true,
          8, 6000, 90,'Traer bolsas. Un grupo cada vez.','Gratis hasta 24 h antes.','jardin-las-rozas')`,
      [S.patio, S.sala, P.ines],
    );

    // --- Quedadas -----------------------------------------------------------
    await db.query(
      `insert into public.playdates
        (id, host_id, host_pet_id, species_id, kind, title, description, place_id, point,
         starts_at, ends_at, visibility, admits_sizes, admits_energy, leashed,
         max_pets, session_minutes, public_slug)
       values
        ($1,$4,$7,'dog','scheduled','Paseo de la mañana en Parque Central',
          'Salimos a las siete, como cada día. Ritmo alto: los nuestros corren.',
          $10, public.make_point(40.4098,-3.6939),
          ${atLocalTime(1, 7)}, ${atLocalTime(1, 7, 45)},
          'public','{medium,large}','{medium,high}', false, 8, 45,'paseo-manana-central'),

        ($2,$5,$8,'dog','scheduled','Caminata nocturna por Parque Berlín',
          'Para quienes paseamos cuando ya no hay nadie.',
          $11, public.make_point(40.4562,-3.6764),
          ${atLocalTime(2, 22, 30)}, ${atLocalTime(3, 0)},
          'public','{medium,large}','{medium,high}', false, 6, 60,'nocturna-berlin'),

        -- La corta y con sombra: existe para que el radar tenga algo que
        -- ofrecer los días en que el bienestar recorta los ratos largos.
        ($3,$6,$9,'dog','scheduled','Vuelta corta a la sombra',
          'Media hora sin prisa por la zona arbolada. Para los que se cansan pronto o llevan mal el calor.',
          $12, public.make_point(40.4153,-3.6844),
          ${atLocalTime(1, 20)}, ${atLocalTime(1, 20, 30)},
          'public','{mini,small,medium}','{low,medium}', true, 5, 30,'vuelta-corta-sombra')`,
      [
        E.manana, E.nocturna, E.sombra,
        P.marta, P.diego, P.carlos,
        A.nina, A.rocky, A.kira,
        L.central, L.berlin, L.retiro,
      ],
    );

    await db.query(
      `insert into public.playdate_rsvps (playdate_id, pet_id, profile_id, status, affinity_at_join)
       values ($1,$2,$3,'going',100), ($1,$4,$5,'going',92),
              ($6,$7,$5,'going',64)`,
      [E.manana, A.nina, P.marta, A.toby, P.carlos, E.sombra, A.kira],
    );

    // --- Comunidad y servicios ---------------------------------------------
    // Un tutor de perro también necesita esto, y no solo las quedadas: quién
    // cuida en agosto, qué veterinario está de guardia el domingo, y con quién
    // hablar cuando el suyo se pone raro a las tres de la mañana.
    await db.query(
      `insert into public.communities (id, species_id, name, description, center, radius_m, created_by, public_slug)
       values
        ($1,'dog','Perros de Chamberí',
          'Vecinos con perro: qué parque está abierto, quién cuida en agosto y qué veterinario coge el teléfono un domingo.',
          public.make_point(40.4370,-3.7038), 8000, $4,'perros-chamberi'),
        ($2,'dog','Paseos nocturnos Madrid',
          'Para quienes salimos cuando ya no hay nadie. Rutas con luz, zonas que evitar y compañía a horas raras.',
          public.make_point(40.4168,-3.7038), 25000, $5,'paseos-nocturnos-madrid'),
        ($3,null,'Mascotas del barrio',
          'Cualquier especie: dónde comprar, quién cuida en agosto y qué hacer con un animal perdido.',
          public.make_point(40.4168,-3.7038), 12000, $6,'mascotas-del-barrio')`,
      [C.chamberi, C.nocturnos, C.barrio, P.lucia, P.diego, P.sara],
    );

    await db.query(
      `insert into public.community_members (community_id, profile_id) values
        ($1,$4), ($2,$5), ($3,$6), ($1,$5)`,
      [C.chamberi, C.nocturnos, C.barrio, P.lucia, P.diego, P.sara],
    );

    await db.query(
      `insert into public.services (name, kind, point, address, phone, species_served, is_24h, verified_at, created_by)
       values
        ('Urgencias Veterinarias 24h Madrid','emergency_vet', public.make_point(40.4302,-3.6989),
         'Calle de Ejemplo 4, Madrid','+34910000001','{dog}', true, now(), $1),
        ('Clínica Veterinaria Arganzuela','vet', public.make_point(40.4211,-3.7098),
         'Calle de Ejemplo 18, Madrid','+34910000002','{dog}', false, now(), $1),
        ('Guardería Canina El Retiro','boarding', public.make_point(40.4368,-3.7042),
         'Calle de Ejemplo 7, Madrid','+34910000003','{dog}', false, now(), $2),
        ('Peluquería Canina El Nudo','groomer', public.make_point(40.4099,-3.6951),
         'Calle de Ejemplo 21, Madrid','+34910000004','{dog}', false, null, $2)`,
      [P.sara, P.lucia],
    );

    // --- Publicaciones ------------------------------------------------------
    // `image_path` es la clave del objeto en el almacenamiento, no la imagen.
    // En un despliegue real apunta al bucket; aquí las rutas existen para que el
    // feed tenga forma y para que la aplicación pueda enseñar el hueco con su
    // texto alternativo en lugar de una foto de archivo que no es de nadie.
    await db.query(
      `insert into public.posts (id, pet_id, author_id, image_path, image_alt, caption, place_id, created_at)
       values
        ($1,$6,$9,'posts/nina-pelota.jpg',
         'Nina, border collie blanca y negra, con una pelota en la boca sobre la hierba',
         'Cuarenta minutos y no ha soltado la pelota ni una vez. Mañana a las siete, como siempre.',
         $12, now() - interval '3 hours'),
        ($2,$7,$10,'posts/toby-charco.jpg',
         'Toby, mestizo marrón, empapado saliendo de un charco',
         'Ha encontrado el único charco del parque. Obviamente.',
         $12, now() - interval '9 hours'),
        ($3,$8,$11,'posts/rocky-sombra.jpg',
         'Rocky, galgo español, tumbado a la sombra de un árbol',
         'A esta hora ya no hay nadie y se está mejor. Los martes y jueves salimos a las once.',
         $13, now() - interval '1 day'),
        ($4,$6,$9,'posts/nina-kira.jpg',
         'Nina y Kira sentadas juntas en un banco del parque',
         'Salen juntas y vuelven juntas, aunque una tarda el triple.',
         $12, now() - interval '2 days'),
        ($5,$14,$10,'posts/kira-sombra.jpg',
         'Kira, bulldog francés, jadeando a la sombra',
         'Hoy media hora y a casa. La app no me dejaba ni eso a mediodía y tenía razón.',
         $13, now() - interval '3 days')`,
      [
        SEED_IDS.posts.ninaPelota, SEED_IDS.posts.tobyCharco, SEED_IDS.posts.rockySombra,
        SEED_IDS.posts.ninaKira, SEED_IDS.posts.kiraSombra,
        A.nina, A.toby, A.rocky,
        P.marta, P.carlos, P.diego,
        L.central, L.retiro,
        A.kira,
      ],
    );

    await db.query(
      `insert into public.post_likes (post_id, profile_id) values
        ($1,$6), ($1,$7), ($2,$5), ($3,$5), ($4,$6), ($4,$7)`,
      [
        SEED_IDS.posts.ninaPelota, SEED_IDS.posts.tobyCharco,
        SEED_IDS.posts.rockySombra, SEED_IDS.posts.ninaKira,
        P.marta, P.carlos, P.diego,
      ],
    );

    await db.query(
      `insert into public.post_comments (post_id, author_id, body) values
        ($1,$3,'Nosotros salimos a esa hora también. Nos vemos mañana.'),
        ($1,$4,'Esa pelota le va a durar dos días.'),
        ($2,$3,'Buena idea lo de las once. En verano no se puede antes.')`,
      [SEED_IDS.posts.ninaPelota, SEED_IDS.posts.rockySombra, P.carlos, P.diego],
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
