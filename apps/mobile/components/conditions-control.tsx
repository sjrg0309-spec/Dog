/**
 * El tiempo que hace, y quién lo dice.
 *
 * Antes esto pedía la temperatura porque no había forma de saberla. Ahora la
 * trae `@coincide/weather` de Open-Meteo y este componente hace algo distinto:
 * **enseña el dato y de dónde sale**.
 *
 * Esa segunda mitad no es cortesía. Un número que aparece solo al lado de un
 * veredicto de «hoy no salgas» invita a la pregunta de dónde ha salido, y si la
 * pantalla no la contesta, la respuesta que se imagina el usuario es peor que
 * la real. Así que se dice el servicio, la hora de la medida y —cuando la ha
 * puesto él— que la ha puesto él.
 *
 * Los saltos de cinco grados del control manual siguen ahí y siguen siendo
 * deliberados: la diferencia entre 24 y 25 no cambia ninguna decisión, y un
 * control fino invitaría a ajustar hasta que la aplicación dijera lo que uno
 * quiere oír.
 */

import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { Surface } from '@coincide/core';
import { GRID_PRECISION_M, describeSky, estimateGroundC, judgeGround } from '@coincide/weather';

import { Caption, Row } from './ui';
import {
  MANUAL_NOTE,
  SURFACE_LABEL,
  UNKNOWN_NOTE,
  WEATHER_FAILURE_MESSAGE,
  refreshWeather,
  setSurface,
  setTemperature,
  useWeatherState,
} from '@/lib/conditions';
import { RefreshCw, ThermometerSun, TriangleAlert } from '@/lib/icons';
import { fonts } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

const TEMPERATURES = [5, 12, 18, 22, 26, 30, 34] as const;
const SURFACES: Surface[] = ['grass', 'asphalt', 'indoor'];

/* `toLocaleString` y no una división a pelo: en español el decimal es una coma,
   y «~1.1 km» dentro de un párrafo en castellano se lee como un error. */
const kilometres = (metres: number): string =>
  (metres / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 });

const clock = (at: Date): string =>
  at.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export function ConditionsControl() {
  const theme = useTheme();
  const { weather, surface } = useWeatherState();

  const manual = weather.kind === 'manual';
  const live = weather.kind === 'live' ? weather.observation : null;

  const temperatureC =
    live?.temperatureC ?? (weather.kind === 'manual' ? weather.temperatureC : null);

  const groundC =
    temperatureC === null ? null : estimateGroundC(temperatureC, live?.solarRadiation ?? null, surface);
  const groundVerdict = judgeGround(groundC);

  return (
    <View style={{ gap: theme.space[2] }}>
      <Caption>Hoy, donde vais a estar</Caption>

      {weather.kind === 'loading' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <ActivityIndicator color={theme.colors.mutedForeground} />
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            Consultando el tiempo…
          </Text>
        </View>
      ) : null}

      {temperatureC !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[2] }}>
          <ThermometerSun size={20} color={theme.colors.foreground} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.xl,
              }}
            >
              {Math.round(temperatureC)} °C
              {live && Math.abs(live.apparentTemperatureC - live.temperatureC) >= 2
                ? `  ·  sensación ${Math.round(live.apparentTemperatureC)} °C`
                : ''}
            </Text>
            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              {live
                ? `${describeSky(live.weatherCode).label} · Open-Meteo, medido a las ${clock(live.observedAt)}`
                : 'Temperatura puesta por ti'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a consultar el tiempo"
            onPress={() => void refreshWeather(true)}
            hitSlop={8}
            style={{
              minHeight: theme.touchTarget.min,
              minWidth: theme.touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={18} color={theme.colors.mutedForeground} />
          </Pressable>
        </View>
      ) : null}

      {/* El suelo, que es lo que se pisa. Solo aparece cuando se sabe. */}
      {groundVerdict !== null && groundVerdict !== 'safe' && groundC !== null ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: theme.space[2],
            padding: theme.space[3],
            borderRadius: theme.radius.lg,
            backgroundColor:
              groundVerdict === 'burns' ? theme.colors.destructive : theme.colors.muted,
          }}
        >
          <TriangleAlert
            size={18}
            color={
              groundVerdict === 'burns'
                ? theme.colors.destructiveForeground
                : theme.colors.foreground
            }
          />
          <Text
            style={{
              flex: 1,
              color:
                groundVerdict === 'burns'
                  ? theme.colors.destructiveForeground
                  : theme.colors.foreground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            {groundVerdict === 'burns'
              ? `Con este sol el suelo ronda los ${Math.round(groundC)} °C. Va descalzo: eso quema.`
              : `Con este sol el suelo ronda los ${Math.round(groundC)} °C. Para un rato corto pasa; para correr, no.`}
          </Text>
        </View>
      ) : null}

      {weather.kind === 'unknown' ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[2] }}>
          <TriangleAlert size={18} color={theme.colors.foreground} />
          <Text
            style={{
              flex: 1,
              color: theme.colors.foreground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            {WEATHER_FAILURE_MESSAGE[weather.failure]} {UNKNOWN_NOTE}
          </Text>
        </View>
      ) : null}

      <Row gap={1}>
        {TEMPERATURES.map((value) => (
          <Chip
            key={value}
            label={`${value}°`}
            hint={`Fijar la temperatura en ${value} grados`}
            active={manual && value === temperatureC}
            onPress={() => setTemperature(value)}
          />
        ))}
      </Row>

      {manual ? (
        <View style={{ gap: theme.space[1] }}>
          <Caption>{MANUAL_NOTE}</Caption>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a la temperatura automática"
            onPress={() => void refreshWeather(true)}
            style={{
              alignSelf: 'flex-start',
              minHeight: theme.touchTarget.min,
              justifyContent: 'center',
              paddingHorizontal: theme.space[4],
              borderRadius: theme.radius.full,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.sm,
              }}
            >
              Automático
            </Text>
          </Pressable>
        </View>
      ) : null}

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

      <Caption>
        La superficie la eliges tú: ninguna previsión sabe si vais a pisar hierba o asfalto. Para
        preguntar el tiempo se manda tu posición redondeada a ~{kilometres(GRID_PRECISION_M)} km, que
        es la resolución del modelo: más precisión no mejora el dato, solo lo cuenta.
      </Caption>
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
        // 44 de alto por relleno, no por el tamaño del texto: era 34 y se
        // quedaba por debajo del mínimo táctil de la plataforma.
        minHeight: theme.touchTarget.min,
        justifyContent: 'center',
        paddingVertical: theme.space[2],
        paddingHorizontal: theme.space[4],
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
