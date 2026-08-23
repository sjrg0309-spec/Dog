/**
 * Contrato de un adaptador de collar.
 *
 * El diseño es agnóstico del fabricante a propósito, y no por elegancia: la
 * mayoría de estos collares no publican una API. Añadir un modelo nuevo tiene
 * que ser escribir un módulo que cumpla esta interfaz, sin que ninguna otra
 * parte de la aplicación sepa qué marca hay detrás.
 */

import type { LatLng } from '@coincide/core';

export type TrackerVendor = 'phone' | 'webhook' | 'tractive' | 'fi' | 'other';

/** Una lectura de posición, venga de donde venga. */
export type TrackerPing = {
  petId: string;
  deviceId: string;
  point: LatLng;
  /** Precisión declarada en metros. Nula cuando el origen no la aporta. */
  accuracyMeters: number | null;
  batteryPercent: number | null;
  recordedAt: Date;
};

export type TrackerDevice = {
  id: string;
  petId: string;
  vendor: TrackerVendor;
  externalId: string | null;
  label: string | null;
};

/**
 * Un adaptador traduce lo que da un proveedor a `TrackerPing`.
 *
 * Se distinguen dos modos porque el mundo real tiene los dos: los que hay que
 * consultar (`pull`) y los que empujan datos cuando les parece (`push`).
 */
export type TrackerAdapter = {
  vendor: TrackerVendor;
  /** Nombre legible, para la pantalla de ajustes. */
  displayName: string;
  mode: 'pull' | 'push';

  /**
   * Estado real de la integración.
   *
   * Se declara en el propio adaptador para que la interfaz no pueda ofrecer un
   * proveedor que en realidad no está disponible, y para que nadie tenga que
   * buscar en la documentación por qué falla.
   */
  availability: TrackerAvailability;

  /** Solo en modo `pull`: consulta la última posición conocida. */
  fetchLatest?: (device: TrackerDevice) => Promise<TrackerPing | null>;

  /** Solo en modo `push`: valida y traduce lo que llega por webhook. */
  parseWebhook?: (input: WebhookInput, device: TrackerDevice) => TrackerPing;
};

export type TrackerAvailability =
  | { status: 'available' }
  | {
      /** Hay una API, pero exige credenciales que el usuario debe aportar. */
      status: 'requires-credentials';
      note: string;
    }
  | {
      /** No hay forma legítima de integrarlo hoy. */
      status: 'blocked';
      note: string;
    };

export type WebhookInput = {
  /** Cuerpo sin parsear. Se firma sobre el texto exacto, no sobre el objeto. */
  rawBody: string;
  signature: string | null;
  /** Marca de tiempo del envío, en segundos desde época. */
  timestamp: number | null;
};

export class TrackerError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_signature'
      | 'stale_request'
      | 'malformed_payload'
      | 'unsupported'
      | 'unavailable',
  ) {
    super(message);
    this.name = 'TrackerError';
  }
}
