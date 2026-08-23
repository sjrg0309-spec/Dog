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
-- El orden de los valores de `pet_size` y `energy_level` es significativo: la
-- distancia entre dos tallas es aritmética y el algoritmo de compatibilidad
-- depende de ello. Insertar un valor nuevo en medio cambiaría las puntuaciones.
--
-- `pet_size` es una escala RELATIVA DENTRO DE LA ESPECIE. Un conejo gigante y un
-- mastín gigante no tienen nada que ver, y da igual: los encuentros son siempre
-- entre animales de la misma especie, así que la comparación nunca cruza ese
-- límite.
-- ---------------------------------------------------------------------------

create type public.pet_size as enum ('mini', 'small', 'medium', 'large', 'giant');
-- Valores neutros a propósito: la interfaz los traduce al lenguaje de cada
-- especie ("de sofá" y "velocista" en un perro, "tranquilo" y "muy activo" en un
-- conejo), pero el dato guardado es el mismo y el algoritmo no necesita saber de
-- qué animal habla.
create type public.energy_level as enum ('low', 'medium', 'high');
-- Superconjunto multiespecie. Cada especie declara cuáles le aplican:
-- `grooming`, `side_by_side` y `forage` son lo que de verdad hacen conejos,
-- cobayas y hurones, y tenían que entrar en el cálculo, no quedarse de adorno.
create type public.play_style as enum (
  'chase', 'wrestle', 'toys', 'calm_walk', 'grooming', 'side_by_side', 'forage'
);
create type public.pet_sex as enum ('male', 'female');

create type public.trust_circle_flag as enum (
  'loves_everyone',
  'same_size_only',
  'prefers_females',
  'prefers_males',
  'shy_at_first',
  -- Antes era "no cachorros": ahora vale para el juvenil de cualquier especie.
  'no_hyper_juveniles'
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

-- ---------------------------------------------------------------------------
-- Modelo social y taxonomía.
--
-- El modelo social es la decisión que gobierna todo el producto: qué se le
-- ofrece al tutor y si un encuentro tiene sentido siquiera.
-- ---------------------------------------------------------------------------

create type public.social_model as enum (
  -- Encuentros abiertos en grupo. Solo el perro.
  'pack',
  -- Dos o tres, en terreno neutral, supervisados y cortos.
  'small_group',
  -- Sin encuentros. La aplicación ofrece comunidad, lugares y servicios.
  'solitary'
);

create type public.taxon_group as enum (
  'mammal_carnivore', 'mammal_lagomorph', 'mammal_rodent',
  'bird', 'reptile', 'amphibian', 'fish', 'invertebrate'
);

create type public.legal_status as enum (
  'companion_animal',
  'domestic',
  'positive_list_pending',
  'restricted',
  'excluded'
);
