-- Row Level Security.
--
-- La autorización vive en la base de datos, no en el cliente. Un cliente móvil
-- se puede desensamblar y una clave anónima se puede extraer de él en cinco
-- minutos; lo único que separa de verdad los datos de un usuario de los de otro
-- son estas políticas.
--
-- RLS es a nivel de fila, no de columna. Donde hace falta ocultar columnas
-- —el código del chip, la dirección exacta de un spot, el teléfono— la tabla
-- queda cerrada y se publica una vista con lo que sí puede verse.

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

/** ¿Es este perro de quien está preguntando? */
create or replace function public.owns_dog(target_dog uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dogs d
    where d.id = target_dog and d.owner_id = auth.uid()
  );
$$;

/** ¿Puede este tutor ver esta quedada, según su visibilidad? */
create or replace function public.can_see_playdate(target_playdate uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.playdates d
    where d.id = target_playdate
      and (
        d.visibility = 'public'
        or d.host_id = auth.uid()
        or (d.visibility = 'friends' and public.are_friends(d.host_id, auth.uid()))
        or exists (
          select 1 from public.playdate_rsvps r
          where r.playdate_id = d.id and r.profile_id = auth.uid()
        )
      )
  );
$$;

/** ¿Participa este tutor en esta reserva, o es el anfitrión del espacio? */
create or replace function public.is_booking_member(target_booking uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.spot_bookings b
    join public.spots s on s.id = b.spot_id
    where b.id = target_booking
      and (
        b.organizer_id = auth.uid()
        or s.host_id = auth.uid()
        or exists (
          select 1 from public.booking_participants p
          where p.booking_id = b.id and p.profile_id = auth.uid()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.friendships enable row level security;
alter table public.places enable row level security;
alter table public.dog_availability enable row level security;
alter table public.playdates enable row level security;
alter table public.playdate_rsvps enable row level security;
alter table public.live_presence enable row level security;
alter table public.playdate_feedback enable row level security;
alter table public.device_tokens enable row level security;
alter table public.spots enable row level security;
alter table public.spot_bookings enable row level security;
alter table public.booking_participants enable row level security;
alter table public.tracker_devices enable row level security;
alter table public.tracker_pings enable row level security;
alter table public.geofences enable row level security;

-- ---------------------------------------------------------------------------
-- Perfiles. El teléfono de contacto solo lo ve su dueño y sus amigos; el resto
-- de la aplicación usa la vista pública.
-- ---------------------------------------------------------------------------

create policy profiles_select_self_or_friends on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.are_friends(id, auth.uid()));

create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create view public.public_profiles
  with (security_invoker = false) as
  select id, display_name, avatar_url, (phone_verified_at is not null) as is_phone_verified
  from public.profiles;

-- ---------------------------------------------------------------------------
-- Perros.
--
-- El código del chip queda fuera de la vista pública: conocerlo es un paso hacia
-- reclamar un animal que no es tuyo, así que no se difunde aunque sea cómodo.
-- ---------------------------------------------------------------------------

create policy dogs_select_own_or_friends on public.dogs
  for select to authenticated
  using (owner_id = auth.uid() or public.are_friends(owner_id, auth.uid()));

create policy dogs_write_own on public.dogs
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create view public.public_dogs
  with (security_invoker = false) as
  select
    d.id, d.owner_id, d.name, d.photo_url, d.play_video_url, d.bio, d.breeds,
    d.size, d.sex, d.is_neutered, d.energy_level, d.play_styles, d.trust_circle,
    d.is_leash_reactive,
    -- La insignia sí es pública; el código que hay detrás, no.
    (d.microchip_verified_at is not null) as is_microchip_verified,
    -- La edad en meses basta para el algoritmo y no revela la fecha exacta.
    case when d.birth_date is null then null
      else (extract(year from age(d.birth_date)) * 12
            + extract(month from age(d.birth_date)))::int end as age_months
  from public.dogs d;

-- ---------------------------------------------------------------------------
create policy friendships_select_involved on public.friendships
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy friendships_insert_as_requester on public.friendships
  for insert to authenticated with check (requester_id = auth.uid());

create policy friendships_update_involved on public.friendships
  for update to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy friendships_delete_involved on public.friendships
  for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lugares: públicos, también para quien no ha entrado. La web los indexa.
-- ---------------------------------------------------------------------------

create policy places_select_everyone on public.places
  for select to anon, authenticated using (true);

create policy places_insert_authenticated on public.places
  for insert to authenticated with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Horario de paseo.
--
-- Nadie navega la agenda de nadie. Un tercero solo puede obtener el AGREGADO a
-- través de `schedule_matches`, que devuelve "coincidís cinco días" y jamás las
-- franjas. Publicar el calendario sería publicar la rutina diaria de una
-- persona, y este producto va precisamente de salir a la calle a horas fijas.
-- ---------------------------------------------------------------------------

create policy dog_availability_select_own_or_friends on public.dog_availability
  for select to authenticated
  using (public.owns_dog(dog_id) or exists (
    select 1 from public.dogs d
    where d.id = dog_availability.dog_id and public.are_friends(d.owner_id, auth.uid())
  ));

create policy dog_availability_write_own on public.dog_availability
  for all to authenticated
  using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id));

-- ---------------------------------------------------------------------------
-- Quedadas. Las públicas se leen sin cuenta: ese enlace es como se propaga esto.
-- ---------------------------------------------------------------------------

create policy playdates_select_public_anon on public.playdates
  for select to anon
  using (visibility = 'public' and status = 'active');

create policy playdates_select_visible on public.playdates
  for select to authenticated
  using (
    visibility = 'public'
    or host_id = auth.uid()
    or (visibility = 'friends' and public.are_friends(host_id, auth.uid()))
    or exists (
      select 1 from public.playdate_rsvps r
      where r.playdate_id = playdates.id and r.profile_id = auth.uid()
    )
  );

create policy playdates_write_host on public.playdates
  for all to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());

create policy playdate_rsvps_select_related on public.playdate_rsvps
  for select to authenticated
  using (profile_id = auth.uid() or public.can_see_playdate(playdate_id));

-- Solo puedes apuntar a tu propio perro, y solo a una quedada que puedas ver.
create policy playdate_rsvps_insert_own_dog on public.playdate_rsvps
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and public.owns_dog(dog_id)
    and public.can_see_playdate(playdate_id)
  );

create policy playdate_rsvps_update_own on public.playdate_rsvps
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy playdate_rsvps_delete_own on public.playdate_rsvps
  for delete to authenticated using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Radar en vivo.
--
-- Una presencia caducada deja de ser visible en el mismo instante. Apagar el
-- check-in tiene que sacarte del mapa de verdad, no "en la próxima consulta".
-- ---------------------------------------------------------------------------

create policy live_presence_select_active on public.live_presence
  for select to authenticated
  using (profile_id = auth.uid() or expires_at > now());

create policy live_presence_write_own on public.live_presence
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.owns_dog(dog_id));

-- ---------------------------------------------------------------------------
-- Valoraciones.
--
-- Cada tutor solo ve las que ha escrito. Un pulgar abajo público sobre el perro
-- de un vecino sería una herramienta de acoso; aquí solo alimenta el algoritmo.
-- ---------------------------------------------------------------------------

create policy playdate_feedback_select_own on public.playdate_feedback
  for select to authenticated using (public.owns_dog(rater_dog_id));

create policy playdate_feedback_insert_own on public.playdate_feedback
  for insert to authenticated with check (public.owns_dog(rater_dog_id));

-- ---------------------------------------------------------------------------
create policy device_tokens_all_own on public.device_tokens
  for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Espacios privados.
--
-- La dirección exacta solo aparece tras confirmar la reserva; antes, la zona.
-- Publicar la dirección de una propiedad privada a cualquiera que abra la app
-- no es aceptable, por muy cómodo que resulte.
-- ---------------------------------------------------------------------------

create policy spots_select_host_or_confirmed on public.spots
  for select to authenticated
  using (
    host_id = auth.uid()
    or exists (
      select 1
      from public.spot_bookings b
      join public.booking_participants p on p.booking_id = b.id
      where b.spot_id = spots.id
        and b.status = 'confirmed'
        and p.profile_id = auth.uid()
        and p.status = 'going'
    )
  );

create policy spots_write_host on public.spots
  for all to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());

create view public.public_spots
  with (security_invoker = false) as
  select
    s.id, s.host_id, s.title, s.description, s.photos, s.size_m2, s.is_fenced,
    s.fence_height_cm, s.has_water, s.has_shade, s.is_private_single_group,
    s.max_dogs, s.price_per_slot_cents, s.slot_minutes, s.currency, s.rules,
    s.cancellation_policy, s.public_slug, s.status,
    -- Solo la zona: el punto degradado a la rejilla de un kilómetro.
    public.coarsen_point(s.point) as approximate_point
  from public.spots s
  where s.status = 'active';

create policy spot_bookings_select_member on public.spot_bookings
  for select to authenticated using (public.is_booking_member(id));

create policy spot_bookings_insert_organizer on public.spot_bookings
  for insert to authenticated with check (organizer_id = auth.uid());

create policy spot_bookings_update_member on public.spot_bookings
  for update to authenticated using (public.is_booking_member(id));

create policy booking_participants_select_member on public.booking_participants
  for select to authenticated
  using (profile_id = auth.uid() or public.is_booking_member(booking_id));

create policy booking_participants_insert_own on public.booking_participants
  for insert to authenticated
  with check (profile_id = auth.uid() and public.owns_dog(dog_id));

create policy booking_participants_update_own on public.booking_participants
  for update to authenticated using (profile_id = auth.uid());

create policy booking_participants_delete_own on public.booking_participants
  for delete to authenticated using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Collares.
--
-- Sin excepciones y sin vista pública: los pings de un collar son el rastro
-- diario de una persona. Nadie más que el tutor los lee, en ninguna consulta.
-- ---------------------------------------------------------------------------

create policy tracker_devices_all_own on public.tracker_devices
  for all to authenticated
  using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id));

create policy tracker_pings_all_own on public.tracker_pings
  for all to authenticated
  using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id));

create policy geofences_all_own on public.geofences
  for all to authenticated
  using (public.owns_dog(dog_id)) with check (public.owns_dog(dog_id));

-- ---------------------------------------------------------------------------
-- Permisos sobre las vistas públicas.
-- ---------------------------------------------------------------------------

grant select on public.public_profiles to anon, authenticated;
grant select on public.public_dogs to anon, authenticated;
grant select on public.public_spots to anon, authenticated;
