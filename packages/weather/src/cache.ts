/**
 * Una consulta por celda y por cuarto de hora, y no más.
 *
 * Sin esto, cada render de una pantalla que mira el tiempo sería una petición.
 * Tres razones para que no lo sea, en orden de importancia:
 *
 *  1. Open-Meteo es gratis y sin clave porque la gente no abusa. Consultar el
 *     tiempo cuarenta veces por minuto es exactamente cómo se acaba eso.
 *  2. El modelo se actualiza cada quince minutos. Pedirlo más a menudo devuelve
 *     el mismo número con más batería y más datos gastados.
 *  3. Cada petición manda una posición. Menos peticiones es menos rastro.
 *
 * Se cachea también el fallo, pero muchísimo menos: repetir a ciegas contra un
 * servicio que acaba de fallar es la forma de convertir un problema suyo en uno
 * tuyo, y a la vez nadie quiere esperar quince minutos a que se reintente
 * cuando la conexión vuelve a los diez segundos.
 */

import { cellKey } from './privacy.js';
import type { Coordinates, WeatherProvider, WeatherResult } from './types.js';

/** Lo que tarda el modelo en actualizarse. */
export const FRESH_MS = 15 * 60 * 1000;

/** Tras un fallo, lo que se espera antes de volver a intentarlo. */
export const RETRY_AFTER_MS = 30 * 1000;

type Entry = { result: WeatherResult; at: number };

export type Clock = () => number;

export type CachedProvider = WeatherProvider & {
  /** Fuerza la siguiente lectura, para el gesto de «actualizar» del usuario. */
  invalidate(): void;
  /** Lo que hay guardado ahora mismo, sin pedir nada. Para pintar al instante. */
  peek(at: Coordinates): WeatherResult | null;
};

export function withCache(
  provider: WeatherProvider,
  clock: Clock = Date.now,
): CachedProvider {
  const entries = new Map<string, Entry>();
  /* Dos pantallas que preguntan a la vez no deben producir dos peticiones. */
  const inFlight = new Map<string, Promise<WeatherResult>>();

  const ageLimit = (result: WeatherResult): number =>
    result.status === 'ok' ? FRESH_MS : RETRY_AFTER_MS;

  const live = (key: string): WeatherResult | null => {
    const entry = entries.get(key);
    if (!entry) return null;
    return clock() - entry.at < ageLimit(entry.result) ? entry.result : null;
  };

  return {
    id: provider.id,
    attribution: provider.attribution,

    peek(at) {
      return live(cellKey(at));
    },

    invalidate() {
      entries.clear();
    },

    async read(at, signal) {
      const key = cellKey(at);

      const cached = live(key);
      if (cached) return cached;

      const pending = inFlight.get(key);
      if (pending) return await pending;

      const request = provider
        .read(at, signal)
        .then((result) => {
          entries.set(key, { result, at: clock() });
          return result;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, request);
      return await request;
    },
  };
}
