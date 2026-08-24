/**
 * Arrastrar hacia abajo para salir de una pantalla a pantalla completa.
 *
 * Es el gesto de los estados de Instagram y de los vídeos de TikTok, y a estas
 * alturas es lo que la mano hace sola: en un visor sin cromo, el pulgar no
 * busca una equis de doce puntos en una esquina, tira hacia abajo.
 *
 * Lo que lo hace bueno, y lo que casi nunca se copia entero:
 *
 *  - **El contenido se encoge mientras baja.** Sin la escala, el vídeo parece
 *    deslizarse detrás de un borde; con ella, parece que se va alejando, que es
 *    lo que dice «esto se está cerrando» y no «esto se está moviendo».
 *  - **El fondo se aclara con el gesto.** Enseñar lo que hay detrás mientras se
 *    arrastra es lo que convierte el gesto en reversible: se ve a dónde se
 *    vuelve antes de soltar.
 *  - **Se puede arrepentir.** Soltar a mitad devuelve el visor a su sitio con
 *    la velocidad que llevaba el dedo. Un gesto que cierra sí o sí en cuanto se
 *    empieza no es un gesto, es un botón grande.
 *  - **Solo cuenta hacia abajo.** Hacia arriba no se mueve: en un visor de
 *    estados, arriba suele haber otro gesto —o nada—, y una pantalla que se
 *    levanta y deja una franja negra parece rota.
 *
 * El gesto solo se activa tras doce puntos de recorrido vertical, y esa cifra
 * es lo que deja pasar los toques: las zonas de tocar para avanzar y de
 * mantener para pausar siguen funcionando porque un toque no recorre doce
 * puntos.
 */

import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { springs } from './motion';
import { useReducedMotion } from '@/lib/motion';

/** Recorrido a partir del cual se cierra al soltar. */
const CLOSE_AT = 140;
/** O velocidad, aunque apenas se haya movido: un tirón corto también cierra. */
const FLICK = 900;

export function SwipeToClose({
  onClose,
  children,
  /** El color que se ve por detrás mientras el visor se aleja. */
  backdrop = '#000',
}: {
  onClose: () => void;
  children: ReactNode;
  backdrop?: string;
}) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  const pan = Gesture.Pan()
    // Doce puntos de holgura: por debajo de eso es un toque, y los toques son
    // de las zonas de avanzar y retroceder que hay debajo.
    .activeOffsetY(12)
    .onChange((event) => {
      y.value = Math.max(0, y.value + event.changeY);
    })
    .onEnd((event) => {
      if (y.value > CLOSE_AT || event.velocityY > FLICK) {
        if (reduced) {
          runOnJS(onClose)();
          return;
        }
        y.value = withTiming(y.value + 400, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        y.value = withSpring(0, { ...springs.settle, velocity: event.velocityY });
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      // Hasta un 12 % de reducción. Más y el visor parece una tarjeta; menos y
      // no se distingue de un desplazamiento.
      { scale: interpolate(y.value, [0, 400], [1, 0.88], 'clamp') },
    ],
    borderRadius: interpolate(y.value, [0, 120], [0, 24], 'clamp'),
    overflow: 'hidden',
  }));

  return (
    <View style={{ flex: 1, backgroundColor: backdrop }}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
