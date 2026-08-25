/**
 * Fan-out geodirigido del radar.
 *
 * Cuando alguien pulsa "Paseando ahora", esta función busca los dispositivos
 * dentro del radio y les manda un aviso. Es el único punto del sistema que ve
 * tokens de envío junto a ubicaciones, así que corre con el rol de servicio y
 * nunca se expone a un cliente.
 *
 * NOTA HONESTA: este archivo no se ha podido ejecutar en el entorno donde se
 * escribió, porque no hay Deno ni un proyecto Supabase desplegado. Lo que sí
 * está verificado es todo lo que decide el resultado:
 *   - a quién se avisa, con tests de integración contra PostGIS
 *     (`push_targets_in_radius`, en packages/db);
 *   - qué se le dice y qué se hace con cada respuesta de Expo, con tests
 *     unitarios sobre `_shared/notifications.ts`.
 * Lo que queda sin probar aquí es el pegamento HTTP.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  EXPO_PUSH_ENDPOINT,
  buildRadarNotification,
  chunkMessages,
  classifyTickets,
  filterRecipients,
  type ExpoTicket,
  type PushTarget,
} from '../_shared/notifications.ts';

type RequestBody = {
  dogId: string;
  dogName: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  placeName?: string | null;
  playdateId?: string | null;
  /** Hora local `HH:MM` a la que caduca el check-in. */
  until: string;
  /** El propio tutor, para no avisarse a sí mismo. */
  ownerProfileId: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405);
  }

  let payload: RequestBody;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'El cuerpo no es JSON válido' }, 400);
  }

  if (!payload.dogId || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') {
    return json({ error: 'Faltan dogId, lat o lng' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    // El rol de servicio salta RLS: es la única forma de leer tokens de otros
    // usuarios, y la razón por la que esta función no se expone a un cliente.
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const radius = payload.radiusMeters ?? 2000;

  const { data: rows, error } = await supabase.rpc('push_targets_in_radius', {
    lat: payload.lat,
    lng: payload.lng,
    radius_m: radius,
  });

  if (error) {
    console.error('No se pudieron obtener los destinatarios', error);
    return json({ error: 'No se pudieron obtener los destinatarios' }, 500);
  }

  const targets: PushTarget[] = (rows ?? []).map(
    (row: { profile_id: string; expo_push_token: string; platform: PushTarget['platform'] }) => ({
      profileId: row.profile_id,
      expoPushToken: row.expo_push_token,
      platform: row.platform,
    }),
  );

  const recipients = filterRecipients(targets, { excludeProfileIds: [payload.ownerProfileId] });

  if (recipients.length === 0) {
    // Es el estado normal al empezar en un barrio. Se devuelve tal cual para que
    // la aplicación pueda decirlo con honestidad en lugar de fingir alcance.
    return json({ sent: 0, recipients: 0, reason: 'nadie_en_el_radio' });
  }

  const messages = recipients.map((recipient) =>
    buildRadarNotification(recipient, {
      dogName: payload.dogName,
      placeName: payload.placeName ?? null,
      until: payload.until,
      playdateId: payload.playdateId ?? null,
    }),
  );

  let delivered = 0;
  const tokensToRemove: string[] = [];

  for (const batch of chunkMessages(messages)) {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      console.error('Expo devolvió un error', response.status, await response.text());
      continue;
    }

    const result = (await response.json()) as { data?: ExpoTicket[] };
    const outcome = classifyTickets(batch, result.data ?? []);
    delivered += outcome.delivered;
    tokensToRemove.push(...outcome.tokensToRemove);
  }

  // Los tokens muertos se borran: insistir sobre ellos degrada la reputación de
  // envío y termina afectando a los usuarios que sí están.
  if (tokensToRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('device_tokens')
      .delete()
      .in('expo_push_token', tokensToRemove);
    if (deleteError) console.error('No se pudieron limpiar los tokens muertos', deleteError);
  }

  return json({ sent: delivered, recipients: recipients.length, removed: tokensToRemove.length });
});
