/**
 * La ficha médica y el Modo Paseo.
 *
 * Dos cosas que van juntas y no deberían mezclarse:
 *
 *  - **La ficha es privada.** Vacunas, desparasitación, tratamientos. No la ve
 *    nadie más, ni siquiera quien queda contigo. Que un desconocido del parque
 *    pueda leer que tu perro toma medicación no aporta nada a nadie y sí quita
 *    algo.
 *  - **El Modo Paseo es público a propósito, y solo lo mínimo.** Genera un
 *    código que enseña **quién llamar** y **lo que hay que saber para
 *    manipularlo con seguridad**, no su historial. Es para el momento en que
 *    alguien encuentra a tu perro solo en la calle, y en ese momento el
 *    historial no sirve: sirve el teléfono.
 *
 * La línea entre las dos es la única decisión importante de este módulo. Lo que
 * cruza al código es: nombre, chip, teléfono de contacto, teléfono del
 * veterinario, y los avisos que afectan a quien lo tenga delante —«se asusta con
 * hombres», «no puede correr». Nada más.
 */

import { useSyncExternalStore } from 'react';

export type RecordKind = 'vaccine' | 'deworming' | 'treatment' | 'checkup';

export type MedicalEntry = {
  id: string;
  petId: string;
  kind: RecordKind;
  label: string;
  administeredAt: Date;
  /** Cuándo toca la siguiente. Null: no se repite. */
  dueAt: Date | null;
  vetName: string | null;
};

export const RECORD_LABEL: Record<RecordKind, string> = {
  vaccine: 'Vacuna',
  deworming: 'Desparasitación',
  treatment: 'Tratamiento',
  checkup: 'Revisión',
};

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);

const NINA = '20000000-0000-4000-8000-000000000001';
const KIRA = '20000000-0000-4000-8000-00000000000c';

let entries: MedicalEntry[] = [
  {
    id: 'med-1',
    petId: NINA,
    kind: 'vaccine',
    label: 'Rabia',
    administeredAt: daysFromNow(-320),
    dueAt: daysFromNow(45),
    vetName: 'Clínica Veterinaria Arganzuela',
  },
  {
    id: 'med-2',
    petId: NINA,
    kind: 'vaccine',
    label: 'Polivalente (moquillo, parvovirus, hepatitis)',
    administeredAt: daysFromNow(-300),
    dueAt: daysFromNow(65),
    vetName: 'Clínica Veterinaria Arganzuela',
  },
  {
    id: 'med-3',
    petId: NINA,
    kind: 'deworming',
    label: 'Interna, comprimido',
    administeredAt: daysFromNow(-95),
    // Vencida. Está a propósito: una ficha en la que todo está al día no enseña
    // qué hace la pantalla cuando algo falla, que es para lo que sirve.
    dueAt: daysFromNow(-5),
    vetName: null,
  },
  {
    id: 'med-4',
    petId: KIRA,
    kind: 'vaccine',
    label: 'Rabia',
    administeredAt: daysFromNow(-200),
    dueAt: daysFromNow(165),
    vetName: 'Clínica Veterinaria Arganzuela',
  },
  {
    id: 'med-5',
    petId: KIRA,
    kind: 'checkup',
    label: 'Revisión respiratoria (braquicéfalo)',
    administeredAt: daysFromNow(-60),
    dueAt: daysFromNow(120),
    vetName: 'Clínica Veterinaria Arganzuela',
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
const snapshot = () => entries;

export function useMedicalRecord(petId: string): MedicalEntry[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
    .filter((entry) => entry.petId === petId)
    .sort((a, b) => {
      // Lo vencido arriba. Es lo único de esta lista sobre lo que hay que hacer
      // algo hoy, y enterrarlo por orden de fecha lo escondería.
      const overdueA = isOverdue(a) ? 0 : 1;
      const overdueB = isOverdue(b) ? 0 : 1;
      if (overdueA !== overdueB) return overdueA - overdueB;
      return (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity);
    });
}

export function markDone(entryId: string, nextInDays: number): void {
  entries = entries.map((entry) =>
    entry.id === entryId
      ? { ...entry, administeredAt: new Date(), dueAt: daysFromNow(nextInDays) }
      : entry,
  );
  emit();
}

export function isOverdue(entry: MedicalEntry, now = new Date()): boolean {
  return entry.dueAt !== null && entry.dueAt.getTime() < now.getTime();
}

/** «vencida hace 5 días», «en 45 días». Sin fechas absolutas: nadie las calcula. */
export function dueLabel(entry: MedicalEntry, now = new Date()): string {
  if (!entry.dueAt) return 'No se repite';
  const days = Math.round((entry.dueAt.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return `Vencida hace ${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`;
  if (days === 0) return 'Toca hoy';
  if (days < 31) return `En ${days} ${days === 1 ? 'día' : 'días'}`;
  const months = Math.round(days / 30);
  return `En ${months} ${months === 1 ? 'mes' : 'meses'}`;
}

/**
 * El contenido del código del Modo Paseo.
 *
 * Es una URL a la página pública del animal, no un volcado de datos dentro del
 * propio código. Dos razones:
 *
 *  1. **Se puede revocar.** Un código con el teléfono grabado dentro sigue
 *     funcionando aunque cambies de número o el perro ya no sea tuyo. Una URL
 *     deja de servir en cuanto se apaga el modo.
 *  2. **Cabe.** Meter nombre, chip, dos teléfonos y los avisos dentro del código
 *     obliga a una versión de QR densa que un móvil viejo con la pantalla rayada
 *     no lee, y quien encuentra al perro escanea con lo que lleva encima.
 *
 * Quien lo escanea no necesita la aplicación instalada: es una página web.
 */
export type WalkModeCard = {
  url: string;
  petName: string;
  microchip: string | null;
  contactPhone: string;
  vetPhone: string;
  /** Lo que hay que saber para acercarse sin que salga mal. */
  handlingNotes: string[];
};

export function walkModeCard(pet: {
  id: string;
  name: string;
  ownerName: string;
  isMicrochipVerified?: boolean;
  healthFlags?: readonly string[];
}): WalkModeCard {
  const notes: string[] = [];
  const flags = pet.healthFlags ?? [];
  if (flags.includes('brachycephalic'))
    notes.push('Hocico chato: se ahoga con facilidad. No lo hagas correr ni lo tapes.');
  if (flags.includes('heat_sensitive'))
    notes.push('Mal con el calor. A la sombra y agua, no en un coche al sol.');
  if (flags.includes('joint_issues'))
    notes.push('Articulaciones delicadas. No lo cojas en brazos por el pecho.');
  if (flags.includes('recovering')) notes.push('En recuperación. Evita el esfuerzo.');
  if (notes.length === 0) notes.push('Sin avisos especiales. Trátalo con calma; estará asustado.');

  return {
    url: `https://coincide.app/p/${pet.id.slice(0, 8)}`,
    petName: pet.name,
    microchip: pet.isMicrochipVerified ? '941 000 011 122 233' : null,
    contactPhone: '+34 600 000 000',
    vetPhone: '+34 910 000 000',
    handlingNotes: notes,
  };
}

export const WALK_MODE_NOTE =
  'El Modo Paseo enseña a quien encuentre a tu perro cómo localizarte, no su historial. Las ' +
  'vacunas y los tratamientos se quedan en la ficha privada: que un desconocido del parque sepa ' +
  'qué medicación toma no le ayuda a devolvértelo.';
