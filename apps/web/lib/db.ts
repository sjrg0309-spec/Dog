import 'server-only';

import pg from 'pg';

/**
 * Acceso a datos de la web pública.
 *
 * Cada consulta se ejecuta con el rol `anon`, el mismo que tendría un visitante
 * sin cuenta. No es una formalidad: significa que las páginas de esta web están
 * sujetas a las mismas políticas RLS que cualquier otro cliente, y que si una
 * política es demasiado permisiva se nota aquí antes que en producción.
 */

const globalForPool = globalThis as unknown as { coincidePool?: pg.Pool };

function pool(): pg.Pool {
  globalForPool.coincidePool ??= new pg.Pool({
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? 'coincide',
    password: process.env.PGPASSWORD ?? 'coincide',
    database: process.env.PGDATABASE ?? 'coincide',
    max: 5,
  });
  return globalForPool.coincidePool;
}

/** Ejecuta una consulta como visitante anónimo. */
export async function queryAsAnon<T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await pool().connect();
  try {
    await client.query('begin');
    await client.query('set local role anon');
    const result = await client.query<T>(text, params);
    await client.query('commit');
    return result.rows;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Especies
// ---------------------------------------------------------------------------

export type SpeciesRow = {
  id: string;
  common_name: string;
  scientific_name: string;
  taxon_group: string;
  social_model: 'pack' | 'small_group' | 'solitary';
  social_note: string;
  juvenile_until_months: number;
  legal_status: string | null;
  legal_note: string | null;
  legal_source: string | null;
  pet_count: number;
};

export function allSpecies() {
  return queryAsAnon<SpeciesRow>(
    `select
       s.id, s.common_name, s.scientific_name, s.taxon_group::text as taxon_group,
       s.social_model::text as social_model, s.social_note, s.juvenile_until_months,
       l.status::text as legal_status, l.note as legal_note, l.source as legal_source,
       (select count(*) from public.public_pets p where p.species_id = s.id)::int as pet_count
     from public.species s
     left join public.species_legal_status l
       on l.species_id = s.id and l.jurisdiction = 'ES'
     order by
       case s.social_model when 'pack' then 0 when 'small_group' then 1 else 2 end,
       s.common_name`,
  );
}

// ---------------------------------------------------------------------------
// Quedadas
// ---------------------------------------------------------------------------

export type PlaydateRow = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  species_id: string;
  species_name: string;
  social_model: string;
  starts_at: Date;
  ends_at: Date;
  public_slug: string;
  admits_sizes: string[];
  admits_energy: string[];
  leashed: boolean;
  max_pets: number | null;
  place_name: string | null;
  place_is_fenced: boolean | null;
  place_has_water: boolean | null;
  place_has_shade: boolean | null;
  host_name: string | null;
  attendee_count: number;
  health_for_meetups: string[];
};

const PLAYDATE_SELECT = `
  select
    d.id, d.title, d.description, d.kind::text as kind,
    d.species_id, sp.common_name as species_name, sp.social_model::text as social_model,
    sp.health_for_meetups,
    d.starts_at, d.ends_at, d.public_slug,
    d.admits_sizes::text[] as admits_sizes, d.admits_energy::text[] as admits_energy,
    d.leashed, d.max_pets,
    pl.name as place_name, pl.is_fenced as place_is_fenced,
    pl.has_water as place_has_water, pl.has_shade as place_has_shade,
    pr.display_name as host_name,
    (select count(*) from public.playdate_rsvps r
      where r.playdate_id = d.id and r.status = 'going')::int as attendee_count
  from public.playdates d
  join public.species sp on sp.id = d.species_id
  left join public.places pl on pl.id = d.place_id
  left join public.public_profiles pr on pr.id = d.host_id
`;

export function upcomingPlaydates(limit = 6) {
  return queryAsAnon<PlaydateRow>(
    `${PLAYDATE_SELECT}
     where d.status = 'active' and d.ends_at > now()
     order by d.starts_at asc
     limit $1`,
    [limit],
  );
}

export async function playdateBySlug(slug: string) {
  const [row] = await queryAsAnon<PlaydateRow>(`${PLAYDATE_SELECT} where d.public_slug = $1`, [
    slug,
  ]);
  return row ?? null;
}

export type AttendeeRow = {
  id: string;
  name: string;
  species_name: string;
  size: string | null;
  energy_level: string | null;
  play_styles: string[];
  breeds: string[];
  age_months: number | null;
  is_microchip_verified: boolean;
  bio: string | null;
};

export function playdateAttendees(playdateId: string) {
  // Se lee de `public_pets`, que deja fuera el código del chip y la fecha de
  // nacimiento exacta.
  return queryAsAnon<AttendeeRow>(
    `select
       p.id, p.name, p.species_name, p.size::text as size,
       p.energy_level::text as energy_level, p.play_styles::text[] as play_styles,
       p.breeds, p.age_months, p.is_microchip_verified, p.bio
     from public.playdate_rsvps r
     join public.public_pets p on p.id = r.pet_id
     where r.playdate_id = $1 and r.status = 'going'
     order by p.name`,
    [playdateId],
  );
}

// ---------------------------------------------------------------------------
// Espacios
// ---------------------------------------------------------------------------

export type SpotRow = {
  id: string;
  title: string;
  description: string | null;
  public_slug: string;
  max_pets: number;
  price_per_slot_cents: number;
  slot_minutes: number;
  is_fenced: boolean;
  fence_height_cm: number | null;
  has_water: boolean;
  has_shade: boolean;
  is_private_single_group: boolean;
  size_m2: number | null;
  rules: string | null;
  cancellation_policy: string | null;
  host_name: string | null;
};

const SPOT_SELECT = `
  select
    s.id, s.title, s.description, s.public_slug, s.max_pets, s.price_per_slot_cents,
    s.slot_minutes, s.is_fenced, s.fence_height_cm, s.has_water, s.has_shade,
    s.is_private_single_group, s.size_m2, s.rules, s.cancellation_policy,
    pr.display_name as host_name
  from public.public_spots s
  left join public.public_profiles pr on pr.id = s.host_id
`;

export function activeSpots(limit = 6) {
  return queryAsAnon<SpotRow>(`${SPOT_SELECT} order by s.price_per_slot_cents asc limit $1`, [
    limit,
  ]);
}

export async function spotBySlug(slug: string) {
  const [row] = await queryAsAnon<SpotRow>(`${SPOT_SELECT} where s.public_slug = $1`, [slug]);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Lugares, comunidad y servicios
// ---------------------------------------------------------------------------

export type PlaceRow = {
  id: string;
  name: string;
  kind: string;
  is_fenced: boolean | null;
  has_double_gate: boolean | null;
  has_water: boolean | null;
  has_shade: boolean | null;
  has_small_pet_area: boolean | null;
  admits_species: string[];
  admits_species_names: string[];
  upcoming_playdates: number;
};

export function allPlaces() {
  return queryAsAnon<PlaceRow>(
    `select
       p.id, p.name, p.kind, p.is_fenced, p.has_double_gate, p.has_water,
       p.has_shade, p.has_small_pet_area, p.admits_species,
       coalesce(
         (select array_agg(s.common_name order by s.common_name)
          from public.species s where s.id = any (p.admits_species)),
         '{}'
       ) as admits_species_names,
       (select count(*) from public.playdates d
         where d.place_id = p.id and d.status = 'active' and d.ends_at > now())::int
         as upcoming_playdates
     from public.places p
     order by p.name`,
  );
}

export type CommunityRow = {
  id: string;
  name: string;
  species_id: string | null;
  species_name: string | null;
  member_count: number;
  public_slug: string;
};

/**
 * Comunidades cerca del centro de Madrid.
 *
 * La web pública no conoce la ubicación del visitante, así que parte de un punto
 * de referencia y un radio amplio. En la aplicación esta misma consulta arranca
 * del GPS del tutor.
 */
export function communitiesNear(lat = 40.4168, lng = -3.7038, radiusMeters = 40000) {
  return queryAsAnon<CommunityRow>(
    `select
       c.id, c.name, c.species_id, c.member_count, c.public_slug,
       s.common_name as species_name
     from public.communities_nearby($1, $2, null, $3) c
     left join public.species s on s.id = c.species_id
     order by c.distance_m`,
    [lat, lng, radiusMeters],
  );
}

export type ServiceRow = {
  id: string;
  name: string;
  kind: string;
  is_24h: boolean;
  species_served: string[];
  species_names: string[];
  is_verified: boolean;
};

export function servicesNear(lat = 40.4168, lng = -3.7038, radiusMeters = 40000) {
  return queryAsAnon<ServiceRow>(
    `select
       v.id, v.name, v.kind::text as kind, v.is_24h, v.species_served, v.is_verified,
       coalesce(
         (select array_agg(s.common_name order by s.common_name)
          from public.species s where s.id = any (v.species_served)),
         '{}'
       ) as species_names
     from public.services_nearby($1, $2, null, null, $3) v`,
    [lat, lng, radiusMeters],
  );
}
