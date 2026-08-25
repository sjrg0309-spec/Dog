/**
 * Las alertas de seguridad abiertas.
 *
 * Es un objeto distinto del radar social y con reglas opuestas, y conviene
 * tenerlas delante porque la tentación de unificarlos es constante:
 *
 * |  | Radar social | Alerta de seguridad |
 * |---|---|---|
 * | Dónde | Solo zonas pet-friendly | En cualquier sitio |
 * | Quién la ve | Compatibles a 2 km | Todo tutor dentro del radio |
 * | Caducidad | Máximo 4 h | Hasta que se resuelve |
 * | Precisión | Anclada al lugar | Punto exacto |
 *
 * El catálogo de escenarios, el radio y su crecimiento viven en
 * `@petnav/core`: son lógica pura y están cubiertos por tests. Aquí solo está
 * el estado —qué alertas hay abiertas y qué se ha visto— y la consulta de a
 * quién le importan.
 */

import { useSyncExternalStore } from 'react';

import {
  alertRadiusM,
  distanceMeters,
  findScenario,
  formatDistance,
  type SafetyScenario,
} from '@petnav/core';

export type Sighting = {
  id: string;
  at: Date;
  point: { lat: number; lng: number };
  note: string;
  /** Quién lo vio. Vacío cuando lo reporta alguien sin cuenta. */
  reporterName: string | null;
};

export type SafetyAlert = {
  id: string;
  scenarioId: string;
  /** Nulo en los peligros de zona: un cebo envenenado no es de nadie. */
  petName: string | null;
  petBreed: string | null;
  petPhoto: string | null;
  microchipCode: string | null;
  contactPhone: string | null;
  ownerName: string;
  /** Dónde se abrió. En una alerta de perro perdido es el último punto conocido. */
  point: { lat: number; lng: number };
  areaName: string;
  openedAt: Date;
  resolvedAt: Date | null;
  sightings: Sighting[];
  /**
   * Quién ha dicho que va a buscar.
   *
   * Vive en la alerta y no en quien la mira porque su valor está en verse desde
   * el otro lado: quien ha perdido a su perro a las tres de la mañana necesita
   * saber que hay tres personas mirando, y quien va de camino necesita saber
   * que no va solo. Un botón que solo cambia de color en tu teléfono no hace ni
   * una cosa ni la otra.
   *
   * Son identificadores, no nombres: en el aviso sale cuánta gente va, no
   * quiénes son. Salir a buscar un perro de noche no debería publicar dónde vas
   * a estar tú.
   */
  searchers: string[];
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

/**
 * Alertas de ejemplo.
 *
 * Las tres cubren los tres comportamientos distintos del radio, que es lo que
 * diferencia este catálogo de una lista de tipos: una que crece rápido, una que
 * no crece nada y una que ya se resolvió y por eso no avisa a nadie.
 */
let alerts: SafetyAlert[] = [
  {
    id: 'alert-fireworks',
    scenarioId: 'fireworks',
    petName: 'Lúa',
    petBreed: 'Podenco andaluz',
    petPhoto: null,
    microchipCode: '941000024681357',
    contactPhone: '+34 600 112 233',
    ownerName: 'Elena V.',
    point: { lat: 40.4132, lng: -3.6902 },
    areaName: 'Calle de Doctor Esquerdo',
    openedAt: minutesAgo(95),
    resolvedAt: null,
    sightings: [
      {
        id: 'sighting-1',
        at: minutesAgo(38),
        point: { lat: 40.4171, lng: -3.6858 },
        note: 'Cruzando hacia el Retiro por la acera, no se dejó acercar.',
        reporterName: 'Javier P.',
      },
    ],
    /* Dos vecinos ya de camino. La semilla lo trae para que el contador se vea
       haciendo lo suyo desde el primer momento: sin nadie, el número diría cero
       en las tres alertas y no se sabría si funciona o si no hay estado. */
    searchers: ['vecina-1', 'vecino-2'],
  },
  {
    id: 'alert-bait',
    scenarioId: 'poison_bait',
    petName: null,
    petBreed: null,
    petPhoto: null,
    microchipCode: null,
    contactPhone: null,
    ownerName: 'Carlos M.',
    point: { lat: 40.4089, lng: -3.6952 },
    areaName: 'Setos de la entrada sur del Parque Central',
    openedAt: minutesAgo(240),
    resolvedAt: null,
    /* Nadie. Un cebo no se busca: se evita. Que este esté a cero enseña que el
       contador cuenta y no adorna. */
    sightings: [],
    searchers: [],
  },
  {
    id: 'alert-found',
    scenarioId: 'found',
    petName: null,
    petBreed: 'Mestizo pequeño, marrón',
    petPhoto: null,
    microchipCode: null,
    contactPhone: '+34 600 998 877',
    ownerName: 'Sin cuenta',
    point: { lat: 40.4211, lng: -3.7038 },
    areaName: 'Café Con Perro',
    openedAt: minutesAgo(1400),
    resolvedAt: minutesAgo(1200),
    sightings: [],
    searchers: ['rescatista-1'],
  },
];

const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => alerts;

/**
 * Quién es esta cuenta para las alertas.
 *
 * Basta con una constante mientras no hay servidor: lo que importa es que
 * unirse a una búsqueda sea **una entrada más** en la misma lista que las
 * demás, y no un booleano aparte que luego habría que reconciliar.
 */
const ME = 'me';

/**
 * Los avisos guardados.
 *
 * Guardar no es una preferencia de visualización: una protectora guarda el
 * aviso del galgo del polígono porque va a volver a él mañana, cuando ya no
 * esté arriba del tablero y puede que ni siquiera siga abierto. Por eso los
 * guardados se listan **incluidos los resueltos** —saber cómo acabó es la mitad
 * del valor— y por eso viven fuera de la alerta: son de quien guarda.
 */
let saved: readonly string[] = [];
const savedSnapshot = (): readonly string[] => saved;

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

export function openAlert(input: {
  scenarioId: string;
  petName?: string | null;
  petBreed?: string | null;
  microchipCode?: string | null;
  contactPhone?: string | null;
  ownerName: string;
  point: { lat: number; lng: number };
  areaName: string;
}): SafetyAlert {
  const alert: SafetyAlert = {
    id: nextId('alert'),
    scenarioId: input.scenarioId,
    petName: input.petName ?? null,
    petBreed: input.petBreed ?? null,
    petPhoto: null,
    microchipCode: input.microchipCode ?? null,
    contactPhone: input.contactPhone ?? null,
    ownerName: input.ownerName,
    point: input.point,
    areaName: input.areaName,
    openedAt: new Date(),
    resolvedAt: null,
    sightings: [],
    searchers: [],
  };
  alerts = [alert, ...alerts];
  emit();
  return alert;
}

/**
 * Cerrar una alerta.
 *
 * No se borra. Un aviso que desaparece del historial deja a quien lo vio sin
 * saber cómo acabó, y en un barrio eso importa: la próxima vez no lo mira.
 */
export function resolveAlert(id: string): void {
  alerts = alerts.map((alert) =>
    alert.id === id && !alert.resolvedAt ? { ...alert, resolvedAt: new Date() } : alert,
  );
  emit();
}

/**
 * Reportar un avistamiento.
 *
 * Lleva coordenadas porque «lo he visto por el centro» no sirve para buscar, y
 * porque el punto del avistamiento es el que hay que usar a partir de entonces:
 * seguir midiendo desde donde se perdió manda a la gente al sitio equivocado.
 */
export function reportSighting(
  alertId: string,
  sighting: { point: { lat: number; lng: number }; note: string; reporterName: string | null },
): void {
  alerts = alerts.map((alert) =>
    alert.id === alertId
      ? {
          ...alert,
          sightings: [
            { id: nextId('sighting'), at: new Date(), ...sighting },
            ...alert.sightings,
          ],
        }
      : alert,
  );
  emit();
}

/**
 * Apuntarse a buscar, y borrarse.
 *
 * Se puede deshacer, y eso no es un detalle: un botón de «voy» que no se pueda
 * retirar hace que la cuenta de gente buscando solo suba, y una cuenta que solo
 * sube deja de significar nada a la tercera noche. Quien llega a casa y lo
 * apaga está diciendo algo verdadero sobre quién queda mirando.
 */
export function toggleSearch(alertId: string): void {
  alerts = alerts.map((alert) =>
    alert.id === alertId
      ? {
          ...alert,
          searchers: alert.searchers.includes(ME)
            ? alert.searchers.filter((id) => id !== ME)
            : [...alert.searchers, ME],
        }
      : alert,
  );
  emit();
}

/** ¿Voy yo a buscar a este? Lo consulta el botón para saber qué decir. */
export function useAmSearching(alertId: string): boolean {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  return all.find((alert) => alert.id === alertId)?.searchers.includes(ME) ?? false;
}

/** «3 buscando», «vas tú sola». Lo lee la tarjeta y también la ficha del SOS. */
export function describeSearchers(alert: SafetyAlert): string | null {
  const total = alert.searchers.length;
  const mine = alert.searchers.includes(ME);
  if (total === 0) return null;
  if (total === 1) return mine ? 'Vas tú' : '1 persona buscando';
  if (mine) return `Vas tú y ${total - 1} ${total - 1 === 1 ? 'persona más' : 'personas más'}`;
  return `${total} personas buscando`;
}

/* ------------------------------------------------------------------ */

const subscribeSaved = (listener: () => void): (() => void) => subscribe(listener);

/** Guardar o dejar de guardar un aviso. */
export function toggleSavedAlert(alertId: string): void {
  saved = saved.includes(alertId)
    ? saved.filter((id) => id !== alertId)
    : [alertId, ...saved];
  emit();
}

export function useIsSaved(alertId: string): boolean {
  const ids = useSyncExternalStore(subscribeSaved, savedSnapshot, savedSnapshot);
  return ids.includes(alertId);
}

export type LiveAlert = {
  alert: SafetyAlert;
  scenario: SafetyScenario;
  /** Horas abiertas, que es lo que decide el radio actual. */
  openForHours: number;
  /** El radio ahora mismo, ya crecido si el escenario crece. */
  radiusM: number;
  /** Desde dónde hay que buscar: el último avistamiento, o donde se abrió. */
  searchPoint: { lat: number; lng: number };
  distanceM: number;
  distanceLabel: string;
  /** ¿Le llega a quien está mirando? */
  reachesMe: boolean;
};

function hydrate(alert: SafetyAlert, from: { lat: number; lng: number }): LiveAlert | null {
  const scenario = findScenario(alert.scenarioId);
  if (!scenario) return null;

  const openForHours = (Date.now() - alert.openedAt.getTime()) / 3_600_000;
  const radiusM = alertRadiusM(scenario, openForHours);
  // El último avistamiento manda sobre el punto de origen. Un perro visto hace
  // media hora a dos kilómetros ya no está donde se perdió.
  const latest = alert.sightings[0];
  const searchPoint = latest ? latest.point : alert.point;
  const distanceM = distanceMeters(from, searchPoint);

  return {
    alert,
    scenario,
    openForHours,
    radiusM,
    searchPoint,
    distanceM,
    distanceLabel: formatDistance(distanceM),
    reachesMe: distanceM <= radiusM,
  };
}

/**
 * Las alertas abiertas que alcanzan a este punto, de la más cerca a la más
 * lejos.
 *
 * Lo resuelto no entra: una alerta cerrada no debe seguir llamando la atención
 * de nadie, aunque siga en el historial.
 */
export function useLiveAlerts(from: { lat: number; lng: number }): LiveAlert[] {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  return all
    .filter((alert) => !alert.resolvedAt)
    .map((alert) => hydrate(alert, from))
    .filter((live): live is LiveAlert => live !== null && live.reachesMe)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/** Todas, resueltas incluidas, para el historial de la zona. */
export function useAllAlerts(from: { lat: number; lng: number }): LiveAlert[] {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  return all
    .map((alert) => hydrate(alert, from))
    .filter((live): live is LiveAlert => live !== null)
    .sort((a, b) => b.alert.openedAt.getTime() - a.alert.openedAt.getTime());
}

/**
 * Los guardados, en el orden en que se guardaron.
 *
 * Incluye los resueltos a propósito: quien guardó el aviso de un galgo quiere
 * saber si apareció, y esa es justo la información que un filtro de «solo
 * abiertos» le escondería.
 */
export function useSavedAlerts(from: { lat: number; lng: number }): LiveAlert[] {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  const ids = useSyncExternalStore(subscribeSaved, savedSnapshot, savedSnapshot);
  return ids
    .map((id) => all.find((alert) => alert.id === id))
    .filter((alert): alert is SafetyAlert => alert !== undefined)
    .map((alert) => hydrate(alert, from))
    .filter((live): live is LiveAlert => live !== null);
}

/** Cuántas alertas críticas hay abiertas cerca. Es lo que pinta la pestaña. */
export function useCriticalCount(from: { lat: number; lng: number }): number {
  return useLiveAlerts(from).filter((live) => live.scenario.severity === 'critical').length;
}

/** «Abierta hace 1 h 35 min», que es lo que hace entender por qué el radio creció. */
export function formatOpenFor(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
