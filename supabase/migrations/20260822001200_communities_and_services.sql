-- Comunidad y servicios.
--
-- Esto es lo que hace que Coincide sirva a un tutor de gato, de gecko o de
-- betta. Sin ello, la mitad del catálogo de especies tendría una ficha bonita y
-- ningún motivo para volver a abrir la aplicación.
--
-- La decisión de producto detrás: **no todas las mascotas socializan, pero todos
-- los tutores sí**. Un tutor de reptiles necesita saber qué veterinario de
-- exóticos hay abierto un domingo y con quién hablar cuando su animal deja de
-- comer. Eso es tan producto como una quedada en el parque.
--
-- Reutiliza el mismo motor geoespacial que el radar: son consultas por radio
-- sobre PostGIS, no una funcionalidad aparte.

create type public.service_kind as enum (
  'vet',
  'exotic_vet',
  'emergency_vet',
  'groomer',
  'boarding',
  'trainer',
  'shop',
  'shelter'
);

-- ---------------------------------------------------------------------------
-- Comunidades.
--
-- Un grupo de tutores por especie y zona. Para las especies que no quedan es la
-- funcionalidad principal; para las que sí, es el complemento.
-- ---------------------------------------------------------------------------

create table public.communities (
  id uuid primary key default extensions.gen_random_uuid(),
  /** Nulo significa "de todas las especies": el grupo del barrio, sin más. */
  species_id text references public.species (id) on delete cascade,
  name text not null check (length(trim(name)) between 3 and 120),
  description text check (description is null or length(description) <= 2000),

  /** Centro de la zona a la que sirve. Se consulta por radio, como el radar. */
  center extensions.geography(Point, 4326) not null,
  radius_m int not null default 10000 check (radius_m between 500 and 200000),

  created_by uuid references public.profiles (id) on delete set null,
  public_slug text not null unique,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index communities_center_idx on public.communities using gist (center);
create index communities_species_idx on public.communities (species_id);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, profile_id)
);

create index community_members_profile_idx on public.community_members (profile_id);

-- ---------------------------------------------------------------------------
-- Servicios.
--
-- Directorio de veterinarios, urgencias, guarderías y tiendas, con las especies
-- que cada uno atiende de verdad.
--
-- `species_served` es la columna que justifica toda la tabla: un veterinario de
-- perros y gatos no sabe tratar a un gecko, y mandarle uno es peor que no tener
-- directorio. Que un servicio diga a quién atiende es el dato útil.
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  kind public.service_kind not null,
  point extensions.geography(Point, 4326) not null,
  address text,
  phone text,
  url text,

  /** Especies que atiende. Vacío significa sin declarar, no "ninguna". */
  species_served text[] not null default '{}',
  /** Urgencias fuera de horario: el dato que se busca a las tres de la mañana. */
  is_24h boolean not null default false,

  /** Verificado por el equipo, no por quien lo publicó. */
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index services_point_idx on public.services using gist (point);
create index services_kind_idx on public.services (kind);
create index services_species_idx on public.services using gin (species_served);
create index services_emergency_idx on public.services (is_24h) where is_24h;

-- ---------------------------------------------------------------------------
-- Consultas
-- ---------------------------------------------------------------------------

/**
 * ¿Pertenece este tutor a esta comunidad?
 *
 * Es `security definer` por necesidad, no por comodidad: una política de RLS
 * sobre `community_members` que consulte `community_members` se llama a sí misma
 * y Postgres aborta con recursión infinita. La comprobación tiene que salir del
 * alcance de la política.
 */
create or replace function public.is_community_member(target_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_members m
    where m.community_id = target_community and m.profile_id = auth.uid()
  );
$$;

/**
 * Comunidades cerca que sirvan a una especie.
 *
 * Devuelve tanto las de la especie concreta como las generales del barrio: un
 * tutor de gecko quiere su grupo de reptiles, pero también el de su zona.
 *
 * `security definer` porque cuenta miembros: el número de integrantes es
 * público, pero la lista de quiénes son no lo es, y sin esto habría que abrir
 * `community_members` a cualquiera para poder mostrar un contador.
 */
create or replace function public.communities_nearby(
  lat double precision,
  lng double precision,
  target_species text default null,
  radius_m int default 25000
)
returns table (
  id uuid,
  name text,
  species_id text,
  member_count int,
  public_slug text,
  distance_m double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.species_id,
    (select count(*) from public.community_members m where m.community_id = c.id)::int,
    c.public_slug,
    extensions.st_distance(c.center, public.make_point(lat, lng))
  from public.communities c
  where c.is_public
    and (target_species is null or c.species_id is null or c.species_id = target_species)
    and extensions.st_dwithin(c.center, public.make_point(lat, lng), radius_m)
  order by 6;
$$;

/**
 * Servicios cerca para una especie.
 *
 * Un servicio sin especies declaradas aparece igualmente: es preferible que el
 * tutor llame y pregunte a que la aplicación le oculte el único veterinario del
 * pueblo por no haber rellenado un campo.
 */
create or replace function public.services_nearby(
  lat double precision,
  lng double precision,
  target_species text default null,
  target_kind public.service_kind default null,
  radius_m int default 25000
)
returns table (
  id uuid,
  name text,
  kind public.service_kind,
  is_24h boolean,
  species_served text[],
  is_verified boolean,
  distance_m double precision
)
language sql
stable
set search_path = ''
as $$
  select
    s.id, s.name, s.kind, s.is_24h, s.species_served,
    (s.verified_at is not null),
    extensions.st_distance(s.point, public.make_point(lat, lng))
  from public.services s
  where extensions.st_dwithin(s.point, public.make_point(lat, lng), radius_m)
    and (target_kind is null or s.kind = target_kind)
    and (
      target_species is null
      or cardinality(s.species_served) = 0
      or target_species = any (s.species_served)
    )
  -- Primero las urgencias y lo verificado: es el orden que importa cuando se
  -- busca esto con prisa.
  order by s.is_24h desc, (s.verified_at is not null) desc, 7;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.services enable row level security;

-- El directorio es público a propósito: encontrar un veterinario de urgencias
-- no debería exigir crear una cuenta.
create policy communities_select_public on public.communities
  for select to anon, authenticated using (is_public);

create policy communities_insert_authenticated on public.communities
  for insert to authenticated with check (created_by = auth.uid());

create policy communities_update_creator on public.communities
  for update to authenticated using (created_by = auth.uid());

create policy community_members_select_own on public.community_members
  for select to authenticated
  using (profile_id = auth.uid() or public.is_community_member(community_id));

create policy community_members_join_self on public.community_members
  for insert to authenticated with check (profile_id = auth.uid());

create policy community_members_leave_self on public.community_members
  for delete to authenticated using (profile_id = auth.uid());

create policy services_select_everyone on public.services
  for select to anon, authenticated using (true);

create policy services_insert_authenticated on public.services
  for insert to authenticated with check (created_by = auth.uid());

grant select, insert, update, delete on
  public.communities, public.community_members, public.services to authenticated;
grant select on public.communities, public.services to anon;
grant all on public.communities, public.community_members, public.services to service_role;
grant execute on function
  public.communities_nearby(double precision, double precision, text, int),
  public.services_nearby(double precision, double precision, text, public.service_kind, int)
  to anon, authenticated;
