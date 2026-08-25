-- Publicaciones con foto, y el radar acotado a zonas pet-friendly.
--
-- Dos cosas distintas en la misma migración porque comparten una idea: **el
-- lugar deja de ser decoración**. Una publicación puede decir dónde se hizo, y
-- un check-in ya no puede hacerse en cualquier sitio.

-- ---------------------------------------------------------------------------
-- Zonas pet-friendly
-- ---------------------------------------------------------------------------
--
-- Hasta aquí un lugar era un punto con nombre. Para acotar el radar hace falta
-- que sea un **área**: un parque tiene doscientos metros de radio y una terraza
-- veinte, y hacerse visible desde el salón de casa no debería poder ocurrir.
--
-- Por qué esto es mejor producto y no solo una restricción:
--
--  1. **El radar deja de ser una baliza personal.** Antes decía «estoy aquí» en
--     cualquier coordenada; ahora dice «estoy en el Parque Central», que es lo
--     único que el resto necesita saber y lo único que el tutor querría
--     publicar. La regla de privacidad que ya teníamos —anclar al lugar, nunca a
--     la persona— pasa de ser una convención de la interfaz a algo que la base
--     de datos garantiza.
--  2. **Un aviso solo llega donde se puede ir.** Enterarse de que hay un perro
--     compatible en el patio cerrado de un particular no sirve de nada.
--  3. **Filtra el ruido sin pedir nada.** Nadie tiene que acordarse de apagar el
--     check-in al llegar a casa si desde casa no se puede encender.

alter table public.places
  /**
   * Radio efectivo de la zona, en metros.
   *
   * Un parque son cientos de metros; una terraza, veinte. Guardar un polígono
   * sería más exacto y muchísimo más caro de mantener a mano: un radio por
   * lugar se corrige en un segundo y acierta en el 95 % de los casos.
   */
  add column radius_m int not null default 150 check (radius_m between 10 and 2000),
  /**
   * ¿Se puede hacer check-in aquí?
   *
   * Separado de que el lugar exista en el directorio. Una tienda de piensos es
   * un sitio útil que sale en el mapa y del que no tiene sentido anunciarse.
   */
  add column allows_checkin boolean not null default true;

comment on column public.places.allows_checkin is
  'Zona pet-friendly donde el radar puede encenderse. Un lugar del directorio '
  'no es automáticamente un sitio desde el que anunciarse.';

/**
 * ¿En qué zona pet-friendly está este punto?
 *
 * Devuelve la más pequeña que lo contenga: si una terraza está dentro de un
 * parque, gana la terraza, que es la respuesta más informativa.
 */
create or replace function public.place_at(
  lat double precision,
  lng double precision
)
returns table (id uuid, name text, kind text, distance_m double precision)
language sql
stable
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.kind,
    extensions.st_distance(p.point, public.make_point(lat, lng))
  from public.places p
  where p.allows_checkin
    and extensions.st_dwithin(p.point, public.make_point(lat, lng), p.radius_m)
  order by p.radius_m asc, 4 asc
  limit 1;
$$;

/**
 * El radar solo se enciende dentro de una zona pet-friendly.
 *
 * Está aquí y no en el cliente por el motivo de siempre: una aplicación móvil se
 * desensambla en cinco minutos, y lo que impide que alguien publique su posición
 * desde el portal de su casa llamando a la API es esto.
 */
create or replace function public.enforce_checkin_area()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
  found_name text;
begin
  select id, name into found_id, found_name
  from public.place_at(
    extensions.st_y(new.point::extensions.geometry),
    extensions.st_x(new.point::extensions.geometry)
  );

  if found_id is null then
    raise exception
      'El radar solo funciona dentro de una zona pet-friendly: parques, áreas caninas y terrazas que lo admiten';
  end if;

  -- El lugar no se pide, se deduce. Que lo declare el cliente sería dejar que
  -- alguien dijera estar en el Parque Central desde el otro lado de la ciudad.
  new.place_id := found_id;
  return new;
end;
$$;

create trigger live_presence_enforce_area
  before insert or update of point on public.live_presence
  for each row execute function public.enforce_checkin_area();

-- Los parques de la semilla son zonas grandes; el café, una terraza pequeña.
update public.places set radius_m = 250 where kind = 'park';
update public.places set radius_m = 30, allows_checkin = true where kind = 'cafe';

-- ---------------------------------------------------------------------------
-- Publicaciones
-- ---------------------------------------------------------------------------
--
-- Una foto, un texto y, si el tutor quiere, el lugar. Es lo que la gente ya sabe
-- hacer sin que nadie se lo explique, y aquí tiene una función que no tiene en
-- una red social genérica: **el perro que sale en la foto está identificado**, y
-- eso es lo que convierte una publicación en un motivo para escribirle a alguien
-- con quien tu perro encaja.

create table public.posts (
  id uuid primary key default extensions.gen_random_uuid(),
  /** De qué perro es la publicación. No del tutor: del perro. */
  pet_id uuid not null references public.pets (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,

  /**
   * Ruta del objeto en el almacenamiento, no la imagen.
   *
   * Postgres no guarda binarios grandes bien y una foto en base64 dentro de una
   * fila envenena cualquier consulta que la roce. La subida va a almacenamiento
   * de objetos y aquí queda la clave.
   */
  image_path text not null check (length(trim(image_path)) > 0),
  /** Descripción de la imagen. Obligatoria: una foto sin alt no la ve todo el mundo. */
  image_alt text not null check (length(trim(image_alt)) between 3 and 300),
  caption text check (caption is null or length(caption) <= 2200),

  /** Dónde se hizo. Solo zonas pet-friendly: es la misma regla que el radar. */
  place_id uuid references public.places (id) on delete set null,

  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index posts_pet_idx on public.posts (pet_id, created_at desc);
create index posts_author_idx on public.posts (author_id);
create index posts_feed_idx on public.posts (created_at desc) where is_public;

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create table public.post_comments (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index post_comments_post_idx on public.post_comments (post_id, created_at);

/**
 * Solo se publica del propio perro.
 *
 * Sin esto, cualquiera podría colgar una foto atribuida al perro de otro. Es la
 * misma comprobación que ya hace el RSVP, y por el mismo motivo.
 */
create or replace function public.enforce_post_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.pets p where p.id = new.pet_id and p.owner_id = new.author_id
  ) then
    raise exception 'Solo se puede publicar sobre un animal propio';
  end if;
  return new;
end;
$$;

create trigger posts_enforce_ownership
  before insert or update of pet_id, author_id on public.posts
  for each row execute function public.enforce_post_ownership();

/** El lugar de una publicación es una zona pet-friendly o no es nada. */
create or replace function public.enforce_post_place()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.place_id is not null and not exists (
    select 1 from public.places p where p.id = new.place_id and p.allows_checkin
  ) then
    raise exception 'Ese lugar no es una zona pet-friendly';
  end if;
  return new;
end;
$$;

create trigger posts_enforce_place
  before insert or update of place_id on public.posts
  for each row execute function public.enforce_post_place();

-- ---------------------------------------------------------------------------
-- El feed
-- ---------------------------------------------------------------------------

/**
 * Publicaciones públicas con lo que la tarjeta necesita.
 *
 * Se cuenta aquí en lugar de en el cliente para no hacer una consulta por
 * publicación, que es el camino más corto a un feed que tarda dos segundos.
 */
create or replace view public.public_posts
  with (security_invoker = false) as
  select
    po.id,
    po.pet_id,
    pe.name as pet_name,
    pe.species_id,
    po.author_id,
    pr.display_name as author_name,
    po.image_path,
    po.image_alt,
    po.caption,
    po.place_id,
    pl.name as place_name,
    po.created_at,
    (select count(*) from public.post_likes l where l.post_id = po.id)::int as like_count,
    (select count(*) from public.post_comments c where c.post_id = po.id)::int as comment_count
  from public.posts po
  join public.pets pe on pe.id = po.pet_id
  left join public.public_profiles pr on pr.id = po.author_id
  left join public.places pl on pl.id = po.place_id
  where po.is_public;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

create policy posts_select_public on public.posts
  for select to anon, authenticated using (is_public or author_id = auth.uid());

create policy posts_write_own on public.posts
  for all to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- Quién ha dado like es del propio autor del like y del dueño de la
-- publicación; el contador es público y sale de la vista.
create policy post_likes_select_own on public.post_likes
  for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

create policy post_likes_write_own on public.post_likes
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy post_comments_select_public on public.post_comments
  for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.is_public));

create policy post_comments_write_own on public.post_comments
  for all to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

grant select, insert, update, delete on
  public.posts, public.post_likes, public.post_comments to authenticated;
grant select on public.posts, public.post_comments to anon;
grant select on public.public_posts to anon, authenticated;
grant all on public.posts, public.post_likes, public.post_comments to service_role;
grant execute on function public.place_at(double precision, double precision) to anon, authenticated;
