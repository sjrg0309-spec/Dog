-- Consultas geoespaciales y de coincidencia horaria.
--
-- Todas fijan `search_path` vacío y califican los esquemas: una función sin
-- `search_path` fijo es un vector de escalada de privilegios en cuanto además
-- es `security definer`.

/** Convierte lat/lng a un punto geográfico. Reduce el ruido de cada consulta. */
create or replace function public.make_point(lat double precision, lng double precision)
returns extensions.geography
language sql
immutable
set search_path = ''
as $$
  select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;
$$;

/**
 * El radar: quién está paseando cerca ahora mismo.
 *
 * Solo devuelve presencias vivas. Una presencia caducada no se muestra jamás,
 * ni siquiera un segundo después: el compromiso con el usuario es que apagar el
 * check-in —o dejar que expire— lo saca del mapa de verdad.
 */
create or replace function public.presence_nearby(
  lat double precision,
  lng double precision,
  radius_m int default 2000
)
returns table (
  pet_id uuid,
  profile_id uuid,
  place_id uuid,
  playdate_id uuid,
  expires_at timestamptz,
  distance_m double precision
)
language sql
stable
set search_path = ''
as $$
  select
    p.pet_id,
    p.profile_id,
    p.place_id,
    p.playdate_id,
    p.expires_at,
    extensions.st_distance(p.point, public.make_point(lat, lng))
  from public.live_presence p
  where p.expires_at > now()
    and extensions.st_dwithin(p.point, public.make_point(lat, lng), radius_m)
  order by 6;
$$;

/** Quedadas activas y futuras dentro del radio. */
create or replace function public.playdates_nearby(
  lat double precision,
  lng double precision,
  radius_m int default 5000,
  horizon interval default interval '14 days'
)
returns table (
  id uuid,
  host_id uuid,
  kind public.playdate_kind,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  place_id uuid,
  spot_id uuid,
  public_slug text,
  distance_m double precision
)
language sql
stable
set search_path = ''
as $$
  select
    d.id, d.host_id, d.kind, d.title, d.starts_at, d.ends_at,
    d.place_id, d.spot_id, d.public_slug,
    extensions.st_distance(d.point, public.make_point(lat, lng))
  from public.playdates d
  where d.status = 'active'
    and d.ends_at > now()
    and d.starts_at < now() + horizon
    and extensions.st_dwithin(d.point, public.make_point(lat, lng), radius_m)
  order by d.starts_at, 10;
$$;

create or replace function public.places_nearby(
  lat double precision,
  lng double precision,
  radius_m int default 5000
)
returns table (id uuid, name text, kind text, distance_m double precision)
language sql
stable
set search_path = ''
as $$
  select p.id, p.name, p.kind, extensions.st_distance(p.point, public.make_point(lat, lng))
  from public.places p
  where extensions.st_dwithin(p.point, public.make_point(lat, lng), radius_m)
  order by 4;
$$;

create or replace function public.spots_nearby(
  lat double precision,
  lng double precision,
  radius_m int default 15000
)
returns table (
  id uuid,
  title text,
  max_pets smallint,
  price_per_slot_cents int,
  slot_minutes smallint,
  is_fenced boolean,
  public_slug text,
  distance_m double precision
)
language sql
stable
set search_path = ''
as $$
  select
    s.id, s.title, s.max_pets, s.price_per_slot_cents, s.slot_minutes, s.is_fenced,
    s.public_slug,
    extensions.st_distance(s.point, public.make_point(lat, lng))
  from public.spots s
  where s.status = 'active'
    and extensions.st_dwithin(s.point, public.make_point(lat, lng), radius_m)
  order by 8;
$$;

-- ---------------------------------------------------------------------------
-- Coincidencia de horarios.
--
-- Es lo que hace útil la aplicación a cualquier hora, y también un punto
-- sensible: la agenda de paseo de una persona es su rutina diaria.
--
-- Por eso esta función es `security definer` y devuelve **solo el agregado**:
-- cuántos minutos coincidís, cuántos en el mismo parque y qué días. Nunca las
-- franjas concretas de nadie. Y comprueba que quien pregunta es el dueño del
-- animal por el que pregunta, para que no pueda usarse como buscador de rutinas
-- ajenas.
-- ---------------------------------------------------------------------------

create or replace function public.schedule_matches(target_pet uuid, max_results int default 50)
returns table (
  pet_id uuid,
  total_minutes int,
  shared_place_minutes int,
  days smallint[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.pets d
    where d.id = target_pet and d.owner_id = auth.uid()
  ) then
    raise exception 'Solo el tutor puede consultar las coincidencias de su animal'
      using errcode = '42501';
  end if;

  return query
  with mine as (
    select av.place_id, i.interval_start, i.interval_end
    from public.pet_availability av
    cross join lateral public.availability_intervals(av.weekday, av.start_time, av.end_time) i
    where av.pet_id = target_pet
  ),
  theirs as (
    select av.pet_id, av.place_id, i.interval_start, i.interval_end
    from public.pet_availability av
    cross join lateral public.availability_intervals(av.weekday, av.start_time, av.end_time) i
    where av.pet_id <> target_pet
  ),
  matched as (
    select
      t.pet_id,
      least(m.interval_end, t.interval_end) - greatest(m.interval_start, t.interval_start)
        as minutes,
      greatest(m.interval_start, t.interval_start) as overlap_start,
      (m.place_id is not null and m.place_id = t.place_id) as same_place
    from mine m
    join theirs t
      on least(m.interval_end, t.interval_end) > greatest(m.interval_start, t.interval_start)
  )
  select
    o.pet_id,
    sum(o.minutes)::int,
    coalesce(sum(o.minutes) filter (where o.same_place), 0)::int,
    array_agg(distinct ((o.overlap_start / 1440) % 7)::smallint)
  from matched o
  group by o.pet_id
  order by 2 desc
  limit max_results;
end;
$$;

-- ---------------------------------------------------------------------------
-- Destinatarios de una notificación geodirigida.
--
-- Solo para el backend. Devuelve tokens de envío, así que exponerla a un
-- cliente permitiría enumerar quién vive cerca de un punto cualquiera.
-- ---------------------------------------------------------------------------

create or replace function public.push_targets_in_radius(
  lat double precision,
  lng double precision,
  radius_m int default 2000
)
returns table (profile_id uuid, expo_push_token text, platform text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.profile_id, t.expo_push_token, t.platform
  from public.device_tokens t
  where t.coarse_point is not null
    -- El margen de un kilómetro compensa la degradación deliberada de la
    -- ubicación: mejor avisar de más que dejar fuera a un vecino real.
    and extensions.st_dwithin(t.coarse_point, public.make_point(lat, lng), radius_m + 1000)
    and t.last_active_at > now() - interval '30 days';
$$;

revoke all on function public.push_targets_in_radius(double precision, double precision, int)
  from public, anon, authenticated;

/** Animales que cumplen hoy años, para sugerir reservar un spot. */
create or replace function public.pets_with_birthday(within_days int default 7)
returns table (pet_id uuid, owner_id uuid, name text, turning_age int, birthday date)
language sql
stable
set search_path = ''
as $$
  select
    d.id,
    d.owner_id,
    d.name,
    extract(year from age(next_birthday, d.birth_date))::int,
    next_birthday
  from public.pets d
  cross join lateral (
    select case
      when make_date(
        extract(year from current_date)::int,
        extract(month from d.birth_date)::int,
        extract(day from d.birth_date)::int
      ) >= current_date
      then make_date(
        extract(year from current_date)::int,
        extract(month from d.birth_date)::int,
        extract(day from d.birth_date)::int
      )
      else make_date(
        extract(year from current_date)::int + 1,
        extract(month from d.birth_date)::int,
        extract(day from d.birth_date)::int
      )
    end as next_birthday
  ) b
  where d.birth_date is not null
    and next_birthday <= current_date + within_days;
$$;
