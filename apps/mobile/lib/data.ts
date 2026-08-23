/**
 * Capa de datos.
 *
 * Una sola interfaz con dos implementaciones. Hoy corre la local, porque en el
 * entorno donde se construyó esto no hay un proyecto Supabase desplegado y
 * React Native no puede hablar con Postgres directamente. Cambiar de una a otra
 * es sustituir un módulo, no reescribir pantallas.
 *
 * Lo que **no** es local es el cálculo: la afinidad, la coincidencia de horarios
 * y el orden del descubrimiento salen de `@coincide/core`, el mismo código que
 * verifican los tests del paquete y que la base de datos espeja en SQL —incluida
 * la regla de que un encuentro es siempre entre animales de la misma especie.
 */

import {
  assessWelfare,
  calculateAffinity,
  classifyResults,
  findSpecies,
  formatDistance,
  groupWelfare,
  hasMeetups,
  rankCandidates,
  type Conditions,
  type DiscoveryCandidate,
  type DiscoveryMatch,
  type EmptyStateReason,
  type SpeciesProfile,
  type WelfareVerdict,
} from '@coincide/core';

import {
  COMMUNITIES,
  MY_PETS,
  OTHER_PETS,
  PLAYDATES,
  SERVICES,
  SPOTS,
  type DemoPet,
} from './demo-data';

export type {
  DemoCommunity,
  DemoPet,
  DemoPlaydate,
  DemoService,
  DemoSpot,
} from './demo-data';

export type DiscoveryEntry = {
  pet: DemoPet;
  match: DiscoveryMatch;
  distanceLabel: string | null;
};

export type DiscoveryResult = {
  entries: DiscoveryEntry[];
  emptyReason: EmptyStateReason;
  /**
   * Descartados por un límite de seguridad —tamaño, o algo que declaró su
   * tutor—, para poder decirlo en vez de callarlo.
   *
   * No incluye a los de otra especie: eso no es un veto que el tutor pueda
   * entender como "casi encajaba", es que la aplicación no organiza encuentros
   * entre especies distintas. Mezclar los dos números haría creer que hay diez
   * candidatos rechazados cuando lo que hay son diez animales que nunca
   * estuvieron en la conversación.
   */
  safetyVetoed: number;
  /** Cuántos animales de otra especie hay cerca. Es contexto, no un rechazo. */
  otherSpeciesNearby: number;
  /**
   * Qué le conviene hoy al animal del tutor.
   *
   * Se devuelve siempre, también cuando el veredicto es "hoy no": es lo primero
   * que la pantalla tiene que decir, y decirlo requiere tenerlo aquí y no
   * deducirlo de que la lista esté vacía.
   */
  welfare: WelfareVerdict;
  /**
   * Compañeros que hoy no aparecen porque a **ellos** no les conviene.
   *
   * Se cuentan aparte de todo lo demás porque no es un rechazo de este par: es
   * que el otro animal no está para encuentros hoy, y eso se explica distinto.
   */
  restingNearby: number;
};

/** El perfil de especie de una mascota, o null si no está en el catálogo. */
export function speciesOf(pet: DemoPet): SpeciesProfile | null {
  return findSpecies(pet.speciesId);
}

/** ¿Esta mascota puede tener encuentros? Lo decide su especie, no su ficha. */
export function petHasMeetups(pet: DemoPet): boolean {
  const species = speciesOf(pet);
  return species !== null && hasMeetups(species);
}

/**
 * Descubrimiento por los tres ejes.
 *
 * Para una especie solitaria no devuelve una lista vacía con una disculpa:
 * devuelve `entries` vacío y la pantalla enseña otra cosa —comunidad y
 * servicios—, porque el problema de ese tutor es distinto.
 */
export function discover(viewerPet: DemoPet, conditions: Conditions): DiscoveryResult {
  const sameSpecies = OTHER_PETS.filter((pet) => pet.speciesId === viewerPet.speciesId);
  const otherSpeciesNearby = OTHER_PETS.length - sameSpecies.length;
  const welfare = assessWelfare(viewerPet, conditions);

  if (!petHasMeetups(viewerPet)) {
    return {
      entries: [],
      emptyReason: 'no_candidates',
      safetyVetoed: 0,
      otherSpeciesNearby,
      welfare,
      restingNearby: 0,
    };
  }

  const viewer = {
    pet: viewerPet,
    availability: viewerPet.availability,
    location: viewerPet.location,
  };

  const candidates: DiscoveryCandidate[] = sameSpecies.map((pet) => ({
    pet,
    availability: pet.availability,
    location: pet.location,
  }));

  const matches = rankCandidates(viewer, candidates, { radiusMeters: 5000, conditions });
  const byId = new Map(sameSpecies.map((pet) => [pet.id, pet]));

  const entries: DiscoveryEntry[] = matches.flatMap((match) => {
    const pet = byId.get(match.petId);
    if (!pet) return [];
    return [
      {
        pet,
        match,
        distanceLabel: match.distanceMeters === null ? null : formatDistance(match.distanceMeters),
      },
    ];
  });

  // Se cuenta con el algoritmo, no restando longitudes de listas: así el número
  // que ve el usuario es literalmente "a cuántos les salió veto de seguridad".
  const safetyVetoed = sameSpecies.filter(
    (pet) => calculateAffinity(viewerPet, pet).vetoKind === 'safety',
  ).length;

  // A quién le toca descansar hoy. Solo cuenta si la afinidad no lo habría
  // descartado igualmente: mezclar los dos motivos convertiría "hoy no le
  // conviene" en "no encajáis", que es otra cosa y se arregla de otra forma.
  const restingNearby = sameSpecies.filter(
    (pet) =>
      !calculateAffinity(viewerPet, pet).vetoed &&
      groupWelfare([viewerPet, pet], conditions).level === 'stop',
  ).length;

  return {
    entries,
    emptyReason: classifyResults(viewer, candidates, matches, conditions),
    safetyVetoed,
    otherSpeciesNearby,
    welfare,
    restingNearby,
  };
}

/**
 * Quién está fuera ahora mismo, de la misma especie.
 *
 * El filtro por especie no es cosmético: enseñarle a un tutor de conejo que hay
 * tres perros sueltos a doscientos metros no es una oportunidad, es un aviso de
 * por dónde no pasar.
 */
export function walkingNow(speciesId: string): DemoPet[] {
  return OTHER_PETS.filter(
    (pet) => pet.speciesId === speciesId && pet.walkingUntilMinutes !== null,
  );
}

export function playdatesFor(speciesId: string) {
  return PLAYDATES.filter((playdate) => playdate.speciesId === speciesId).sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}

/** Todas las quedadas, para poder decir cuántas hay de otras especies. */
export function allPlaydates() {
  return [...PLAYDATES].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function spotsFor(speciesId: string) {
  return SPOTS.filter((spot) => spot.speciesIds.includes(speciesId));
}

/**
 * Comunidades para una especie.
 *
 * Salen tanto las de la especie concreta como las generales del barrio: un tutor
 * de gecko quiere su grupo de reptiles, pero también el de su zona.
 */
export function communitiesFor(speciesId: string) {
  return COMMUNITIES.filter(
    (community) => community.speciesId === null || community.speciesId === speciesId,
  );
}

/**
 * Servicios para una especie.
 *
 * Uno sin especies declaradas aparece igualmente: es preferible que el tutor
 * llame y pregunte a que la aplicación le oculte el único veterinario del pueblo
 * por no haber rellenado un campo.
 */
export function servicesFor(speciesId: string) {
  return SERVICES.filter(
    (service) => service.speciesServed.length === 0 || service.speciesServed.includes(speciesId),
  ).sort((a, b) => Number(b.is24h) - Number(a.is24h) || Number(b.isVerified) - Number(a.isVerified));
}

export function petById(id: string): DemoPet | null {
  return [...MY_PETS, ...OTHER_PETS].find((pet) => pet.id === id) ?? null;
}
