/**
 * Paseo acompañado: avisar a alguien de que has salido.
 *
 * Esta aplicación se usa a las seis de la mañana y a las once de la noche
 * —son las horas en las que se pasea solo, y las que la hicieron existir— y en
 * media América Latina esas dos horas son las que preocupan. Hasta ahora todo
 * lo de seguridad miraba al animal: si le conviene salir, si el suelo quema, si
 * hay cebos. Esto mira a la persona.
 *
 * ## Qué hace, exactamente
 *
 * Al salir se puede elegir a alguien de confianza. Esa persona recibe **el
 * sitio y la hora de vuelta**, y nada más. Si el paseo no se cierra a la hora
 * prevista más un margen, se le avisa.
 *
 * ## Y qué no hace, que es lo que lo hace aceptable
 *
 * **No es un rastro en vivo.** No manda tu posición mientras andas, ni siquiera
 * a quien tú elijas. Manda el sitio —el parque, que es un lugar público al que
 * cualquiera puede ir— y la hora. Es la misma regla que gobierna el radar desde
 * el principio: se comparte el lugar, no la persona.
 *
 * La diferencia importa cuando se piensa en quién más puede acabar mirando esa
 * pantalla. Un rastro en vivo compartido con una pareja es la herramienta de
 * control doméstico mejor diseñada que existe, y se instala con muy buenas
 * intenciones. Un «he salido al Parque Central, vuelvo a las 19:30» no lo es.
 *
 * **Caduca solo.** El acompañamiento se acaba con el paseo, no queda encendido.
 * Y se puede quitar en cualquier momento sin dar explicaciones ni avisar.
 */

/** Margen antes de avisar de que un paseo no se ha cerrado. */
export const ESCORT_GRACE_MINUTES = 15;

export type Escort = {
  /** A quién se avisa. Uno, no una lista: elegir a cinco personas es no elegir. */
  contactId: string;
  contactName: string;
  /** Dónde, con el nombre del sitio. Nunca coordenadas de la persona. */
  placeName: string;
  /** Cuándo empezó y cuándo debería haber vuelto. */
  startedAt: string;
  dueAt: string;
  /** Cerrado por quien salió. Lo normal. */
  closedAt?: string | null;
};

export type EscortState = 'walking' | 'late' | 'closed';

export function escortState(escort: Escort, now: Date): EscortState {
  if (escort.closedAt) return 'closed';
  const due = Date.parse(escort.dueAt) + ESCORT_GRACE_MINUTES * 60_000;
  return now.getTime() > due ? 'late' : 'walking';
}

/**
 * El mensaje que le llega al contacto, en cada momento.
 *
 * Se escribe aquí y no en la pantalla porque es lo único que sale de este
 * teléfono hacia otra persona: conviene poder leerlo entero, de una vez, y
 * comprobar que no lleva nada más que el sitio y la hora.
 */
export function escortMessage(escort: Escort, now: Date): string {
  const state = escortState(escort, now);
  const hour = formatHour(escort.dueAt);

  if (state === 'closed') {
    return `${escort.contactName ? '' : ''}Ha vuelto del paseo. Todo bien.`;
  }
  if (state === 'late') {
    return `No ha cerrado el paseo y ya pasó de las ${hour}. Salió a ${escort.placeName}. Escríbele.`;
  }
  return `Ha salido a pasear a ${escort.placeName}. Vuelve sobre las ${hour}.`;
}

/** Lo que se le enseña a quien sale, antes de elegir a nadie. */
export const ESCORT_NOTE =
  'Le mandamos el sitio y la hora de vuelta. No compartimos dónde estás mientras paseas.';

export const ESCORT_LATE_NOTE =
  'Si no cierras el paseo, le avisamos 15 minutos después de la hora que pusiste.';

function formatHour(iso: string): string {
  const at = new Date(iso);
  const hours = at.getHours();
  const minutes = at.getMinutes();
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}
