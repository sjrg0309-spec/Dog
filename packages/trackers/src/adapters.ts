/**
 * Adaptadores de collar.
 *
 * Estado verificado el 22 de agosto de 2026, no recordado:
 *
 *  - **Fi** no publica documentación de API para terceros. Lo que existe es una
 *    API GraphQL descubierta por ingeniería inversa que usan integraciones
 *    comunitarias (`pytryfi`, la integración de Home Assistant). Depender de
 *    ella significaría romperse en cualquier despliegue de Fi y, muy
 *    probablemente, contravenir sus términos. Queda declarado como bloqueado.
 *  - **Tractive** tampoco publica una API oficial. Hay envoltorios no oficiales
 *    en Node y Python, y la integración de Home Assistant exige cuenta premium.
 *    Queda declarado como pendiente de credenciales y de acuerdo.
 *  - **AirTag** es un sistema cerrado: la red Find My no expone API alguna.
 *
 * Lo que sí funciona con seguridad, y por eso es lo que se implementa de verdad,
 * es el GPS del propio teléfono y una ingesta genérica por webhook firmado, que
 * acepta cualquier cosa capaz de hacer una petición: IFTTT, Tasker, Atajos de
 * iOS o un script casero.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { TrackerError, type TrackerAdapter, type TrackerDevice, type TrackerPing, type WebhookInput } from './types.js';

/** Ventana de validez de un webhook firmado, en segundos. */
export const WEBHOOK_MAX_AGE_SECONDS = 300;

/**
 * GPS del teléfono.
 *
 * Es la base de todo: no depende de ningún fabricante, funciona para cualquier
 * usuario y es lo que hace que el producto no necesite un collar caro para
 * servir de algo.
 */
export const phoneAdapter: TrackerAdapter = {
  vendor: 'phone',
  displayName: 'GPS del teléfono',
  mode: 'push',
  availability: { status: 'available' },
  parseWebhook: (input, device) => parseGenericPayload(input.rawBody, device),
};

/**
 * Ingesta genérica por webhook.
 *
 * Acepta cualquier origen capaz de firmar una petición con HMAC. Es la vía por
 * la que un usuario puede conectar hoy un collar que no tenga adaptador propio,
 * sin esperar a que exista.
 */
export const webhookAdapter: TrackerAdapter = {
  vendor: 'webhook',
  displayName: 'Webhook genérico',
  mode: 'push',
  availability: { status: 'available' },
  parseWebhook: (input, device) => parseGenericPayload(input.rawBody, device),
};

export const tractiveAdapter: TrackerAdapter = {
  vendor: 'tractive',
  displayName: 'Tractive',
  mode: 'pull',
  availability: {
    status: 'requires-credentials',
    note:
      'Tractive no publica una API para terceros. Existen envoltorios no oficiales y la ' +
      'integración de Home Assistant exige cuenta premium. Este adaptador queda a la espera ' +
      'de un acuerdo con el fabricante o de credenciales aportadas por el propio usuario.',
  },
  fetchLatest: async () => {
    throw new TrackerError(
      'La integración con Tractive todavía no está disponible',
      'unavailable',
    );
  },
};

export const fiAdapter: TrackerAdapter = {
  vendor: 'fi',
  displayName: 'Fi',
  mode: 'pull',
  availability: {
    status: 'blocked',
    note:
      'Fi no publica documentación de API para terceros. La única vía conocida es una API ' +
      'GraphQL obtenida por ingeniería inversa, frágil y probablemente contraria a sus ' +
      'términos de uso. No se integra por esa vía: hace falta un acuerdo comercial.',
  },
  fetchLatest: async () => {
    throw new TrackerError(
      'La integración con Fi requiere un acuerdo con el fabricante',
      'unavailable',
    );
  },
};

export const ADAPTERS: Record<string, TrackerAdapter> = {
  phone: phoneAdapter,
  webhook: webhookAdapter,
  tractive: tractiveAdapter,
  fi: fiAdapter,
};

/** Adaptadores que un usuario puede conectar hoy de verdad. */
export function availableAdapters(): TrackerAdapter[] {
  return Object.values(ADAPTERS).filter(
    (adapter) => adapter.availability.status === 'available',
  );
}

// ---------------------------------------------------------------------------

type GenericPayload = {
  lat?: unknown;
  lng?: unknown;
  lon?: unknown;
  longitude?: unknown;
  latitude?: unknown;
  accuracy?: unknown;
  battery?: unknown;
  timestamp?: unknown;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Traduce un cuerpo JSON a un ping.
 *
 * Acepta los nombres de campo más habituales (`lat`/`latitude`,
 * `lng`/`lon`/`longitude`) porque cada fabricante los llama a su manera, y
 * porque el objetivo es que conectar un collar raro no exija código nuevo.
 */
export function parseGenericPayload(rawBody: string, device: TrackerDevice): TrackerPing {
  let payload: GenericPayload;
  try {
    payload = JSON.parse(rawBody) as GenericPayload;
  } catch {
    throw new TrackerError('El cuerpo no es JSON válido', 'malformed_payload');
  }

  const lat = asNumber(payload.lat ?? payload.latitude);
  const lng = asNumber(payload.lng ?? payload.lon ?? payload.longitude);

  if (lat === null || lng === null) {
    throw new TrackerError('Faltan la latitud o la longitud', 'malformed_payload');
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new TrackerError('Las coordenadas están fuera de rango', 'malformed_payload');
  }

  const timestamp = asNumber(payload.timestamp);
  // Se aceptan segundos y milisegundos: los dos circulan, y confundirlos daría
  // pings fechados en 1970 o en el año 56000.
  const recordedAt =
    timestamp === null
      ? new Date()
      : new Date(timestamp > 1e11 ? timestamp : timestamp * 1000);

  if (Number.isNaN(recordedAt.getTime())) {
    throw new TrackerError('La marca de tiempo no es válida', 'malformed_payload');
  }

  const battery = asNumber(payload.battery);

  return {
    petId: device.petId,
    deviceId: device.id,
    point: { lat, lng },
    accuracyMeters: asNumber(payload.accuracy),
    batteryPercent: battery === null ? null : Math.max(0, Math.min(100, Math.round(battery))),
    recordedAt,
  };
}

/**
 * Comprueba la firma de un webhook.
 *
 * Dos controles, no uno:
 *  - HMAC-SHA256 sobre `timestamp.cuerpo`, comparado en tiempo constante. Una
 *    comparación normal con `===` filtra por cuánto tarda en fallar, y con
 *    suficientes intentos eso permite reconstruir la firma byte a byte.
 *  - Ventana temporal, para que capturar una petición válida no sirva para
 *    reproducirla mañana.
 */
export function verifyWebhookSignature(
  input: WebhookInput,
  secret: string,
  now: Date = new Date(),
): void {
  if (!input.signature) {
    throw new TrackerError('Falta la firma', 'invalid_signature');
  }
  if (input.timestamp === null) {
    throw new TrackerError('Falta la marca de tiempo de la firma', 'invalid_signature');
  }

  const ageSeconds = Math.abs(Math.floor(now.getTime() / 1000) - input.timestamp);
  if (ageSeconds > WEBHOOK_MAX_AGE_SECONDS) {
    throw new TrackerError('La petición está fuera de la ventana de validez', 'stale_request');
  }

  const expected = createHmac('sha256', secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest('hex');

  const provided = input.signature.trim().toLowerCase();
  if (provided.length !== expected.length) {
    throw new TrackerError('La firma no es válida', 'invalid_signature');
  }

  const equal = timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
  if (!equal) {
    throw new TrackerError('La firma no es válida', 'invalid_signature');
  }
}

/** Firma un cuerpo igual que se espera recibirlo. Se usa en los tests y en la app. */
export function signWebhookBody(rawBody: string, secret: string, timestampSeconds: number): string {
  return createHmac('sha256', secret).update(`${timestampSeconds}.${rawBody}`).digest('hex');
}
