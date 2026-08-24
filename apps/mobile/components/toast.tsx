/**
 * El aviso corto de «ya está», flotando sobre la pantalla.
 *
 * Existe por una sola razón, y es la que decide su forma: hay acciones que
 * ocurren **fuera** de la aplicación —copiar al portapapeles, abrir la hoja del
 * sistema— y que no dejan ninguna huella dentro. Sin una confirmación, la
 * persona pulsa «compartir» en un navegador de escritorio, no pasa nada
 * visible, y vuelve a pulsar.
 *
 * Lo que **no** es: un sitio donde contar cosas. Solo aparece cuando ha pasado
 * algo que la persona provocó y no puede ver, dura lo que se tarda en leerlo, y
 * no tiene botón de cerrar —tener que cerrar un aviso de tres palabras es peor
 * que el problema que resuelve—.
 *
 * Se anuncia como región activa para que un lector de pantalla lo lea sin
 * mover el foco: robar el foco por un «Copiado» dejaría a quien navega con
 * teclado fuera del sitio donde estaba.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { fonts } from '@/lib/fonts';
import { useReducedMotion } from '@/lib/motion';
import { useTheme } from '@/lib/theme';

export function Toast({
  message,
  onDone,
  duration = 2600,
}: {
  message: string;
  onDone: () => void;
  duration?: number;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (!reduced) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone, opacity, reduced]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: theme.space[4],
        right: theme.space[4],
        bottom: theme.space[6],
        opacity,
        alignItems: 'center',
      }}
    >
      <View
        accessibilityRole="alert"
        aria-live="polite"
        style={{
          maxWidth: 420,
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[3],
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.foreground,
        }}
      >
        <Text
          style={{
            color: theme.colors.background,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
