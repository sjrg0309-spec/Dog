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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Pressable, View } from 'react-native';

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

  const translate = useRef(new Animated.Value(position === 'open' ? 0 : peekY)).current;
  // El valor arrastrado hay que leerlo, y `Animated.Value` no se lee de forma
  // síncrona: se guarda a mano en cada movimiento.
  const dragStart = useRef(position === 'open' ? 0 : peekY);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const to = position === 'open' ? 0 : peekY;
    dragStart.current = to;
    if (reduced) {
      translate.setValue(to);
      return;
    }
    Animated.timing(translate, {
      toValue: to,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [position, peekY, reduced, translate]);

  const pan = useRef(
    PanResponder.create({
      // Solo se captura el gesto cuando es claramente vertical: si no, un
      // desplazamiento lateral dentro de la lista arrastraría la hoja entera.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: (_event, gesture) => {
        const next = Math.min(Math.max(dragStart.current + gesture.dy, 0), peekY);
        translate.setValue(next);
      },
      onPanResponderRelease: (_event, gesture) => {
        setDragging(false);
        const landed = Math.min(Math.max(dragStart.current + gesture.dy, 0), peekY);
        // Manda la velocidad sobre la posición: un gesto rápido y corto hacia
        // abajo es «cierra», aunque haya recorrido veinte píxeles.
        const next =
          Math.abs(gesture.vy) > 0.5
            ? gesture.vy > 0
              ? 'peek'
              : 'open'
            : landed > peekY / 2
              ? 'peek'
              : 'open';
        dragStart.current = next === 'open' ? 0 : peekY;
        if (next !== position) haptics.tap();
        onPosition(next);
      },
    }),
  ).current;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: openHeight,
        transform: [{ translateY: translate }],
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
      }}
    >
      {/* El asa. Es a la vez el tirador del gesto y un botón, porque un gesto
          que sea el único camino a una función deja fuera a quien navega con
          lector de pantalla: no puede descubrirlo. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={position === 'open' ? 'Ver el mapa entero' : 'Ver la lista'}
        accessibilityState={{ expanded: position === 'open' }}
        onPress={() => {
          haptics.tap();
          onPosition(position === 'open' ? 'peek' : 'open');
        }}
        {...pan.panHandlers}
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

      {children}
    </Animated.View>
  );
}
