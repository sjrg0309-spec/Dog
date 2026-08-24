/**
 * Componentes base de la aplicación móvil.
 *
 * Son propios y no compartidos con la web a propósito: Tailwind y shadcn/ui no
 * corren en React Native. Lo que sí se comparte son los tokens, así que el color
 * y el espaciado de estos componentes salen del mismo sitio que los de la web.
 */

import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { Icon } from './icon';
import { Press } from './motion';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import type { LucideIcon } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>{children}</View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: theme.colors.foreground,
        fontSize: theme.fontSize['3xl'],
        fontFamily: fonts.displayExtrabold,
        letterSpacing: -0.5,
        lineHeight: theme.fontSize['3xl'] * 1.1,
      }}
    >
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: theme.colors.foreground,
        fontSize: theme.fontSize.xl,
        fontFamily: fonts.displayBold,
      }}
    >
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: muted ? theme.colors.mutedForeground : theme.colors.foreground,
        fontSize: theme.fontSize.base,
        fontFamily: fonts.body,
        lineHeight: theme.fontSize.base * 1.5,
      }}
    >
      {children}
    </Text>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.mutedForeground,
        fontSize: theme.fontSize.sm,
        fontFamily: fonts.body,
      }}
    >
      {children}
    </Text>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.mutedForeground,
        fontSize: theme.fontSize.xs,
        fontFamily: fonts.bodyBold,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderRadius: theme.radius.lg,
          padding: theme.space[5],
          gap: theme.space[3],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'live' | 'verified' | 'warning';

export function Badge({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  /**
   * Icono del estado, opcional.
   *
   * Antes esto se hacía metiendo un «✓» o un «×» dentro del texto de la
   * insignia. Además de descuadrar la línea base, obligaba al lector de pantalla
   * a leer el carácter, así que el estado se anunciaba como «por Verificado» o
   * cosas parecidas según la fuente. Como icono es decorativo y la palabra que
   * va al lado ya dice de qué estado se trata.
   */
  icon?: LucideIcon;
}) {
  const theme = useTheme();

  const palette: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.muted, fg: theme.colors.mutedForeground },
    accent: { bg: theme.colors.accent, fg: theme.colors.accentForeground },
    live: { bg: theme.colors.liveSurface, fg: theme.colors.liveForeground },
    verified: { bg: theme.colors.successSurface, fg: theme.colors.success },
    warning: { bg: theme.colors.warningSurface, fg: theme.colors.warning },
  };

  const { bg, fg } = palette[tone];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[1],
        backgroundColor: bg,
        borderRadius: theme.radius.full,
        paddingHorizontal: theme.space[2],
        paddingVertical: theme.space[0.5],
      }}
    >
      {icon ? <Icon icon={icon} size="sm" color={fg} decorative /> : null}
      <Text style={{ color: fg, fontSize: theme.fontSize.xs, fontFamily: fonts.bodyBold }}>
        {children}
      </Text>
    </View>
  );
}

export function Row({ children, gap = 2 }: { children: ReactNode; gap?: 1 | 2 | 3 }) {
  const theme = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space[gap] }}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  accessibilityHint,
  icon,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'live';
  accessibilityHint?: string;
  icon?: LucideIcon;
  /** Deshabilitado con motivo: quien lo pone debería poder explicarlo al lado. */
  disabled?: boolean;
  /**
   * En curso.
   *
   * Ocupa el mismo sitio que el estado normal a propósito: sustituir la etiqueta
   * por un indicador haría saltar el botón de tamaño y moverse todo lo de abajo
   * justo cuando el usuario acaba de tocarlo.
   */
  loading?: boolean;
}) {
  const theme = useTheme();

  const styles = {
    primary: {
      bg: theme.colors.primary,
      fg: theme.colors.primaryForeground,
      border: 'transparent',
    },
    outline: {
      bg: 'transparent',
      fg: theme.colors.foreground,
      border: theme.colors.borderStrong,
    },
    live: {
      bg: theme.colors.liveRing,
      fg: theme.colors.background,
      border: 'transparent',
    },
  } as const;

  const style = styles[variant];
  const inert = disabled || loading;

  // El foco se lleva aparte porque el estado que expone `Pressable` no lo
  // incluye en esta versión. En web —donde vive el teclado— `onFocus` sí llega.
  const [focused, setFocused] = useState(false);
  /* Y el dedo también, por el mismo motivo: lo que se encoge es el botón
     entero con su fondo, así que la escala vive fuera del `Pressable` y no
     puede leer su estado desde dentro. */
  const [down, setDown] = useState(false);

  return (
    <Press pressed={down && !inert}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      // Se anuncia el estado además de pintarlo: un botón atenuado que el lector
      // de pantalla presenta como pulsable es una trampa.
      accessibilityState={{ disabled: inert, busy: loading }}
      disabled={inert}
      onPress={onPress}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        // 44 es el suelo del área táctil, no el objetivo.
        minHeight: theme.touchTarget.min,
        flexDirection: 'row',
        gap: theme.space[2],
        /* Antes eran 20 a cada lado. En un botón ancho no se notaba; en dos
           botones que comparten una fila de 390 puntos, esos 40 puntos son la
           diferencia entre «Lo he visto» en una línea y en dos. Se vio en la
           captura de la ficha de una alerta, con cuatro acciones en rejilla. */
        paddingHorizontal: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: focused ? theme.colors.focusRing : style.border,
        backgroundColor: style.bg,
        alignItems: 'center',
        justifyContent: 'center',
        // El foco se ve, y se ve por algo más que el color del borde: en web
        // esta es la única pista que tiene quien navega con teclado.
        outlineColor: theme.colors.focusRing,
        outlineWidth: focused ? 3 : 0,
        outlineStyle: 'solid',
        outlineOffset: 2,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={style.fg} />
      ) : icon ? (
        <Icon icon={icon} size="base" color={style.fg} decorative />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          color: style.fg,
          fontSize: theme.fontSize.base,
          fontFamily: fonts.bodyBold,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
    </Press>
  );
}

/**
 * Aviso informativo.
 *
 * Se usa sobre todo para los estados vacíos, que en esta aplicación son la
 * norma al empezar en un barrio y no una excepción que haya que disimular.
 */
export function Notice({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surfaceSunken,
        borderColor: theme.colors.border,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderRadius: theme.radius.md,
        padding: theme.space[4],
        gap: theme.space[2],
      }}
    >
      {children}
    </View>
  );
}

/**
 * Control segmentado.
 *
 * Dos o tres opciones excluyentes, todas visibles a la vez. Se usa para el
 * alternador del feed y para las capas del mapa, y en los dos sitios importa lo
 * mismo: **poder ver la otra opción sin tocarla**. Un desplegable escondería que
 * existe un feed de vecindario, que es justo lo que hace distinta a esta
 * aplicación de una red social cualquiera.
 *
 * Se anuncia como una lista de pestañas y no como botones sueltos, para que un
 * lector de pantalla diga «2 de 2» y no obligue a adivinar cuántas hay.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ id: T; label: string; hint?: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surfaceSunken,
        borderRadius: theme.radius.full,
        padding: theme.space[0.5],
        gap: theme.space[0.5],
      }}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            onPress={() => {
              if (selected) return;
              haptics.tap();
              onChange(option.id);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: theme.touchTarget.min - 6,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.full,
              backgroundColor: selected ? theme.colors.surface : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={{
                color: selected ? theme.colors.foreground : theme.colors.mutedForeground,
                fontFamily: selected ? fonts.displayBold : fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Fila de datos: rótulo a la izquierda, valor a la derecha.
 *
 * Existe porque la ficha médica y la del espacio la repetían con estilos
 * ligeramente distintos cada una, y dos tablas que deberían leerse igual se
 * leían distinto.
 */
export function DataRow({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** `alert` para lo que está vencido o falta. */
  tone?: 'default' | 'alert';
}) {
  const theme = useTheme();
  const color = tone === 'alert' ? theme.colors.destructive : theme.colors.foreground;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: theme.touchTarget.min,
      }}
    >
      {icon ? <Icon icon={icon} size="base" color={theme.colors.mutedForeground} decorative /> : null}
      <Text
        style={{
          flex: 1,
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color,
          fontFamily: tone === 'alert' ? fonts.bodyBold : fonts.body,
          fontSize: theme.fontSize.sm,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
