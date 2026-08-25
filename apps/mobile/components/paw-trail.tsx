/**
 * El rastro de huellas del doble toque.
 *
 * Cae desde donde se ha tocado, alternando izquierda y derecha como anda un
 * perro de verdad: las huellas de un cuadrúpedo no caen en línea recta ni todas
 * a la vez.
 *
 * Tres cosas que lo separan de un adorno:
 *
 *  1. **No es la única señal.** El doble toque también pone la reacción, y la
 *     reacción se ve en la barra de abajo con su número. Quien tenga el
 *     movimiento reducido, o simplemente mire para otro lado, se entera igual.
 *  2. **Con movimiento reducido no se anima.** No desaparece: aparece el rastro
 *     ya puesto y se desvanece. Es el mismo estado final sin el trayecto.
 *  3. **Es efímero y no se puede tocar.** Nunca captura un gesto, así que no
 *     puede tragarse el siguiente toque del usuario.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Icon } from './icon';
import { PawPrint } from '@/lib/icons';
import { useTheme } from '@/lib/theme';
import { useReducedMotion } from '@/lib/motion';

const PAWS = 5;
/** Cuánto tarda el rastro entero, de la primera huella a la última. */
const TOTAL_MS = 900;

export function PawTrail({
  origin,
  onDone,
}: {
  /** Dónde tocó el dedo, en coordenadas de la foto. */
  origin: { x: number; y: number };
  onDone: () => void;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 260 : TOTAL_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => animation.stop();
  }, [progress, reduced, onDone]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {Array.from({ length: PAWS }, (_, index) => {
        // Cada huella entra un poco después que la anterior. Sin este escalón el
        // efecto es un parpadeo, no un rastro.
        const start = index / PAWS;
        const end = start + 1 / PAWS;
        const side = index % 2 === 0 ? -1 : 1;

        const opacity = reduced
          ? progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] })
          : progress.interpolate({
              inputRange: [start, (start + end) / 2, end, 1],
              outputRange: [0, 1, 0.9, 0],
              extrapolate: 'clamp',
            });

        const translateY = reduced
          ? 0
          : progress.interpolate({
              inputRange: [start, 1],
              outputRange: [0, 46 + index * 6],
              extrapolate: 'clamp',
            });

        const scale = reduced
          ? 1
          : progress.interpolate({
              inputRange: [start, end],
              outputRange: [0.6, 1],
              extrapolate: 'clamp',
            });

        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              // La marcha alterna: cada huella se separa del eje hacia un lado.
              left: origin.x - 14 + side * (10 + index * 3),
              top: origin.y - 14 + index * 26,
              opacity,
              transform: [{ translateY }, { scale }, { rotate: `${side * 18}deg` }],
            }}
          >
            <Icon icon={PawPrint} size="xl" color={theme.colors.liveRing} strokeWidth={2.5} decorative />
          </Animated.View>
        );
      })}
    </View>
  );
}
