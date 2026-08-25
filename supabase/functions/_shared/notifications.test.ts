import { describe, expect, it } from 'vitest';

import {
  EXPO_MAX_BATCH,
  buildBirthdayNotification,
  buildRadarNotification,
  chunkMessages,
  classifyTickets,
  dedupeTargets,
  filterRecipients,
  type ExpoPushMessage,
  type ExpoTicket,
  type PushTarget,
} from './notifications.js';

const target = (token: string, profileId = 'perfil-1'): PushTarget => ({
  profileId,
  expoPushToken: token,
  platform: 'ios',
});

describe('aviso del radar', () => {
  const base = {
    dogName: 'Nina',
    placeName: 'Parque Central',
    until: '19:00',
    playdateId: 'quedada-1',
  };

  it('dice quién, dónde y hasta cuándo', () => {
    const message = buildRadarNotification(target('token-1'), base);

    expect(message.title).toContain('Nina');
    expect(message.body).toContain('Parque Central');
    expect(message.body).toContain('19:00');
    expect(message.data?.playdateId).toBe('quedada-1');
  });

  it('va con prioridad alta: media hora tarde no sirve de nada', () => {
    expect(buildRadarNotification(target('token-1'), base).priority).toBe('high');
  });

  it('menciona la afinidad solo cuando es un argumento de verdad', () => {
    const great = buildRadarNotification(target('t'), { ...base, affinity: 92 });
    const mediocre = buildRadarNotification(target('t'), { ...base, affinity: 42 });
    const unknown = buildRadarNotification(target('t'), { ...base, affinity: null });

    expect(great.body).toContain('92 %');
    // Un "42 % de afinidad" no anima a nadie; ponerlo solo añade ruido.
    expect(mediocre.body).not.toContain('42');
    expect(unknown.body).not.toContain('afinidad');
  });

  it('funciona aunque no se conozca el nombre del sitio', () => {
    const message = buildRadarNotification(target('t'), { ...base, placeName: null });
    expect(message.body).toContain('un parque cercano');
  });
});

describe('aviso de cumpleaños', () => {
  it('propone algo concreto', () => {
    const message = buildBirthdayNotification(target('t'), {
      dogName: 'Toby',
      turningAge: 3,
      suggestedSpotTitle: 'Patio cercado en Chamberí',
    });

    expect(message?.title).toContain('Toby');
    expect(message?.title).toContain('3');
    expect(message?.body).toContain('Patio cercado en Chamberí');
  });

  it('no se envía si no hay nada que proponer', () => {
    // Una notificación que no pide nada y no aporta nada es la vía rápida a que
    // el usuario silencie la aplicación entera.
    const message = buildBirthdayNotification(target('t'), {
      dogName: 'Toby',
      turningAge: 3,
      suggestedSpotTitle: null,
    });

    expect(message).toBeNull();
  });
});

describe('lotes de envío', () => {
  const make = (count: number): ExpoPushMessage[] =>
    Array.from({ length: count }, (_, index) => ({
      to: `token-${index}`,
      title: 't',
      body: 'b',
    }));

  it('respeta el máximo que acepta Expo', () => {
    const batches = chunkMessages(make(250));

    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(EXPO_MAX_BATCH);
    expect(batches[2]).toHaveLength(50);
  });

  it('no pierde ni duplica mensajes', () => {
    const messages = make(137);
    const flattened = chunkMessages(messages).flat();

    expect(flattened).toHaveLength(137);
    expect(new Set(flattened.map((message) => message.to)).size).toBe(137);
  });

  it('una lista vacía no produce lotes', () => {
    expect(chunkMessages([])).toEqual([]);
  });

  it('rechaza un tamaño de lote sin sentido', () => {
    expect(() => chunkMessages(make(3), 0)).toThrow();
  });
});

describe('respuesta de Expo', () => {
  const messages: ExpoPushMessage[] = [
    { to: 'vivo', title: 't', body: 'b' },
    { to: 'muerto', title: 't', body: 'b' },
    { to: 'saturado', title: 't', body: 'b' },
  ];

  it('separa entregados, tokens muertos y reintentables', () => {
    const tickets: ExpoTicket[] = [
      { status: 'ok', id: '1' },
      { status: 'error', message: 'no registrado', details: { error: 'DeviceNotRegistered' } },
      { status: 'error', message: 'demasiados', details: { error: 'MessageRateExceeded' } },
    ];

    const outcome = classifyTickets(messages, tickets);

    expect(outcome.delivered).toBe(1);
    // Seguir enviando a tokens muertos degrada la reputación de envío y acaba
    // afectando a los usuarios reales.
    expect(outcome.tokensToRemove).toEqual(['muerto']);
    expect(outcome.retryable).toEqual(['saturado']);
  });

  it('un error sin clasificar se reintenta, pero uno conocido y permanente no', () => {
    const outcome = classifyTickets(messages.slice(0, 2), [
      { status: 'error', message: 'vaya' },
      { status: 'error', message: 'mensaje demasiado grande', details: { error: 'MessageTooBig' } },
    ]);

    expect(outcome.retryable).toEqual(['vivo']);
    expect(outcome.tokensToRemove).toEqual([]);
  });

  it('aguanta que Expo devuelva menos tickets que mensajes', () => {
    const outcome = classifyTickets(messages, [{ status: 'ok', id: '1' }]);
    expect(outcome.delivered).toBe(1);
  });
});

describe('selección de destinatarios', () => {
  it('un token repetido solo recibe una copia', () => {
    const unique = dedupeTargets([target('a'), target('a'), target('b')]);
    expect(unique.map((entry) => entry.expoPushToken)).toEqual(['a', 'b']);
  });

  it('la misma persona con dos dispositivos recibe en los dos', () => {
    const unique = dedupeTargets([target('telefono', 'marta'), target('tableta', 'marta')]);
    expect(unique).toHaveLength(2);
  });

  it('no se avisa a quien originó el check-in', () => {
    const recipients = filterRecipients([target('a', 'marta'), target('b', 'carlos')], {
      excludeProfileIds: ['marta'],
    });

    expect(recipients.map((entry) => entry.profileId)).toEqual(['carlos']);
  });

  it('no se avisa dos veces de la misma quedada', () => {
    const recipients = filterRecipients([target('a', 'marta'), target('b', 'carlos')], {
      alreadyNotified: ['carlos'],
    });

    expect(recipients.map((entry) => entry.profileId)).toEqual(['marta']);
  });
});
