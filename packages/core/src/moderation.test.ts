/**
 * Bloquear y denunciar.
 *
 * Tres de estos tests comprueban que algo **no se puede hacer**: que un bloqueo
 * no se pueda esquivar mirando desde el otro lado, que una denuncia no lleve
 * texto, y que una sola cuenta no baste para señalar a nadie. Son las tres
 * formas conocidas de convertir una herramienta de seguridad en un arma.
 */

import { describe, expect, it } from 'vitest';

import {
  BLOCK_NOTE,
  REPORT_MIN_REPORTERS,
  REPORT_REASONS,
  isBlocked,
  reportSignal,
  visibleTo,
  withoutBlocked,
  type Block,
  type Report,
} from './moderation.js';

const blocks: Block[] = [{ byId: 'ana', targetId: 'luis', blockedAt: '2026-06-01T10:00:00Z' }];

const report = (reporterId: string, reason: Report['reason'] = 'harassment'): Report => ({
  id: `${reporterId}-${reason}`,
  targetId: 'luis',
  reporterId,
  reason,
  reportedAt: '2026-06-01T10:00:00Z',
});

describe('bloquear', () => {
  it('quien bloquea deja de ver a quien bloqueó', () => {
    expect(visibleTo('ana', 'luis', blocks)).toBe(false);
  });

  it('y quien fue bloqueado tampoco ve a quien lo bloqueó', () => {
    /* Un bloqueo que solo funciona hacia un lado deja a la persona bloqueada
       mirando el perfil de quien la bloqueó, que es justo lo que no puede
       pasar. */
    expect(visibleTo('luis', 'ana', blocks)).toBe(false);
  });

  it('a los demás no les afecta', () => {
    expect(visibleTo('ana', 'sara', blocks)).toBe(true);
    expect(visibleTo('luis', 'sara', blocks)).toBe(true);
  });

  it('saca a la persona de cualquier lista, no solo del feed', () => {
    /* Es una sola función y la usan el feed, el radar, el descubrimiento y las
       quedadas. Un bloqueo que tapa las fotos y deja que os propongan quedar el
       martes en el mismo parque no es un bloqueo. */
    const posts = [
      { id: 'p1', ownerId: 'luis' },
      { id: 'p2', ownerId: 'sara' },
    ];
    expect(withoutBlocked('ana', posts, (post) => post.ownerId, blocks).map((p) => p.id)).toEqual([
      'p2',
    ]);
  });

  it('no se le avisa, y el texto lo dice', () => {
    /* Un «te han bloqueado» es una invitación a abrirse otra cuenta, y a veces
       a algo peor. Que no se avise es la mitad de la función, así que se
       promete por escrito donde se pulsa. */
    expect(BLOCK_NOTE).toContain('No le avisamos');
  });

  it('sin bloqueos, se ve todo', () => {
    expect(isBlocked('ana', 'luis', [])).toBe(false);
  });
});

describe('denunciar', () => {
  it('no hay dónde escribir', () => {
    /* La misma decisión que en los avisos de rescate: un campo libre acaba
       siendo un campo para escribir sobre alguien. */
    const keys = Object.keys(report('ana')).sort();
    expect(keys).toEqual(['id', 'reason', 'reportedAt', 'reporterId', 'targetId']);
    for (const forbidden of ['text', 'note', 'comment', 'description', 'photo', 'evidence']) {
      expect(keys, `admite «${forbidden}»`).not.toContain(forbidden);
    }
  });

  it('cada motivo dice qué es y qué hace', () => {
    for (const reason of REPORT_REASONS) {
      expect(reason.label.length).toBeGreaterThan(0);
      expect(reason.hint.length).toBeGreaterThan(0);
      expect(typeof reason.affectsMatching).toBe('boolean');
    }
  });

  it('una cuenta denunciando tres veces no es una señal', () => {
    /* Es una persona enfadada. La regla es la de las zonas marcadas, aplicada
       a gente: se cuentan personas, no formularios. */
    const spam = [report('ana', 'harassment'), report('ana', 'no_show'), report('ana', 'fake_profile')];
    const signal = reportSignal('luis', spam);
    expect(signal.reporters).toBe(1);
    expect(signal.actionable).toBe(false);
  });

  it('tres cuentas distintas sí', () => {
    const real = [report('ana'), report('sara'), report('marta')];
    const signal = reportSignal('luis', real);
    expect(signal.reporters).toBe(REPORT_MIN_REPORTERS);
    expect(signal.actionable).toBe(true);
  });

  it('las denuncias de otro no cuentan para este', () => {
    const other: Report = { ...report('ana'), targetId: 'otro' };
    expect(reportSignal('luis', [other]).reporters).toBe(0);
  });

  it('quien denuncia no sale en el resultado', () => {
    /* Se cuenta, no se publica: decir quién denunció es decir a quién ir a
       preguntar. */
    const signal = reportSignal('luis', [report('ana'), report('sara'), report('marta')]);
    expect(JSON.stringify(signal)).not.toContain('ana');
  });
});
