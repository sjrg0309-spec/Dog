/**
 * Bloquear y denunciar.
 *
 * Una aplicación donde quedas con desconocidos en un parque necesita esto
 * antes que muchas cosas que sí tenía. Hasta ahora la pantalla de
 * configuración decía «bloquear a alguien: falta el servidor», y era verdad a
 * medias: **bloquear no necesita servidor para funcionar en tu teléfono**, y lo
 * que hace es sacar a alguien de todas las listas que decide esta aplicación.
 *
 * ## Bloquear es desaparecer, no silenciar
 *
 * Silenciar deja a la otra persona viéndote y creyendo que la lees. Aquí
 * bloquear es **mutuo e invisible**: quien bloquea deja de ver a quien
 * bloqueó, y quien fue bloqueado deja de ver a quien lo bloqueó, sin que se le
 * diga. Sin aviso a propósito: un «te han bloqueado» es una invitación a
 * abrirse otra cuenta, y a veces algo peor.
 *
 * Y no se queda en el feed. `visibleTo` es una sola función y la usan el feed,
 * el radar, el descubrimiento y las quedadas, porque un bloqueo que solo tapa
 * las fotos y deja que os propongan quedar el martes en el mismo parque no es
 * un bloqueo.
 *
 * ## Denunciar sin campo de texto
 *
 * Se elige un motivo de una lista. **No hay dónde escribir.** Es la misma
 * decisión que en los avisos de rescate y por el mismo motivo: un campo libre
 * acaba siendo un campo para escribir sobre alguien, y quien lo lee tiene que
 * llegar a tiempo. Aquí lo que llega es un motivo y un contador.
 *
 * Y las denuncias **cuentan personas, no formularios**: tres cuentas distintas
 * denunciando lo mismo es una señal; una cuenta denunciando tres veces es una
 * persona enfadada. Es la regla de las zonas marcadas, aplicada a gente.
 */

/** Por qué se denuncia. La lista es corta porque cada motivo hace algo distinto. */
export const REPORT_REASONS = [
  {
    id: 'aggressive_dog',
    label: 'Su perro fue agresivo',
    hint: 'En una quedada o en el parque',
    /** Va al equipo de seguridad y además baja su afinidad contigo. */
    affectsMatching: true,
  },
  {
    id: 'no_show',
    label: 'Quedó y no apareció',
    hint: 'Repetido, no una vez',
    affectsMatching: true,
  },
  {
    id: 'harassment',
    label: 'Me está molestando',
    hint: 'Mensajes o insistencia',
    affectsMatching: true,
  },
  {
    id: 'fake_profile',
    label: 'El perfil es falso',
    hint: 'Fotos de otro o datos inventados',
    affectsMatching: false,
  },
  {
    id: 'animal_welfare',
    label: 'Trata mal a su animal',
    hint: 'Lo que veas, no lo que te cuenten',
    affectsMatching: false,
  },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['id'];

/**
 * Una denuncia.
 *
 * Cinco campos y ninguno es de texto. Si mañana hiciera falta añadir contexto,
 * el sitio no es este: es un motivo nuevo en la lista de arriba.
 */
export type Report = {
  id: string;
  /** A quién se denuncia. */
  targetId: string;
  /** Quién denuncia. Se cuenta, no se publica. */
  reporterId: string;
  reason: ReportReason;
  reportedAt: string;
};

export type Block = {
  /** Quién bloquea. */
  byId: string;
  /** A quién. */
  targetId: string;
  blockedAt: string;
};

/** Cuentas distintas que hacen falta para que una denuncia sea una señal. */
export const REPORT_MIN_REPORTERS = 3;

/**
 * ¿Se ven estos dos?
 *
 * Mira el bloqueo **en las dos direcciones**: da igual quién bloqueó a quién,
 * porque un bloqueo que solo funciona hacia un lado deja a la persona
 * bloqueada mirando el perfil de quien la bloqueó.
 */
export function visibleTo(
  viewerId: string,
  otherId: string,
  blocks: readonly Block[],
): boolean {
  return !blocks.some(
    (block) =>
      (block.byId === viewerId && block.targetId === otherId) ||
      (block.byId === otherId && block.targetId === viewerId),
  );
}

/**
 * Filtrar una lista de cualquier cosa que tenga dueño.
 *
 * Se pasa el identificador de la persona porque es lo que se bloquea: bloquear
 * a alguien y seguir viendo a su otro perro sería un bloqueo a medias.
 */
export function withoutBlocked<T>(
  viewerId: string,
  items: readonly T[],
  ownerOf: (item: T) => string,
  blocks: readonly Block[],
): T[] {
  return items.filter((item) => visibleTo(viewerId, ownerOf(item), blocks));
}

export function isBlocked(viewerId: string, otherId: string, blocks: readonly Block[]): boolean {
  return !visibleTo(viewerId, otherId, blocks);
}

/**
 * Cuánta señal hay contra alguien, contando personas.
 *
 * Tres cuentas distintas diciendo lo mismo es una señal; una cuenta diciéndolo
 * tres veces es una persona enfadada. Se devuelve el número de personas y no un
 * veredicto: quien decide qué hacer con esto es alguien, no una función.
 */
export function reportSignal(
  targetId: string,
  reports: readonly Report[],
): { reporters: number; reasons: ReportReason[]; actionable: boolean } {
  const mine = reports.filter((report) => report.targetId === targetId);
  const reporters = new Set(mine.map((report) => report.reporterId));
  const reasons = [...new Set(mine.map((report) => report.reason))];

  return {
    reporters: reporters.size,
    reasons,
    actionable: reporters.size >= REPORT_MIN_REPORTERS,
  };
}

/**
 * Lo que se le dice a quien acaba de bloquear.
 *
 * Dice qué pasa —desaparece de todas partes— y qué no pasa: **no se le avisa**.
 * Es la duda que tiene cualquiera al pulsar ese botón, y no contestarla hace
 * que la gente no lo pulse.
 */
export const BLOCK_NOTE =
  'Dejaréis de veros en el feed, el mapa, el radar y las quedadas. No le avisamos de nada.';

export const REPORT_NOTE =
  'Elige un motivo. No hay dónde escribir: lo que se manda es el motivo, nunca un texto sobre alguien.';

export const REPORT_THANKS =
  'Gracias. Lo revisamos con las demás denuncias sobre esa cuenta.';
