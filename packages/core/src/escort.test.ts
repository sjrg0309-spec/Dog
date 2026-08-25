/**
 * Paseo acompañado.
 *
 * El test que sostiene la función no es el del aviso: es el que comprueba que
 * lo que sale de este teléfono son **el sitio y la hora**, y no dónde estás.
 * Un rastro en vivo compartido «con quien tú elijas» es la herramienta de
 * control doméstico mejor diseñada que existe, y se instala con muy buenas
 * intenciones.
 */

import { describe, expect, it } from 'vitest';

import {
  ESCORT_GRACE_MINUTES,
  ESCORT_NOTE,
  escortMessage,
  escortState,
  type Escort,
} from './escort.js';

const base: Escort = {
  contactId: 'sara',
  contactName: 'Sara',
  placeName: 'Parque Central',
  startedAt: '2026-06-01T18:00:00.000Z',
  dueAt: '2026-06-01T19:00:00.000Z',
};

const at = (iso: string) => new Date(iso);

describe('el estado del paseo', () => {
  it('mientras dura, está paseando', () => {
    expect(escortState(base, at('2026-06-01T18:30:00.000Z'))).toBe('walking');
  });

  it('pasada la hora hay margen antes de asustar a nadie', () => {
    /* Quince minutos: nadie cierra el paseo en el segundo exacto, y un aviso
       que salta siempre se acaba ignorando, que es lo peor que le puede pasar
       a este aviso en concreto. */
    const almost = new Date(Date.parse(base.dueAt) + (ESCORT_GRACE_MINUTES - 1) * 60_000);
    expect(escortState(base, almost)).toBe('walking');
  });

  it('pasado el margen, se avisa', () => {
    const late = new Date(Date.parse(base.dueAt) + (ESCORT_GRACE_MINUTES + 1) * 60_000);
    expect(escortState(base, late)).toBe('late');
  });

  it('cerrado es cerrado, aunque sea tarde', () => {
    const closed = { ...base, closedAt: '2026-06-01T19:40:00.000Z' };
    expect(escortState(closed, at('2026-06-02T10:00:00.000Z'))).toBe('closed');
  });
});

describe('lo que sale de este teléfono', () => {
  it('es el sitio y la hora, no dónde estás', () => {
    /* La comprobación central. Se lee el mensaje entero —es lo único que sale
       hacia otra persona— y se afirma lo que no lleva. */
    const message = escortMessage(base, at('2026-06-01T18:30:00.000Z'));
    expect(message).toContain('Parque Central');
    /* La hora se calcula con la zona horaria de quien lee, así que se compara
       con la del propio entorno en vez de con una escrita a mano: si no, el
       test aprueba en Madrid y falla en Bogotá. */
    const due = new Date(base.dueAt);
    expect(message).toContain(`${due.getHours()}:${String(due.getMinutes()).padStart(2, '0')}`);
    expect(message.toLowerCase()).not.toContain('ubicación');
    expect(message).not.toMatch(/-?\d+\.\d{3,}/);
  });

  it('el aviso de retraso dice qué hacer', () => {
    const late = new Date(Date.parse(base.dueAt) + 30 * 60_000);
    const message = escortMessage(base, late);
    expect(message).toContain('Escríbele');
    expect(message).toContain('Parque Central');
  });

  it('al volver, se dice que todo bien', () => {
    const closed = { ...base, closedAt: '2026-06-01T18:55:00.000Z' };
    expect(escortMessage(closed, at('2026-06-01T19:00:00.000Z'))).toContain('Todo bien');
  });

  it('se promete por escrito que no hay rastro en vivo', () => {
    expect(ESCORT_NOTE).toContain('No compartimos dónde estás');
  });
});
