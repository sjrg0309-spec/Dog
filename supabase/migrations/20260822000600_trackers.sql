-- Collares rastreadores y geocercas.
--
-- Un collar GPS es vigilancia continua de la rutina de una persona, no solo de
-- su perro. Por eso los pings de esta tabla no se comparten NUNCA con otros
-- usuarios: solo alimentan el check-in automático del propio tutor, y caducan a
-- los treinta días. Lo que ve el resto de la aplicación es "en el Parque
-- Central", jamás un rastro.
--
-- El diseño es agnóstico del fabricante a propósito: la mayoría de estos
-- collares no publican una API oficial. Añadir uno nuevo debe ser escribir un
-- adaptador, no tocar el esquema.

create table public.tracker_devices (
  id uuid primary key default extensions.gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  vendor public.tracker_vendor not null,
  -- Identificador del dispositivo en el sistema del fabricante.
  external_id text,
  -- Referencia a un secreto guardado fuera de la base, nunca la credencial.
  credentials_ref text,
  -- Secreto compartido para firmar la ingesta por webhook.
  webhook_secret text,
  label text,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  last_ping_at timestamptz,
  created_at timestamptz not null default now(),
  unique (vendor, external_id)
);

create index tracker_devices_dog_idx on public.tracker_devices (dog_id);

create table public.tracker_pings (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.tracker_devices (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  point extensions.geography(Point, 4326) not null,
  accuracy_m real,
  battery_pct smallint check (battery_pct is null or battery_pct between 0 and 100),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index tracker_pings_point_idx on public.tracker_pings using gist (point);
create index tracker_pings_dog_time_idx on public.tracker_pings (dog_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Geocercas: lo que dispara el check-in automático.
--
-- El tutor no tiene que acordarse de nada. El perro llega al parque, el radar se
-- enciende solo, y al salir caduca solo.
-- ---------------------------------------------------------------------------

create table public.geofences (
  id uuid primary key default extensions.gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  center extensions.geography(Point, 4326) not null,
  radius_m int not null default 150 check (radius_m between 25 and 2000),
  auto_checkin boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index geofences_center_idx on public.geofences using gist (center);
create index geofences_dog_idx on public.geofences (dog_id) where active;

/**
 * Purga los pings antiguos.
 *
 * Conserva el último punto de cada dispositivo —hace falta para saber dónde
 * estaba el perro la última vez— y borra el resto pasados treinta días. La
 * retención corta no es un detalle de mantenimiento: es la razón por la que
 * guardar estos datos resulta aceptable.
 */
create or replace function public.purge_old_tracker_pings(retention_days int default 30)
returns int
language plpgsql
set search_path = ''
as $$
declare
  deleted int;
begin
  with latest as (
    select distinct on (device_id) id
    from public.tracker_pings
    order by device_id, recorded_at desc
  )
  delete from public.tracker_pings p
  where p.recorded_at < now() - make_interval(days => retention_days)
    and p.id not in (select id from latest);

  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

/**
 * ¿En qué geocercas activas cae este punto?
 *
 * La usa la ingesta de pings para decidir si abrir un check-in automático.
 */
create or replace function public.geofences_containing(
  target_dog uuid,
  lat double precision,
  lng double precision
)
returns table (geofence_id uuid, place_id uuid, distance_m double precision)
language sql
stable
set search_path = ''
as $$
  select
    g.id,
    g.place_id,
    extensions.st_distance(
      g.center,
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
    )
  from public.geofences g
  where g.dog_id = target_dog
    and g.active
    and g.auto_checkin
    and extensions.st_dwithin(
      g.center,
      extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography,
      g.radius_m
    )
  order by 3;
$$;
