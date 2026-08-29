/**
 * Acceso a Postgres.
 *
 * Las migraciones SQL son la única fuente de verdad del esquema. Este paquete
 * no vuelve a declararlo: se limita a conectar, a ofrecer el equivalente de
 * "iniciar sesión como este usuario" y a espejar los tipos que las aplicaciones
 * necesitan, con un test que comprueba que el espejo sigue cuadrando con la base
 * real.
 */

import pg from 'pg';

const { Pool } = pg;

export type Db = pg.Pool;

export type ConnectionOptions = {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
};

/**
 * Los valores por defecto **son los que crea `scripts/db-reset.sh`**, y eso es
 * la definición de que funcionen: el README dice «ejecuta el reset y ya está»,
 * así que si estos tres no son los que el reset acaba de crear, ese «ya está»
 * es mentira y quien lo sigue se encuentra con «database "…" does not exist».
 *
 * Pasó: aquí ponía `petnav` mientras el script creaba `coincide`. Nadie lo veía
 * porque quien tiene las variables de entorno puestas nunca llega a los valores
 * por defecto. Hay un test —`connection.test.ts`— que lee el script y comprueba
 * que los tres siguen coincidiendo, en vez de fiarlo a que alguien se acuerde.
 */
export function connectionConfig(overrides: ConnectionOptions = {}) {
  return {
    host: overrides.host ?? process.env.PGHOST ?? '127.0.0.1',
    port: overrides.port ?? Number(process.env.PGPORT ?? 5432),
    user: overrides.user ?? process.env.PGUSER ?? 'coincide',
    password: overrides.password ?? process.env.PGPASSWORD ?? 'coincide',
    database: overrides.database ?? process.env.PGDATABASE ?? 'coincide',
  };
}

export function createPool(overrides: ConnectionOptions = {}): Db {
  return new Pool({ ...connectionConfig(overrides), max: 8 });
}

/**
 * Ejecuta una consulta como haría un usuario concreto a través de PostgREST.
 *
 * Fija el rol y el mismo GUC de reclamaciones del que lee `auth.uid()`, dentro
 * de una transacción que siempre revierte. Es la única forma honesta de probar
 * RLS: comprobar las políticas leyendo el SQL no demuestra nada, porque lo que
 * importa es qué devuelve la base a un usuario real.
 */
export async function asUser<T>(
  db: Db,
  userId: string | null,
  run: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    if (userId) {
      await client.query('select set_config($1, $2, true)', [
        'request.jwt.claims',
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      await client.query('set local role authenticated');
    } else {
      await client.query('select set_config($1, $2, true)', ['request.jwt.claims', '']);
      await client.query('set local role anon');
    }
    return await run(client);
  } finally {
    // Siempre se revierte: un test de RLS no debe poder ensuciar los datos que
    // usan los demás tests.
    await client.query('rollback').catch(() => undefined);
    client.release();
  }
}

/** Igual que `asUser`, pero con el rol de servicio, que salta RLS. */
export async function asService<T>(
  db: Db,
  run: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('set local role service_role');
    return await run(client);
  } finally {
    await client.query('rollback').catch(() => undefined);
    client.release();
  }
}
