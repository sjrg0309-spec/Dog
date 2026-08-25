-- Permisos de tabla.
--
-- Un proyecto Supabase concede esto por defecto a `anon` y `authenticated`, y
-- después RLS decide fila a fila. Se declara aquí de forma explícita para que el
-- esquema sea reproducible fuera de Supabase —en CI, por ejemplo— y para que
-- quede escrito que sin RLS estos permisos serían demasiado amplios.

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- El fan-out de notificaciones devuelve tokens de envío: exponerlo a un cliente
-- permitiría enumerar quién vive cerca de un punto cualquiera.
revoke all on function public.push_targets_in_radius(double precision, double precision, int)
  from public, anon, authenticated;
grant execute on function public.push_targets_in_radius(double precision, double precision, int)
  to service_role;
