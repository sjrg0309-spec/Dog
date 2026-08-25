#!/usr/bin/env bash
#
# Recrea la base de datos local y aplica todas las migraciones en orden.
#
# Usa un Postgres normal con PostGIS más el sustituto de `auth`, en lugar de la
# pila completa de Supabase. Las migraciones son las mismas que se despliegan;
# lo único que cambia es quién provee el esquema `auth`. A cambio, esto arranca
# en segundos y cabe en un contenedor de CI.
set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-coincide}"
PGPASSWORD="${PGPASSWORD:-coincide}"
PGDATABASE="${PGDATABASE:-coincide}"
export PGHOST PGPORT PGUSER PGPASSWORD

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql -d postgres -v ON_ERROR_STOP=1 -q <<SQL
select pg_terminate_backend(pid)
from pg_stat_activity
where datname = '${PGDATABASE}' and pid <> pg_backend_pid();
drop database if exists ${PGDATABASE};
create database ${PGDATABASE} owner ${PGUSER};
SQL

echo "→ sustituto local del esquema auth"
psql -d "${PGDATABASE}" -v ON_ERROR_STOP=1 -q -f "${ROOT}/supabase/local/00_local_auth_shim.sql"

for migration in "${ROOT}"/supabase/migrations/*.sql; do
  echo "→ $(basename "${migration}")"
  psql -d "${PGDATABASE}" -v ON_ERROR_STOP=1 -q -f "${migration}"
done

echo "✓ base de datos lista"
