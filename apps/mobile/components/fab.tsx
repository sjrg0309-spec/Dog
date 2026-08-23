/**
 * Botón de acción flotante.
 *
 * La especificación pide «botones de acción flotantes de gran tamaño», y aquí el
 * tamaño tiene una razón concreta: se pulsa con una mano mientras la otra lleva
 * la correa, a veces con guantes y a veces andando. 64 px, no 44.
 *
 * Tres cosas que un botón flotante suele hacer mal y aquí no:
 *
 *  1. **Tapa contenido.** Flota sobre la lista, así que el último elemento
 *     quedaría debajo. Se exporta `FAB_CLEARANCE` para que la lista reserve ese
 *     hueco al final en lugar de perder su última fila.
 *  2. **Se anuncia como «botón» y ya.** Lleva etiqueta escrita siempre: el
 *     icono solo no dice qué hace, ni a un lector de pantalla ni a alguien que
 *     abre la aplicación por primera vez.
 *  3. **No responde al dedo.** Se encoge al pulsar y da un toque háptico. Es la
 *     única confirmación que hay antes de que la pantalla cambie.
 */

import { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { Icon } from './icon';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import type { LucideIcon } from '@/lib/icons';
import { useTheme } from '@/lib/theme';
import { useReducedMotion } from '@/lib/motion';

/** Hueco que una lista debe dejar al final para no quedar tapada. */
export const FAB_CLEARANCE = 96;

export function Fab({
  label,
  icon,
  onPress,
  tone = 'accent',
  accessibilityHint,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  /**
   * `accent` es la acción de crear. `alarm` es el botón de pánico, y es el único
   * sitio donde se permite el rojo de extraviados en un control flotante: si
   * apareciera en dos, dejaría de significar emergencia.
   */
  tone?: 'accent' | 'alarm';
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const palette =
    tone === 'alarm'
      ? { bg: theme.colors.destructive, fg: theme.colors.destructiveForeground }
      : { bg: theme.colors.liveRing, fg: theme.colors.background };

  const press = (to: number) => {
    if (reduced) return;
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };

  return (
    <View
      // No captura toques fuera del propio botón: es una capa encima de una
      // lista que se sigue pudiendo desplazar por debajo.
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: theme.space[4],
        bottom: theme.space[4],
      }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          onPressIn={() => press(0.92)}
          onPressOut={() => press(1)}
          onPress={() => {
            haptics.tap();
            onPress();
          }}
          style={({ pressed }) => ({
            minHeight: theme.touchTarget.floating,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[2],
            paddingHorizontal: theme.space[5],
            borderRadius: theme.radius.full,
            backgroundColor: palette.bg,
            opacity: pressed ? 0.9 : 1,
            // Es lo único de la pantalla que flota, así que sí lleva sombra: es
            // la separación del plano, no decoración.
            shadowColor: '#000',
            shadowOpacity: theme.isDark ? 0.4 : 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          })}
        >
          <Icon icon={icon} size="xl" color={palette.fg} strokeWidth={2.25} decorative />
          <Text
            maxFontSizeMultiplier={1.4}
            style={{
              color: palette.fg,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
            }}
          >
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
