import { describe, expect, it } from 'vitest';

import {
  ADAPTERS,
  WEBHOOK_MAX_AGE_SECONDS,
  availableAdapters,
  parseGenericPayload,
  signWebhookBody,
  verifyWebhookSignature,
} from './adapters.js';
import {
  DEFAULT_DWELL_MINUTES,
  EXIT_HYSTERESIS,
  advanceGeofence,
  initialGeofenceState,
  pickGeofence,
  type Geofence,
} from './geofence.js';
import { formatMicrochip, validateMicrochip } from './microchip.js';
import { TrackerError, type TrackerDevice } from './types.js';

const device: TrackerDevice = {
  id: 'device-1',
  dogId: 'dog-1',
  vendor: 'webhook',
  externalId: null,
  label: 'Collar de prueba',
};

describe('microchip — identidad, no ubicación', () => {
  it('acepta un código ISO de 15 dígitos y reconoce el prefijo de país', () => {
    // 724 es el código ISO 3166 numérico de España.
    const result = validateMicrochip('724098100123456');
    expect(result.valid).toBe(true);
    if (!result.valid) return;

    expect(result.standard).toBe('iso-fdx-b');
    expect(result.prefix).toBe('724');
    expect(result.prefixKind).toBe('country');
  });

  it('reconoce los prefijos de fabricante del rango 900–999', () => {
    const result = validateMicrochip('941000012345678');
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.prefixKind).toBe('manufacturer');
  });

  it('acepta los formatos heredados de 9 y 10 dígitos', () => {
    // Rechazarlos dejaría fuera justo a los perros adultos, que son muchos.
    expect(validateMicrochip('123456789').valid).toBe(true);
    expect(validateMicrochip('1234567890').valid).toBe(true);
  });

  it('ignora los separadores con los que viene escrito en la cartilla', () => {
    const result = validateMicrochip('724 0981-0012.3456');
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.normalized).toBe('724098100123456');
  });

  it('rechaza longitudes que no existen y caracteres que no son dígitos', () => {
    expect(validateMicrochip('12345').valid).toBe(false);
    expect(validateMicrochip('7240981001234567').valid).toBe(false);
    expect(validateMicrochip('ABC098100123456').valid).toBe(false);
    expect(validateMicrochip('').valid).toBe(false);
  });

  it('rechaza el prefijo 000, que es lo que devuelve un lector que falla', () => {
    const result = validateMicrochip('000098100123456');
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toContain('000');
  });

  it('deja claro que un formato válido no demuestra que el chip exista', () => {
    const result = validateMicrochip('724098100123456');
    expect(result.valid).toBe(true);
    if (!result.valid) return;

    // El número impreso no lleva dígito de control, así que validar el formato
    // nunca podrá sustituir a una comprobación contra registro.
    expect(result.requiresRegistryCheck).toBe(true);
  });

  it('agrupa el código para poder cotejarlo sin equivocarse', () => {
    expect(formatMicrochip('724098100123456')).toBe('724 0981 0012 3456');
  });
});

describe('adaptadores de collar', () => {
  it('solo ofrece los que de verdad se pueden conectar hoy', () => {
    const available = availableAdapters().map((adapter) => adapter.vendor);
    expect(available).toContain('phone');
    expect(available).toContain('webhook');
    // Ni Fi ni Tractive publican API oficial, así que no se ofrecen como
    // disponibles por mucho que la interfaz quedara más completa.
    expect(available).not.toContain('fi');
    expect(available).not.toContain('tractive');
  });

  it('explica por qué Fi está bloqueado en lugar de fallar en silencio', () => {
    const availability = ADAPTERS.fi?.availability;
    expect(availability?.status).toBe('blocked');
    if (availability?.status !== 'blocked') return;
    expect(availability.note).toMatch(/ingeniería inversa|acuerdo/i);
  });

  it('Tractive queda a la espera de credenciales, no bloqueado del todo', () => {
    expect(ADAPTERS.tractive?.availability.status).toBe('requires-credentials');
  });
});

describe('ingesta genérica', () => {
  it('acepta los nombres de campo más habituales', () => {
    for (const body of [
      '{"lat": 40.4098, "lng": -3.6939}',
      '{"latitude": 40.4098, "longitude": -3.6939}',
      '{"lat": "40.4098", "lon": "-3.6939"}',
    ]) {
      const ping = parseGenericPayload(body, device);
      expect(ping.point.lat).toBeCloseTo(40.4098, 4);
      expect(ping.point.lng).toBeCloseTo(-3.6939, 4);
    }
  });

  it('distingue marcas de tiempo en segundos y en milisegundos', () => {
    const seconds = parseGenericPayload('{"lat":40,"lng":-3,"timestamp":1780000000}', device);
    const millis = parseGenericPayload('{"lat":40,"lng":-3,"timestamp":1780000000000}', device);

    // Confundirlas fecharía el ping en 1970 o en el año 56000.
    expect(seconds.recordedAt.getTime()).toBe(millis.recordedAt.getTime());
  });

  it('acota la batería al rango que tiene sentido', () => {
    expect(parseGenericPayload('{"lat":40,"lng":-3,"battery":150}', device).batteryPercent).toBe(100);
    expect(parseGenericPayload('{"lat":40,"lng":-3,"battery":-5}', device).batteryPercent).toBe(0);
    expect(parseGenericPayload('{"lat":40,"lng":-3}', device).batteryPercent).toBeNull();
  });

  it('rechaza coordenadas fuera de rango y cuerpos rotos', () => {
    expect(() => parseGenericPayload('no soy json', device)).toThrow(TrackerError);
    expect(() => parseGenericPayload('{"lat":91,"lng":0}', device)).toThrow(/rango/);
    expect(() => parseGenericPayload('{"lat":0,"lng":181}', device)).toThrow(/rango/);
    expect(() => parseGenericPayload('{"lng":-3}', device)).toThrow(/latitud/);
  });
});

describe('firma del webhook', () => {
  const secret = 'secreto-compartido';
  const body = '{"lat":40.4098,"lng":-3.6939}';
  const now = new Date('2026-08-22T12:00:00Z');
  const timestamp = Math.floor(now.getTime() / 1000);

  it('acepta una petición firmada correctamente', () => {
    const signature = signWebhookBody(body, secret, timestamp);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature, timestamp }, secret, now),
    ).not.toThrow();
  });

  it('rechaza una firma hecha con otro secreto', () => {
    const signature = signWebhookBody(body, 'otro-secreto', timestamp);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature, timestamp }, secret, now),
    ).toThrow(/firma/i);
  });

  it('rechaza un cuerpo alterado después de firmarlo', () => {
    const signature = signWebhookBody(body, secret, timestamp);
    const tampered = '{"lat":41.0000,"lng":-3.6939}';
    expect(() =>
      verifyWebhookSignature({ rawBody: tampered, signature, timestamp }, secret, now),
    ).toThrow(/firma/i);
  });

  it('rechaza una petición reproducida más tarde', () => {
    // Capturar una petición válida no debe servir para repetirla mañana.
    const oldTimestamp = timestamp - WEBHOOK_MAX_AGE_SECONDS - 1;
    const signature = signWebhookBody(body, secret, oldTimestamp);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature, timestamp: oldTimestamp }, secret, now),
    ).toThrow(/ventana/i);
  });

  it('rechaza una petición sin firma o sin marca de tiempo', () => {
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature: null, timestamp }, secret, now),
    ).toThrow(/firma/i);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature: 'abc', timestamp: null }, secret, now),
    ).toThrow(/marca de tiempo/i);
  });
});

describe('geocercas y check-in automático', () => {
  const PARK = { lat: 40.4098, lng: -3.6939 };
  const fence: Geofence = {
    id: 'fence-1',
    dogId: 'dog-1',
    placeId: 'place-1',
    center: PARK,
    radiusMeters: 150,
    autoCheckin: true,
  };

  /** Desplaza un punto aproximadamente `meters` hacia el norte. */
  const north = (meters: number) => ({ lat: PARK.lat + meters / 111_320, lng: PARK.lng });

  it('detecta la llegada al parque', () => {
    const result = advanceGeofence(fence, initialGeofenceState, north(50), new Date());
    expect(result.event.type).toBe('entered');
    expect(result.state.inside).toBe(true);
  });

  it('no abre el check-in hasta cumplir la permanencia mínima', () => {
    // Pasar por delante del parque camino del trabajo no es estar en el parque.
    const arrival = new Date('2026-08-22T18:00:00Z');
    const entered = advanceGeofence(fence, initialGeofenceState, north(50), arrival);

    const tooSoon = advanceGeofence(
      fence,
      entered.state,
      north(50),
      new Date(arrival.getTime() + 60_000),
    );
    expect(tooSoon.event.type).toBe('none');

    const later = advanceGeofence(
      fence,
      entered.state,
      north(50),
      new Date(arrival.getTime() + DEFAULT_DWELL_MINUTES * 60_000),
    );
    expect(later.event.type).toBe('checkin');
    if (later.event.type !== 'checkin') return;
    expect(later.event.placeId).toBe('place-1');
  });

  it('abre el check-in una sola vez por visita', () => {
    const arrival = new Date('2026-08-22T18:00:00Z');
    let state = advanceGeofence(fence, initialGeofenceState, north(50), arrival).state;
    state = advanceGeofence(
      fence,
      state,
      north(50),
      new Date(arrival.getTime() + 5 * 60_000),
    ).state;

    const again = advanceGeofence(
      fence,
      state,
      north(50),
      new Date(arrival.getTime() + 20 * 60_000),
    );
    expect(again.event.type).toBe('none');
  });

  it('detecta la salida y deja el estado listo para la próxima visita', () => {
    const state = advanceGeofence(fence, initialGeofenceState, north(50), new Date()).state;
    const exited = advanceGeofence(fence, state, north(400), new Date());

    expect(exited.event.type).toBe('exited');
    expect(exited.state).toEqual(initialGeofenceState);
  });

  it('la histéresis evita el parpadeo de un GPS que baila en el borde', () => {
    // Un punto entre el radio de entrada y el de salida: fuera para entrar,
    // dentro para seguir dentro. Sin esto, un perro parado en el borde generaría
    // una cascada de entradas y salidas, y con ella de notificaciones.
    const edge = north(fence.radiusMeters * 1.1);

    const fromOutside = advanceGeofence(fence, initialGeofenceState, edge, new Date());
    expect(fromOutside.event.type).toBe('none');
    expect(fromOutside.state.inside).toBe(false);

    const inside = advanceGeofence(fence, initialGeofenceState, north(20), new Date()).state;
    const fromInside = advanceGeofence(fence, inside, edge, new Date());
    expect(fromInside.event.type).toBe('none');
    expect(fromInside.state.inside).toBe(true);

    // Más allá del margen sí se considera salida.
    const wellOutside = advanceGeofence(
      fence,
      inside,
      north(fence.radiusMeters * EXIT_HYSTERESIS + 30),
      new Date(),
    );
    expect(wellOutside.event.type).toBe('exited');
  });

  it('cuando dos parques se solapan gana el más cercano, no el primero', () => {
    const near: Geofence = { ...fence, id: 'cerca', center: north(30) };
    const far: Geofence = { ...fence, id: 'lejos', center: north(120), radiusMeters: 300 };

    expect(pickGeofence([far, near], PARK)?.id).toBe('cerca');
    expect(pickGeofence([near, far], PARK)?.id).toBe('cerca');
  });

  it('ignora las geocercas con el check-in automático desactivado', () => {
    const disabled: Geofence = { ...fence, autoCheckin: false };
    expect(pickGeofence([disabled], PARK)).toBeNull();
  });

  it('devuelve nada cuando el punto queda lejos de todas', () => {
    expect(pickGeofence([fence], north(5000))).toBeNull();
  });
});
