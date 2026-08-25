-- Tareas programadas.
--
-- La purga de pings no es mantenimiento: es la razón por la que guardar el
-- rastro de un collar resulta aceptable. Si deja de ejecutarse, la promesa de
-- retención corta deja de ser cierta, así que se programa junto al esquema y no
-- como un ajuste suelto del panel que nadie recuerda haber tocado.
--
-- `pg_cron` no está disponible en todos los entornos —en un Postgres normal de
-- CI, por ejemplo—, así que la programación se hace condicional en lugar de
-- romper la migración. Donde no exista, la purga se invoca desde la Edge
-- Function `purge-tracker-pings` con un disparador externo.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- Todos los días a las 03:15 UTC, cuando casi nadie pasea.
    perform cron.schedule(
      'purge-tracker-pings',
      '15 3 * * *',
      $job$ select public.purge_old_tracker_pings(30); $job$
    );

    -- La presencia caduca por su propia marca de tiempo, así que borrarla es
    -- solo higiene de tabla; se hace con menos frecuencia.
    perform cron.schedule(
      'purge-expired-presence',
      '30 3 * * *',
      $job$ delete from public.live_presence where expires_at < now() - interval '1 day'; $job$
    );
  else
    raise notice 'pg_cron no disponible: las tareas se programarán desde fuera de la base';
  end if;
end
$$;
