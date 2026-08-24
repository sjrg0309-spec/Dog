/**
 * Bloqueos y denuncias, del lado de la aplicación.
 *
 * Las reglas —qué es un bloqueo, cuántas personas hacen falta para que una
 * denuncia sea una señal— viven en `@petnav/core` con sus tests. Aquí está
 * dónde se guardan y, sobre todo, **el punto por el que pasa todo lo que
 * enseña gente**.
 *
 * Eso último es lo que hace que el bloqueo sea de verdad: no se filtra en cada
 * pantalla por su cuenta —eso son cinco sitios donde olvidarse— sino que el
 * feed, el radar, el mapa y el descubrimiento llaman al mismo sitio.
 */

import { useSyncExternalStore } from 'react';

import {
  reportSignal,
  visibleTo,
  type Block,
  type Report,
  type ReportReason,
} from '@petnav/core';

import { petById } from './data';

/** Quién eres tú aquí. Con servidor sería el identificador de la sesión. */
const ME = 'me';

let blocks: Block[] = [];
let reports: Report[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): Block[] => blocks;

export function useBlocks(): Block[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * Bloquear al tutor de una mascota.
 *
 * Se bloquea a **la persona** y no al animal: alguien con dos perros seguiría
 * apareciendo con el otro, y eso no es un bloqueo, es un despiste.
 */
export function blockOwnerOf(petId: string): void {
  const owner = petById(petId)?.ownerId;
  if (!owner || blocks.some((block) => block.byId === ME && block.targetId === owner)) return;
  blocks = [...blocks, { byId: ME, targetId: owner, blockedAt: new Date().toISOString() }];
  emit();
}

export function unblock(ownerId: string): void {
  blocks = blocks.filter((block) => !(block.byId === ME && block.targetId === ownerId));
  emit();
}

export function reportOwnerOf(petId: string, reason: ReportReason): void {
  const owner = petById(petId)?.ownerId;
  if (!owner) return;
  reports = [
    ...reports,
    {
      id: `report-${reports.length}`,
      targetId: owner,
      reporterId: ME,
      reason,
      reportedAt: new Date().toISOString(),
    },
  ];
  emit();
}

/** Cuánta señal hay contra alguien. Lo usa la pantalla de una cuenta denunciada. */
export function signalAgainst(ownerId: string) {
  return reportSignal(ownerId, reports);
}

/**
 * El filtro por el que pasa todo lo que enseña gente.
 *
 * Es una sola función a propósito. Filtrar en cada pantalla son cinco sitios
 * donde olvidarse, y el que se olvide es el que te propone quedar el martes con
 * la persona que bloqueaste.
 */
export function useVisiblePets<T extends { id: string }>(pets: readonly T[]): T[] {
  const current = useBlocks();
  return pets.filter((pet) => {
    const owner = petById(pet.id)?.ownerId;
    return owner === undefined || visibleTo(ME, owner, current);
  });
}

/** Lo mismo para cualquier cosa que sepa de qué mascota es. */
export function useVisibleBy<T>(items: readonly T[], petIdOf: (item: T) => string): T[] {
  const current = useBlocks();
  return items.filter((item) => {
    const owner = petById(petIdOf(item))?.ownerId;
    return owner === undefined || visibleTo(ME, owner, current);
  });
}

export function useIsBlocked(petId: string): boolean {
  const current = useBlocks();
  const owner = petById(petId)?.ownerId;
  return owner !== undefined && !visibleTo(ME, owner, current);
}
