/**
 * Preferencia de movimiento reducido.
 *
 * El proyecto tiene una regla desde el primer día: el anillo del radar es el
 * único elemento con movimiento continuo, y con movimiento reducido se sustituye
 * por un estado estático que comunica lo mismo. Ahora hay más animación —el
 * rastro de huellas del doble toque, el botón flotante que se encoge, la cuenta
 * atrás del check-in—, así que la preferencia deja de ser cosa de un componente
 * y pasa a leerse desde un solo sitio.
 *
 * `AccessibilityInfo` resuelve de forma asíncrona y notifica los cambios en
 * caliente: alguien puede activar la preferencia con la aplicación abierta.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useSettings } from './settings';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  /*
   * El ajuste de la aplicación **suma, no sustituye**.
   *
   * Se puede pedir movimiento reducido desde aquí aunque el teléfono no lo
   * tenga puesto —hay quien lo quiere en esta aplicación y no en el resto—,
   * pero no al revés: con la preferencia del sistema activada, nada de esta
   * pantalla la cancela. Quien la activó lo hizo por un motivo que no es
   * estético, y una aplicación que se salta esa preferencia porque tiene su
   * propio interruptor es exactamente el fallo que la preferencia existe para
   * evitar.
   */
  const forced = useSettings().motion === 'reduced';

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => {
        // Si no se puede preguntar, se anima. Es el comportamiento por defecto
        // de la plataforma y no hay nada mejor que suponer.
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);

    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return forced || reduced;
}
