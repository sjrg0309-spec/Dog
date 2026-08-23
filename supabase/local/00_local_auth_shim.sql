-- Sustituto local del esquema `auth` de Supabase.
--
-- NO es una migración: en un proyecto Supabase real este esquema ya existe y
-- aplicarlo sobrescribiría la autenticación de verdad. Vive aparte para que
-- las migraciones sigan siendo exactamente las que se despliegan.
--
-- Reproduce lo justo para poder probar RLS contra un Postgres normal: los tres
-- roles, la tabla de usuarios y `auth.uid()` leyendo el mismo GUC que usa
-- PostgREST. Así un test puede "iniciar sesión" con
-- `set local request.jwt.claims = '{"sub": "<uuid>"}'`.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);

/**
 * El identificador del usuario de la petición, o null si no hay sesión.
 *
 * El `nullif` va **antes** del cast, no después. Escrito al revés —castear la
 * cadena vacía a json y luego mirar si el resultado es nulo— revienta con
 * «invalid input syntax for type json» en cuanto una política legible por `anon`
 * llama a esta función, porque para `anon` el GUC está vacío. La implementación
 * real de Supabase lo hace en este orden justamente por eso, y un shim más
 * estricto que producción hace fallar en local políticas que allí funcionan.
 */
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json ->> 'role', ''),
    'anon'
  );
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
