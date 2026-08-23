-- Asistentes visibles en una quedada pública.
--
-- La página pública de una quedada existe para compartirla por mensajería: se
-- pega el enlace en el grupo del barrio y quien lo abre decide si le encaja. Sin
-- ver qué animales van, esa decisión no se puede tomar, así que la lista forma
-- parte de la invitación.
--
-- El alcance es deliberadamente estrecho: solo quedadas `public` y `active`. Las
-- de amigos y las de invitación siguen exigiendo cuenta, y lo que se muestra
-- sale de `public_pets`, que deja fuera el chip y la fecha de nacimiento.

create policy playdate_rsvps_select_public_anon on public.playdate_rsvps
  for select to anon
  using (
    exists (
      select 1
      from public.playdates d
      where d.id = playdate_rsvps.playdate_id
        and d.visibility = 'public'
        and d.status = 'active'
    )
  );
