/**
 * El esqueleto de lo que está por llegar.
 *
 * Un rectángulo gris no es un esqueleto: un esqueleto es **la forma de lo que
 * va a aparecer**. Si el hueco tiene el tamaño de la foto, la altura del
 * rótulo y la posición del retrato, quien mira ya sabe qué va a haber ahí antes
 * de que llegue, y el momento de la carga deja de ser un salto.
 *
 * ## Por qué el brillo, y por qué tan lento
 *
 * El brillo que recorre la pieza dice «esto está viniendo», que es distinto de
 * «esto está vacío». Va a 1,4 segundos por pasada: más rápido parece nervioso y
 * se convierte en lo único que se mira; más lento no se lee como movimiento.
 *
 * **Es la segunda excepción a la regla del movimiento continuo** —la primera es
 * el pulso del radar— y se aguanta por lo mismo: dura lo que dura la espera y
 * desaparece con ella. Un brillo permanente sería un adorno; este se apaga solo
 * cuando llega el contenido. Con movimiento reducido no hay brillo: queda la
 * forma, que es la parte que informa.
 *
 * Y no se anuncia pieza por pieza: la pantalla dice una vez «cargando» y el
 * resto queda oculto al lector, porque oír nueve rectángulos no es información.
 */

import { useEffect } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib/motion';
import { useTheme } from '@/lib/theme';

export function SkeletonBlock({
  width,
  height,
  radius,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(shimmer);
  }, [reduced, shimmer]);

  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.55, 1]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.muted,
        },
        style,
        animated,
      ]}
    />
  );
}
