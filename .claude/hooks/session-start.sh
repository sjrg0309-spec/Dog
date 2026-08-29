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
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

echo "→ dependencias"
pnpm install --frozen-lockfile

# PostGIS no viene con el Postgres de la imagen y las migraciones lo piden en la
# primera línea. Se instala sólo si falta, para que la segunda sesión —que
# arranca del contenedor ya cacheado— no vuelva a bajar cuarenta megas.
if ! psql --version >/dev/null 2>&1; then
  echo "‼ no hay cliente de Postgres en esta imagen: se omite la base de datos"
  exit 0
fi

if ! su postgres -c "psql -tAc \"select 1 from pg_available_extensions where name = 'postgis'\"" 2>/dev/null | grep -q 1; then
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
  su postgres -c 'psql -tAc "select 1"' >/dev/null 2>&1 && break
  sleep 1
done

# El rol que espera `scripts/db-reset.sh`. Es superusuario porque las
# migraciones crean extensiones y esquemas, no porque la aplicación lo necesite:
# en producción quien las aplica es el despliegue, no el servidor de la API.
su postgres -c "psql -tAc \"select 1 from pg_roles where rolname = 'coincide'\"" 2>/dev/null | grep -q 1 || \
  su postgres -c "psql -q -c \"create role coincide login superuser password 'coincide'\""

echo "→ esquema y migraciones"
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=coincide PGPASSWORD=coincide PGDATABASE=coincide
./scripts/db-reset.sh

# Para el resto de la sesión: los tests de `@petnav/db` leen estas variables.
{
  echo 'export PGHOST=127.0.0.1'
  echo 'export PGPORT=5432'
  echo 'export PGUSER=coincide'
  echo 'export PGPASSWORD=coincide'
  echo 'export PGDATABASE=coincide'
} >> "${CLAUDE_ENV_FILE:-/dev/null}"

echo "✓ listo: pnpm test corre entero, base de datos incluida"
