/**
 * Respuesta háptica.
 *
 * Envuelve `expo-haptics` en lugar de llamarlo directo por dos razones, y
 * ninguna es estética:
 *
 *  1. **En web no existe.** La versión de escritorio de Expo no tiene motor
 *     háptico, y la demo que se publica corre ahí. Sin esta envoltura, cada
 *     toque lanzaría una promesa rechazada.
 *  2. **El vocabulario tiene que ser corto.** Con la API cruda a mano, cada
 *     pantalla acaba eligiendo su propia intensidad y el resultado es ruido: si
 *     todo vibra igual de fuerte, la vibración deja de significar nada.
 *
 * Cuatro gestos y ninguno más:
 *
 * | gesto | cuándo |
 * |---|---|
 * | `tap` | cambiar de pestaña, alternar un filtro |
 * | `commit` | algo queda hecho: publicar, apuntarse, hacer check-in |
 * | `warn` | algo se ha bloqueado por bienestar o por zona |
 * | `alarm` | se ha abierto o recibido una alerta de seguridad |
 *
 * `alarm` es el único que se permite fuera de una interacción directa, porque es
 * el único caso en el que interrumpir a alguien está justificado.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const available = Platform.OS === 'ios' || Platform.OS === 'android';

/** Se traga el fallo: una vibración que no sale no puede romper una acción. */
function run(effect: () => Promise<void>): void {
  if (!available) return;
  void effect().catch(() => {});
}

export const haptics = {
  /** Un toque seco. Confirma que el dedo ha llegado, nada más. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Algo ha quedado hecho. */
  commit: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** Algo se ha bloqueado, y quien lo bloquea es el animal. */
  warn: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),

  /**
   * Alerta de seguridad.
   *
   * Doble golpe fuerte y separado: es lo que se nota con el teléfono en el
   * bolsillo y andando, que es exactamente la situación en la que llega.
   */
  alarm: () => {
    if (!available) return;
    void (async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        await new Promise((resolve) => setTimeout(resolve, 140));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {
        // Sin motor háptico no pasa nada: la alerta ya se ve y se lee.
      }
    })();
  },
} as const;
