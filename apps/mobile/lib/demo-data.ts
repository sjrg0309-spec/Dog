/**
 * Datos de demostración de la aplicación móvil.
 *
 * IMPORTANTE, para que nadie se confunda leyendo esto: **son los mismos perros
 * que la semilla de la base de datos**, no un conjunto inventado aparte. El
 * algoritmo que se ejecuta sobre ellos es el real, importado de
 * `@doggymeet/core`; lo único que falta es el transporte.
 *
 * La razón es concreta: React Native no puede hablar con Postgres directamente,
 * y en el entorno donde se construyó esto no hay un proyecto Supabase
 * desplegado. En vez de dejar la aplicación sin datos, o de fingir una conexión
 * que no existe, la capa de datos está detrás de una interfaz —ver `data.ts`—
 * con dos implementaciones: esta y la de Supabase, que es un solo módulo.
 */

import type { Availability, MatchableDog } from '@doggymeet/core';

export type DemoDog = MatchableDog & {
  name: string;
  ownerName: string;
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

/** El perro del usuario. En la aplicación real sale de su propia ficha. */
export const MY_DOG: DemoDog = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Nina',
  ownerName: 'Marta R.',
  breeds: ['Border Collie'],
  bio: 'Le obsesiona la pelota. No para.',
  size: 'medium',
  energyLevel: 'sprinter',
  playStyles: ['chase', 'toys'],
  trustCircle: ['loves_everyone'],
  sex: 'female',
  ageMonths: 64,
  isMicrochipVerified: true,
  availability: weekdayMorning(PLACES.central.id),
  location: { lat: 40.4098, lng: -3.6939 },
  walkingUntilMinutes: null,
  placeName: null,
};

export const OTHER_DOGS: DemoDog[] = [
  {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Toby',
    ownerName: 'Carlos M.',
    breeds: ['Mestizo'],
    bio: 'Corre con quien haga falta.',
    size: 'medium',
    energyLevel: 'sprinter',
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
    breeds: ['Galgo español'],
    bio: 'Tímido al principio, luego no hay quien lo pare.',
    size: 'large',
    energyLevel: 'explorer',
    playStyles: ['chase', 'calm_walk'],
    trustCircle: ['shy_at_first'],
    sex: 'male',
    ageMonths: 90,
    isMicrochipVerified: false,
    availability: weekdayMorning(PLACES.central.id),
    location: { lat: 40.4089, lng: -3.6952 },
    walkingUntilMinutes: null,
    placeName: null,
  },
  {
    id: '20000000-0000-4000-8000-000000000005',
    name: 'Simba',
    ownerName: 'Inés L.',
    breeds: ['Golden Retriever'],
    bio: 'Paseos tranquilos y largos. Nada de cachorros saltando encima.',
    size: 'large',
    energyLevel: 'couch',
    playStyles: ['calm_walk', 'toys'],
    trustCircle: ['loves_everyone', 'no_hyper_puppies'],
    sex: 'male',
    ageMonths: 93,
    isMicrochipVerified: true,
    availability: [0, 6].map((weekday) => ({
      weekday,
      startTime: '10:00',
      endTime: '12:00',
      placeId: PLACES.retiro.id,
    })),
    location: { lat: 40.4153, lng: -3.6844 },
    walkingUntilMinutes: null,
    placeName: null,
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    name: 'Kira',
    ownerName: 'Lucía P.',
    breeds: ['Bulldog francés'],
    bio: 'Se cansa enseguida. Le va el paseo corto y la sombra.',
    size: 'small',
    energyLevel: 'couch',
    playStyles: ['toys', 'calm_walk'],
    trustCircle: ['shy_at_first'],
    sex: 'female',
    ageMonths: 43,
    isMicrochipVerified: false,
    availability: [2, 4, 6].map((weekday) => ({
      weekday,
      startTime: '23:20',
      endTime: '00:10',
      placeId: PLACES.berlin.id,
    })),
    location: { lat: 40.4562, lng: -3.6764 },
    walkingUntilMinutes: 40,
    placeName: PLACES.berlin.name,
  },
  {
    id: '20000000-0000-4000-8000-000000000007',
    name: 'Bruno',
    ownerName: 'Pablo G.',
    breeds: ['Pastor alemán'],
    bio: 'Cachorro en plena socialización. Mucha energía.',
    size: 'large',
    energyLevel: 'sprinter',
    playStyles: ['wrestle', 'chase'],
    trustCircle: ['loves_everyone'],
    sex: 'male',
    ageMonths: 8,
    isMicrochipVerified: false,
    availability: [0, 6].map((weekday) => ({
      weekday,
      startTime: '10:00',
      endTime: '12:00',
      placeId: PLACES.retiro.id,
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
  placeName: string;
  startsAt: Date;
  endsAt: Date;
  admitsSizes: string[];
  admitsEnergy: string[];
  leashed: boolean;
  attendeeIds: string[];
  maxDogs: number;
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
    placeName: PLACES.central.name,
    startsAt: upcoming(1, 7),
    endsAt: upcoming(1, 7, 45),
    admitsSizes: ['medium', 'large'],
    admitsEnergy: ['explorer', 'sprinter'],
    leashed: false,
    attendeeIds: [MY_DOG.id, '20000000-0000-4000-8000-000000000002'],
    maxDogs: 8,
  },
  {
    id: '50000000-0000-4000-8000-000000000003',
    title: 'Caminata nocturna por Parque Berlín',
    description: 'Para quienes paseamos cuando ya no hay nadie. Perros pequeños.',
    placeName: PLACES.berlin.name,
    startsAt: upcoming(2, 22, 30),
    endsAt: upcoming(3, 0),
    admitsSizes: ['mini', 'small'],
    admitsEnergy: ['couch', 'explorer'],
    leashed: false,
    attendeeIds: ['20000000-0000-4000-8000-000000000006'],
    maxDogs: 6,
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    title: 'Quedada de perros gigantes en el Retiro',
    description: 'Solo perros grandes y gigantes. Paseo tranquilo y sombra.',
    placeName: PLACES.retiro.name,
    startsAt: upcoming(3, 11),
    endsAt: upcoming(3, 13),
    admitsSizes: ['large', 'giant'],
    admitsEnergy: ['couch', 'explorer'],
    leashed: true,
    attendeeIds: ['20000000-0000-4000-8000-000000000007'],
    maxDogs: 12,
  },
];

export type DemoSpot = {
  id: string;
  title: string;
  description: string;
  maxDogs: number;
  pricePerSlotCents: number;
  slotMinutes: number;
  isFenced: boolean;
  zone: string;
};

export const SPOTS: DemoSpot[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    title: 'Patio cercado en Chamberí',
    description: 'Patio privado de 200 m² con valla de dos metros. Un grupo cada vez.',
    maxDogs: 6,
    pricePerSlotCents: 4000,
    slotMinutes: 120,
    isFenced: true,
    zone: 'Chamberí',
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    title: 'Finca vallada en Las Rozas',
    description: 'Media hectárea vallada, ideal para perros que no pueden ir sueltos al parque.',
    maxDogs: 10,
    pricePerSlotCents: 6000,
    slotMinutes: 90,
    isFenced: true,
    zone: 'Las Rozas',
  },
];
