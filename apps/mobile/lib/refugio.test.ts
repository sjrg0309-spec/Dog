/**
 * Las reglas del panel del refugio.
 *
 * Se prueba el modelo y no la pantalla porque es donde vive la regla: publicar
 * a un animal al que le falta el chip tiene que fallar **aunque se llame desde
 * otro sitio**, y un botón deshabilitado no prueba eso.
 */

import { describe, expect, it } from 'vitest';

import {
  ageLabel,
  resolvePending,
  setAnimalStatus,
  STATUS_ORDER,
  tally,
  type ShelterAnimal,
} from './refugio';

/* Un animal cualquiera del que partir. `tally` recibe la lista, así que las
   cifras se prueban con una lista escrita a mano y no con la semilla: una
   prueba que depende de los ocho animales de ejemplo se rompe el día que se
   añada el noveno, y no por un error. */
const base: ShelterAnimal = {
  id: 'x',
  name: 'X',
  breed: 'Mestizo',
  ageMonths: 24,
  size: 'medium',
  status: 'treatment',
  since: new Date().toISOString(),
  note: '',
  fosterName: null,
  pending: [],
};

describe('las situaciones', () => {
  it('van de lo que pide trabajo a lo que ya no pide nada', () => {
    expect(STATUS_ORDER).toEqual(['treatment', 'foster', 'adoptable', 'adopted']);
  });
});

describe('publicar en adopción', () => {
  it('se rechaza mientras quede algo pendiente, y dice qué falta', () => {
    /* «refugio-1» es Trufa, que llega con la segunda vacuna y la esterilización
       sin hacer. */
    const rejected = setAnimalStatus('refugio-1', 'adoptable');

    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.reason).toContain('Trufa');
      expect(rejected.reason).toContain('segunda vacuna');
    }
  });

  it('se acepta en cuanto no falta nada', () => {
    resolvePending('refugio-1', 'Segunda vacuna');
    resolvePending('refugio-1', 'Esterilización');

    expect(setAnimalStatus('refugio-1', 'adoptable')).toEqual({ ok: true });
  });

  it('no inventa un animal que no está', () => {
    const result = setAnimalStatus('no-existe', 'adopted');
    expect(result.ok).toBe(false);
  });
});

describe('las cifras del resumen', () => {
  it('se derivan de la lista, nunca se guardan aparte', () => {
    const list: ShelterAnimal[] = [
      { ...base, id: 'a', status: 'treatment', pending: ['Chip'] },
      { ...base, id: 'b', status: 'foster', pending: [] },
      { ...base, id: 'c', status: 'adoptable', pending: [] },
      /* Adoptado y con algo pendiente: no cuenta como bloqueado, porque ya no
         hay nada que publicar. */
      { ...base, id: 'd', status: 'adopted', pending: ['Cartilla al día'] },
    ];

    expect(tally(list)).toEqual({
      total: 4,
      treatment: 1,
      foster: 1,
      adoptable: 1,
      adopted: 1,
      blocked: 1,
    });
  });
});

describe('la edad', () => {
  it('se dice en meses hasta el año y en años a partir de ahí', () => {
    expect(ageLabel(1)).toBe('1 mes');
    expect(ageLabel(8)).toBe('8 meses');
    expect(ageLabel(12)).toBe('1 año');
    expect(ageLabel(30)).toBe('3 años');
  });
});
