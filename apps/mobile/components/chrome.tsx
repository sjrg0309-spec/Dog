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
  /** El título pequeño solo aparece cuando el grande ya no se ve. */
  showTitle = true,
}: {
  title: string;
  trailing?: ReactNode;
  scrolled: boolean;
  showTitle?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        height: NAV_BAR_HEIGHT,
        paddingHorizontal: theme.space[4],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.background,
        borderBottomWidth: scrolled ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{
          flex: 1,
          color: theme.colors.foreground,
          fontFamily: fonts.displayBold,
          fontSize: theme.fontSize.lg,
          opacity: showTitle ? 1 : 0,
        }}
      >
        {title}
      </Text>
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
