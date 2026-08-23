/**
 * El control de condiciones.
 *
 * Existe porque la app no puede consultar el tiempo (ver `lib/conditions.ts`) y
 * porque esconder ese hecho sería peor que pedirlo: un número inventado al lado
 * de un veredicto de "hoy no salgas" es exactamente la clase de dato que hace
 * que alguien deje de creerse el resto.
 *
 * Los saltos de cinco grados no son pereza: la diferencia entre 24 y 25 grados
 * no cambia ninguna decisión, y un control fino invitaría a ajustar hasta que
 * la aplicación dijera lo que uno quiere oír.
 */

import { Pressable, Text, View } from 'react-native';

import type { Surface } from '@coincide/core';

import { Caption, Row } from './ui';
import {
  CONDITIONS_SOURCE_NOTE,
  SURFACE_LABEL,
  setSurface,
  setTemperature,
  useDeclaredConditions,
} from '@/lib/conditions';
import { fonts } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

const TEMPERATURES = [5, 12, 18, 22, 26, 30, 34] as const;
const SURFACES: Surface[] = ['grass', 'asphalt', 'indoor'];

export function ConditionsControl() {
  const theme = useTheme();
  const { temperatureC, surface } = useDeclaredConditions();

  return (
    <View style={{ gap: theme.space[2] }}>
      <Caption>Hoy, donde vais a estar</Caption>

      <Row gap={1}>
        {TEMPERATURES.map((value) => (
          <Chip
            key={value}
            label={`${value}°`}
            hint={`Fijar la temperatura en ${value} grados`}
            active={value === temperatureC}
            onPress={() => setTemperature(value)}
          />
        ))}
      </Row>

      <Row gap={1}>
        {SURFACES.map((value) => (
          <Chip
            key={value}
            label={SURFACE_LABEL[value]}
            hint={`Fijar la superficie en ${SURFACE_LABEL[value].toLowerCase()}`}
            active={value === surface}
            onPress={() => setSurface(value)}
          />
        ))}
      </Row>

      <Caption>{CONDITIONS_SOURCE_NOTE}</Caption>
    </View>
  );
}

function Chip({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityHint={hint}
      onPress={onPress}
      style={{
        paddingVertical: theme.space[2],
        paddingHorizontal: theme.space[3],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: active ? theme.colors.primary : theme.colors.border,
        backgroundColor: active ? theme.colors.primary : 'transparent',
      }}
    >
      <Text
        style={{
          color: active ? theme.colors.primaryForeground : theme.colors.mutedForeground,
          fontFamily: active ? fonts.bodyBold : fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
