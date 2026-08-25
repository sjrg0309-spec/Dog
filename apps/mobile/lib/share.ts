/**
 * Sacar un texto de la aplicación.
 *
 * Compartir es la única acción del tablero de rescate que hace algo que la
 * aplicación no puede hacer sola: un aviso llega a quien tiene Petnav y está
 * dentro del radio, y el perro no se perdió dentro de ese radio. El grupo del
 * barrio, el de la escalera y el mostrador del veterinario están fuera.
 *
 * ## Por qué devuelve qué pasó en vez de un booleano
 *
 * Las tres vías no son la misma cosa para quien pulsa:
 *
 *  - En el teléfono se abre la hoja del sistema y la persona elige a dónde va.
 *  - En un navegador que tiene `navigator.share` pasa lo mismo.
 *  - En un navegador que no lo tiene **no hay hoja**, así que se copia al
 *    portapapeles. Eso es útil, pero **no es compartir**: si la pantalla dijera
 *    «compartido» la persona se quedaría esperando un menú que no va a salir, o
 *    peor, creería que ya está enviado.
 *
 * Por eso el resultado dice cuál de las tres ocurrió y la pantalla lo cuenta
 * como es. Y por eso `cancelled` existe aparte de `failed`: cerrar la hoja sin
 * elegir no es un error y no debe enseñar uno.
 */

import { Platform, Share } from 'react-native';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Lo que se le dice a la persona después, ya escrito. `null` = no decir nada. */
export function shareResultNote(result: ShareResult): string | null {
  switch (result) {
    case 'copied':
      return 'Copiado. Pégalo en el grupo del barrio.';
    case 'failed':
      return 'No hemos podido compartirlo. Copia el texto a mano.';
    default:
      // Compartido de verdad: la hoja del sistema ya lo confirmó, y repetirlo
      // con un aviso propio es ruido encima de algo que la persona vio.
      return null;
  }
}

export async function shareText(message: string): Promise<ShareResult> {
  if (Platform.OS !== 'web') {
    try {
      const result = await Share.share({ message });
      return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
    } catch {
      return 'failed';
    }
  }

  const nav = typeof navigator === 'undefined' ? undefined : navigator;

  if (nav?.share) {
    try {
      await nav.share({ text: message });
      return 'shared';
    } catch (error) {
      // Cerrar la hoja lanza `AbortError`, que no es un fallo. Distinguirlo
      // evita enseñar «no hemos podido» a quien simplemente cambió de idea.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      return 'failed';
    }
  }

  if (nav?.clipboard) {
    try {
      await nav.clipboard.writeText(message);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  return 'failed';
}
