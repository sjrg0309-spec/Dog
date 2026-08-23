/**
 * Avisos de rescate y zonas marcadas, del lado de la aplicación.
 *
 * La lógica —qué marca un sitio, cuánto dura, quién recibe qué— vive en
 * `@coincide/core` sin red ni almacenamiento. Aquí está dónde se guardan y una
 * semilla que enseña la regla **funcionando y también no disparándose**, que es
 * la mitad que suele faltar.
 */

import { useSyncExternalStore } from 'react';

import { hazardZones, type HazardZone, type RescueReport } from '@coincide/core';

import { PLACES } from './demo-data';

const daysAgo = (days: number): string => {
  const at = new Date();
  at.setDate(at.getDate() - days);
  return at.toISOString();
};

/**
 * La semilla, con las dos caras de la regla.
 *
 * **Parque Central sí se marca**: cuatro avisos de cebos de tres personas
 * distintas en las últimas tres semanas. Es el caso que este módulo existe para
 * contar — envenenar un parque no es un suceso, es alguien que vuelve.
 *
 * **Parque del Retiro no**, y está aquí a propósito: tiene cinco avisos, más
 * que Central, pero **todos de la misma persona**. Sin ese contraste la semilla
 * enseñaría que la función marca sitios y no enseñaría lo único que impide que
 * sea un arma. Alguien que quiera ver la regla en acción solo tiene que
 * comparar los dos.
 */
function seed(): RescueReport[] {
  const central: RescueReport[] = [
    { id: 'r1', scenarioId: 'poisoning_seen', placeId: PLACES.central.id, reporterId: 'vecina-1', reportedAt: daysAgo(3) },
    { id: 'r2', scenarioId: 'poisoning_seen', placeId: PLACES.central.id, reporterId: 'vecina-2', reportedAt: daysAgo(9) },
    { id: 'r3', scenarioId: 'poisoning_seen', placeId: PLACES.central.id, reporterId: 'vecina-1', reportedAt: daysAgo(14) },
    { id: 'r4', scenarioId: 'poisoning_seen', placeId: PLACES.central.id, reporterId: 'rescatista-1', reportedAt: daysAgo(20) },
  ];

  const retiro: RescueReport[] = [2, 5, 8, 11, 15].map((day, index) => ({
    id: `s${index}`,
    scenarioId: 'poisoning_seen',
    placeId: PLACES.retiro.id,
    reporterId: 'una-sola-persona',
    reportedAt: daysAgo(day),
  }));

  return [...central, ...retiro];
}

let reports: RescueReport[] = seed();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): RescueReport[] => reports;

/**
 * Los sitios marcados ahora mismo.
 *
 * Se recalcula al leer y no se guarda: una zona depende de la fecha, así que
 * guardarla sería guardar una respuesta que caduca. Al salirse los avisos de la
 * ventana, la marca desaparece sola sin que nadie tenga que borrar nada — igual
 * que caduca un check-in.
 */
export function useHazardZones(): HazardZone[] {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot);
  return hazardZones(all);
}

/** La zona de un sitio concreto, si la hay. */
export function useZoneAt(placeId: string): HazardZone | null {
  return useHazardZones().find((zone) => zone.placeId === placeId) ?? null;
}

export function reportRescue(report: Omit<RescueReport, 'id'>): void {
  reports = [...reports, { ...report, id: `rescue-${reports.length}-${Date.parse(report.reportedAt)}` }];
  for (const listener of listeners) listener();
}
