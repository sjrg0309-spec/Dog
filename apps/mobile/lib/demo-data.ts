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
 * El catálogo cubre los tres modelos sociales a propósito: perros que quedan en
 * grupo, hurones y conejos que se presentan de dos en dos, y un gato, un gecko y
 * un betta que no conocen a nadie. Si la demo solo tuviera perros, sería muy
 * fácil construir pantallas que solo funcionan para perros.
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
 * Son dos y de modelos sociales opuestos a propósito: Marta tiene una perra que
 * queda en el parque y una gata que no va a conocer a nadie nunca. Es el caso
 * que obliga a que la aplicación tenga algo que ofrecer en los dos escenarios,
 * en vez de asumir que toda mascota sale a socializar.
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
    id: '20000000-0000-4000-8000-000000000009',
    name: 'Misi',
    ownerName: 'Marta R.',
    ownerId: '10000000-0000-4000-8000-000000000001',
    speciesId: 'cat',
    breeds: ['Común europeo'],
    bio: 'Territorial y feliz de serlo. No quiere conocer a nadie.',
    size: 'medium',
    energyLevel: 'low',
    playStyles: ['chase', 'toys'],
    trustCircle: ['shy_at_first'],
    sex: 'female',
    ageMonths: 86,
    isMicrochipVerified: true,
    availability: [],
    location: { lat: 40.4098, lng: -3.6939 },
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

  // --- Hurones y conejos: grupo pequeño, terreno neutral, supervisado ------
  {
    id: '20000000-0000-4000-8000-000000000005',
    name: 'Lola',
    ownerName: 'Inés L.',
    ownerId: '10000000-0000-4000-8000-000000000005',
    speciesId: 'ferret',
    breeds: ['Hurón estándar'],
    bio: 'No hay tubo por el que no se meta.',
    size: 'small',
    energyLevel: 'high',
    playStyles: ['chase', 'wrestle', 'forage'],
    trustCircle: ['loves_everyone'],
    sex: 'female',
    ageMonths: 39,
    isMicrochipVerified: true,
    availability: weekendAfternoon(),
    location: { lat: 40.4405, lng: -3.7012 },
    walkingUntilMinutes: null,
    placeName: null,
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    name: 'Pipo',
    ownerName: 'Inés L.',
    ownerId: '10000000-0000-4000-8000-000000000005',
    speciesId: 'ferret',
    breeds: ['Hurón angora'],
    bio: 'Duerme dieciocho horas y las seis restantes las aprovecha.',
    size: 'small',
    energyLevel: 'medium',
    playStyles: ['chase', 'forage', 'toys'],
    trustCircle: ['shy_at_first'],
    sex: 'male',
    ageMonths: 48,
    isMicrochipVerified: true,
    availability: weekendAfternoon(),
    location: { lat: 40.4405, lng: -3.7012 },
    walkingUntilMinutes: null,
    placeName: null,
  },
  {
    id: '20000000-0000-4000-8000-000000000007',
    name: 'Trufa',
    ownerName: 'Álvaro T.',
    ownerId: '10000000-0000-4000-8000-000000000006',
    speciesId: 'rabbit',
    breeds: ['Belier'],
    bio: 'Se acicala con quien la deje. Muy sociable para ser conejo.',
    size: 'medium',
    energyLevel: 'medium',
    playStyles: ['grooming', 'side_by_side', 'forage'],
    trustCircle: ['loves_everyone'],
    sex: 'female',
    ageMonths: 41,
    isMicrochipVerified: false,
    availability: weekendAfternoon(),
    location: { lat: 40.4405, lng: -3.7012 },
    walkingUntilMinutes: null,
    placeName: null,
  },
  {
    id: '20000000-0000-4000-8000-000000000008',
    name: 'Canela',
    ownerName: 'Álvaro T.',
    ownerId: '10000000-0000-4000-8000-000000000006',
    speciesId: 'rabbit',
    breeds: ['Enano holandés'],
    bio: 'Necesita su tiempo. Las presentaciones con ella van despacio.',
    size: 'small',
    energyLevel: 'low',
    playStyles: ['side_by_side', 'forage'],
    trustCircle: ['shy_at_first'],
    sex: 'female',
    ageMonths: 19,
    isMicrochipVerified: false,
    availability: weekendAfternoon(),
    location: { lat: 40.4405, lng: -3.7012 },
    walkingUntilMinutes: null,
    placeName: null,
  },

  // --- Solitarias: existen en la aplicación, pero no en el descubrimiento ---
  // Están aquí a propósito. El algoritmo las veta por especie, no por falta de
  // datos, y eso es exactamente lo que la interfaz tiene que saber explicar.
  {
    id: '20000000-0000-4000-8000-000000000010',
    name: 'Kiwi',
    ownerName: 'Sara V.',
    ownerId: '10000000-0000-4000-8000-000000000007',
    speciesId: 'leopard_gecko',
    breeds: [],
    bio: 'Come grillos los martes y jueves. Nada más que contar, y está bien así.',
    size: 'mini',
    energyLevel: 'low',
    playStyles: [],
    trustCircle: [],
    sex: 'male',
    ageMonths: 45,
    isMicrochipVerified: false,
    availability: [],
    location: { lat: 40.4211, lng: -3.7098 },
    walkingUntilMinutes: null,
    placeName: null,
  },
  {
    id: '20000000-0000-4000-8000-000000000011',
    name: 'Azul',
    ownerName: 'Lucía P.',
    ownerId: '10000000-0000-4000-8000-000000000008',
    speciesId: 'betta',
    breeds: [],
    bio: 'Vive solo por definición de su especie.',
    size: 'mini',
    energyLevel: 'low',
    playStyles: [],
    trustCircle: [],
    sex: 'male',
    ageMonths: 18,
    isMicrochipVerified: false,
    availability: [],
    location: { lat: 40.437, lng: -3.7038 },
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
    id: '50000000-0000-4000-8000-000000000002',
    title: 'Tarde de hurones en sala neutral',
    description:
      'Cuatro como mucho, sesiones de veinte minutos con descanso. Traed transportín y el moquillo al día.',
    speciesId: 'ferret',
    placeName: 'Sala neutral para presentaciones',
    startsAt: upcoming(2, 17),
    endsAt: upcoming(2, 19),
    admitsSizes: ['mini', 'small'],
    admitsEnergy: ['medium', 'high'],
    leashed: false,
    attendeeIds: ['20000000-0000-4000-8000-000000000006'],
    maxPets: 4,
  },
  {
    id: '50000000-0000-4000-8000-000000000003',
    title: 'Presentación de conejos, terreno neutral',
    description:
      'Espacio sin olores previos y supervisión constante. Si no se caen bien, se para y ya está: forzarlo acaba en peleas de verdad.',
    speciesId: 'rabbit',
    placeName: 'Sala neutral para presentaciones',
    startsAt: upcoming(4, 18),
    endsAt: upcoming(4, 19),
    admitsSizes: ['small', 'medium'],
    admitsEnergy: ['low', 'medium'],
    leashed: false,
    attendeeIds: ['20000000-0000-4000-8000-000000000008'],
    maxPets: 3,
  },
  {
    id: '50000000-0000-4000-8000-000000000004',
    title: 'Caminata nocturna por Parque Berlín',
    description: 'Para quienes paseamos cuando ya no hay nadie.',
    speciesId: 'dog',
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
    title: 'Sala neutral para presentaciones',
    description:
      'Sala interior de 20 m² sin olores previos, pensada para presentar conejos y hurones. Suelo lavable y separadores.',
    maxPets: 4,
    pricePerSlotCents: 1500,
    slotMinutes: 60,
    isFenced: true,
    zone: 'Chamberí',
    speciesIds: ['ferret', 'rabbit', 'guinea_pig'],
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
    id: '70000000-0000-4000-8000-000000000001',
    name: 'Reptiles de Madrid',
    description:
      'Dudas de temperatura, muda, alimentación y qué veterinario está de guardia el domingo.',
    speciesId: 'leopard_gecko',
    memberCount: 2,
  },
  {
    id: '70000000-0000-4000-8000-000000000002',
    name: 'Gatos de Chamberí',
    description:
      'Vecinos con gato: veterinarios felinos, cuidadores para las vacaciones y colonias de la zona.',
    speciesId: 'cat',
    memberCount: 1,
  },
  {
    id: '70000000-0000-4000-8000-000000000003',
    name: 'Conejos en Madrid',
    description: 'Presentaciones, dietas y las dos vacunas que de verdad hacen falta.',
    speciesId: 'rabbit',
    memberCount: 1,
  },
  {
    id: '70000000-0000-4000-8000-000000000004',
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
    id: '80000000-0000-4000-8000-000000000001',
    name: 'Urgencias Veterinarias 24h Madrid',
    kind: 'emergency_vet',
    is24h: true,
    isVerified: true,
    speciesServed: ['dog', 'cat', 'ferret', 'rabbit'],
    distanceLabel: '1,8 km',
  },
  {
    id: '80000000-0000-4000-8000-000000000002',
    name: 'Clínica de Exóticos Vetlab',
    kind: 'exotic_vet',
    is24h: false,
    isVerified: true,
    speciesServed: [
      'ferret',
      'rabbit',
      'guinea_pig',
      'leopard_gecko',
      'bearded_dragon',
      'budgerigar',
      'greek_tortoise',
    ],
    distanceLabel: '2,4 km',
  },
  {
    id: '80000000-0000-4000-8000-000000000003',
    name: 'Centro Felino Chamberí',
    kind: 'vet',
    is24h: false,
    isVerified: true,
    speciesServed: ['cat'],
    distanceLabel: '3,1 km',
  },
  {
    id: '80000000-0000-4000-8000-000000000004',
    name: 'Peluquería Canina El Nudo',
    kind: 'groomer',
    is24h: false,
    isVerified: false,
    speciesServed: ['dog'],
    distanceLabel: '900 m',
  },
];
