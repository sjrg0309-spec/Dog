-- La capa de seguridad.
--
-- El radar social solo se enciende en zonas pet-friendly. Esta es la razón por
-- la que esa regla no basta, y por qué **no** se relaja para arreglarlo: una
-- emergencia no ocurre en una zona pet-friendly. Un perro se suelta en una obra,
-- se escapa por la puerta abierta de una mudanza, huye de los petardos de San
-- Juan y cruza tres calles. Los sitios donde hace falta ayuda son exactamente
-- los sitios donde el radar social está apagado.
--
-- Así que son **dos objetos distintos con reglas distintas**, y confundirlos
-- estropea los dos:
--
--                      Radar social            Alerta de seguridad
--   Dónde              Solo zonas pet-friendly  En cualquier sitio
--   Quién la ve        Compatibles a 2 km       Todos los tutores del radio
--   Caducidad          Máximo 4 h               Hasta que se resuelve
--   Precisión          Anclada al lugar         Punto exacto
--   Qué publica        «Estoy en el Central»    «Perdida aquí, chip verificado»
--
-- La privacidad cede en una emergencia, y solo ahí. Es una decisión consciente:
-- publicar el punto exacto de un animal perdido es lo único que hace que alguien
-- lo encuentre, y quien la activa lo hace a propósito sobre su propio animal.

create type public.alert_kind as enum (
  /** Mi animal se ha perdido. */
  'lost_pet',
  /** Peligro en una zona: cebos, cristales, un perro agresivo suelto. */
  'hazard',
  /** Brote contagioso en una zona: tos de las perreras, parvovirus. */
  'outbreak',
  /** Encontrado sin tutor: el otro lado de `lost_pet`. */
  'found_pet'
);

create type public.alert_severity as enum ('info', 'warning', 'critical');

create table public.safety_alerts (
  id uuid primary key default extensions.gen_random_uuid(),
  kind public.alert_kind not null,
  severity public.alert_severity not null default 'warning',

  /**
   * El animal, cuando la alerta va de uno concreto.
   *
   * Nulo en `hazard` y `outbreak`: un cebo envenenado no es de nadie, y esa es
   * justamente la diferencia entre avisar de un peligro y buscar a tu perro.
   */
  pet_id uuid references public.pets (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,

  /** Dónde. En una emergencia el punto es exacto: es lo único que sirve. */
  point extensions.geography(Point, 4326) not null,
  /**
   * Radio de aviso.
   *
   * Un perro perdido se mueve, así que el radio crece con el tiempo; un cebo
   * envenenado no. Quien crea la alerta pone el inicial y el proceso de
   * ampliación vive fuera, en la tarea programada.
   */
  radius_m int not null default 2000 check (radius_m between 100 and 20000),

  title text not null check (length(trim(title)) between 3 and 120),
  detail text check (detail is null or length(detail) <= 2000),

  /** Teléfono de contacto para esta alerta, si el tutor quiere darlo. */
  contact_phone text,

  created_at timestamptz not null default now(),
  /** Cuándo dejó de ser cierta. Una alerta sin resolver no caduca sola. */
  resolved_at timestamptz,
  resolution text check (resolution is null or length(resolution) <= 500)
);

create index safety_alerts_point_idx on public.safety_alerts using gist (point);
create index safety_alerts_open_idx on public.safety_alerts (created_at desc)
  where resolved_at is null;
create index safety_alerts_pet_idx on public.safety_alerts (pet_id);

/**
 * Una alerta de animal necesita animal; una de zona, no.
 *
 * Sin esto se cuela un «perro perdido» sin perro, que en el momento de mirarlo
 * es una alerta que no se puede resolver ni atribuir a nadie.
 */
alter table public.safety_alerts
  add constraint safety_alerts_pet_when_needed check (
    (kind in ('lost_pet', 'found_pet') and pet_id is not null)
    or (kind in ('hazard', 'outbreak') and pet_id is null)
  );

/**
 * Solo se declara perdido el animal propio.
 *
 * `found_pet` es la excepción a propósito: quien encuentra un perro no es su
 * tutor, y exigirlo haría imposible el único caso en que un desconocido tiene
 * algo urgente que decir.
 */
create or replace function public.enforce_alert_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'lost_pet' and not exists (
    select 1 from public.pets p where p.id = new.pet_id and p.owner_id = new.reporter_id
  ) then
    raise exception 'Solo puedes declarar perdido a un animal propio';
  end if;
  return new;
end;
$$;

create trigger safety_alerts_enforce_ownership
  before insert or update of pet_id, reporter_id, kind on public.safety_alerts
  for each row execute function public.enforce_alert_ownership();

-- ---------------------------------------------------------------------------
-- A quién le importa una alerta
-- ---------------------------------------------------------------------------

/**
 * Las alertas abiertas que afectan a un punto.
 *
 * Se consulta sin cuenta a propósito: quien encuentra un perro por la calle no
 * tiene la aplicación instalada, y pedirle que se registre antes de poder mirar
 * si alguien lo está buscando sería poner un formulario entre un animal perdido
 * y su casa.
 */
create or replace function public.alerts_near(
  lat double precision,
  lng double precision,
  radius_m int default 3000
)
returns table (
  id uuid,
  kind public.alert_kind,
  severity public.alert_severity,
  title text,
  detail text,
  pet_id uuid,
  pet_name text,
  distance_m double precision,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id, a.kind, a.severity, a.title, a.detail, a.pet_id, p.name,
    extensions.st_distance(a.point, public.make_point(lat, lng)),
    a.created_at
  from public.safety_alerts a
  left join public.pets p on p.id = a.pet_id
  where a.resolved_at is null
    -- El radio de la alerta y el de la consulta se suman: una alerta con dos
    -- kilómetros de radio alcanza a quien esté a dos kilómetros de ella, no solo
    -- a quien la esté buscando desde encima.
    and extensions.st_dwithin(a.point, public.make_point(lat, lng), a.radius_m + radius_m)
  order by
    case a.severity when 'critical' then 0 when 'warning' then 1 else 2 end,
    8 asc;
$$;

/**
 * A quién avisar de una alerta, incluidos los que **todavía no están allí**.
 *
 * Aquí está lo que esta aplicación puede hacer y una alerta vecinal genérica no:
 * ya sabe a qué hora y en qué parque sale cada perro. Un cebo envenenado
 * encontrado a las once de la mañana en el Parque Central le importa sobre todo
 * a quien va a estar allí a las siete de la tarde, y esa persona no está cerca
 * ahora mismo, así que un aviso por proximidad no la alcanzaría.
 *
 * Devuelve las dos vías por separado —quien está cerca y quien pasa por allí—
 * para que la interfaz pueda redactar el aviso distinto: «hay un cebo donde
 * estás» no es lo mismo que «hay un cebo donde sueles ir».
 */
create or replace function public.alert_audience(target_alert uuid)
returns table (profile_id uuid, pet_id uuid, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  with alert as (
    select point, radius_m from public.safety_alerts where id = target_alert
  ),
  -- Quien está dentro del radio ahora mismo.
  present as (
    select distinct lp.profile_id, lp.pet_id, 'presente'::text as reason
    from public.live_presence lp, alert a
    where lp.expires_at > now()
      and extensions.st_dwithin(lp.point, a.point, a.radius_m)
  ),
  -- Y quien tiene declarado que pasa por ahí, aunque hoy no haya salido aún.
  habitual as (
    select distinct pe.owner_id as profile_id, av.pet_id, 'pasa por allí'::text as reason
    from public.pet_availability av
    join public.pets pe on pe.id = av.pet_id
    join public.places pl on pl.id = av.place_id, alert a
    where extensions.st_dwithin(pl.point, a.point, a.radius_m + pl.radius_m)
  )
  select * from present
  union
  select * from habitual where profile_id not in (select profile_id from present);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.safety_alerts enable row level security;

-- Legible sin cuenta. Una alerta que solo ven los usuarios registrados sirve a
-- la mitad de la gente que podría encontrar al animal.
create policy safety_alerts_select_everyone on public.safety_alerts
  for select to anon, authenticated using (true);

create policy safety_alerts_insert_own on public.safety_alerts
  for insert to authenticated with check (reporter_id = auth.uid());

create policy safety_alerts_update_own on public.safety_alerts
  for update to authenticated using (reporter_id = auth.uid());

grant select on public.safety_alerts to anon, authenticated;
grant insert, update on public.safety_alerts to authenticated;
grant all on public.safety_alerts to service_role;
grant execute on function
  public.alerts_near(double precision, double precision, int),
  public.alert_audience(uuid)
  to anon, authenticated;
