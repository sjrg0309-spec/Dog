-- Tutores y perros.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 60),
  avatar_url text,
  contact_phone text,
  phone_verified_at timestamptz,
  bio text check (bio is null or length(bio) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Perros.
--
-- Las columnas de temperamento no son opcionales por capricho: un perro sin
-- ellas no puede entrar al descubrimiento, y la aplicación debe pedirlas en vez
-- de mostrarlo con datos a medias. Se permiten nulas para que el onboarding
-- pueda guardar en pasos, pero `is_matchable` decide quién participa.
-- ---------------------------------------------------------------------------

create table public.dogs (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,

  name text not null check (length(trim(name)) between 1 and 40),
  photo_url text,
  -- "Vídeo de cómo juega": vale más que cualquier descripción para decidir si
  -- quedas con un desconocido en un parque.
  play_video_url text,
  bio text check (bio is null or length(bio) <= 500),

  breeds text[] not null default '{}',
  birth_date date check (birth_date is null or birth_date <= current_date),
  size public.dog_size,
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg between 0.3 and 120),
  sex public.dog_sex,
  is_neutered boolean,

  energy_level public.energy_level,
  play_styles public.play_style[] not null default '{}',
  trust_circle public.trust_circle_flag[] not null default '{}',
  is_leash_reactive boolean not null default false,

  -- El chip identifica, no localiza. Es un transpondedor pasivo: sin batería y
  -- sin GPS. Se guarda para verificar al tutor y para la recuperación por
  -- veterinario, nunca como fuente de ubicación.
  microchip_code text,
  microchip_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- ISO 11784/11785 son 15 dígitos; se aceptan los formatos heredados de 9 y 10
  -- porque siguen circulando muchos perros con ellos.
  constraint dogs_microchip_format check (
    microchip_code is null or microchip_code ~ '^[0-9]{9}$|^[0-9]{10}$|^[0-9]{15}$'
  ),
  -- Verificado implica que hay algo que verificar.
  constraint dogs_microchip_verified_needs_code check (
    microchip_verified_at is null or microchip_code is not null
  )
);

create trigger dogs_touch_updated_at
  before update on public.dogs
  for each row execute function public.touch_updated_at();

create index dogs_owner_idx on public.dogs (owner_id);

-- Un chip identifica a un animal concreto: dos perros no pueden compartirlo.
create unique index dogs_microchip_unique on public.dogs (microchip_code)
  where microchip_code is not null;

/** ¿Tiene el perro lo mínimo para que el algoritmo pueda puntuarlo? */
create or replace function public.dog_is_matchable(dog public.dogs)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select dog.size is not null
     and dog.energy_level is not null
     and array_length(dog.play_styles, 1) is not null;
$$;

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  constraint friendships_no_self check (requester_id <> addressee_id)
);

create index friendships_addressee_idx on public.friendships (addressee_id, status);

/**
 * ¿Son amigos aceptados estos dos tutores?
 *
 * La usan varias políticas de RLS, así que es `security definer`: una política
 * no puede depender de que quien consulta tenga permiso para leer la tabla de
 * amistades de otro. `search_path` fijo y vacío por la misma razón.
 */
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;
