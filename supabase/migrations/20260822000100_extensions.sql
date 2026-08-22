-- Extensiones y tipos base.
--
-- PostGIS vive en el esquema `extensions`, como en un proyecto Supabase. Eso
-- obliga a calificar cada llamada geoespacial y a fijar `search_path` en las
-- funciones, que es exactamente lo que queremos: una función con `search_path`
-- heredado es un vector de escalada de privilegios cuando además es
-- `security definer`.

create schema if not exists extensions;

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos del dominio.
--
-- El orden de los valores de `dog_size` y `energy_level` es significativo: la
-- distancia entre dos tallas es aritmética y el algoritmo de compatibilidad
-- depende de ello. Insertar un valor nuevo en medio cambiaría las puntuaciones.
-- ---------------------------------------------------------------------------

create type public.dog_size as enum ('mini', 'small', 'medium', 'large', 'giant');
create type public.energy_level as enum ('couch', 'explorer', 'sprinter');
create type public.play_style as enum ('chase', 'wrestle', 'toys', 'calm_walk');
create type public.dog_sex as enum ('male', 'female');

create type public.trust_circle_flag as enum (
  'loves_everyone',
  'same_size_only',
  'prefers_females',
  'prefers_males',
  'shy_at_first',
  'no_hyper_puppies'
);

create type public.playdate_kind as enum ('live_walk', 'scheduled', 'recurring', 'spot_booking');
create type public.playdate_visibility as enum ('public', 'friends', 'invite_only');
create type public.playdate_status as enum ('active', 'cancelled', 'finished');
create type public.rsvp_status as enum ('going', 'maybe', 'declined');

create type public.booking_status as enum (
  'proposed',
  'collecting',
  'requested',
  'confirmed',
  'cancelled'
);

create type public.tracker_vendor as enum ('phone', 'webhook', 'tractive', 'fi', 'other');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

-- ---------------------------------------------------------------------------
-- Utilidades compartidas.
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

/**
 * Reduce un punto a una rejilla de aproximadamente un kilómetro.
 *
 * Es la regla de privacidad del proyecto hecha código, y vive en la base de
 * datos además de en el cliente: si un día una ruta olvida degradar la
 * ubicación antes de guardarla, el disparador de `device_tokens` la degrada
 * igualmente. La precisión no debe depender de que todos los llamadores se
 * acuerden.
 */
create or replace function public.coarsen_point(point extensions.geography)
returns extensions.geography
language sql
immutable
set search_path = ''
as $$
  select extensions.st_setsrid(
    extensions.st_makepoint(
      round(extensions.st_x(point::extensions.geometry)::numeric, 2)::double precision,
      round(extensions.st_y(point::extensions.geometry)::numeric, 2)::double precision
    ),
    4326
  )::extensions.geography;
$$;
