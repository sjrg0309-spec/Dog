/**
 * Los ajustes, comprobados como lo que son: promesas.
 *
 * Una pantalla de configuración es el sitio de una aplicación donde es más
 * fácil mentir sin querer. Un interruptor se dibuja en diez líneas y parece que
 * hace algo; conectarlo cuesta el resto del trabajo, y nadie se da cuenta de
 * que falta —ni siquiera quien lo escribió— porque la pantalla se ve perfecta.
 * Con los ajustes de privacidad eso no es un descuido estético: alguien apaga
 * el modo fantasma creyendo que desaparece del mapa.
 *
 * Por eso el índice vive como dato y estos tests lo recorren entero: **cada
 * fila cambia un ajuste, lleva a una ruta que existe, o declara por qué no está
 * construida**. No hay cuarta opción, y añadir una pone la suite en rojo.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  SETTINGS,
  resetSettings,
  readSettings,
  searchSettings,
  setSetting,
  subscribeSettings,
  type SettingRow,
} from './settings.js';

const ROOT = `${process.cwd()}/`;
const SCREEN = readFileSync(join(ROOT, 'app/ajustes.tsx'), 'utf8');

const rows: SettingRow[] = SETTINGS.flatMap((group) => [...group.rows]);

beforeEach(() => {
  resetSettings();
});

describe('el índice de configuración', () => {
  it('no repite identificadores', () => {
    /* Dos filas con el mismo id harían que el buscador devolviera una y la
       pantalla dibujara la otra. */
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it('cada fila se puede encontrar por algo que no sea su rótulo', () => {
    /* Nadie escribe «ficha médica» cuando lo que quiere ver es si toca la
       antirrábica. Sin palabras clave, el buscador solo encuentra lo que ya
       sabes cómo se llama, que es justo lo que no hace falta buscar. */
    for (const row of rows) {
      expect(row.keywords.length, `«${row.label}» no tiene por dónde buscarse`).toBeGreaterThan(0);
    }
  });

  it('todo enlace va a una pantalla que existe', () => {
    for (const row of rows.filter((candidate) => candidate.kind === 'link')) {
      expect(row.href, `«${row.label}» es un enlace sin destino`).toBeTruthy();
      const name = row.href!.replace(/^\//, '').split('?')[0];
      const exists =
        existsSync(join(ROOT, `app/${name}.tsx`)) || existsSync(join(ROOT, `app/(tabs)/${name}.tsx`));
      expect(exists, `«${row.label}» apunta a ${row.href}, que no es ninguna pantalla`).toBe(true);
    }
  });

  it('todo interruptor está conectado en la pantalla', () => {
    /* La comprobación que impide el interruptor decorativo. La pantalla
       despacha por identificador, así que si el id no aparece en su código, la
       fila se dibuja y no hace nada. */
    for (const row of rows.filter((candidate) => candidate.kind !== 'missing')) {
      if (row.kind === 'link') continue;
      expect(SCREEN, `«${row.label}» sale en la lista y nadie la atiende`).toContain(`'${row.id}'`);
    }
  });

  it('lo que no está construido dice por qué', () => {
    /* Un «próximamente» es una forma de no decir nada. El motivo es lo que
       permite discutirlo: si el motivo es malo, se ve. */
    for (const row of rows.filter((candidate) => candidate.kind === 'missing')) {
      expect(row.why, `«${row.label}» falta sin explicar por qué`).toBeTruthy();
      expect(row.why!.length).toBeGreaterThan(40);
    }
  });

  it('lo que no existe no se puede tocar', () => {
    /* La fila de algo no construido no es un `Pressable`: un interruptor
       apagado promete dos cosas falsas —que existe y que está desactivado—. */
    const missing = /function MissingRow[\s\S]*?\n}/.exec(SCREEN)?.[0] ?? '';
    expect(missing).not.toBe('');
    expect(missing).not.toContain('<Pressable');
    expect(missing).not.toContain('onPress');
  });
});

describe('el buscador de ajustes', () => {
  it('sin nada escrito enseña la lista entera', () => {
    expect(searchSettings('')).toHaveLength(SETTINGS.length);
  });

  it('encuentra por palabra clave y no solo por rótulo', () => {
    /* El caso que justifica que el buscador exista: se entra en configuración
       a buscar lo que no se encuentra, no solo a cambiar interruptores. */
    const found = searchSettings('vacunas').flatMap((group) => group.rows);
    expect(found.map((row) => row.id)).toContain('record');
  });

  it('no le importan las tildes', () => {
    expect(searchSettings('medica').flatMap((group) => group.rows).map((row) => row.id)).toContain(
      'record',
    );
  });

  it('conserva el grupo del resultado', () => {
    /* «Soy rescatista» debajo de «Quién te ve» se entiende; suelto en una lista
       plana parece otra casilla más. */
    const groups = searchSettings('rescatista');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('Quién te ve');
  });

  it('lo que no está construido también se encuentra', () => {
    /* Quien busca «cerrar sesión» tiene que llegar a la explicación de por qué
       no la hay, no a una lista vacía que parece un fallo del buscador. */
    const found = searchSettings('cerrar sesión').flatMap((group) => group.rows);
    expect(found.map((row) => row.id)).toContain('account');
  });

  it('cada cuenta ve sus ajustes y no los de la otra', () => {
    /* Una protectora no tiene chip que verificar y un tutor no tiene revisión
       de perfil pendiente. Enseñar la fila del otro sería enseñar un ajuste que
       no se puede tocar, que es la versión educada del interruptor decorativo. */
    const tutor = searchSettings('', 'tutor').flatMap((group) => group.rows).map((row) => row.id);
    const shelter = searchSettings('', 'rescuer').flatMap((group) => group.rows).map((row) => row.id);
    expect(tutor).toContain('chip');
    expect(tutor).not.toContain('shelter');
    expect(shelter).toContain('shelter');
    expect(shelter).not.toContain('chip');
    expect(shelter).not.toContain('rescuer');
  });

  it('con algo que no está, no inventa', () => {
    expect(searchSettings('zzzz')).toEqual([]);
  });
});

describe('el almacén', () => {
  it('no avisa cuando el valor no cambia', () => {
    /* Sin esto, tocar dos veces el mismo botón repinta la aplicación entera
       para dejarla igual. */
    let notices = 0;
    const stop = subscribeSettings(() => {
      notices += 1;
    });
    setSetting('theme', 'dark');
    setSetting('theme', 'dark');
    stop();
    expect(notices).toBe(1);
  });

  it('lo que se guarda son cuatro ajustes, y el modo fantasma no está', () => {
    /* Estructural a propósito. El estado del modo fantasma es de
       `lib/presence`, que es quien apaga el radar de verdad; tenerlo también
       aquí serían dos fuentes para el mismo interruptor, y de ahí a que la
       pantalla diga «apagado» mientras se publica presencia hay un despiste. */
    expect(Object.keys(readSettings()).sort()).toEqual([
      'feedRadiusM',
      'motion',
      'rescuer',
      'theme',
    ]);
  });
});
