/**
 * Las condiciones del encuentro que se está planteando.
 *
 * `packages/core` juzga si a un animal le conviene salir, pero no consulta
 * nada: recibe temperatura, superficie y duración. Quien las obtiene es esta
 * capa, y ahora las obtiene sola: `@petnav/weather` pregunta a Open-Meteo por
 * la celda donde está el tutor y devuelve la temperatura del aire, la sensación
 * térmica y la radiación solar, que es de donde sale la estimación del suelo.
 *
 * Tres decisiones que gobiernan este módulo:
 *
 *  1. **No saber no es permiso.** Si la consulta falla, el estado es `unknown` y
 *     la pantalla lo dice. Nunca se cae a una temperatura por defecto: un número
 *     inventado delante de una función que puede decir «hoy no salgas» convierte
 *     una decisión en una casualidad, y encima sin que se note.
 *  2. **El tutor puede corregir, y su corrección se nota.** Quien esté en una
 *     terraza a pleno sol sabe algo que el modelo no sabe. Al fijar un valor a
 *     mano el origen pasa a `manual` y la pantalla deja de atribuírselo al
 *     servicio; el gesto de volver a lo automático está siempre a un toque.
 *  3. **La superficie sigue siendo suya.** Ninguna API sabe si vas a pisar
 *     hierba o asfalto. Lo que sí se automatiza es cuánto calienta el sol esa
 *     superficie, que es la mitad del problema que importa.
 */

import { useEffect, useSyncExternalStore } from 'react';

import type { Conditions, Surface } from '@petnav/core';
import {
  FAILURE_MESSAGE,
  createOpenMeteoProvider,
  estimateGroundC,
  withCache,
} from '@petnav/weather';
import type { WeatherFailure, WeatherObservation } from '@petnav/weather';

export type WeatherStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'live'; observation: WeatherObservation }
  | { kind: 'unknown'; failure: WeatherFailure; detail: string }
  | { kind: 'manual'; temperatureC: number };

type State = {
  weather: WeatherStatus;
  surface: Surface;
  /**
   * Dónde está el tutor.
   *
   * En la aplicación real sale del GPS. Aquí se elige, porque un prototipo que
   * dice «no estás en una zona pet-friendly» y no deja moverte no enseña la
   * regla: enseña una pared. Cambiarla vuelve a consultar el tiempo, que es
   * justo lo que hace visible que la consulta es de verdad.
   */
  location: { lat: number; lng: number };
};

const DEFAULT_LOCATION = { lat: 40.4098, lng: -3.6939 };

let state: State = {
  weather: { kind: 'idle' },
  surface: 'grass',
  location: DEFAULT_LOCATION,
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): State => state;

const set = (next: Partial<State>): void => {
  state = { ...state, ...next };
  emit();
};

const provider = withCache(createOpenMeteoProvider());

/** Evita que dos pantallas montadas a la vez pisen el estado la una a la otra. */
let generation = 0;

export async function refreshWeather(force = false): Promise<void> {
  if (force) provider.invalidate();

  /* Si ya hay un dato fresco en caché se pinta sin pasar por «cargando»: un
     parpadeo de carga para algo que ya se sabe se lee como que la app duda. */
  const cached = provider.peek(state.location);
  if (cached && !force) {
    apply(cached);
    return;
  }

  const mine = ++generation;
  set({ weather: { kind: 'loading' } });
  const result = await provider.read(state.location);
  if (mine !== generation) return;
  apply(result);
}

function apply(result: Awaited<ReturnType<typeof provider.read>>): void {
  if (result.status === 'ok') set({ weather: { kind: 'live', observation: result.observation } });
  else set({ weather: { kind: 'unknown', failure: result.failure, detail: result.detail } });
}

/** El tutor corrige. A partir de aquí el número es suyo y se dice que lo es. */
export function setTemperature(temperatureC: number): void {
  set({ weather: { kind: 'manual', temperatureC } });
}

/** Y vuelve a lo automático. */
export function useAutomaticWeather(): void {
  void refreshWeather(true);
}

export function setSurface(surface: Surface): void {
  if (surface === state.surface) return;
  set({ surface });
}

export function setLocation(location: { lat: number; lng: number }): void {
  if (location.lat === state.location.lat && location.lng === state.location.lng) return;
  set({ location });
  void refreshWeather();
}

/**
 * La temperatura que se usa para juzgar, o null si no se sabe.
 *
 * Devolver null en lugar de un número es lo que obliga a quien llama a decidir
 * qué hacer sin dato, en vez de recibir uno inventado y no enterarse.
 */
export function temperatureOf(weather: WeatherStatus): number | null {
  if (weather.kind === 'live') return weather.observation.temperatureC;
  if (weather.kind === 'manual') return weather.temperatureC;
  return null;
}

/** La radiación solo la trae la observación real; corregida a mano no la hay. */
const radiationOf = (weather: WeatherStatus): number | null =>
  weather.kind === 'live' ? weather.observation.solarRadiation : null;

export function useConditions(durationMinutes: number): Conditions | null {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const temperatureC = temperatureOf(current.weather);
  if (temperatureC === null) return null;
  return {
    temperatureC,
    surface: current.surface,
    durationMinutes,
    groundTemperatureC: estimateGroundC(
      temperatureC,
      radiationOf(current.weather),
      current.surface,
    ),
  };
}

export function useWeatherState(): State {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Para las pantallas que juzgan varias duraciones de una vez.
 *
 * El radar comprueba una hora, dos y cuatro por separado para ofrecer solo las
 * que convienen, y las quedadas juzgan los minutos que declara cada una. Con
 * `useConditions` harían falta tantas llamadas como duraciones, y una lista de
 * duraciones no se conoce hasta el render.
 *
 * Devuelve `null` —y no un constructor que devuelve algo por defecto— cuando no
 * se sabe el tiempo, para que el `if` esté en la pantalla y se vea.
 */
export function useConditionsBuilder(): ((durationMinutes: number) => Conditions) | null {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  const temperatureC = temperatureOf(current.weather);
  if (temperatureC === null) return null;
  const groundTemperatureC = estimateGroundC(
    temperatureC,
    radiationOf(current.weather),
    current.surface,
  );
  return (durationMinutes: number) => ({
    temperatureC,
    surface: current.surface,
    durationMinutes,
    groundTemperatureC,
  });
}

/**
 * Arranca la consulta una vez, desde la raíz de la aplicación.
 *
 * Va en un hook y no al importar el módulo porque un efecto de red en el
 * cuerpo de un módulo se dispara también al renderizar en servidor y en los
 * tests, donde no hay a quién preguntar ni quien escuche la respuesta.
 */
export function useWeatherBootstrap(): void {
  useEffect(() => {
    if (state.weather.kind === 'idle') void refreshWeather();
  }, []);
}

export const SURFACE_LABEL: Record<Surface, string> = {
  grass: 'Hierba',
  earth: 'Tierra',
  asphalt: 'Asfalto',
  indoor: 'Bajo techo',
  unknown: 'Sin saber',
};

export const WEATHER_FAILURE_MESSAGE = FAILURE_MESSAGE;

export const MANUAL_NOTE =
  'Has fijado la temperatura tú, así que mandas tú. Toca «Automático» para volver a lo que ' +
  'diga el servicio.';

export const UNKNOWN_NOTE =
  'Sin temperatura no juzgamos: preferimos decir que no lo sabemos a suponer que hace bueno. ' +
  'Puedes ponerla a mano y seguir.';
