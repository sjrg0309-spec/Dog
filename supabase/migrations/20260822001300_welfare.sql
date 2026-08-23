-- El interés del animal, en la base de datos.
--
-- Hasta aquí el esquema sabía con quién encaja cada animal. No sabía nada sobre
-- si le conviene salir, y esa es la diferencia entre una aplicación para el
-- tutor y una para la mascota.
--
-- Está aquí y no solo en el cliente por el mismo motivo que las reglas de
-- especie: un cliente se desensambla en cinco minutos, y una quedada de dos
-- horas de hurones creada por una llamada directa a la API sería igual de
-- agotadora para el animal que si la hubiera creado la aplicación.
--
-- Lo que **no** hace: dar consejo veterinario. Son umbrales prudentes de la
-- propia aplicación, guardados a la vista para que se puedan discutir.

-- ---------------------------------------------------------------------------
-- Límites de cuidado por especie
-- ---------------------------------------------------------------------------

alter table public.species
  /** Minutos de contacto seguidos que tolera la especie. 0 = no tiene encuentros. */
  add column max_session_minutes smallint not null default 0
    check (max_session_minutes between 0 and 480),
  /** Horas de descanso antes del siguiente encuentro. */
  add column rest_between_sessions_hours smallint not null default 24
    check (rest_between_sessions_hours between 0 and 168),
  /** Franja térmica en la que un encuentro al aire libre es razonable. */
  add column comfort_temp_min_c smallint not null default 15
    check (comfort_temp_min_c between -30 and 45),
  add column comfort_temp_max_c smallint not null default 26
    check (comfort_temp_max_c between -30 and 50),
  add column senior_from_months smallint not null default 96
    check (senior_from_months between 6 and 600),
  add column needs_neutral_ground boolean not null default true,
  add constraint species_comfort_range check (comfort_temp_min_c < comfort_temp_max_c);

update public.species set
  max_session_minutes = v.max_session,
  rest_between_sessions_hours = v.rest_hours,
  comfort_temp_min_c = v.temp_min,
  comfort_temp_max_c = v.temp_max,
  senior_from_months = v.senior,
  needs_neutral_ground = v.neutral
from (values
  ('dog',            120, 4,  -5, 26,  96, false),
  ('cat',              0, 24,  5, 30, 120, true),
  ('ferret',          20, 4,   2, 24,  48, true),
  ('rabbit',          20, 6,   5, 24,  60, true),
  ('guinea_pig',      20, 6,  15, 26,  48, true),
  ('rat',             30, 6,  15, 26,  18, true),
  ('hamster',          0, 24, 18, 26,  14, true),
  ('gerbil',           0, 24, 18, 28,  24, true),
  ('budgerigar',       0, 24, 18, 30,  60, true),
  ('canary',           0, 24, 15, 28,  60, true),
  ('leopard_gecko',    0, 24, 22, 34,  84, true),
  ('bearded_dragon',   0, 24, 24, 38,  72, true),
  ('greek_tortoise',   0, 24, 20, 34, 240, true),
  ('betta',            0, 24, 24, 30,  24, true),
  ('monk_parakeet',    0, 24, 15, 32,  60, true)
) as v (id, max_session, rest_hours, temp_min, temp_max, senior, neutral)
where public.species.id = v.id;

-- Una especie que socializa y no declara cuánto aguanta es un hueco por el que
-- se cuela una sesión de cuatro horas.
alter table public.species
  add constraint species_social_needs_session_limit
  check (social_model = 'solitary' or max_session_minutes > 0);

-- ---------------------------------------------------------------------------
-- Lo que le pasa a este animal concreto
-- ---------------------------------------------------------------------------

create type public.health_flag as enum (
  'brachycephalic',
  'recovering',
  'vaccination_pending',
  'joint_issues',
  'heat_sensitive',
  'in_heat'
);

alter table public.pets
  add column health_flags public.health_flag[] not null default '{}',
  /**
   * Techos propios declarados por el tutor.
   *
   * La comprobación de que solo endurecen no está aquí sino en la función que
   * los aplica: un `check` contra la especie obligaría a una subconsulta y
   * dejaría la fila sin validar cuando cambie el catálogo. Lo que sí impide la
   * columna es un valor absurdo.
   */
  add column own_max_session_minutes smallint
    check (own_max_session_minutes is null or own_max_session_minutes between 5 and 480),
  add column own_max_temp_c smallint
    check (own_max_temp_c is null or own_max_temp_c between -10 and 45);

comment on column public.pets.health_flags is
  'Circunstancias del animal que cambian lo que puede hacer hoy. No intervienen '
  'en la afinidad: el carácter y el bienestar son dos preguntas distintas.';

-- ---------------------------------------------------------------------------
-- La duración de contacto de una quedada
-- ---------------------------------------------------------------------------

alter table public.playdates
  /**
   * Minutos de contacto seguidos, que no son la duración del evento.
   *
   * Una tarde de hurones dura dos horas y son seis sesiones de veinte minutos
   * con descanso entre medias. Confundir ambas cosas obligaría a elegir entre
   * prohibir la tarde o permitir dos horas de contacto seguido, y las dos
   * respuestas son malas.
   */
  add column session_minutes smallint;

update public.playdates d
set session_minutes = least(
  s.max_session_minutes,
  greatest(5, (extract(epoch from (d.ends_at - d.starts_at)) / 60)::int)
)
from public.species s
where s.id = d.species_id;

alter table public.playdates
  alter column session_minutes set not null,
  add constraint playdates_session_positive check (session_minutes between 5 and 480);

/**
 * Ninguna quedada puede proponer más contacto seguido del que aguanta la especie.
 *
 * Es el equivalente en bienestar del disparador que impide juntar especies
 * distintas: una regla que el tutor no puede saltarse aunque quiera, porque
 * quien la pagaría no es él.
 */
create or replace function public.enforce_session_length()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  limit_minutes smallint;
  species_name text;
begin
  select s.max_session_minutes, s.common_name
    into limit_minutes, species_name
  from public.species s
  where s.id = new.species_id;

  if limit_minutes is null or limit_minutes = 0 then
    raise exception 'La especie % no participa en encuentros', species_name;
  end if;

  if new.session_minutes > limit_minutes then
    raise exception
      'Una sesión de % minutos es demasiado seguida para esta especie (%): el máximo es % minutos y luego descanso',
      new.session_minutes, species_name, limit_minutes;
  end if;

  return new;
end;
$$;

create trigger playdates_session_length
  before insert or update of session_minutes, species_id on public.playdates
  for each row execute function public.enforce_session_length();

/**
 * Cuánto aguanta un animal concreto, aplicando lo que sabemos de él.
 *
 * Espeja `sessionCeilingMinutes` de `packages/core`, y hay un test de paridad
 * que compara las dos implementaciones sobre las mismas entradas: si servidor y
 * cliente respondieran distinto a esta pregunta, la respuesta que vale es
 * siempre la más corta, y eso es un fallo, no un diseño.
 */
create or replace function public.pet_session_ceiling(target_pet uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, least(
    coalesce(p.own_max_session_minutes, 480),
    round(
      s.max_session_minutes
      * case when p.birth_date is not null
              and (extract(year from age(p.birth_date)) * 12
                   + extract(month from age(p.birth_date))) < s.juvenile_until_months
             then 0.5 else 1 end
      * case when p.birth_date is not null
              and (extract(year from age(p.birth_date)) * 12
                   + extract(month from age(p.birth_date))) >= s.senior_from_months
             then 0.6 else 1 end
      * case when 'joint_issues' = any (p.health_flags) then 0.6 else 1 end
    )::int
  ))
  from public.pets p
  join public.species s on s.id = p.species_id
  where p.id = target_pet;
$$;

/**
 * El techo térmico de un animal concreto.
 *
 * Los descuentos se acumulan a propósito: un bulldog sénior no está en la misma
 * situación que un bulldog joven, y sumar es la forma prudente de equivocarse.
 */
create or replace function public.pet_heat_ceiling(target_pet uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select least(
    coalesce(p.own_max_temp_c, 45),
    s.comfort_temp_max_c
      - case when 'brachycephalic' = any (p.health_flags) then 4 else 0 end
      - case when 'heat_sensitive' = any (p.health_flags) then 2 else 0 end
      - case when p.birth_date is not null
                  and (extract(year from age(p.birth_date)) * 12
                       + extract(month from age(p.birth_date))) < s.juvenile_until_months
             then 1 else 0 end
      - case when p.birth_date is not null
                  and (extract(year from age(p.birth_date)) * 12
                       + extract(month from age(p.birth_date))) >= s.senior_from_months
             then 2 else 0 end
  )::int
  from public.pets p
  join public.species s on s.id = p.species_id
  where p.id = target_pet;
$$;

/**
 * ¿Puede este animal entrar hoy al descubrimiento?
 *
 * Amplía `pet_is_matchable` con lo que no es carácter sino estado: quien está
 * en recuperación no aparece en la lista de nadie, y no porque se lleve mal con
 * los demás.
 */
create or replace function public.pet_is_available_today(target_pet uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.pet_is_matchable(target_pet)
     and not exists (
       select 1 from public.pets p
       where p.id = target_pet
         and ('recovering' = any (p.health_flags)
              or 'vaccination_pending' = any (p.health_flags))
     );
$$;

grant execute on function
  public.pet_session_ceiling(uuid),
  public.pet_heat_ceiling(uuid),
  public.pet_is_available_today(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Qué se hace público del bienestar de un animal
-- ---------------------------------------------------------------------------
--
-- El resultado sí; el motivo no.
--
-- Que una quedada dure veinte minutos porque uno de los asistentes no aguanta
-- más es información que el grupo necesita para organizarse. Que ese animal
-- esté convaleciente, o en celo, es un dato de salud y no le importa a nadie
-- más que a su tutor. La vista publica el techo ya calculado y se queda con la
-- razón dentro.

create or replace view public.public_pets
  with (security_invoker = false) as
  select
    p.id, p.owner_id, p.name, p.photo_url, p.play_video_url, p.bio, p.breeds,
    p.species_id, s.common_name as species_name, s.social_model, s.taxon_group,
    p.size, p.sex, p.is_neutered, p.energy_level, p.play_styles, p.trust_circle,
    p.is_leash_reactive,
    (p.microchip_verified_at is not null) as is_microchip_verified,
    case when p.birth_date is null then null
      else (extract(year from age(p.birth_date)) * 12
            + extract(month from age(p.birth_date)))::int end as age_months,
    -- El techo, sin decir por qué es ese.
    public.pet_session_ceiling(p.id) as session_ceiling_minutes
  from public.pets p
  join public.species s on s.id = p.species_id;

grant select on public.public_pets to anon, authenticated;
