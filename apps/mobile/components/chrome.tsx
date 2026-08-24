/**
 * El cromo de la aplicación: barra de navegación y título grande.
 *
 * Sigue tres reglas de la guía de interfaz de la plataforma que aquí no eran
 * decorativas sino que faltaban:
 *
 *  1. **Los controles van sobre el contenido, no en su mismo plano.** La barra
 *     flota encima y el contenido pasa por debajo, en lugar de empujarla.
 *  2. **Efecto de borde al desplazar.** La separación entre barra y contenido
 *     aparece solo cuando hay algo debajo. Una línea permanente sobre una
 *     pantalla sin desplazar es una raya que no informa de nada.
 *  3. **Título grande que se recoge.** Da jerarquía al abrir y devuelve el
 *     espacio al empezar a leer. Con movimiento reducido no se anima: aparece
 *     ya recogido, que es el mismo estado final sin el trayecto.
 */

import { useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from './icon';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { ArrowLeft } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

/** Alto de la barra, sin contar el área segura. 44 es el suelo táctil. */
export const NAV_BAR_HEIGHT = 48;

export function NavBar({
  title,
  trailing,
  /** Ya se ha desplazado el contenido: toca enseñar la separación. */
  scrolled,
  /**
   * El desplazamiento en crudo, si la pantalla lo lleva.
   *
   * Con él, la separación **aparece progresivamente** en los primeros doce
   * puntos de scroll en vez de encenderse de golpe al pasar de cuatro. Es la
   * misma información —hay algo debajo— dicha sin un salto, y se calcula en el
   * hilo de la interfaz, así que no depende de que JavaScript esté libre.
   *
   * Sigue siendo opcional: las pantallas que no se desplazan apenas —o que
   * están detrás de una hoja— se quedan con el booleano, que no miente, solo es
   * más basto.
   */
  scrollY,
  /** El título pequeño solo aparece cuando el grande ya no se ve. */
  showTitle = true,
  /**
   * Qué hace tocar el título.
   *
   * En el feed, el nombre de la aplicación devuelve arriba y refresca — es lo
   * que hace el logotipo de Instagram en el navegador—. Es opcional porque en
   * el resto de pantallas el título es un rótulo y nada más: hacerlo pulsable
   * en todas prometería una acción que no existe.
   */
  onTitlePress,
  /**
   * A qué altura de scroll el título grande ha dejado de verse.
   *
   * Con esto el rótulo de la barra **se cruza** con el grande —uno se va
   * mientras el otro llega— en vez de aparecer de golpe cuando un booleano
   * cambia. Es el gesto de iOS, y lo que lo hace legible: en ningún momento hay
   * dos títulos a plena tinta ni ninguno.
   */
  revealAt,
}: {
  title: string;
  trailing?: ReactNode;
  scrolled: boolean;
  scrollY?: SharedValue<number>;
  showTitle?: boolean;
  onTitlePress?: () => void;
  revealAt?: number;
}) {
  const theme = useTheme();

  const hairline = useAnimatedStyle(() => ({
    opacity: scrollY ? interpolate(scrollY.value, [0, 12], [0, 1], 'clamp') : scrolled ? 1 : 0,
  }));

  const titleStyle = useAnimatedStyle(() => {
    if (!scrollY || revealAt === undefined) return { opacity: showTitle ? 1 : 0 };
    return {
      opacity: interpolate(scrollY.value, [revealAt - 28, revealAt], [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(scrollY.value, [revealAt - 28, revealAt], [6, 0], 'clamp') }],
    };
  });

  return (
    <View
      style={{
        height: NAV_BAR_HEIGHT,
        paddingHorizontal: theme.space[4],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* La separación es una capa aparte y no un borde del contenedor: un
          borde no se puede desvanecer sin mover el contenido un pelo hacia
          arriba al aparecer, y ese pelo se ve. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: theme.colors.border,
          },
          hairline,
        ]}
      />
      {onTitlePress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. Volver arriba y actualizar`}
          onPress={() => {
            haptics.tap();
            onTitlePress();
          }}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}
        >
          <Animated.Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[
              {
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.lg,
              },
              titleStyle,
            ]}
          >
            {title}
          </Animated.Text>
        </Pressable>
      ) : (
        <Animated.Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[
            {
              flex: 1,
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.lg,
            },
            titleStyle,
          ]}
        >
          {title}
        </Animated.Text>
      )}
      {trailing ? <View style={{ flexDirection: 'row', gap: theme.space[3] }}>{trailing}</View> : null}
    </View>
  );
}

/**
 * La barra de una pantalla que vive fuera de las pestañas.
 *
 * Su único trabajo es ofrecer **una salida y solo una**. Es el mismo
 * razonamiento que sacó de las pestañas al chat, al visor de estados y al
 * reproductor de reels: en una pantalla en la que se entra y de la que se
 * sale, cinco iconos abajo son cinco formas de perder lo que se estaba
 * mirando, y ninguna de ellas es «volver».
 *
 * El botón mide el suelo táctil entero aunque la flecha sea pequeña, y lleva
 * su etiqueta: una flecha sola es un icono sin nombre para un lector de
 * pantalla.
 */
export function BackBar({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        minHeight: NAV_BAR_HEIGHT + 8,
        paddingRight: theme.space[4],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        onPress={() => {
          haptics.tap();
          router.back();
        }}
        style={({ pressed }) => ({
          width: theme.touchTarget.min,
          height: theme.touchTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon icon={ArrowLeft} size="lg" decorative />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.base,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize['2xs'],
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing}
    </View>
  );
}

/**
 * Título grande de cabecera.
 *
 * Va dentro del contenido desplazable, no en la barra: así se va con el scroll
 * en lugar de quedarse ocupando sitio mientras se lee.
 */
export function LargeTitle({ children, subtitle }: { children: string; subtitle?: string }) {
  const theme = useTheme();

  return (
    <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[3] }}>
      <Text
        accessibilityRole="header"
        // Se deja crecer con el tamaño de texto del sistema, pero con un tope:
        // un título a escala 3× empuja el contenido fuera de la pantalla y la
        // guía pide priorizar el contenido, no los rótulos.
        maxFontSizeMultiplier={1.6}
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.displayExtrabold,
          fontSize: theme.fontSize['3xl'],
          lineHeight: theme.fontSize['3xl'] * 1.12,
          letterSpacing: -0.6,
        }}
      >
        {children}
      </Text>
      {subtitle ? (
        <Text
          style={{
            marginTop: theme.space[1],
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
            lineHeight: theme.fontSize.base * 1.45,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Estado de desplazamiento, para el efecto de borde de la barra. */
export function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useRef((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    setScrolled(event.nativeEvent.contentOffset.y > 4);
  }).current;
  return { scrolled, onScroll };
}

/** Separador de un pelo, del grosor que corresponde a la densidad de pantalla. */
export function Separator({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginLeft: inset,
      }}
    />
  );
}
