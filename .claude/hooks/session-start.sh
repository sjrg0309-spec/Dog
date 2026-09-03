#!/usr/bin/env bash
#
# Deja la sesión en condiciones de ejecutar `pnpm test` entero.
#
# El repositorio ya estaba verde salvo por una cosa: `@petnav/db` no son
# pruebas unitarias, son **pruebas de integración contra Postgres**. Y eso es a
# propósito: lo que comprueban —las políticas RLS, el disparador que impide una
# quedada de dos horas para un hurón, la paridad entre el techo que calcula la
# base y el que calcula `packages/core`— no existe en TypeScript. Vive en el
# esquema. Un simulacro de Postgres probaría el simulacro.
#
# La consecuencia es que en una máquina recién clonada esas 83 pruebas fallan
# por no tener con qué hablar. Este script pone el «con qué»: PostGIS, el rol,
# la base y todas las migraciones en orden, que es exactamente lo que el README
# manda hacer a mano en «Poner en marcha».
#
# Solo corre en remoto. En la máquina de alguien ya hay un Postgres suyo, con
# sus datos, y arrancárselo y recrearle una base sin preguntar sería pasarse.
#
# ## Y no vuelve a recrear la base si ya está
#
# `SessionStart` no se dispara sólo al arrancar: también en `resume`, en `clear`
# y cada vez que la conversación se compacta. Y `scripts/db-reset.sh` empieza con
# un `drop database`. La primera versión de este script las juntaba, así que
# reanudar una sesión tiraba la base a media tarea —se vio en vivo, en un
# `resume`—. Ahora se comprueba antes si el esquema ya está aplicado, y sólo se
# reconstruye cuando falta. Reconstruirla a mano sigue siendo una orden:
# `pnpm db:reset`.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

echo "→ dependencias"
pnpm install --frozen-lockfile

# Todo lo de aquí abajo se hace **como el superusuario del servidor y contra la
# base `postgres`**, y las dos mitades importan.
#
# Contra `postgres` porque es la única que existe siempre: `coincide` es
# justamente la que puede faltar, que es el caso que este script viene a
# arreglar. Y con las variables `PG*` quitadas de en medio porque una sesión
# reanudada trae puesto `PGDATABASE=coincide` —lo escribió este mismo script en
# `$CLAUDE_ENV_FILE` la vez anterior—, y `su` las hereda. Sin las dos cosas, el
# arranque en frío intentaba conectarse a la base que todavía no existe para
# poder crearla, y moría ahí: sólo funcionaba cuando ya estaba hecho.
# La consulta entra por la entrada estándar, no como argumento: pasarla como
# texto atravesaría dos capas de comillas —las de `su -c` y las del propio
# shell— y ese escapado es exactamente donde se cuelan los errores que sólo
# aparecen el día que la consulta lleva un apóstrofo.
psql_admin() {
  env -u PGHOST -u PGPORT -u PGUSER -u PGPASSWORD -u PGDATABASE \
    su postgres -c 'psql -d postgres -tAqXf -'
}

# PostGIS no viene con el Postgres de la imagen y las migraciones lo piden en la
# primera línea. Se instala sólo si falta, para que la segunda sesión —que
# arranca del contenedor ya cacheado— no vuelva a bajar cuarenta megas.
if ! psql --version >/dev/null 2>&1; then
  echo "‼ no hay cliente de Postgres en esta imagen: se omite la base de datos"
  exit 0
fi

if ! echo "select 1 from pg_available_extensions where name = 'postgis'" |
  psql_admin 2>/dev/null | grep -q 1; then
  echo "→ PostGIS"
  apt-get update -qq >/dev/null 2>&1 || true
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-16-postgis-3 >/dev/null 2>&1 || {
    echo "‼ no se pudo instalar PostGIS: las pruebas de @petnav/db se saltarán"
    exit 0
  }
fi

echo "→ servidor"
service postgresql start >/dev/null 2>&1 || true
for _ in $(seq 1 20); do
  echo 'select 1' | psql_admin >/dev/null 2>&1 && break
  sleep 1
done

# El rol que espera `scripts/db-reset.sh`. Es superusuario porque las
# migraciones crean extensiones y esquemas, no porque la aplicación lo necesite:
# en producción quien las aplica es el despliegue, no el servidor de la API.
echo "select 1 from pg_roles where rolname = 'coincide'" | psql_admin 2>/dev/null | grep -q 1 ||
  echo "create role coincide login superuser password 'coincide'" | psql_admin

export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=coincide PGPASSWORD=coincide PGDATABASE=coincide

# ¿Está ya aplicado el esquema? Se pregunta por una tabla de la última migración
# —`safety_alerts`, de `20260822001600_safety.sql`—: si esa existe, existen
# todas las anteriores, porque se aplican en orden y con `ON_ERROR_STOP`. Mirar
# sólo si la base existe no bastaría; una base creada a medias es peor que
# ninguna, porque falla más tarde y con peor mensaje.
if echo "select to_regclass('public.safety_alerts')" |
  env -u PGHOST -u PGPORT -u PGUSER -u PGPASSWORD -u PGDATABASE \
    su postgres -c 'psql -d coincide -tAqXf -' 2>/dev/null | grep -q safety_alerts; then
  echo "✓ la base ya está montada: no se toca"
else
  echo "→ esquema y migraciones"
  ./scripts/db-reset.sh
fi

# Para el resto de la sesión: los tests de `@petnav/db` leen estas variables.
{
  echo 'export PGHOST=127.0.0.1'
  echo 'export PGPORT=5432'
  echo 'export PGUSER=coincide'
  echo 'export PGPASSWORD=coincide'
  echo 'export PGDATABASE=coincide'
} >> "${CLAUDE_ENV_FILE:-/dev/null}"

echo "✓ listo: pnpm test corre entero, base de datos incluida"
