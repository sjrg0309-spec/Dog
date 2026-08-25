/**
 * Sugerencia de cumpleaños.
 *
 * Se dispara desde un cron diario. Busca los perros que cumplen dentro de la
 * ventana y propone un espacio privado cerca para celebrarlo entre varios.
 *
 * La regla que gobierna esta función: **solo se envía si hay algo concreto que
 * proponer**. Un "tu perro cumple años" sin más es una notificación que no pide
 * nada y no aporta nada, y una aplicación que manda de esas se acaba silenciando
 * entera. Si no hay espacio disponible cerca, no se manda nada.
 *
 * Igual que el fan-out del radar, el pegamento HTTP de este archivo no se ha
 * podido ejecutar en el entorno donde se escribió; la lógica que decide qué se
 * dice y cuándo no se dice nada sí está probada en `_shared/notifications.ts`.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  EXPO_PUSH_ENDPOINT,
  buildBirthdayNotification,
  chunkMessages,
  classifyTickets,
  dedupeTargets,
  type ExpoPushMessage,
  type ExpoTicket,
  type PushTarget,
} from '../_shared/notifications.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data: birthdays, error } = await supabase.rpc('dogs_with_birthday', { within_days: 7 });
  if (error) {
    console.error('No se pudieron leer los cumpleaños', error);
    return json({ error: 'No se pudieron leer los cumpleaños' }, 500);
  }

  const messages: ExpoPushMessage[] = [];
  let skippedWithoutSpot = 0;

  for (const birthday of birthdays ?? []) {
    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('profile_id, expo_push_token, platform')
      .eq('profile_id', birthday.owner_id);

    const targets: PushTarget[] = dedupeTargets(
      (tokens ?? []).map((row) => ({
        profileId: row.profile_id,
        expoPushToken: row.expo_push_token,
        platform: row.platform,
      })),
    );
    if (targets.length === 0) continue;

    // Se busca un espacio con sitio para un grupo pequeño: celebrar un
    // cumpleaños con un solo perro invitado no es celebrarlo.
    const { data: spots } = await supabase
      .from('public_spots')
      .select('title, max_dogs')
      .gte('max_dogs', 3)
      .limit(1);

    const suggestedSpotTitle = spots?.[0]?.title ?? null;
    if (!suggestedSpotTitle) {
      skippedWithoutSpot += 1;
      continue;
    }

    for (const target of targets) {
      const message = buildBirthdayNotification(target, {
        dogName: birthday.name,
        turningAge: birthday.turning_age,
        suggestedSpotTitle,
      });
      if (message) messages.push(message);
    }
  }

  let delivered = 0;
  for (const batch of chunkMessages(messages)) {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(batch),
    });
    if (!response.ok) continue;

    const result = (await response.json()) as { data?: ExpoTicket[] };
    delivered += classifyTickets(batch, result.data ?? []).delivered;
  }

  return json({ sent: delivered, candidates: birthdays?.length ?? 0, skippedWithoutSpot });
});
