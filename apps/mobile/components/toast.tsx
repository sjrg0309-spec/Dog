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

import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { Glass } from './glass';
import { Appear } from './motion';
import { fonts } from '@/lib/fonts';
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

  useEffect(() => {
    const timer = setTimeout(onDone, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: theme.space[4],
        right: theme.space[4],
        bottom: theme.space[6],
        alignItems: 'center',
      }}
    >
      {/* Entra con muelle desde abajo. Es lo mismo que hace la píldora de
          Instagram y de iOS, y no es gratuito: un aviso que aparece de golpe se
          confunde con un fallo de dibujo. */}
      <Appear distance={-16}>
        {/* Cristal y no un rectángulo opaco: el aviso flota sobre la pantalla,
            así que dejar ver la forma de lo que hay debajo es lo que dice que
            no es una pantalla nueva. El tinte del cristal mantiene el
            contraste; el desenfoque solo aporta el efecto. */}
        <Glass
          tone="ink"
          style={{
            maxWidth: 420,
            paddingHorizontal: theme.space[4],
            paddingVertical: theme.space[3],
            borderRadius: theme.radius.full,
            overflow: 'hidden',
          }}
        >
          <Text
            accessibilityRole="alert"
            aria-live="polite"
            style={{
              color: theme.colors.background,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
              textAlign: 'center',
            }}
          >
            {message}
          </Text>
        </Glass>
      </Appear>
    </View>
  );
}
