/**
 * Que «ejecuta el reset y ya está» sea verdad.
 *
 * El README promete dos órdenes para tener el proyecto en marcha:
 * `./scripts/db-reset.sh` y luego arrancar lo que sea. Esa promesa se apoya en
 * una coincidencia que no estaba escrita en ningún sitio: **el rol y la base que
 * crea el script tienen que llamarse igual que los que buscan los clientes
 * cuando nadie ha puesto variables de entorno.**
 *
 * Y no coincidían. El script creaba `coincide`, el cliente de `packages/db`
 * pedía `petnav`, y no lo notaba nadie porque quien trabaja a diario tiene las
 * variables puestas y jamás llega a los valores por defecto. Sólo lo veía quien
 * clonaba el repositorio por primera vez —«database "petnav" does not exist»—,
 * que es justo la persona con menos contexto para entenderlo.
 *
 * Dos decisiones de cómo está escrito esto:
 *
 *  - **Lee los tres ficheros en vez de repetir el nombre.** Un test que
 *    escribiera «coincide» sería una cuarta copia del mismo dato, y la cuarta se
 *    desincroniza igual que se desincronizaron las tres primeras.
 *  - **Mira el código fuente, no `connectionConfig()`.** Llamar a la función
 *    aquí no probaría nada: en esta misma sesión las variables de entorno están
 *    puestas, así que devolvería el entorno y el test pasaría sin haber mirado
 *    los valores por defecto, que son lo único que se quiere comprobar.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const source = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** Lo que `scripts/db-reset.sh` crea cuando nadie le dice otra cosa. */
function resetDefaults(): Record<string, string> {
  const script = source('scripts/db-reset.sh');
  return extract('scripts/db-reset.sh', (name) => {
    const match = new RegExp(`${name}="\\$\\{${name}:-([^}]+)\\}"`).exec(script);
    return match?.[1];
  });
}

/** Lo que pide `packages/db` cuando no hay entorno. */
function clientDefaults(): Record<string, string> {
  const client = source('packages/db/src/client.ts');
  return extract('packages/db/src/client.ts', (name) => {
    const match = new RegExp(`process\\.env\\.${name} \\?\\? '([^']+)'`).exec(client);
    return match?.[1];
  });
}

/** Lo que busca la web pública, que tiene su propia piscina de conexiones. */
function webDefaults(): Record<string, string> {
  const web = source('apps/web/lib/db.ts');
  return extract('apps/web/lib/db.ts', (name) => {
    const match = new RegExp(`process\\.env\\.${name} \\?\\? '([^']+)'`).exec(web);
    return match?.[1];
  });
}

function extract(file: string, read: (name: string) => string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, variable] of [
    ['user', 'PGUSER'],
    ['password', 'PGPASSWORD'],
    ['database', 'PGDATABASE'],
  ] as const) {
    const value = read(variable);
    if (!value) throw new Error(`No se encontró ${variable} en ${file}`);
    out[key] = value;
  }
  return out;
}

describe('los valores por defecto de conexión', () => {
  it('el cliente apunta a la base que crea el reset', () => {
    expect(clientDefaults()).toEqual(resetDefaults());
  });

  it('la web pública apunta a la misma', () => {
    expect(webDefaults()).toEqual(resetDefaults());
  });
});
