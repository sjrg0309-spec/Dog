/**
 * Capa de datos.
 *
 * Una sola interfaz con dos implementaciones. Hoy corre la local, porque en el
 * entorno donde se construyó esto no hay un proyecto Supabase desplegado y
 * React Native no puede hablar con Postgres directamente. Cambiar de una a otra
 * es sustituir un módulo, no reescribir pantallas.
 *
 * Lo que **no** es local es el cálculo: la afinidad, la coincidencia de horarios
 * y el orden del descubrimiento salen de `@petnav/core`, el mismo código que
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
  distanceMeters,
  groupByRoutine,
  proposeMeetupPoints,
  type MeetupParticipant,
  type MeetupPlace,
  type RecurringMeetup,
  type WelfareVerdict,
} from '@petnav/core';

import {
  COMMUNITIES,
  MY_PETS,
  PLACES,
  OTHER_PETS,
  PLAYDATES,
  SERVICES,
  SPOTS,
  type DemoPet,
} from './demo-data';

import { walkPairHistory } from './walks';

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
  emptyReason: AppEmptyReason;
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
  welfare: WelfareVerdict | null;
  /**
   * Compañeros que hoy no aparecen porque a **ellos** no les conviene.
   *
   * Se cuentan aparte de todo lo demás porque no es un rechazo de este par: es
   * que el otro animal no está para encuentros hoy, y eso se explica distinto.
   */
  restingNearby: number;
};

/**
 * Los estados vacíos del algoritmo, más uno que es de la aplicación.
 *
 * `weather_unknown` no lo produce `packages/core` y no debería: el núcleo no
 * sabe que existe un proveedor meteorológico ni que puede caerse. Que no haya
 * dato del tiempo es una circunstancia de esta aplicación, y por eso el tipo se
 * ensancha aquí y no allí.
 */
export type AppEmptyReason = EmptyStateReason | 'weather_unknown';

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
export function discover(
  viewerPet: DemoPet,
  conditions: Conditions | null,
): DiscoveryResult {
  const sameSpecies = OTHER_PETS.filter((pet) => pet.speciesId === viewerPet.speciesId);
  const otherSpeciesNearby = OTHER_PETS.length - sameSpecies.length;

  /*
   * Sin tiempo no se propone nada.
   *
   * Es la misma postura que con un veto de bienestar, y por el mismo motivo:
   * una lista que sigue ahí se acaba usando. La diferencia es que este estado
   * se arregla en un toque —la pantalla enseña el control para poner la
   * temperatura a mano— así que no deja a nadie encerrado, solo obliga a que
   * alguien diga qué tiempo hace antes de que la aplicación opine.
   */
  if (conditions === null) {
    return {
      entries: [],
      emptyReason: 'weather_unknown',
      safetyVetoed: 0,
      otherSpeciesNearby,
      welfare: null,
      restingNearby: 0,
    };
  }

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

  /* El historial entra aquí, y es lo que hace que el 👎 del resumen de paseo
     no sea un adorno: `calculateAffinity` descuenta quince puntos con
     `hadNegativeFeedback`, suficiente para sacar a un perro de la banda en la
     que se propone. Sin esta línea la valoración se guardaría, se dibujaría y
     no cambiaría nada de lo que la aplicación propone mañana. */
  const history = walkPairHistory(viewerPet.id);

  const candidates: DiscoveryCandidate[] = sameSpecies.map((pet) => ({
    pet,
    availability: pet.availability,
    location: pet.location,
    history: history.get(pet.id),
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

/**
 * Puntos de encuentro para el animal activo.
 *
 * Cruza la rutina del tutor con la de sus vecinos y devuelve dónde y cuándo
 * quedar. La casa de cada uno entra aquí y no sale: lo que se devuelve lleva el
 * lugar, la hora y quiénes, más **la caminata del propio tutor**, que es el
 * único trayecto que se le puede enseñar a alguien sin contarle dónde vive otro.
 */
/**
 * Lo que se sabe de los demás en un punto de encuentro.
 *
 * Es deliberadamente estrecho. La primera versión devolvía el `DemoPet` entero
 * y con él se colaban dos cosas que el resto del proyecto se cuida de no
 * publicar: **la casa** de cada vecino y **su horario completo**. Ninguna de
 * las dos hace falta para pintar la tarjeta, y las dos juntas son la rutina
 * diaria de una persona y dónde vive.
 *
 * Lo encontró un test, no una revisión: el algoritmo del núcleo tenía su
 * comprobación de que no filtra coordenadas, y esta capa la había perdido al
 * envolverlo. Por eso la comprobación se repite aquí.
 */
export type MeetupCompanion = {
  id: string;
  name: string;
  ownerName: string;
  speciesId: string;
  breeds: string[];
};

export type MeetupSuggestion = RecurringMeetup & {
  placeName: string;
  /** Lo que le toca andar a quien mira la pantalla, y solo a él. */
  myWalkMeters: number;
  others: MeetupCompanion[];
};

export function meetupsFor(viewerPet: DemoPet): MeetupSuggestion[] {
  if (!petHasMeetups(viewerPet)) return [];

  const neighbours = [viewerPet, ...OTHER_PETS.filter((pet) => pet.speciesId === viewerPet.speciesId)];

  const participants: MeetupParticipant[] = neighbours.map((pet) => ({
    petId: pet.id,
    pet,
    home: pet.home,
    routine: pet.availability,
  }));

  const places: MeetupPlace[] = Object.values(PLACES).map((place) => ({
    id: place.id,
    name: place.name,
    point: { lat: place.lat, lng: place.lng },
  }));

  const byId = new Map(neighbours.map((pet) => [pet.id, pet]));
  const placeById = new Map(places.map((place) => [place.id, place]));

  return groupByRoutine(proposeMeetupPoints(participants, places, { limit: 20 }))
    /* Solo los planes en los que estás tú: la pantalla es «con quién puedes
       quedar», no un directorio de los grupos del barrio. Enseñar los ajenos
       sería además publicar la rutina de gente que no la ha compartido contigo. */
    .filter((meetup) => meetup.attendees.includes(viewerPet.id))
    .flatMap((meetup) => {
      const place = placeById.get(meetup.placeId);
      if (!place) return [];
      return [
        {
          ...meetup,
          placeName: place.name,
          myWalkMeters: Math.round(distanceMeters(viewerPet.home, place.point)),
          others: meetup.attendees
            .filter((petId) => petId !== viewerPet.id)
            .flatMap((petId): MeetupCompanion[] => {
              const pet = byId.get(petId);
              /* Campo a campo y no con un `delete`: así, el día que `DemoPet`
                 gane un dato sensible, no se cuela solo. */
              return pet
                ? [
                    {
                      id: pet.id,
                      name: pet.name,
                      ownerName: pet.ownerName,
                      speciesId: pet.speciesId,
                      breeds: pet.breeds,
                    },
                  ]
                : [];
            }),
        },
      ];
    });
}
