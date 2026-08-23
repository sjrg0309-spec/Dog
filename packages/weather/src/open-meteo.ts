/**
 * Open-Meteo: el proveedor que sí se puede usar.
 *
 * Se elige por tres motivos concretos, no por costumbre:
 *
 *  1. **No pide clave.** Cualquier proveedor con API key obliga a meter un
 *     secreto en la aplicación, y un secreto dentro de una app que se instala no
 *     es un secreto. La alternativa sería un servidor intermedio solo para
 *     esconderlo, y eso es infraestructura para consultar la temperatura.
 *  2. **Responde con CORS abierto**, así que funciona desde el navegador y desde
 *     el móvil sin proxy.
 *  3. **Da radiación solar**, que es lo que permite estimar si el suelo quema.
 *     La mayoría de las APIs gratuitas solo dan temperatura del aire, y con eso
 *     no se puede decidir lo que de verdad hay que decidir aquí.
 *
 * La radiación no está entre las variables que admite `current`, solo entre las
 * de `hourly`. Así que se piden las dos cosas en la misma llamada y se busca la
 * hora en curso dentro de la serie: una petición, no dos.
 *
 * Sobre la verificación: en el contenedor donde se construyó esto **el proxy de
 * salida bloquea `api.open-meteo.com`**, así que el adaptador no se ha podido
 * ejecutar contra el servicio de verdad desde aquí. Lo que sí se hizo fue traer
 * su especificación OpenAPI —`openapi/forecast.yml` de su repositorio— y
 * escribir los tests contra las formas que declara, incluidas las respuestas
 * mal formadas. Cuando la aplicación corre en un teléfono, la red es la del
 * teléfono y la llamada sale.
 */

import { coarsen } from './privacy.js';
import type { Coordinates, WeatherProvider, WeatherResult } from './types.js';
import { unavailable } from './types.js';

export const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

/** Lo que se pide en `current`. Están todas en el enum de la especificación. */
const CURRENT = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'is_day',
  'weather_code',
  'wind_speed_10m',
] as const;

/** La radiación solo existe por horas. Ver la cabecera. */
const HOURLY = ['shortwave_radiation'] as const;

export function buildUrl(at: Coordinates): string {
  const cell = coarsen(at);
  const query = new URLSearchParams({
    latitude: String(cell.lat),
    longitude: String(cell.lng),
    current: CURRENT.join(','),
    hourly: HOURLY.join(','),
    /* Una sola jornada: no se está haciendo una previsión, se está mirando
       ahora. Pedir siete días serían cien veces más datos para tirarlos. */
    forecast_days: '1',
    /* Sin esto los tiempos vuelven en UTC y encontrar «la hora en curso» pasa a
       depender de la zona del dispositivo, que es justo lo que no queremos
       calcular a mano. */
    timezone: 'auto',
  });
  return `${OPEN_METEO_ENDPOINT}?${query.toString()}`;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Busca la radiación de la hora en curso dentro de la serie horaria.
 *
 * Las marcas vienen como `2026-08-23T09:00` en hora local del punto, sin zona.
 * Se compara por prefijo de hora contra la marca de `current`, que viene en la
 * misma escala. Comparar convirtiendo a `Date` sería peor: al no llevar zona,
 * el navegador las interpretaría como locales del dispositivo, que puede estar
 * en otro huso que el sitio consultado.
 */
export function radiationAt(
  currentTime: string,
  times: unknown,
  values: unknown,
): number | null {
  if (!Array.isArray(times) || !Array.isArray(values)) return null;
  const hour = currentTime.slice(0, 13); // "2026-08-23T09"
  const index = times.findIndex((time) => typeof time === 'string' && time.startsWith(hour));
  if (index === -1) return null;
  const value = values[index];
  return isFiniteNumber(value) ? value : null;
}

/**
 * Convierte la respuesta en una observación, o dice que no la entiende.
 *
 * Se valida campo a campo en lugar de confiar en el tipo declarado. No es
 * ceremonia: esto es la entrada de una función que puede decidir que un animal
 * no salga, y un `undefined` que se cuele aquí sale por el otro lado como una
 * temperatura `NaN` que no supera ningún umbral y deja pasar cualquier cosa.
 * Un dato que no se entiende tiene que parecerse a no tener dato, no a hacer
 * buen tiempo.
 */
export function parseResponse(body: unknown, at: Coordinates): WeatherResult {
  if (typeof body !== 'object' || body === null) {
    return unavailable('malformed', 'la respuesta no es un objeto');
  }
  const payload = body as Record<string, unknown>;

  if (payload['error'] === true) {
    const reason = typeof payload['reason'] === 'string' ? payload['reason'] : 'sin motivo';
    return unavailable('rejected', reason);
  }

  const current = payload['current'];
  if (typeof current !== 'object' || current === null) {
    return unavailable('malformed', 'falta el bloque "current"');
  }
  const now = current as Record<string, unknown>;

  const temperatureC = now['temperature_2m'];
  if (!isFiniteNumber(temperatureC)) {
    return unavailable('malformed', 'la temperatura no es un número');
  }

  const time = now['time'];
  if (typeof time !== 'string') {
    return unavailable('malformed', 'falta la hora de la medida');
  }

  const observedAt = new Date(time);
  if (Number.isNaN(observedAt.getTime())) {
    return unavailable('malformed', `hora ilegible: ${time}`);
  }

  const hourly = (payload['hourly'] ?? {}) as Record<string, unknown>;
  const solarRadiation = radiationAt(time, hourly['time'], hourly['shortwave_radiation']);

  const apparent = now['apparent_temperature'];
  const humidity = now['relative_humidity_2m'];
  const wind = now['wind_speed_10m'];
  const code = now['weather_code'];

  return {
    status: 'ok',
    observation: {
      temperatureC,
      /* Si falta la sensación térmica se usa la del aire, que es la que decide
         de todos modos. Un hueco aquí no justifica descartar la observación. */
      apparentTemperatureC: isFiniteNumber(apparent) ? apparent : temperatureC,
      humidityPct: isFiniteNumber(humidity) ? humidity : 0,
      windSpeedKmh: isFiniteNumber(wind) ? wind : 0,
      /* `is_day` llega como 1 o 0, no como booleano. */
      isDay: now['is_day'] === 1 || now['is_day'] === true,
      solarRadiation,
      weatherCode: isFiniteNumber(code) ? code : 0,
      observedAt,
      queriedFor: coarsen(at),
      provider: 'open-meteo',
    },
  };
}

/** Más de esto y la pantalla lleva demasiado rato diciendo «cargando». */
export const TIMEOUT_MS = 8000;

export function createOpenMeteoProvider(
  fetchImpl: typeof fetch = fetch,
): WeatherProvider {
  return {
    id: 'open-meteo',
    attribution: 'Datos meteorológicos de Open-Meteo.com',

    async read(at: Coordinates, signal?: AbortSignal): Promise<WeatherResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      /* Quien llama puede cancelar —al desmontar la pantalla, por ejemplo— y
         eso tiene que abortar la petición además del temporizador propio. */
      const onAbort = () => controller.abort();
      signal?.addEventListener('abort', onAbort);

      try {
        const response = await fetchImpl(buildUrl(at), { signal: controller.signal });
        if (!response.ok) {
          return unavailable('rejected', `HTTP ${response.status}`);
        }
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          return unavailable('malformed', 'la respuesta no es JSON');
        }
        return parseResponse(body, at);
      } catch (error) {
        /* Distinguir el corte de red del plantón importa: uno se reintenta solo
           cuando vuelva la conexión y el otro no. */
        if (controller.signal.aborted) {
          return unavailable('timeout', `sin respuesta en ${TIMEOUT_MS} ms`);
        }
        return unavailable('offline', error instanceof Error ? error.message : 'fallo de red');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}
