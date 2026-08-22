-- Quedadas, asistencia, radar en vivo y valoración posterior.

create table public.playdates (
  id uuid primary key default extensions.gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  host_dog_id uuid references public.dogs (id) on delete set null,

  kind public.playdate_kind not null,
  title text not null check (length(trim(title)) between 3 and 120),
  description text check (description is null or length(description) <= 2000),

  place_id uuid references public.places (id) on delete set null,
  spot_id uuid,
  point extensions.geography(Point, 4326) not null,

  starts_at timestamptz not null,
  -- En `live_walk` esto es la caducidad: "estoy en el parque hasta las 19:00".
  ends_at timestamptz not null,
  recurrence_rule text,

  visibility public.playdate_visibility not null default 'public',

  -- Parámetros de admisión.
  admits_sizes public.dog_size[] not null default '{}',
  admits_energy public.energy_level[] not null default '{}',
  puppies_only boolean not null default false,
  breed_filter text[] not null default '{}',
  leashed boolean not null default false,
  max_dogs smallint check (max_dogs is null or max_dogs between 2 and 50),

  public_slug text not null unique,
  status public.playdate_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint playdates_ends_after_start check (ends_at > starts_at),
  -- Un check-in en vivo que dura más de cuatro horas casi siempre es un olvido.
  -- La caducidad obligatoria es una decisión de privacidad: nadie debe quedar
  -- visible en el mapa por no acordarse de apagarlo.
  constraint playdates_live_walk_max_duration check (
    kind <> 'live_walk' or ends_at <= starts_at + interval '4 hours'
  ),
  constraint playdates_recurrence_only_recurring check (
    recurrence_rule is null or kind = 'recurring'
  )
);

create trigger playdates_touch_updated_at
  before update on public.playdates
  for each row execute function public.touch_updated_at();

create index playdates_point_idx on public.playdates using gist (point);
create index playdates_host_idx on public.playdates (host_id);
create index playdates_place_idx on public.playdates (place_id) where place_id is not null;
-- El descubrimiento solo pregunta por quedadas vivas y futuras.
create index playdates_active_idx on public.playdates (starts_at)
  where status = 'active';

create table public.playdate_rsvps (
  playdate_id uuid not null references public.playdates (id) on delete cascade,
  dog_id uuid not null references public.dogs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null default 'going',
  -- Se guarda la afinidad del momento de unirse: permite auditar después qué
  -- prometió el algoritmo y contrastarlo con cómo fue el encuentro.
  affinity_at_join smallint check (affinity_at_join between 0 and 100),
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (playdate_id, dog_id)
);

create index playdate_rsvps_profile_idx on public.playdate_rsvps (profile_id);
create index playdate_rsvps_dog_idx on public.playdate_rsvps (dog_id);

-- ---------------------------------------------------------------------------
-- Radar en vivo.
--
-- Una fila por perro, que se sobrescribe. No se historiza a propósito: guardar
-- el rastro de por dónde pasea alguien cada día es justo lo que este producto no
-- debe hacer, y la forma más fiable de no filtrarlo es no tenerlo.
--
-- La presencia se ancla al lugar del check-in, no a las coordenadas exactas del
-- tutor: nunca hay un punto azul siguiendo a una persona.
-- ---------------------------------------------------------------------------

create table public.live_presence (
  dog_id uuid primary key references public.dogs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  playdate_id uuid references public.playdates (id) on delete set null,
  place_id uuid references public.places (id) on delete set null,
  point extensions.geography(Point, 4326) not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  -- Distingue el check-in que pulsó una persona del que disparó una geocerca.
  source text not null default 'manual' check (source in ('manual', 'geofence')),
  constraint live_presence_expiry_bounded check (expires_at <= last_seen_at + interval '4 hours')
);

create index live_presence_point_idx on public.live_presence using gist (point);
create index live_presence_active_idx on public.live_presence (expires_at);
create index live_presence_profile_idx on public.live_presence (profile_id);

create table public.playdate_feedback (
  id uuid primary key default extensions.gen_random_uuid(),
  playdate_id uuid references public.playdates (id) on delete set null,
  rater_dog_id uuid not null references public.dogs (id) on delete cascade,
  rated_dog_id uuid not null references public.dogs (id) on delete cascade,
  -- Un pulgar arriba o abajo. Deliberadamente no hay estrellas: pedir un
  -- matiz de cinco niveles sobre el perro de un vecino invita a un detalle que
  -- nadie quiere escribir y que a nadie le sienta bien leer.
  is_positive boolean not null,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  constraint playdate_feedback_no_self check (rater_dog_id <> rated_dog_id),
  unique (playdate_id, rater_dog_id, rated_dog_id)
);

create index playdate_feedback_pair_idx on public.playdate_feedback (rater_dog_id, rated_dog_id);

-- Tokens de envío. La ubicación aquí SIEMPRE está degradada a ~1 km: sirve para
-- decidir un radio de dos kilómetros y no sirve para seguir a nadie.
create table public.device_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  coarse_point extensions.geography(Point, 4326),
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index device_tokens_profile_idx on public.device_tokens (profile_id);
create index device_tokens_coarse_idx on public.device_tokens using gist (coarse_point);

/**
 * Degrada la ubicación antes de guardarla, pase lo que pase.
 *
 * La aplicación ya la degrada en el cliente. Este disparador existe porque una
 * garantía de privacidad que depende de que todos los llamadores se acuerden no
 * es una garantía.
 */
create or replace function public.enforce_coarse_device_point()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.coarse_point is not null then
    new.coarse_point = public.coarsen_point(new.coarse_point);
  end if;
  return new;
end;
$$;

create trigger device_tokens_enforce_coarse
  before insert or update on public.device_tokens
  for each row execute function public.enforce_coarse_device_point();
