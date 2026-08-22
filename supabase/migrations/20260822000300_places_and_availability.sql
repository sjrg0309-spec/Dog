-- Lugares y horarios declarados de paseo.

create table public.places (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  kind text not null default 'park',
  point extensions.geography(Point, 4326) not null,
  address text,
  -- Atributos que de verdad importan al elegir un parque canino.
  is_fenced boolean,
  has_double_gate boolean,
  has_water boolean,
  has_shade boolean,
  has_small_dog_area boolean,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index places_point_idx on public.places using gist (point);
create index places_kind_idx on public.places (kind);

-- ---------------------------------------------------------------------------
-- Horario declarado.
--
-- Es la pieza que hace que la aplicación sirva a cualquier hora. El radar en
-- vivo solo funciona en hora punta; esto funciona siempre, y sin exigir que dos
-- personas coincidan conectadas.
--
-- `end_time <= start_time` significa cruce de medianoche: el paseo de las
-- 23:30 es un caso corriente, no una excepción.
-- ---------------------------------------------------------------------------

create table public.dog_availability (
  id uuid primary key default extensions.gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  place_id uuid references public.places (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Una franja de duración cero no significa nada; se rechaza en el origen para
  -- que ningún cálculo tenga que decidir qué hacer con ella.
  constraint dog_availability_non_empty check (start_time <> end_time)
);

create index dog_availability_dog_idx on public.dog_availability (dog_id);
create index dog_availability_slot_idx on public.dog_availability (weekday, start_time, end_time);
create index dog_availability_place_idx on public.dog_availability (place_id)
  where place_id is not null;

/**
 * Proyecta una franja a intervalos absolutos de la semana, en minutos.
 *
 * Espeja `toWeeklyIntervals` de packages/core, y hay un test que compara ambas
 * implementaciones sobre los mismos casos: una divergencia entre el cálculo del
 * cliente y el del servidor daría dos respuestas distintas a la misma pregunta.
 */
create or replace function public.availability_intervals(
  weekday smallint,
  start_time time,
  end_time time
)
returns table (interval_start int, interval_end int)
language sql
immutable
set search_path = ''
as $$
  select *
  from (
    select
      weekday * 1440 + extract(hour from start_time)::int * 60
        + extract(minute from start_time)::int as interval_start,
      case
        when end_time > start_time
          then weekday * 1440 + extract(hour from end_time)::int * 60
            + extract(minute from end_time)::int
        else (weekday + 1) * 1440
      end as interval_end
    union all
    -- Segunda mitad de una franja que cruza medianoche. La semana es circular,
    -- así que la madrugada del domingo posterior vuelve al principio.
    select
      ((weekday + 1) % 7) * 1440 as interval_start,
      ((weekday + 1) % 7) * 1440 + extract(hour from end_time)::int * 60
        + extract(minute from end_time)::int as interval_end
    where end_time < start_time
  ) parts
  where interval_end > interval_start;
$$;

/**
 * Minutos de solapamiento semanal entre las agendas de dos perros.
 *
 * Devuelve además los minutos que además coinciden en el mismo parque, que
 * pesan más: quedar es mucho más probable cuando ya vais al mismo sitio.
 */
create or replace function public.schedule_overlap_minutes(dog_a uuid, dog_b uuid)
returns table (total_minutes int, shared_place_minutes int, days smallint[])
language sql
stable
set search_path = ''
as $$
  with a as (
    select av.place_id, i.interval_start, i.interval_end
    from public.dog_availability av
    cross join lateral public.availability_intervals(av.weekday, av.start_time, av.end_time) i
    where av.dog_id = dog_a
  ),
  b as (
    select av.place_id, i.interval_start, i.interval_end
    from public.dog_availability av
    cross join lateral public.availability_intervals(av.weekday, av.start_time, av.end_time) i
    where av.dog_id = dog_b
  ),
  matched as (
    select
      least(a.interval_end, b.interval_end) - greatest(a.interval_start, b.interval_start)
        as minutes,
      greatest(a.interval_start, b.interval_start) as overlap_start,
      (a.place_id is not null and a.place_id = b.place_id) as same_place
    from a
    join b on least(a.interval_end, b.interval_end) > greatest(a.interval_start, b.interval_start)
  )
  select
    coalesce(sum(minutes), 0)::int,
    coalesce(sum(minutes) filter (where same_place), 0)::int,
    coalesce(array_agg(distinct ((overlap_start / 1440) % 7)::smallint), '{}')
  from matched;
$$;
