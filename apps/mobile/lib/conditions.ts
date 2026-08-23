/**
 * Las condiciones del encuentro que se está planteando.
 *
 * `packages/core` juzga si a un animal le conviene salir, pero no consulta
 * nada: recibe temperatura, superficie y duración. Quien las obtiene es esta
 * capa, y hoy **no hay ninguna fuente meteorológica conectada**.
 *
 * No es una decisión de diseño, es un hecho del entorno: el proxy de salida
 * rechaza `api.open-meteo.com` con un 403, comprobado y no recordado. Así que
 * la temperatura la declara el tutor con un control visible, y la pantalla dice
 * de dónde sale el número en lugar de aparentar que lo sabe.
 *
 * Cuando haya proveedor, lo único que cambia es este módulo. Es el mismo patrón
 * que la capa de collares: una interfaz, y la implementación que hoy funciona de
 * verdad en lugar de una que finge.
 */

import { useSyncExternalStore } from 'react';

import type { Conditions, Surface } from '@coincide/core';

/** Una tarde de julio en Madrid: el caso que hace visible el problema. */
const DEFAULT_TEMPERATURE_C = 22;

type State = { temperatureC: number; surface: Surface };

let state: State = { temperatureC: DEFAULT_TEMPERATURE_C, surface: 'grass' };
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

export function setTemperature(temperatureC: number): void {
  if (temperatureC === state.temperatureC) return;
  state = { ...state, temperatureC };
  emit();
}

export function setSurface(surface: Surface): void {
  if (surface === state.surface) return;
  state = { ...state, surface };
  emit();
}

export function useConditions(durationMinutes: number): Conditions {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { ...current, durationMinutes };
}

export function useDeclaredConditions(): State {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const SURFACE_LABEL: Record<Surface, string> = {
  grass: 'Hierba',
  earth: 'Tierra',
  asphalt: 'Asfalto',
  indoor: 'Bajo techo',
  unknown: 'Sin saber',
};

export const CONDITIONS_SOURCE_NOTE =
  'La temperatura la pones tú: todavía no hay ningún proveedor meteorológico conectado, y ' +
  'preferimos decirlo a enseñar un número que nos hemos inventado.';
