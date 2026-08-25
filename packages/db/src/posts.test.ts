/**
 * Publicaciones y zonas pet-friendly, comprobadas en la base.
 *
 * Las dos reglas que aquí se prueban son de las que no se pueden dejar solo en
 * el cliente: quién puede publicar sobre qué animal, y desde dónde se puede
 * encender el radar. Una aplicación móvil se desensambla en cinco minutos.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asService, asUser, createPool, type Db } from './client.js';
import { SEED_IDS, seed } from './seed.js';

const { profiles: P, pets: A, places: L, posts: O } = SEED_IDS;

let db: Db;

beforeAll(async () => {
  db = createPool();
  await seed(db);
}, 60_000);

afterAll(async () => {
  await db?.end();
});

describe('el radar solo se enciende en zona pet-friendly', () => {
  it('dentro de un parque, la zona se reconoce', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query('select * from public.place_at(40.4098, -3.6939)')).rows,
    );
    expect(rows[0]?.name).toBe('Parque Central');
  });

  it('en mitad de la ciudad, no hay zona', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query('select * from public.place_at(40.3800, -3.7500)')).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it('un check-in fuera de zona se rechaza', async () => {
    // Es la regla completa: sin esto, el radar sería una baliza personal que
    // publica tu portal.
    await expect(
      asUser(db, P.marta, async (client) =>
        client.query(
          `insert into public.live_presence (pet_id, profile_id, point, expires_at)
           values ($1, $2, public.make_point(40.3800,-3.7500), now() + interval '1 hour')`,
          [A.nina, P.marta],
        ),
      ),
    ).rejects.toThrow(/zona pet-friendly/i);
  });

  it('dentro de zona sí, y el lugar lo deduce la base', async () => {
    // El cliente no declara dónde está: si pudiera, alguien diría estar en el
    // Parque Central desde el otro lado de la ciudad.
    const row = await asUser(db, P.marta, async (client) =>
      (
        await client.query(
          `insert into public.live_presence (pet_id, profile_id, point, expires_at)
           values ($1, $2, public.make_point(40.4098,-3.6939), now() + interval '1 hour')
           returning place_id`,
          [A.nina, P.marta],
        )
      ).rows[0],
    );
    expect(row.place_id).toBe(L.central);
  });

  it('mover el check-in fuera de zona también se rechaza', async () => {
    await expect(
      asService(db, async (client) =>
        client.query(
          `update public.live_presence set point = public.make_point(40.3800,-3.7500)
           where pet_id = $1`,
          [A.toby],
        ),
      ),
    ).rejects.toThrow(/zona pet-friendly/i);
  });

  it('gana la zona más pequeña que contiene el punto', async () => {
    // Si una terraza cae dentro de un parque, la respuesta útil es la terraza.
    const rows = await asService(db, async (client) => {
      await client.query(
        `update public.places set point = public.make_point(40.4099,-3.6940), radius_m = 30
         where id = $1`,
        [L.cafe],
      );
      return (await client.query('select * from public.place_at(40.4099, -3.6940)')).rows;
    });
    expect(rows[0]?.kind).toBe('cafe');
  });
});

describe('publicaciones', () => {
  it('el feed público se lee sin cuenta', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query('select * from public.public_posts order by created_at desc')).rows,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].pet_name).toBeTruthy();
  });

  it('los contadores vienen resueltos, no una consulta por publicación', async () => {
    const row = await asUser(db, null, async (client) =>
      (await client.query('select * from public.public_posts where id = $1', [O.ninaPelota]))
        .rows[0],
    );
    expect(row.like_count).toBe(2);
    expect(row.comment_count).toBe(2);
  });

  it('no se puede publicar sobre el animal de otro', async () => {
    await expect(
      asUser(db, P.marta, async (client) =>
        client.query(
          `insert into public.posts (pet_id, author_id, image_path, image_alt)
           values ($1, $2, 'posts/robo.jpg', 'Una foto que no es mía')`,
          [A.toby, P.marta],
        ),
      ),
    ).rejects.toThrow(/animal propio/i);
  });

  it('una foto no puede publicarse sin describirla', async () => {
    // Una imagen sin texto alternativo no la ve todo el mundo, y esta aplicación
    // eligió su tipografía por accesibilidad: dejarlo opcional sería
    // contradecirse.
    await expect(
      asUser(db, P.marta, async (client) =>
        client.query(
          `insert into public.posts (pet_id, author_id, image_path, image_alt)
           values ($1, $2, 'posts/x.jpg', '')`,
          [A.nina, P.marta],
        ),
      ),
    ).rejects.toThrow();
  });

  it('el lugar de una publicación tiene que ser una zona pet-friendly', async () => {
    await expect(
      asService(db, async (client) => {
        await client.query(`update public.places set allows_checkin = false where id = $1`, [
          L.berlin,
        ]);
        return client.query(
          `insert into public.posts (pet_id, author_id, image_path, image_alt, place_id)
           values ($1, $2, 'posts/x.jpg', 'Una foto en un sitio cerrado', $3)`,
          [A.nina, P.marta, L.berlin],
        );
      }),
    ).rejects.toThrow(/zona pet-friendly/i);
  });

  it('nadie edita la publicación de otro', async () => {
    const changed = await asUser(db, P.diego, async (client) =>
      (
        await client.query(`update public.posts set caption = 'secuestrada' where id = $1`, [
          O.ninaPelota,
        ])
      ).rowCount,
    );
    expect(changed).toBe(0);
  });

  it('quién dio like no es público; el contador sí', async () => {
    // Sara no ha dado like a nada y no es autora de nada: no debería poder ver
    // quién ha dado like a qué.
    const rows = await asUser(db, P.sara, async (client) =>
      (await client.query('select profile_id from public.post_likes')).rows,
    );
    expect(rows).toHaveLength(0);

    const counted = await asUser(db, null, async (client) =>
      (await client.query('select like_count from public.public_posts where id = $1', [
        O.ninaPelota,
      ])).rows[0],
    );
    expect(counted.like_count).toBe(2);
  });

  it('los comentarios de una publicación pública se leen sin cuenta', async () => {
    const rows = await asUser(db, null, async (client) =>
      (await client.query('select body from public.post_comments where post_id = $1', [
        O.ninaPelota,
      ])).rows,
    );
    expect(rows.length).toBe(2);
  });

  it('un comentario vacío no se guarda', async () => {
    await expect(
      asUser(db, P.carlos, async (client) =>
        client.query(
          `insert into public.post_comments (post_id, author_id, body) values ($1, $2, '   ')`,
          [O.ninaPelota, P.carlos],
        ),
      ),
    ).rejects.toThrow();
  });
});
