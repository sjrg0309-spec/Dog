/**
 * Purga de pings de collar.
 *
 * Cron diario. Borra las lecturas de más de treinta días conservando el último
 * punto de cada dispositivo.
 *
 * Esta función no es mantenimiento: es la razón por la que guardar estos datos
 * resulta aceptable. Un collar GPS registra la rutina diaria de una persona, y
 * el compromiso del producto es que ese rastro no se acumula. Si esta tarea deja
 * de ejecutarse, la promesa deja de ser cierta, así que su resultado se registra
 * para poder vigilarlo.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const RETENTION_DAYS = 30;

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc('purge_old_tracker_pings', {
    retention_days: RETENTION_DAYS,
  });

  if (error) {
    console.error('Falló la purga de pings', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  console.log(`Purga completada: ${data} pings borrados`);
  return new Response(JSON.stringify({ deleted: data, retentionDays: RETENTION_DAYS }), {
    headers: { 'content-type': 'application/json' },
  });
});
