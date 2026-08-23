-- Espacios privados y reserva en grupo con reparto de coste.
--
-- La diferencia con un directorio de espacios en renta está aquí: alquilar un
-- patio a una persona es fácil, y saber qué cinco animales pueden compartirlo sin
-- pelearse requiere conocer a los animales. Coincide ya lo sabe, así que puede
-- armar el grupo y repartir el importe.
--
-- En esta fase el cobro NO ocurre dentro de la aplicación: `payment_mode` es
-- siempre `offline`. Repartir dinero entre varios exige alta fiscal del
-- anfitrión, reembolsos parciales cuando alguien se cae y una postura sobre
-- responsabilidad civil. Es un producto entero, y es la única parte de esto de
-- la que no se sale iterando.

create table public.spots (
  id uuid primary key default extensions.gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,

  title text not null check (length(trim(title)) between 3 and 120),
  description text check (description is null or length(description) <= 2000),
  point extensions.geography(Point, 4326) not null,
  -- La dirección exacta solo se revela tras confirmar la reserva. Antes, la RLS
  -- solo deja ver la zona.
  address text,
  photos text[] not null default '{}',

  size_m2 int check (size_m2 is null or size_m2 between 10 and 100000),
  is_fenced boolean not null default false,
  fence_height_cm smallint check (fence_height_cm is null or fence_height_cm between 30 and 400),
  has_water boolean not null default false,
  has_shade boolean not null default false,
  -- Un grupo cada vez: es la razón por la que un tutor con un animal reactivo
  -- paga por un espacio privado en lugar de ir al parque.
  is_private_single_group boolean not null default true,

  max_pets smallint not null check (max_pets between 1 and 30),
  price_per_slot_cents int not null check (price_per_slot_cents >= 0),
  slot_minutes smallint not null default 60 check (slot_minutes between 15 and 480),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),

  rules text check (rules is null or length(rules) <= 2000),
  cancellation_policy text,
  status text not null default 'active' check (status in ('active', 'paused', 'removed')),
  public_slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger spots_touch_updated_at
  before update on public.spots
  for each row execute function public.touch_updated_at();

create index spots_point_idx on public.spots using gist (point);
create index spots_host_idx on public.spots (host_id);
create index spots_active_idx on public.spots (status) where status = 'active';

alter table public.playdates
  add constraint playdates_spot_fk foreign key (spot_id) references public.spots (id) on delete set null;

create table public.spot_bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  spot_id uuid not null references public.spots (id) on delete cascade,
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  playdate_id uuid references public.playdates (id) on delete set null,

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  total_price_cents int not null check (total_price_cents >= 0),
  -- Derivado: se recalcula cada vez que alguien confirma o se cae del grupo.
  price_per_pet_cents int not null default 0 check (price_per_pet_cents >= 0),
  confirmed_pets_count smallint not null default 0 check (confirmed_pets_count >= 0),

  -- La afinidad del grupo en el momento de reservar, por el mínimo par a par.
  group_affinity_min smallint check (group_affinity_min between 0 and 100),

  status public.booking_status not null default 'proposed',
  -- En esta fase solo existe un valor. La columna está para que activar los
  -- pagos no exija una migración de datos.
  payment_mode text not null default 'offline' check (payment_mode in ('offline')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spot_bookings_ends_after_start check (ends_at > starts_at)
);

create trigger spot_bookings_touch_updated_at
  before update on public.spot_bookings
  for each row execute function public.touch_updated_at();

create index spot_bookings_spot_idx on public.spot_bookings (spot_id, starts_at);
create index spot_bookings_organizer_idx on public.spot_bookings (organizer_id);

create table public.booking_participants (
  booking_id uuid not null references public.spot_bookings (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.rsvp_status not null default 'going',
  share_cents int not null default 0 check (share_cents >= 0),
  created_at timestamptz not null default now(),
  primary key (booking_id, pet_id)
);

create index booking_participants_profile_idx on public.booking_participants (profile_id);

/**
 * Reparte el importe entre los confirmados sin perder un céntimo.
 *
 * Trabaja en enteros y reparte el resto de uno en uno, igual que `splitCost` en
 * packages/core. Dividir en coma flotante y redondear cada parte deja
 * descuadres, y un descuadre en dinero real de un usuario es de las pocas cosas
 * que no se arreglan el martes siguiente.
 */
create or replace function public.recalculate_booking_shares(booking uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  total int;
  going_count int;
  base int;
  remainder int;
begin
  select b.total_price_cents into total
  from public.spot_bookings b
  where b.id = booking;

  select count(*) into going_count
  from public.booking_participants p
  where p.booking_id = booking and p.status = 'going';

  if going_count = 0 then
    update public.booking_participants
      set share_cents = 0
      where booking_id = booking;
    update public.spot_bookings
      set price_per_pet_cents = 0, confirmed_pets_count = 0
      where id = booking;
    return;
  end if;

  base := total / going_count;
  remainder := total % going_count;

  -- El orden por `pet_id` hace el reparto determinista: recalcular dos veces
  -- con los mismos participantes da exactamente las mismas partes.
  with ordered as (
    select pet_id, row_number() over (order by pet_id) - 1 as position
    from public.booking_participants
    where booking_id = booking and status = 'going'
  )
  update public.booking_participants p
    set share_cents = base + case when o.position < remainder then 1 else 0 end
    from ordered o
    where p.booking_id = booking and p.pet_id = o.pet_id;

  update public.booking_participants
    set share_cents = 0
    where booking_id = booking and status <> 'going';

  update public.spot_bookings
    set price_per_pet_cents = base + case when remainder > 0 then 1 else 0 end,
        confirmed_pets_count = going_count
    where id = booking;
end;
$$;

create or replace function public.booking_participants_recalculate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- El recálculo escribe en la misma tabla que dispara este trigger. Sin este
  -- corte, cada escritura volvería a dispararlo y la recursión no terminaría.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  perform public.recalculate_booking_shares(coalesce(new.booking_id, old.booking_id));
  return coalesce(new, old);
end;
$$;

create trigger booking_participants_recalculate_shares
  after insert or update or delete on public.booking_participants
  for each row execute function public.booking_participants_recalculate();
