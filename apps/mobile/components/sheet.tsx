/**
 * La hoja inferior.
 *
 * Es la mitad de un mapa moderno, y no por moda: un mapa quiere la pantalla
 * entera y la lista de lo que hay en él también, así que una de las dos tiene
 * que poder taparse. La hoja las reparte con el pulgar —se arrastra, no se
 * navega— y **nunca se cierra del todo**: en la posición baja siguen viéndose
 * el asa y el primer renglón, que es lo que dice que hay algo debajo. Una hoja
 * que desaparece es una función que nadie encuentra dos veces.
 *
 * Dos posiciones y no un arrastre libre: «mapa» y «lista». Un continuo obliga a
 * decidir a cuántos píxeles se deja, que es justo la decisión que nadie quiere
 * tomar mientras anda por la calle. Se suelta y cae a la más cercana.
 *
 * Con movimiento reducido no hay animación de caída: salta a su sitio. Es el
 * mismo estado final sin el trayecto.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { springs } from './motion';
import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';
import { useTheme } from '@/lib/theme';

export type SheetPosition = 'peek' | 'open';

export function Sheet({
  /** Alto total disponible: de ahí salen las dos posiciones. */
  available,
  /** Cuánto asoma en la posición baja. */
  peekHeight,
  position,
  onPosition,
  children,
}: {
  available: number;
  peekHeight: number;
  position: SheetPosition;
  onPosition: (position: SheetPosition) => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();

  const openHeight = Math.round(available * 0.82);
  const peekY = openHeight - peekHeight;

  /*
   * La posición de la hoja, en el hilo de la interfaz.
   *
   * Antes era un `Animated.Value` movido por un `PanResponder`, y los dos viven
   * en el hilo de JavaScript: mientras el dedo arrastra, la lista de dentro
   * está midiendo y dibujando filas, así que la hoja se movía a tirones justo
   * durante el gesto — el único momento en que se mira.
   */
  const y = useSharedValue(position === 'open' ? 0 : peekY);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const to = position === 'open' ? 0 : peekY;
    y.value = reduced ? to : withSpring(to, springs.gentle);
  }, [peekY, position, reduced, y]);

  const settle = (next: SheetPosition) => {
    if (next !== position) haptics.tap();
    onPosition(next);
  };

  const pan = Gesture.Pan()
    .onBegin(() => runOnJS(setDragging)(true))
    .onChange((event) => {
      y.value = Math.min(Math.max(y.value + event.changeY, 0), peekY);
    })
    .onEnd((event) => {
      /*
       * A dónde iría el dedo si lo soltara y siguiera frenando.
       *
       * Elegir por la posición al soltar obliga a arrastrar media hoja para
       * cambiarla de sitio; elegir solo por la velocidad hace que un arrastre
       * lento y largo no haga nada. Proyectar la posición con la velocidad
       * —un quinto de segundo de inercia— resuelve los dos casos con una sola
       * regla, y es lo que hacen las hojas del sistema.
       */
      const projected = y.value + event.velocityY * 0.2;
      const next: SheetPosition = projected > peekY / 2 ? 'peek' : 'open';
      y.value = withSpring(next === 'open' ? 0 : peekY, {
        ...springs.gentle,
        velocity: event.velocityY,
      });
      runOnJS(settle)(next);
    })
    .onFinalize(() => runOnJS(setDragging)(false));

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View
      style={[
        sheetStyle,
        {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: openHeight,
        backgroundColor: theme.colors.background,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        // Una sombra tenue y solo aquí: es lo que dice que la hoja está por
        // encima del mapa en vez de recortada contra él.
        shadowColor: '#000',
        shadowOpacity: dragging ? 0.18 : 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
        elevation: 12,
        },
      ]}
    >
      {/* El asa. Es a la vez el tirador del gesto y un botón, porque un gesto
          que sea el único camino a una función deja fuera a quien navega con
          lector de pantalla: no puede descubrirlo. */}
      <GestureDetector gesture={pan}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={position === 'open' ? 'Ver el mapa entero' : 'Ver la lista'}
          accessibilityState={{ expanded: position === 'open' }}
          onPress={() => {
            haptics.tap();
            onPosition(position === 'open' ? 'peek' : 'open');
          }}
          style={{ paddingTop: theme.space[2], paddingBottom: theme.space[1], alignItems: 'center' }}
        >
          <View
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.borderStrong,
            }}
          />
        </Pressable>
      </GestureDetector>

      {children}
    </Animated.View>
  );
}
