/**
 * Las tres piezas de movimiento de la aplicación.
 *
 * El proyecto tenía una regla desde el primer día: **el anillo del radar es el
 * único elemento con movimiento continuo**, y por eso significa «en vivo». Esa
 * regla sigue, y lo que hay aquí no la rompe:
 *
 *  - `Appear` es movimiento **de entrada**: ocurre una vez, al aparecer algo, y
 *    se acaba. Sin él una lista se materializa de golpe y no se sabe si ha
 *    cargado o si siempre estuvo así.
 *  - `Pop` es movimiento **de respuesta**: ocurre porque el dedo ha tocado. Es
 *    la confirmación de que el toque ha entrado, antes de que cambie el número.
 *  - `Pulse` es el único **continuo**, y solo lo lleva lo que está pasando
 *    ahora mismo.
 *
 * Los tres respetan movimiento reducido, y ninguno esconde información: quitar
 * la animación deja el mismo estado final, no un estado peor.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';

import { useReducedMotion } from '@/lib/motion';

/**
 * Entrada: sube y aparece.
 *
 * `index` escalona la entrada de una lista. Se limita a los primeros: escalonar
 * el elemento número treinta lo haría entrar segundo y medio después de abrir
 * la pantalla, que ya no es una entrada sino una espera.
 */
export function Appear({
  children,
  index = 0,
  distance = 14,
  style,
}: {
  children: ReactNode;
  index?: number;
  distance?: number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 6) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Respuesta al toque: se encoge y vuelve con un rebote corto.
 *
 * `trigger` es el valor que cambia cuando hay que animar —normalmente el estado
 * de la reacción—. No se anima en el primer render: una tarjeta que llega con
 * el corazón ya puesto no debería rebotar al aparecer.
 */
export function Pop({
  children,
  trigger,
  style,
}: {
  children: ReactNode;
  trigger: unknown;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;

    scale.setValue(0.7);
    const animation = Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 14,
    });
    animation.start();
    return () => animation.stop();
  }, [reduced, scale, trigger]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/**
 * El pulso del radar: el único movimiento continuo de la aplicación.
 *
 * Con movimiento reducido no desaparece — desaparecería la información — sino
 * que se queda en el estado grande y estático, que comunica lo mismo sin el
 * trayecto.
 */
export function Pulse({
  children,
  active,
  style,
}: {
  children: ReactNode;
  active: boolean;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active || reduced) {
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 1200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduced, value]);

  if (!active) return <Animated.View style={style}>{children}</Animated.View>;

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            { scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
