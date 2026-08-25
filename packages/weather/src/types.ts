/**
 * El tiempo que hace, como entrada del juicio de bienestar.
 *
 * `assessWelfare` decide si a un animal le conviene salir, y para eso necesita
 * una temperatura. Hasta ahora la ponía el tutor a mano. Esta capa la trae.
 *
 * Dos reglas gobiernan todo lo que hay aquí:
 *
 *  1. **No saber no es permiso.** Si la consulta falla, el resultado es
 *     `unavailable` con su motivo, nunca una temperatura por defecto. Un valor
 *     inventado en la entrada de una función que puede decir «hoy no salgas»
 *     convierte una decisión en una casualidad, y encima sin que se note.
 *  2. **El proveedor recibe una coordenada redondeada.** El modelo meteorológico
 *     trabaja en una rejilla de kilómetros, así que la precisión de más no
 *     mejora el dato: solo le cuenta a un tercero dónde está exactamente una
 *     persona. Ver `privacy.ts`.
 *
 * La forma —una interfaz y adaptadores— es la misma que la de los collares, y
 * por la misma razón: el resto de la aplicación no debe saber quién da el dato.
 */

export type Coordinates = { lat: number; lng: number };

/** Por qué no hay dato. Cada motivo se le cuenta al usuario de forma distinta. */
export const WEATHER_FAILURES = [
  /** No hay red, o la petición no llegó a salir. */
  'offline',
  /** Salió y la rechazaron: bloqueo de red, CSP, cuota, o el servicio caído. */
  'rejected',
  /** Respondió, pero no con lo que dice su esquema. */
  'malformed',
  /** Tardó más de lo aceptable para una pantalla que se está mirando. */
  'timeout',
  /** No se sabe dónde está el tutor, así que no hay nada que preguntar. */
  'no_location',
] as const;
export type WeatherFailure = (typeof WEATHER_FAILURES)[number];

export type WeatherObservation = {
  temperatureC: number;
  /**
   * Sensación térmica: temperatura, humedad, viento y radiación combinados.
   *
   * No sustituye a la del aire para juzgar a un perro —su termorregulación no
   * es la nuestra, y jadear no es sudar— pero cuando es bastante más alta que
   * la del aire, es la señal de que el día aprieta más de lo que marca el
   * termómetro. Se guarda y se enseña; quien decide sigue siendo la del aire.
   */
  apparentTemperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  isDay: boolean;
  /**
   * Radiación solar de onda corta en W/m², o null si el proveedor no la da.
   * Es lo que calienta el suelo, y por tanto lo que decide si el asfalto quema.
   */
  solarRadiation: number | null;
  /** Código WMO del estado del cielo. Ver `weather-codes.ts`. */
  weatherCode: number;
  /** Momento al que se refiere la medida, no el momento en que se pidió. */
  observedAt: Date;
  /** La coordenada que se envió de verdad, ya redondeada. */
  queriedFor: Coordinates;
  provider: string;
};

export type WeatherResult =
  | { status: 'ok'; observation: WeatherObservation }
  | { status: 'unavailable'; failure: WeatherFailure; detail: string };

export interface WeatherProvider {
  readonly id: string;
  /** Atribución que hay que enseñar en pantalla. La piden casi todos, y es justo. */
  readonly attribution: string;
  read(at: Coordinates, signal?: AbortSignal): Promise<WeatherResult>;
}

export const unavailable = (failure: WeatherFailure, detail: string): WeatherResult => ({
  status: 'unavailable',
  failure,
  detail,
});

/** Lo que se le dice a alguien que está mirando la pantalla, no un código. */
export const FAILURE_MESSAGE: Record<WeatherFailure, string> = {
  offline: 'Sin conexión, así que no sabemos qué tiempo hace.',
  rejected: 'El servicio meteorológico no respondió.',
  malformed: 'El servicio meteorológico respondió algo que no entendemos.',
  timeout: 'El servicio meteorológico tardó demasiado.',
  no_location: 'Sin ubicación no podemos saber qué tiempo hace donde estás.',
};
