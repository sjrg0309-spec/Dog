-- Tutores y animales.

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
-- Animales.
--
-- Las columnas de temperamento no son opcionales por capricho: un animal sin
-- ellas no puede entrar al descubrimiento, y la aplicación debe pedirlas en vez
-- de mostrarlo con datos a medias. Se permiten nulas para que el onboarding
-- pueda guardar en pasos, pero `is_matchable` decide quién participa.
-- ---------------------------------------------------------------------------

create table public.pets (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  /**
   * La especie decide todo lo demás: si participa en encuentros, qué rasgos se
   * le preguntan al tutor y qué estado legal tiene. Sin ella no se puede
   * evaluar nada, así que es obligatoria.
   */
  species_id text not null references public.species (id),

  name text not null check (length(trim(name)) between 1 and 40),
  photo_url text,
  -- "Vídeo de cómo juega": vale más que cualquier descripción para decidir si
  -- quedas con un desconocido en un parque.
  play_video_url text,
  bio text check (bio is null or length(bio) <= 500),

  breeds text[] not null default '{}',
  birth_date date check (birth_date is null or birth_date <= current_date),
  size public.pet_size,
  /**
   * Peso en kilos, con tres decimales.
   *
   * El rango va de un gramo a ciento veinte kilos porque el catálogo va de un
   * betta de cinco gramos a un mastín. Un mínimo pensado para perros —0,3 kg—
   * dejaba fuera a la mitad de las especies, y es exactamente el tipo de
   * suposición que se cuela al convertir una aplicación de perros en una de
   * mascotas.
   */
  weight_kg numeric(6, 3) check (weight_kg is null or weight_kg between 0.001 and 120),
  sex public.pet_sex,
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
  -- porque siguen circulando muchos animales con ellos.
  constraint pets_microchip_format check (
    microchip_code is null or microchip_code ~ '^[0-9]{9}$|^[0-9]{10}$|^[0-9]{15}$'
  ),
  -- Verificado implica que hay algo que verificar.
  constraint pets_microchip_verified_needs_code check (
    microchip_verified_at is null or microchip_code is not null
  )
);

create trigger pets_touch_updated_at
  before update on public.pets
  for each row execute function public.touch_updated_at();

create index pets_owner_idx on public.pets (owner_id);
create index pets_species_idx on public.pets (species_id);

-- Un chip identifica a un animal concreto: dos animales no pueden compartirlo.
create unique index pets_microchip_unique on public.pets (microchip_code)
  where microchip_code is not null;

/**
 * ¿Puede este animal entrar al descubrimiento?
 *
 * Dos condiciones, y la primera manda: su especie tiene que participar en
 * encuentros. Un gato con la ficha perfectamente rellenada sigue sin entrar,
 * porque el problema no es que falten datos sino que llevarlo a conocer a otro
 * gato le haría daño.
 */
create or replace function public.pet_is_matchable(target_pet uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.pets p
    join public.species s on s.id = p.species_id
    where p.id = target_pet
      and s.social_model <> 'solitary'
      and p.size is not null
      and p.energy_level is not null
      and array_length(p.play_styles, 1) is not null
  );
$$;

/**
 * No se registran especies excluidas de forma expresa.
 *
 * Una cotorra argentina no puede tenerse legalmente en España, así que la
 * aplicación no le abre una ficha. Lo que está solo pendiente del listado
 * positivo sí se registra, mostrando el aviso: prohibirlo sería decidir por el
 * usuario sobre una norma todavía en desarrollo.
 */
create or replace function public.enforce_registrable_species()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.species_is_registrable(new.species_id, 'ES') then
    raise exception 'La especie % no puede registrarse: está excluida de forma expresa',
      new.species_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger pets_enforce_registrable_species
  before insert or update of species_id on public.pets
  for each row execute function public.enforce_registrable_species();

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
