/**
 * Componentes base de la aplicación móvil.
 *
 * Son propios y no compartidos con la web a propósito: Tailwind y shadcn/ui no
 * corren en React Native. Lo que sí se comparte son los tokens, así que el color
 * y el espaciado de estos componentes salen del mismo sitio que los de la web.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fonts } from '@/lib/fonts';
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

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
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
        backgroundColor: bg,
        borderRadius: theme.radius.full,
        paddingHorizontal: theme.space[2],
        paddingVertical: theme.space[0.5],
      }}
    >
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
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'live';
  accessibilityHint?: string;
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => ({
        // 44 es el suelo del área táctil, no el objetivo.
        minHeight: theme.touchTarget.min,
        paddingHorizontal: theme.space[5],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: style.border,
        backgroundColor: style.bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: style.fg, fontSize: theme.fontSize.base, fontFamily: fonts.bodyBold }}>
        {label}
      </Text>
    </Pressable>
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
