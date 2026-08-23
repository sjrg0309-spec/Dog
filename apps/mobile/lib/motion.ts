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

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

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

  return reduced;
}
