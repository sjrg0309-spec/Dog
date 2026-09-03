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
 * Tres posiciones y no un arrastre libre. Un continuo obliga a decidir a
 * cuántos píxeles se deja, que es justo la decisión que nadie quiere tomar
 * mientras anda por la calle. Se suelta y cae a la más cercana:
 *
 *  - **`peek`**: el asa y las primeras filas. El mapa está entero y vivo; es
 *    la posición de andar mirando dónde estás.
 *  - **`mid`**: media pantalla. Cabe una lista o la ficha de lo que se acaba
 *    de tocar, y el mapa sigue viéndose arriba, con el marcador elegido en él.
 *  - **`full`**: la lista manda. Queda una franja de mapa para recordar que
 *    sigue debajo y que se vuelve arrastrando, no navegando.
 *
 * La aritmética de las tres —dónde caen, cuánto se ve en cada una— vive en
 * `lib/sheet-detents`, sin React, para poder probarse con números. El mapa
 * (quien monta la hoja) usa `visibleHeight` de ahí para dejar un marcador
 * seleccionado **por encima** de la hoja y no tapado por ella.
 *
 * Se arrastra desde el asa y también desde el cuerpo mientras no está arriba
 * del todo: nadie quiere buscar una barra de cuatro píxeles para subir una
 * lista. Arriba del todo el cuerpo deja de arrastrar y el desplazamiento
 * vuelve a ser de la lista de dentro, que es lo que se espera en modo lista.
 *
 * Con movimiento reducido no hay animación de caída: salta a su sitio. Es el
 * mismo estado final sin el trayecto.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { detentOffsets, nextDetent, settleDetent, type SheetPosition } from '@/lib/sheet-detents';
import { useTheme } from '@/lib/theme';

export type { SheetPosition } from '@/lib/sheet-detents';

/** Lo que dice el asa de a dónde lleva el toque, por posición actual. */
const HANDLE_LABEL: Record<SheetPosition, string> = {
  peek: 'Ver la lista',
  mid: 'Ver la lista entera',
  full: 'Ver el mapa entero',
};

export function Sheet({
  /** Alto total disponible: de ahí salen las tres posiciones. */
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

  /* Memorizado porque es la dependencia del efecto que coloca la hoja: un
     objeto nuevo en cada render relanzaría el muelle en cada render. */
  const offsets = useMemo(() => detentOffsets({ available, peekHeight }), [available, peekHeight]);

  /*
   * La posición de la hoja, en el hilo de la interfaz.
   *
   * Antes era un `Animated.Value` movido por un `PanResponder`, y los dos viven
   * en el hilo de JavaScript: mientras el dedo arrastra, la lista de dentro
   * está midiendo y dibujando filas, así que la hoja se movía a tirones justo
   * durante el gesto — el único momento en que se mira.
   */
  const y = useSharedValue(offsets[position]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const to = offsets[position];
    y.value = reduced ? to : withSpring(to, springs.gentle);
  }, [offsets, position, reduced, y]);

  const settle = (next: SheetPosition) => {
    if (next !== position) haptics.tap();
    onPosition(next);
  };

  /*
   * El arrastre, en una función porque lo usan dos detectores —el asa y el
   * cuerpo— con las mismas reglas y distinta condición de arranque. Un
   * gesto compartido entre dos detectores no está permitido en la librería,
   * así que se fabrica uno para cada uno.
   */
  const drag = () =>
    Gesture.Pan()
      .onBegin(() => runOnJS(setDragging)(true))
      .onChange((event) => {
        y.value = Math.min(Math.max(y.value + event.changeY, offsets.full), offsets.peek);
      })
      .onEnd((event) => {
        /* A dónde cae se decide en `settleDetent`, que proyecta la posición
           con la velocidad; aquí sólo se anima hasta allí con la velocidad de
           la mano, para que el muelle continúe el gesto en vez de arrancar
           de cero. */
        const next = settleDetent(y.value, event.velocityY, offsets);
        y.value = withSpring(offsets[next], { ...springs.gentle, velocity: event.velocityY });
        runOnJS(settle)(next);
      })
      .onFinalize(() => runOnJS(setDragging)(false));

  const handlePan = drag();

  /*
   * El cuerpo también arrastra, salvo arriba del todo.
   *
   * Arriba, la lista de dentro tiene que poder desplazarse, y un arrastre
   * que se quede con el gesto la dejaría muerta. El umbral de doce píxeles
   * es para que un toque en una fila —que siempre se mueve un poco— siga
   * siendo un toque y no el principio de un arrastre.
   */
  const bodyPan = drag()
    .enabled(position !== 'full')
    .activeOffsetY([-12, 12]);

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
          height: offsets.height,
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
          lector de pantalla: no puede descubrirlo. El toque pasa por las tres
          posiciones, una por una, por la misma razón. */}
      <GestureDetector gesture={handlePan}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={HANDLE_LABEL[position]}
          accessibilityState={{ expanded: position !== 'peek' }}
          onPress={() => {
            haptics.tap();
            onPosition(nextDetent(position));
          }}
          style={{
            // La barra mide cuatro píxeles; el botón, cuarenta y cuatro. El
            // `hitSlop` no sirve aquí porque hacia arriba saldría de la hoja y
            // la plataforma lo recorta al borde del padre.
            minHeight: 44,
            paddingTop: theme.space[2],
            alignItems: 'center',
          }}
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

      <GestureDetector gesture={bodyPan}>
        <View style={{ flex: 1 }}>{children}</View>
      </GestureDetector>
    </Animated.View>
  );
}
