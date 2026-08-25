/**
 * La barra de pestañas, escrita a mano.
 *
 * La que trae el navegador funciona, y aun así se ha sustituido, porque tres
 * cosas que definen cómo se siente esta aplicación no se pueden pedir desde sus
 * opciones:
 *
 *  1. **La pastilla viaja.** Al cambiar de pestaña, la forma que marca «estás
 *     aquí» se desplaza hasta la nueva en vez de apagarse en un sitio y
 *     encenderse en otro. Es la diferencia entre cinco botones y una barra: un
 *     objeto que se mueve dice que las cinco pestañas son el mismo sitio visto
 *     de cinco maneras.
 *  2. **Se condensa al leer.** Con el dedo bajando pierde los rótulos y baja de
 *     72 a 52 puntos, devolviendo ese alto al contenido; al subir vuelve. Todo
 *     ligado al desplazamiento en el hilo de la interfaz, así que sigue al dedo
 *     y no a JavaScript.
 *  3. **Es de cristal.** El contenido pasa por debajo y se ve, desenfocado. Una
 *     barra opaca corta la pantalla; una de cristal la termina.
 *
 * **Condensar y no esconder** es una decisión, no una limitación: aquí hay una
 * pestaña de emergencia, y una barra que se va mientras alguien lee el feed es
 * un SOS que hay que ir a buscar con un gesto antes de poder pulsarlo.
 *
 * Lo que **no** cambia respecto a la barra del navegador: los papeles y los
 * nombres accesibles. Cada pestaña sigue anunciándose como pestaña, con su
 * nombre y su estado de seleccionada, y la de SOS sigue diciendo cuántas
 * alertas críticas hay abiertas. Una barra bonita que un lector de pantalla no
 * sabe recorrer es una barra rota.
 */

import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { PixelRatio, Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from './glass';
import { springs } from './motion';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { chromeCondensed, resetChrome } from '@/lib/scroll';
import { useTheme } from '@/lib/theme';

/** Alto de la barra sin el área segura, entera y condensada. */
const FULL = 72;
const TIGHT = 52;

/**
 * Cuánto crece la barra con el tamaño de letra del sistema.
 *
 * La guía es explícita en las dos mitades de esto: hay que **admitir texto
 * escalable**, y a la vez «cuando alguien sube el tamaño de letra no espera que
 * los títulos de las pestañas crezcan» —lo que quiere leer más grande es el
 * contenido, no el cromo—. Con altura fija y el rótulo escalando, la palabra se
 * recortaba por abajo; con la altura escalando entera, cinco pestañas se comían
 * un tercio de la pantalla.
 *
 * El acuerdo: el rótulo crece hasta un 20 % y la barra le hace sitio, y de ahí
 * no pasa ninguno de los dos. El contenido de las pantallas sigue escalando sin
 * tope, que es lo que de verdad importa.
 */
const LABEL_CAP = 1.2;
const barHeight = (base: number): number =>
  Math.round(base + 14 * (Math.min(PixelRatio.getFontScale(), LABEL_CAP) - 1));

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  /*
   * Las rutas ocultas siguen estando en el estado del navegador.
   *
   * Se declaran con `href: null`, pero ese atajo no llega hasta aquí: el
   * enrutador lo consume y lo traduce a `tabBarItemStyle: { display: 'none' }`,
   * que es lo que hay que mirar. Filtrar por `href` dejaba las catorce rutas en
   * la barra —radar, quedadas, publicar y las demás— en vez de las cinco
   * pestañas. Lo cazó la auditoría al imprimir los nombres.
   */
  const routes = state.routes.filter((route) => {
    const style = descriptors[route.key]?.options.tabBarItemStyle as
      | { display?: string }
      | undefined;
    return style?.display !== 'none';
  });
  const activeIndex = routes.findIndex((route) => route.key === state.routes[state.index]?.key);

  /* El ancho de una pestaña se mide, no se calcula: dividir el ancho de la
     pantalla entre cinco daba una pastilla desplazada en cuanto el área segura
     lateral no era cero, que es el caso de casi cualquier teléfono en
     horizontal. */
  const [width, setWidth] = useState(0);
  const slot = routes.length > 0 ? width / routes.length : 0;

  /* Se leen en el render y no dentro del worklet: `PixelRatio` no existe en el
     hilo de la interfaz, y el tamaño de letra del sistema no cambia mientras se
     desplaza el dedo —cambia en Ajustes, y al volver la barra ya está pintada
     con el alto nuevo—. */
  const full = barHeight(FULL);
  const tight = barHeight(TIGHT);
  const height = useDerivedValue(() => interpolate(chromeCondensed.value, [0, 1], [full, tight]));

  const barStyle = useAnimatedStyle(() => ({
    height: height.value + insets.bottom,
    paddingBottom: insets.bottom > 0 ? insets.bottom : theme.space[2],
  }));

  /* La pastilla es un solo objeto para las cinco pestañas, y por eso puede
     viajar. Con una pastilla por pestaña —que fue la primera versión— lo único
     que se podía animar era su opacidad, y eso es encender y apagar, no
     moverse. */
  const pillStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withSpring(activeIndex * slot + (slot - 52) / 2, springs.settle) },
      { translateY: interpolate(chromeCondensed.value, [0, 1], [0, 2]) },
    ],
    opacity: activeIndex < 0 || slot === 0 ? 0 : 1,
  }));

  return (
    <Animated.View style={[{ overflow: 'hidden' }, barStyle]}>
      <Glass style={{ flex: 1 }}>
        <View
          /* Una barra de pestañas es una lista de pestañas, y decirlo tiene dos
             efectos: un lector de pantalla anuncia «1 de 5» al recorrerla, y la
             auditoría puede contar **las de la barra** en vez de todas las del
             documento —el conmutador de mascota también son pestañas, y contarlo
             todo junto daba ocho—. */
          accessibilityRole="tablist"
          accessibilityLabel="Navegación principal"
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          {/* La pastilla, debajo de todo y sin capturar toques. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: theme.space[2],
                left: 0,
                width: 52,
                height: 30,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.accent,
              },
              pillStyle,
            ]}
          />

          {routes.map((route, index) => {
            const { options } = descriptors[route.key]!;
            const focused = index === activeIndex;
            const label =
              typeof options.title === 'string' ? options.title : route.name;

            return (
              <TabButton
                key={route.key}
                label={label}
                focused={focused}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                badge={options.tabBarBadge}
                icon={options.tabBarIcon}
                onPress={() => {
                  haptics.tap();
                  /* La barra vuelve entera al cambiar de pestaña. Se vio en una
                     captura: se llegaba a Explorar con los rótulos escondidos
                     porque el dedo había bajado en el feed, y esa pantalla no
                     se había desplazado nunca. El estado del cromo es de la
                     pantalla que se desplaza, no de la aplicación. */
                  resetChrome();
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
              />
            );
          })}
        </View>
      </Glass>
    </Animated.View>
  );
}

function TabButton({
  label,
  focused,
  accessibilityLabel,
  badge,
  icon,
  onPress,
}: {
  label: string;
  focused: boolean;
  accessibilityLabel?: string;
  badge?: number | string;
  icon?: BottomTabBarProps['descriptors'][string]['options']['tabBarIcon'];
  onPress: () => void;
}) {
  const theme = useTheme();

  /* El rótulo se desvanece y **encoge de alto** al condensar. Solo con la
     opacidad, el hueco de la palabra seguía ocupando sitio y la barra no
     bajaba: se veían cinco iconos flotando en el mismo espacio de antes. */
  const line = Math.round(14 * Math.min(PixelRatio.getFontScale(), LABEL_CAP));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(chromeCondensed.value, [0, 0.6], [1, 0]),
    height: interpolate(chromeCondensed.value, [0, 1], [line, 0]),
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      aria-selected={focused}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <View style={{ height: 30, justifyContent: 'center' }}>
        {icon?.({
          focused,
          color: focused ? theme.colors.primary : theme.colors.mutedForeground,
          size: 24,
        })}
        {badge !== undefined ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -10,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.destructive,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              /* El aviso vive en un círculo de dieciocho puntos. Si el número
                 escalara, se saldría del círculo; y lo que hay que leer no es
                 el dígito sino que hay algo, cosa que dice el punto rojo. El
                 nombre accesible de la pestaña sí lo dice con palabras. */
              maxFontSizeMultiplier={1}
              style={{
                color: theme.colors.destructiveForeground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize['2xs'],
              }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Animated.View style={labelStyle}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={LABEL_CAP}
          style={{
            color: focused ? theme.colors.primary : theme.colors.mutedForeground,
            fontFamily: focused ? fonts.bodyBold : fonts.body,
            fontSize: theme.fontSize['2xs'],
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Se exporta el alto máximo para que las pantallas reserven sitio debajo.
 *
 * Se calcula con el tamaño de letra puesto, no con la constante: si la barra
 * crece y esto no, el último elemento de cada lista queda debajo de ella.
 */
export const TAB_BAR_HEIGHT = barHeight(FULL);
