/**
 * La hoja que se arrastra hacia abajo para cerrarse.
 *
 * Es el gesto que define una aplicación social moderna y el que más se imita
 * mal. Lo que lo hace bueno no es que se pueda arrastrar, sino tres cosas que
 * se notan sin poder nombrarlas:
 *
 *  1. **La hoja sigue al dedo, punto por punto.** No hay animación
 *     interpretando el gesto: la posición *es* la del dedo, calculada en el
 *     hilo de la interfaz. Cualquier retraso aquí se siente como goma.
 *  2. **La velocidad decide, no la distancia.** Un tirón corto y rápido cierra;
 *     un arrastre largo y lento que se suelta arriba, no. Medir solo la
 *     distancia obliga a arrastrar media pantalla para cerrar algo que ya
 *     estabas tirando hacia abajo.
 *  3. **Hacia arriba no se va.** El arrastre se limita a cero por arriba, así
 *     que la hoja no se despega del borde. Sin ese tope, un gesto hacia arriba
 *     la levanta y deja un hueco por debajo — y ese hueco es la diferencia
 *     entre una hoja y un rectángulo suelto.
 *
 * Y una cuarta que no es de gesto: **con movimiento reducido no hay trayecto**,
 * ni al abrir ni al cerrar. El gesto sigue funcionando; lo que desaparece es la
 * animación, no la función.
 */

import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from './glass';
import { springs } from './motion';
import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/motion';
import { useRelief } from '@/lib/relieve';
import { useTheme } from '@/lib/theme';

/** A partir de aquí se cierra por distancia recorrida. */
const DISMISS_AT = 120;
/** Y a partir de aquí, por velocidad, aunque apenas se haya movido. */
const FLICK = 800;

export function Drawer({
  title,
  onClose,
  children,
  /** Cuánto de la pantalla ocupa como mucho. */
  height = 0.72,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  height?: number;
}) {
  const theme = useTheme();
  const relief = useRelief();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { height: screen } = useWindowDimensions();
  const panel = Math.round(screen * height);

  const y = useSharedValue(reduced ? 0 : panel);

  useEffect(() => {
    y.value = reduced ? 0 : withSpring(0, springs.gentle);
  }, [reduced, y]);

  const close = () => {
    haptics.tap();
    onClose();
  };

  const dismiss = () => {
    if (reduced) {
      close();
      return;
    }
    y.value = withTiming(panel, { duration: 180 }, (finished) => {
      if (finished) runOnJS(close)();
    });
  };

  const pan = Gesture.Pan()
    .onChange((event) => {
      // Tope por arriba: la hoja no se despega del borde de abajo.
      y.value = Math.max(0, y.value + event.changeY);
    })
    .onEnd((event) => {
      if (y.value > DISMISS_AT || event.velocityY > FLICK) {
        y.value = withTiming(panel, { duration: 180 }, (finished) => {
          if (finished) runOnJS(close)();
        });
      } else {
        // Vuelve a su sitio **con la velocidad que llevaba el dedo**. Sin eso,
        // soltar a mitad de un tirón hacia arriba se siente como si la hoja se
        // hubiera quedado quieta un instante antes de reaccionar.
        y.value = withSpring(0, { ...springs.settle, velocity: event.velocityY });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  /*
   * Va en una capa del sistema y no en un `position: absolute` a secas.
   *
   * Se probó lo segundo y el resultado está en una captura: la hoja se colocaba
   * respecto a la tarjeta que la abría, dentro de la lista, así que aparecía
   * **entre dos publicaciones** y se iba con el scroll. Una hoja es de la
   * pantalla, no del elemento que la abre, y `Modal` es lo que da esa capa —en
   * el teléfono y en el navegador, donde react-native-web la monta al final del
   * documento.
   *
   * `animationType="none"` a propósito: la entrada la hace el muelle de abajo,
   * y encadenar dos animaciones da un doble movimiento que se nota.
   */
  return (
    <Modal transparent visible animationType="none" onRequestClose={dismiss}>
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Glass style={{ flex: 1 }} tone="scrim">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cerrar ${title.toLowerCase()}`}
          onPress={dismiss}
          style={{ flex: 1, backgroundColor: theme.colors.overlay }}
        />
      </Glass>

      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityViewIsModal
          style={[
            {
              height: panel,
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius['2xl'],
              borderTopRightRadius: theme.radius['2xl'],
              paddingBottom: insets.bottom,
              overflow: 'hidden',
            },
            /* La hoja es lo que más sobresale de la pantalla, así que se lleva
               el paso largo del relieve. En las otras direcciones lo que la
               despega es el velo oscuro de detrás, que sigue estando. */
            relief.raised('lg'),
            sheetStyle,
          ]}
        >
          {/* El asa. No hace nada por sí sola y no está de adorno: es lo que
              dice que esto se arrastra, antes de que nadie lo intente. */}
          <View style={{ alignItems: 'center', paddingVertical: theme.space[3] }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.border,
              }}
            />
          </View>

          {children}
        </Animated.View>
      </GestureDetector>
    </View>
    </Modal>
  );
}
