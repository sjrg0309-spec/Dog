/**
 * Lógica de notificaciones, sin dependencias del entorno.
 *
 * Vive aparte de las funciones que la usan para poder probarla con Node: aquí
 * no hay Deno, así que si esto estuviera mezclado con el manejador HTTP no se
 * podría verificar nada de lo que importa —a quién se avisa, qué se le dice y
 * qué se hace cuando un envío falla— hasta desplegarlo.
 *
 * Se usa Expo Push y no Firebase: un solo token cubre iOS y Android, y evita
 * meter un SDK entero para algo que son dos peticiones HTTP.
 */

export const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo acepta como mucho cien mensajes por petición. */
export const EXPO_MAX_BATCH = 100;

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
};

export type PushTarget = {
  profileId: string;
  expoPushToken: string;
  platform: 'ios' | 'android' | 'web';
};

export type RadarNotificationInput = {
  dogName: string;
  placeName: string | null;
  /** Hora local en formato `HH:MM` a la que caduca el check-in. */
  until: string;
  playdateId: string | null;
  /** Afinidad con el perro de quien recibe, si se ha podido calcular. */
  affinity?: number | null;
};

/**
 * Redacta el aviso del radar.
 *
 * El cuerpo dice el nombre, el sitio y hasta cuándo, porque son las tres cosas
 * que deciden si alguien se levanta del sofá. La afinidad solo aparece cuando es
 * lo bastante alta como para ser un argumento; ponerla siempre convertiría un
 * dato útil en ruido, y un "42 % de afinidad" no anima a nadie.
 */
export function buildRadarNotification(
  target: PushTarget,
  input: RadarNotificationInput,
): ExpoPushMessage {
  const place = input.placeName ?? 'un parque cercano';
  const affinityNote =
    typeof input.affinity === 'number' && input.affinity >= 80
      ? ` · ${input.affinity} % de afinidad`
      : '';

  return {
    to: target.expoPushToken,
    title: `${input.dogName} está paseando cerca`,
    body: `En ${place} hasta las ${input.until}${affinityNote}`,
    data: {
      kind: 'radar',
      playdateId: input.playdateId,
    },
    sound: 'default',
    // El radar es útil ahora o no es útil. Media hora tarde no sirve de nada.
    priority: 'high',
    channelId: 'radar',
  };
}

export type BirthdayNotificationInput = {
  dogName: string;
  turningAge: number;
  /** Espacio sugerido para celebrarlo, si hay alguno cerca. */
  suggestedSpotTitle: string | null;
};

/**
 * Redacta el aviso de cumpleaños.
 *
 * Solo se envía cuando hay algo concreto que proponer. Un "tu perro cumple
 * años" sin más es una notificación que no pide nada y no aporta nada, y una
 * aplicación que manda esas se acaba silenciando entera.
 */
export function buildBirthdayNotification(
  target: PushTarget,
  input: BirthdayNotificationInput,
): ExpoPushMessage | null {
  if (!input.suggestedSpotTitle) return null;

  return {
    to: target.expoPushToken,
    title: `${input.dogName} cumple ${input.turningAge}`,
    body: `¿Lo celebramos? ${input.suggestedSpotTitle} está libre y sale a poco por perro.`,
    data: { kind: 'birthday' },
    sound: 'default',
    priority: 'normal',
    channelId: 'sugerencias',
  };
}

/** Parte una lista de mensajes en lotes del tamaño que acepta Expo. */
export function chunkMessages(
  messages: readonly ExpoPushMessage[],
  size: number = EXPO_MAX_BATCH,
): ExpoPushMessage[][] {
  if (size <= 0) throw new Error('El tamaño de lote debe ser positivo');

  const batches: ExpoPushMessage[][] = [];
  for (let index = 0; index < messages.length; index += size) {
    batches.push(messages.slice(index, index + size));
  }
  return batches;
}

export type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

export type TicketOutcome = {
  /** Tokens que Expo considera muertos y hay que borrar de la base. */
  tokensToRemove: string[];
  /** Envíos que fallaron por algo temporal y se pueden reintentar. */
  retryable: string[];
  delivered: number;
};

/**
 * Interpreta la respuesta de Expo.
 *
 * `DeviceNotRegistered` significa que la aplicación se desinstaló o el token
 * caducó: hay que borrarlo. Seguir enviando a tokens muertos degrada la
 * reputación de envío y termina afectando a los usuarios reales, así que la
 * limpieza no es opcional.
 */
export function classifyTickets(
  messages: readonly ExpoPushMessage[],
  tickets: readonly ExpoTicket[],
): TicketOutcome {
  const tokensToRemove: string[] = [];
  const retryable: string[] = [];
  let delivered = 0;

  tickets.forEach((ticket, index) => {
    const token = messages[index]?.to;
    if (!token) return;

    if (ticket.status === 'ok') {
      delivered += 1;
      return;
    }

    if (ticket.details?.error === 'DeviceNotRegistered') {
      tokensToRemove.push(token);
      return;
    }

    // MessageRateExceeded y los errores sin clasificar se reintentan; el resto
    // se registra pero no se reintenta, para no insistir sobre algo roto.
    if (ticket.details?.error === 'MessageRateExceeded' || !ticket.details?.error) {
      retryable.push(token);
    }
  });

  return { tokensToRemove, retryable, delivered };
}

/**
 * Quita destinatarios duplicados.
 *
 * Una persona con el teléfono y la tableta tiene dos tokens y debe recibir el
 * aviso en los dos. Lo que no puede pasar es que el mismo token reciba dos
 * copias porque aparece dos veces en la consulta.
 */
export function dedupeTargets(targets: readonly PushTarget[]): PushTarget[] {
  const seen = new Set<string>();
  const unique: PushTarget[] = [];

  for (const target of targets) {
    if (seen.has(target.expoPushToken)) continue;
    seen.add(target.expoPushToken);
    unique.push(target);
  }

  return unique;
}

/**
 * Excluye a quien no debe recibir el aviso.
 *
 * Quien origina el check-in no necesita que le avisen de sí mismo, y quien ya
 * fue avisado de esta misma quedada tampoco: recibir dos veces la misma cosa es
 * la forma más rápida de que alguien desactive las notificaciones para siempre.
 */
export function filterRecipients(
  targets: readonly PushTarget[],
  options: { excludeProfileIds?: readonly string[]; alreadyNotified?: readonly string[] } = {},
): PushTarget[] {
  const excluded = new Set(options.excludeProfileIds ?? []);
  const notified = new Set(options.alreadyNotified ?? []);

  return dedupeTargets(targets).filter(
    (target) => !excluded.has(target.profileId) && !notified.has(target.profileId),
  );
}
