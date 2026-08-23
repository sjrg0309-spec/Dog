/**
 * Reels: vídeo corto y vertical.
 *
 * Y una decisión de producto que hay que dejar escrita, porque el formato
 * empuja en contra de lo que esta aplicación defiende.
 *
 * El vídeo corto premia lo llamativo: el salto más alto, la carrera más larga,
 * el truco más difícil. En contenido con animales eso tiene una traducción
 * directa y conocida —perros corriendo a mediodía en agosto, saltos que
 * revientan articulaciones, «retos» que alguien copia sin saber lo que hace—.
 * Una aplicación que tiene una capa capaz de decir «hoy no salgas» y a la vez un
 * feed que reparte atención por hacer algo espectacular se está contradiciendo.
 *
 * Tres cosas que hace este módulo para no contradecirse, y ninguna es un aviso
 * legal escondido en los ajustes:
 *
 *  1. **El reel declara sus condiciones.** Temperatura y superficie del momento
 *     en que se grabó, igual que una quedada declara sus minutos de contacto. No
 *     es opcional y no lo pone el espectador: lo pone quien publica, con el
 *     mismo control que ya usa en el resto de la aplicación.
 *  2. **Lo grabado en condiciones que la propia app habría desaconsejado sale
 *     con su etiqueta.** No se oculta ni se borra —quien lo grabó no ha hecho
 *     nada ilegal— pero tampoco se enseña como si nada. La etiqueta es del
 *     contenido, no de la persona.
 *  3. **Denunciar tiene un motivo específico para esto**: «esto no es un reto».
 *     Un formulario que solo ofrece «spam» y «desnudos» no recoge el único daño
 *     que este formato puede hacer aquí.
 */

import { useSyncExternalStore } from 'react';

import { assessWelfare, type Conditions, type Surface } from '@coincide/core';

import { MY_PETS, OTHER_PETS } from './demo-data';

export type Reel = {
  id: string;
  petId: string;
  petName: string;
  authorName: string;
  /** URI local del vídeo. Nula en la semilla: no hay medios de archivo. */
  videoUri: string | null;
  /** Descripción de lo que se ve, obligatoria como en una publicación. */
  alt: string;
  caption: string;
  placeName: string | null;
  /** Segundos. Se enseña antes de entrar: nadie quiere descubrirlo dentro. */
  durationS: number;
  /** De dónde sale el sonido. «Sonido original» cuando es del propio vídeo. */
  soundName: string;
  createdAt: Date;
  /**
   * En qué condiciones se grabó. Es lo que permite etiquetarlo sin juzgar a
   * nadie: son datos, no una opinión.
   */
  recordedIn: { temperatureC: number; surface: Surface };
  reactions: number;
  reactedByMe: boolean;
  barkCount: number;
  barkedByMe: boolean;
  commentCount: number;
};

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

let reels: Reel[] = [
  {
    id: 'rl-1',
    petId: '20000000-0000-4000-8000-000000000002',
    petName: 'Toby',
    authorName: 'Carlos M.',
    videoUri: null,
    alt: 'Toby persiguiendo una pelota por la hierba y frenando en seco para cogerla',
    caption: 'Cuarenta metros a por una pelota y vuelta. No se cansa nunca.',
    placeName: 'Parque Central',
    durationS: 14,
    soundName: 'Sonido original · Toby',
    createdAt: hoursAgo(5),
    recordedIn: { temperatureC: 19, surface: 'grass' },
    reactions: 24,
    reactedByMe: false,
    barkCount: 3,
    barkedByMe: false,
    commentCount: 4,
  },
  {
    id: 'rl-2',
    petId: '20000000-0000-4000-8000-000000000003',
    petName: 'Rocky',
    authorName: 'Diego S.',
    videoUri: null,
    alt: 'Rocky trotando despacio por un paseo de tierra, de noche y con las farolas encendidas',
    caption: 'Los martes a las once. Ni gente ni calor ni prisa.',
    placeName: 'Parque Berlín',
    durationS: 9,
    soundName: 'Sonido original · Rocky',
    createdAt: hoursAgo(20),
    recordedIn: { temperatureC: 21, surface: 'earth' },
    reactions: 11,
    reactedByMe: true,
    barkCount: 1,
    barkedByMe: false,
    commentCount: 2,
  },
  {
    // El caso incómodo, y está en la semilla a propósito: sin él, la etiqueta de
    // condiciones es una función que nadie ha visto dispararse.
    id: 'rl-3',
    petId: '20000000-0000-4000-8000-000000000004',
    petName: 'Bruno',
    authorName: 'Pablo G.',
    videoUri: null,
    alt: 'Bruno corriendo por una acera al sol a mediodía, jadeando con la lengua fuera',
    caption: 'Mirad cómo corre el chaval 🔥',
    placeName: null,
    durationS: 11,
    soundName: 'Sonido original · Bruno',
    createdAt: hoursAgo(30),
    recordedIn: { temperatureC: 33, surface: 'asphalt' },
    reactions: 58,
    reactedByMe: false,
    barkCount: 9,
    barkedByMe: false,
    commentCount: 12,
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
const snapshot = () => reels;

const ALL_PETS = [...MY_PETS, ...OTHER_PETS];

/**
 * ¿La propia aplicación habría desaconsejado grabar esto?
 *
 * Usa exactamente el mismo juez que el resto —`assessWelfare` de
 * `@coincide/core`— sobre el animal que sale y las condiciones que declaró
 * quien lo publicó. No hay un segundo criterio para el contenido: sería la
 * forma más rápida de que los dos dejaran de coincidir.
 */
export type ReelWarning = { level: 'caution' | 'stop'; headline: string; detail: string } | null;

export function reelWarning(reel: Reel): ReelWarning {
  const pet = ALL_PETS.find((candidate) => candidate.id === reel.petId);
  if (!pet) return null;

  const conditions: Conditions = {
    temperatureC: reel.recordedIn.temperatureC,
    surface: reel.recordedIn.surface,
    durationMinutes: Math.max(5, Math.round(reel.durationS / 60)),
  };
  const verdict = assessWelfare(pet, conditions);
  if (verdict.level === 'ok') return null;

  return {
    level: verdict.level,
    headline:
      verdict.level === 'stop'
        ? 'Grabado en condiciones que esta aplicación desaconseja'
        : 'Grabado justo en el límite',
    // El motivo sale del propio veredicto, no de un texto escrito a mano: si
    // mañana cambia el umbral, cambia la etiqueta.
    detail:
      verdict.reasons[0]?.message ??
      'Las condiciones declaradas están fuera de lo recomendable.',
  };
}

/** Los reels sin hook, para los tests. La pantalla usa `useReels`. */
export function reelsSnapshot(): Reel[] {
  return snapshot();
}

export function useReels(): Reel[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function reactToReel(id: string): void {
  reels = reels.map((reel) =>
    reel.id === id
      ? {
          ...reel,
          reactedByMe: !reel.reactedByMe,
          reactions: reel.reactions + (reel.reactedByMe ? -1 : 1),
        }
      : reel,
  );
  emit();
}

export function barkReel(id: string): void {
  reels = reels.map((reel) =>
    reel.id === id && !reel.barkedByMe
      ? { ...reel, barkedByMe: true, barkCount: reel.barkCount + 1 }
      : reel,
  );
  emit();
}

export type NewReel = {
  petId: string;
  petName: string;
  authorName: string;
  videoUri: string;
  alt: string;
  caption: string;
  placeName: string | null;
  durationS: number;
  recordedIn: { temperatureC: number; surface: Surface };
};

export function publishReel(draft: NewReel): void {
  reels = [
    {
      id: `rl-local-${reels.length}`,
      ...draft,
      alt: draft.alt.trim(),
      caption: draft.caption.trim(),
      soundName: `Sonido original · ${draft.petName}`,
      createdAt: new Date(),
      reactions: 0,
      reactedByMe: false,
      barkCount: 0,
      barkedByMe: false,
      commentCount: 0,
    },
    ...reels,
  ];
  emit();
}

/**
 * Los motivos de denuncia.
 *
 * El primero no está en ningún formulario genérico y es el único que recoge el
 * daño que este formato puede hacer aquí.
 */
export const REPORT_REASONS = [
  'Esto no es un reto: pone al animal en riesgo',
  'Maltrato o negligencia',
  'No es del animal que dice ser',
  'Spam o venta',
] as const;

export const REELS_NOTE =
  'Un reel declara la temperatura y la superficie de cuando se grabó, igual que una quedada ' +
  'declara sus minutos de contacto. No se esconde lo que se grabó en malas condiciones: se ' +
  'etiqueta, porque quien lo publicó no ha hecho nada ilegal y quien lo copia sí necesita saberlo.';
