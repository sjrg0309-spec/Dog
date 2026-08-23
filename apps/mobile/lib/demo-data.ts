/**
 * Datos de demostración de la aplicación móvil.
 *
 * IMPORTANTE, para que nadie se confunda leyendo esto: **son las mismas
 * mascotas que la semilla de la base de datos**, no un conjunto inventado
 * aparte. El algoritmo que se ejecuta sobre ellas es el real, importado de
 * `@coincide/core`; lo único que falta es el transporte.
 *
 * La razón es concreta: React Native no puede hablar con Postgres directamente,
 * y en el entorno donde se construyó esto no hay un proyecto Supabase
 * desplegado. En vez de dejar la aplicación sin datos, o de fingir una conexión
 * que no existe, la capa de datos está detrás de una interfaz —ver `data.ts`—
 * con dos implementaciones: esta y la de Supabase, que es un solo módulo.
 *
 * Son todos perros, porque hoy la aplicación solo está abierta a perros. El
 * catálogo de especies sigue en la base con sus reglas —una quedada de gatos
 * sigue siendo imposible—, pero un tutor no puede registrar otra cosa, así que
 * la demo enseña lo que se va a ver de verdad.
 *
 * Lo que sí cubre a propósito son **dos animales de la misma especie a los que
 * hoy les conviene algo distinto**. Ese es el caso que hace visible la capa de
 * bienestar, y es mucho más frecuente que el de dos especies distintas.
 */

import type { Availability, MatchablePet } from '@coincide/core';

export type DemoPet = MatchablePet & {
  name: string;
  ownerName: string;
  ownerId: string;
  breeds: string[];
  bio: string;
  isMicrochipVerified: boolean;
  availability: Availability[];
  location: { lat: number; lng: number };
  /** Presencia en vivo: minutos que le quedan de check-in, o null. */
  walkingUntilMinutes: number | null;
  placeName: string | null;
};

export const PLACES = {
  central: { id: '30000000-0000-4000-8000-000000000001', name: 'Parque Central' },
  retiro: { id: '30000000-0000-4000-8000-000000000002', name: 'Parque del Retiro' },
  berlin: { id: '30000000-0000-4000-8000-000000000004', name: 'Parque Berlín' },
} as const;

const weekdayMorning = (placeId: string): Availability[] =>
  [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startTime: '07:00',
    endTime: '07:45',
    placeId,
  }));

/** Tarde de fin de semana, en casa o en una sala: no todos los encuentros son en un parque. */
const weekendAfternoon = (): Availability[] =>
  [0, 6].map((weekday) => ({
    weekday,
    startTime: '17:00',
    endTime: '19:00',
    placeId: null,
  }));

/**
 * Las mascotas del tutor que usa la aplicación.
 *
 * Son dos perros del mismo tutor, y no uno, porque el caso interesante ya no es
 * «perro contra gato» sino **dos animales de la misma especie a los que hoy les
 * conviene algo distinto**: Nina aguanta un paseo largo a 26 grados y Kira, que
 * es de hocico chato, no debería salir. Eso es lo que hace visible que la
 * aplicación decide por el animal y no por el plan de su tutor.
 */
export const MY_PETS: DemoPet[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'Nina',
    ownerName: 'Marta R.',
    ownerId: '10000000-0000-4000-8000-000000000001',
    speciesId: 'dog',
    breeds: ['Border Collie'],
    bio: 'Le obsesiona la pelota. No para.',
    size: 'medium',
    energyLevel: 'high',
    playStyles: ['chase', 'toys'],
    trustCircle: ['loves_everyone'],
    sex: 'female',
    ageMonths: 64,
    isMicrochipVerified: true,
    availability: weekdayMorning(PLACES.central.id),
    location: { lat: 40.4098, lng: -3.6939 },
    walkingUntilMinutes: null,
    placeName: null,
  },
  {
    id: '20000000-0000-4000-8000-00000000000c',
    name: 'Kira',
    ownerName: 'Marta R.',
    ownerId: '10000000-0000-4000-8000-000000000001',
    speciesId: 'dog',
    breeds: ['Bulldog francés'],
    bio: 'Se cansa enseguida. Le va el paseo corto y la sombra.',
    // A 25 grados, un día corriente para Nina, a Kira no le conviene salir.
    healthFlags: ['brachycephalic', 'heat_sensitive'],
    size: 'small',
    energyLevel: 'low',
    playStyles: ['toys', 'calm_walk'],
    trustCircle: ['shy_at_first'],
    sex: 'female',
    ageMonths: 55,
    isMicrochipVerified: true,
    availability: weekdayMorning(PLACES.central.id),
    location: { lat: 40.4104, lng: -3.6944 },
    walkingUntilMinutes: null,
    placeName: null,
  },
];

export const OTHER_PETS: DemoPet[] = [
  // --- Perros: modelo de manada, encuentros abiertos en grupo ---------------
  {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Toby',
    ownerName: 'Carlos M.',
    ownerId: '10000000-0000-4000-8000-000000000002',
    speciesId: 'dog',
    breeds: ['Mestizo'],
    bio: 'Corre con quien haga falta.',
    size: 'medium',
    energyLevel: 'high',
    playStyles: ['chase', 'wrestle'],
    trustCircle: ['loves_everyone'],
    sex: 'male',
    ageMonths: 71,
    isMicrochipVerified: true,
    availability: weekdayMorning(PLACES.central.id),
    location: { lat: 40.4101, lng: -3.6935 },
    // Está paseando ahora: es lo que hace que el radar tenga algo que enseñar.
    walkingUntilMinutes: 75,
    placeName: PLACES.central.name,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    name: 'Rocky',
    ownerName: 'Diego S.',
    ownerId: '10000000-0000-4000-8000-000000000003',
    speciesId: 'dog',
    breeds: ['Galgo español'],
    bio: 'Tímido al principio, luego no hay quien lo pare.',
    // Un galgo mayor con las articulaciones tocadas: la app le propone ratos
    // más cortos que a Toby aunque los dos sean perros grandes y compatibles.
    healthFlags: ['joint_issues'],
    size: 'large',
    energyLevel: 'medium',
    playStyles: ['chase', 'calm_walk'],
    trustCircle: ['shy_at_first'],
    sex: 'male',
    ageMonths: 90,
    isMicrochipVerified: false,
    availability: [
      ...weekdayMorning(PLACES.central.id),
      // El paseo que empieza antes de medianoche y termina después: el caso que
      // obliga a que el solapamiento horario no se calcule restando horas.
      ...[2, 4, 6].map((weekday) => ({
        weekday,
        startTime: '23:00',
        endTime: '00:30',
        placeId: PLACES.berlin.id,
      })),
    ],
    location: { lat: 40.4089, lng: -3.6952 },
    walkingUntilMinutes: 40,
    placeName: PLACES.berlin.name,
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    name: 'Bruno',
    ownerName: 'Pablo G.',
    ownerId: '10000000-0000-4000-8000-000000000004',
    speciesId: 'dog',
    breeds: ['Pastor alemán'],
    bio: 'Cachorro en plena socialización. Mucha energía.',
    // Le falta pauta. En una especie de manada eso no es un aviso: es que un
    // parque abierto con desconocidos no es su sitio todavía.
    healthFlags: ['vaccination_pending'],
    size: 'large',
    energyLevel: 'high',
    playStyles: ['wrestle', 'chase'],
    trustCircle: ['loves_everyone'],
    sex: 'male',
    ageMonths: 8,
    isMicrochipVerified: false,
    availability: [2, 4, 6].map((weekday) => ({
      weekday,
      startTime: '23:20',
      endTime: '00:10',
      placeId: PLACES.berlin.id,
    })),
    location: { lat: 40.4148, lng: -3.6851 },
    walkingUntilMinutes: null,
    placeName: null,
  },

];

export type DemoPlaydate = {
  id: string;
  title: string;
  description: string;
  /** Una quedada es siempre de una sola especie. No es una restricción de la interfaz. */
  speciesId: string;
  /**
   * Minutos de contacto seguidos, que no son la duración del evento.
   *
   * Una tarde de hurones dura dos horas y son sesiones de veinte minutos con
   * descanso. Confundirlas obligaría a elegir entre prohibir la tarde o
   * permitir dos horas seguidas, y las dos respuestas son malas.
   */
  sessionMinutes: number;
  placeName: string;
  startsAt: Date;
  endsAt: Date;
  admitsSizes: string[];
  admitsEnergy: string[];
  leashed: boolean;
  attendeeIds: string[];
  maxPets: number;
};

/** Ancla una hora concreta de un día futuro, en la zona del dispositivo. */
function upcoming(daysAhead: number, hours: number, minutes = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export const PLAYDATES: DemoPlaydate[] = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    title: 'Paseo de la mañana en Parque Central',
    description: 'Salimos a las siete, como cada día. Ritmo alto: los nuestros corren.',
    speciesId: 'dog',
    sessionMinutes: 45,
    placeName: PLACES.central.name,
    startsAt: upcoming(1, 7),
    endsAt: upcoming(1, 7, 45),
    admitsSizes: ['medium', 'large'],
    admitsEnergy: ['medium', 'high'],
    leashed: false,
    attendeeIds: ['20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'],
    maxPets: 8,
  },
  {
    id: '50000000-0000-4000-8000-000000000005',
    title: 'Vuelta corta a la sombra',
    description:
      'Media hora sin prisa por la zona arbolada. Para los que se cansan pronto o llevan mal el calor.',
    speciesId: 'dog',
    sessionMinutes: 30,
    placeName: PLACES.retiro.name,
    startsAt: upcoming(1, 20),
    endsAt: upcoming(1, 20, 30),
    admitsSizes: ['mini', 'small', 'medium'],
    admitsEnergy: ['low', 'medium'],
    leashed: true,
    attendeeIds: ['20000000-0000-4000-8000-00000000000c'],
    maxPets: 5,
  },
  {
    id: '50000000-0000-4000-8000-000000000004',
    title: 'Caminata nocturna por Parque Berlín',
    description: 'Para quienes paseamos cuando ya no hay nadie.',
    speciesId: 'dog',
    sessionMinutes: 60,
    placeName: PLACES.berlin.name,
    startsAt: upcoming(2, 22, 30),
    endsAt: upcoming(3, 0),
    admitsSizes: ['medium', 'large'],
    admitsEnergy: ['medium', 'high'],
    leashed: false,
    attendeeIds: ['20000000-0000-4000-8000-000000000003'],
    maxPets: 6,
  },
];

export type DemoSpot = {
  id: string;
  title: string;
  description: string;
  maxPets: number;
  pricePerSlotCents: number;
  slotMinutes: number;
  isFenced: boolean;
  zone: string;
  /** Especies para las que este espacio tiene sentido. */
  speciesIds: string[];
};

export const SPOTS: DemoSpot[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    title: 'Patio cercado en Chamberí',
    description: 'Patio privado de 200 m² con valla de dos metros. Un grupo cada vez.',
    maxPets: 6,
    pricePerSlotCents: 4000,
    slotMinutes: 120,
    isFenced: true,
    zone: 'Chamberí',
    speciesIds: ['dog'],
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    title: 'Jardín con sombra en Las Rozas',
    description:
      'Media hectárea vallada con arbolado, para perros que no pueden ir sueltos al parque. Sombra de verdad a mediodía.',
    maxPets: 8,
    pricePerSlotCents: 6000,
    slotMinutes: 90,
    isFenced: true,
    zone: 'Las Rozas',
    speciesIds: ['dog'],
  },
];

// ---------------------------------------------------------------------------
// Comunidad y servicios
//
// Es lo que hace que un tutor de gato, de gecko o de betta tenga un motivo para
// volver a abrir la aplicación. Sin esto, media parte del catálogo de especies
// tendría una ficha bonita y ninguna funcionalidad detrás.
// ---------------------------------------------------------------------------

export type DemoCommunity = {
  id: string;
  name: string;
  description: string;
  /** Null significa "de todas las especies": el grupo del barrio, sin más. */
  speciesId: string | null;
  memberCount: number;
};

export const COMMUNITIES: DemoCommunity[] = [
  {
    id: '80000000-0000-4000-8000-000000000001',
    name: 'Perros de Chamberí',
    description:
      'Vecinos con perro: qué parque está abierto, quién cuida en agosto y qué veterinario coge el teléfono un domingo.',
    speciesId: 'dog',
    memberCount: 2,
  },
  {
    id: '80000000-0000-4000-8000-000000000002',
    name: 'Paseos nocturnos Madrid',
    description:
      'Para quienes salimos cuando ya no hay nadie. Rutas con luz, zonas que evitar y compañía a horas raras.',
    speciesId: 'dog',
    memberCount: 1,
  },
  {
    id: '80000000-0000-4000-8000-000000000003',
    name: 'Mascotas del barrio',
    description:
      'Cualquier especie: dónde comprar, quién cuida en agosto y qué hacer con un animal perdido.',
    speciesId: null,
    memberCount: 6,
  },
];

export type DemoService = {
  id: string;
  name: string;
  kind: string;
  is24h: boolean;
  isVerified: boolean;
  /** Vacío significa "sin declarar", no "ninguna". */
  speciesServed: string[];
  distanceLabel: string;
};

export const SERVICES: DemoService[] = [
  {
    id: '90000000-0000-4000-8000-000000000001',
    name: 'Urgencias Veterinarias 24h Madrid',
    kind: 'emergency_vet',
    is24h: true,
    isVerified: true,
    speciesServed: ['dog'],
    distanceLabel: '1,8 km',
  },
  {
    id: '90000000-0000-4000-8000-000000000002',
    name: 'Clínica Veterinaria Arganzuela',
    kind: 'vet',
    is24h: false,
    isVerified: true,
    speciesServed: ['dog'],
    distanceLabel: '2,4 km',
  },
  {
    id: '90000000-0000-4000-8000-000000000003',
    name: 'Guardería Canina El Retiro',
    kind: 'boarding',
    is24h: false,
    isVerified: true,
    speciesServed: ['dog'],
    distanceLabel: '3,1 km',
  },
  {
    id: '90000000-0000-4000-8000-000000000004',
    name: 'Peluquería Canina El Nudo',
    kind: 'groomer',
    is24h: false,
    isVerified: false,
    speciesServed: ['dog'],
    distanceLabel: '900 m',
  },
];

