/**
 * El resumen de un paseo.
 *
 * Es la pantalla que faltaba al final del bucle: hasta ahora el check-in se
 * apagaba y no pasaba nada. Se abre sola al cerrar un paseo y también sirve
 * para volver a mirar uno del historial, que son el mismo contenido en dos
 * momentos distintos.
 *
 * ## Qué enseña, y qué no
 *
 * **No hay kilómetros ni un trazado sobre el mapa.** Es lo primero que se
 * espera de una pantalla así y aquí sería inventárselo: la aplicación registra
 * un check-in con su hora de entrada y de salida, no una traza de GPS. Y
 * aunque la registrara, un recorrido guardado es exactamente el rastro que la
 * regla de privacidad de este producto existe para no tener —el radar ancla al
 * lugar y nunca a la persona—. Así que se cuenta el tiempo y el sitio, que es
 * lo que de verdad se sabe, y se dice por qué no hay más.
 *
 * **Hay un número que habla del animal**: los minutos que se estuvo fuera
 * frente a los que la capa de bienestar propuso al salir. Es el único dato del
 * resumen que no es sobre el plan de su tutor. Cuando se pasó, se dice, con el
 * motivo que ya se había dado —«a 29 grados sobre asfalto»— y sin regañar: la
 * información sirve para la próxima vez, y un reproche se aprende a saltar.
 *
 * **La pregunta es una sola y va por pareja.** «Qué tal con Toby», no «qué tal
 * el paseo». La afinidad se calcula par a par, así que una nota global
 * ensuciaría a los tres perros de una salida cuando el problema fue con uno.
 * Y la respuesta **entra en el algoritmo**: un 👎 descuenta quince puntos en
 * la afinidad de ese par y puede sacarlo de la banda en la que se propone. La
 * pantalla lo dice, porque pedir una valoración sin explicar qué hace con ella
 * es pedirla para nada.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { summarizeWalk, weekdayName, type WalkOutcome } from '@petnav/core';

import { Avatar } from '@/components/avatar';
import { BackBar } from '@/components/chrome';
import { EmptyState, LIST_GUTTER, ListGroup } from '@/components/list';
import { Icon } from '@/components/icon';
import { Body, Button, Caption, Heading, Notice, Screen } from '@/components/ui';
import { PLACES } from '@/lib/demo-data';
import { petById } from '@/lib/data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Clock, Footprints, MapPin, Thermometer, ThumbsDown, ThumbsUp } from '@/lib/icons';
import { useTheme } from '@/lib/theme';
import { setWalkOutcome, useWalk } from '@/lib/walks';

const SURFACE_LABEL: Record<string, string> = {
  grass: 'hierba',
  earth: 'tierra',
  asphalt: 'asfalto',
  indoor: 'interior',
  unknown: 'sin especificar',
};

function placeName(placeId: string | null): string {
  if (placeId === null) return 'Por la calle';
  return Object.values(PLACES).find((place) => place.id === placeId)?.name ?? 'Tu zona';
}

/** «45 min» o «1 h 15 min». Nunca «75 min», que hay que traducir mentalmente. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (sameDay) return `Hoy a las ${time}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (wasYesterday) return `Ayer a las ${time}`;

  return `El ${weekdayName(date.getDay())} ${date.getDate()} a las ${time}`;
}

export default function WalkSummaryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const walk = useWalk(id);

  if (!walk) {
    return (
      <Screen>
        <BackBar title="Paseo" />
        <EmptyState
          icon={Footprints}
          title="Este paseo ya no está"
          body="El historial vive en memoria mientras la aplicación está abierta. Llevarlo a la base es una tabla con las mismas reglas que los pings del collar: ilegible para quien no sea su tutor."
          action={{ label: 'Volver', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const summary = summarizeWalk(walk);
  const overran = summary.overrunMinutes > 0;

  return (
    <Screen grouped>
      <BackBar title="Cómo fue" subtitle={dayLabel(walk.startedAt)} />

      <ScrollView contentContainerStyle={{ paddingVertical: theme.space[5], gap: theme.space[5] }}>
        {/* El titular es el tiempo, porque es lo que la aplicación sabe de
            verdad. Un kilometraje aquí sería un número con pinta de dato. */}
        <ListGroup leading="none">
          <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
            <View style={{ gap: theme.space[1] }}>
              <Text
                accessibilityRole="header"
                accessibilityLabel={`Estuvisteis fuera ${formatMinutes(summary.minutes)}`}
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.displayBold,
                  fontSize: theme.fontSize['4xl'],
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatMinutes(summary.minutes)}
              </Text>
              <Caption>fuera de casa</Caption>
            </View>

            <View style={{ gap: theme.space[3] }}>
              <Fact icon={MapPin} label="Dónde">
                {placeName(walk.placeId)}
              </Fact>
              <Fact icon={Clock} label="Rato propuesto">
                {formatMinutes(summary.recommendedMinutes)}
              </Fact>
              <Fact icon={Thermometer} label="Condiciones">
                {walk.temperatureC === null
                  ? `Sin dato de temperatura · ${SURFACE_LABEL[walk.surface] ?? walk.surface}`
                  : `${walk.temperatureC} °C sobre ${SURFACE_LABEL[walk.surface] ?? walk.surface}`}
              </Fact>
            </View>
          </View>
        </ListGroup>

        <View style={{ paddingHorizontal: LIST_GUTTER, gap: theme.space[5] }}>
          {/* Lo único de esta pantalla que habla del animal y no del plan. */}
          {overran ? (
            <Notice>
              <Body>
                Fueron {formatMinutes(summary.overrunMinutes)} más de lo que se propuso al salir.
              </Body>
              <Caption>
                {walk.welfareLevel === 'ok'
                  ? 'No pasa nada por una vez; se apunta para la próxima.'
                  : `El rato corto venía de las condiciones de ese día: ${
                      walk.temperatureC ?? '—'
                    } °C sobre ${SURFACE_LABEL[walk.surface] ?? walk.surface}.`}
              </Caption>
            </Notice>
          ) : null}

          {/* No se registra recorrido, y se dice. Callarlo dejaría al usuario
            buscando un mapa que no existe y pensando que falla algo. */}
          <Caption>
            No se guarda el recorrido ni los kilómetros: la aplicación registra cuándo empezó y
            cuándo acabó, no por dónde fuisteis. Un rastro guardado es justo lo que la regla del
            radar —anclar al lugar y nunca a la persona— existe para no tener.
          </Caption>

          {walk.companions.length > 0 ? (
            <View style={{ gap: theme.space[3] }}>
              <Heading>Con quién</Heading>
              <Caption>
                Se pregunta por cada uno por separado. La compatibilidad se calcula pareja a pareja,
                así que una nota del paseo entero ensuciaría a los que no tuvieron nada que ver.
              </Caption>

              {walk.companions.map((companion) => (
                <CompanionRow
                  key={companion.petId}
                  walkId={walk.id}
                  petId={companion.petId}
                  outcome={companion.outcome}
                />
              ))}

              <Caption>
                Un 👎 baja quince puntos de afinidad con ese perro y puede sacarlo de las
                propuestas. Nadie recibe aviso de lo que marques.
              </Caption>
            </View>
          ) : (
            <View style={{ gap: theme.space[1] }}>
              <Body>Este paseo fue solo vuestro.</Body>
              <Caption>
                No coincidisteis con nadie del radar. Es lo normal fuera de las horas punta, y por
                eso la aplicación cruza horarios en vez de depender de quién esté conectado.
              </Caption>
            </View>
          )}

          <Button
            label="Ver el historial"
            variant="outline"
            onPress={() => router.replace('/historial')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: Parameters<typeof Icon>[0]['icon'];
  label: string;
  children: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
      <Icon icon={icon} size="base" color={theme.colors.mutedForeground} decorative />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize['2xs'],
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.sm,
          }}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

function CompanionRow({
  walkId,
  petId,
  outcome,
}: {
  walkId: string;
  petId: string;
  outcome: WalkOutcome | null;
}) {
  const theme = useTheme();
  const pet = petById(petId);
  const name = pet?.name ?? 'Otro perro';

  return (
    <View style={{ gap: theme.space[3], paddingVertical: theme.space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
        <Avatar id={petId} name={name} size={44} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.sm,
            }}
          >
            {name}
          </Text>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize['2xs'],
            }}
          >
            {outcome === null
              ? '¿Qué tal fue?'
              : outcome === 'good'
                ? 'Marcaste que fue bien'
                : 'Marcaste que no fue bien'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        <OutcomeButton
          walkId={walkId}
          petId={petId}
          value="good"
          current={outcome}
          label={`Fue bien con ${name}`}
        />
        <OutcomeButton
          walkId={walkId}
          petId={petId}
          value="bad"
          current={outcome}
          label={`No fue bien con ${name}`}
        />
      </View>
    </View>
  );
}

/**
 * Los dos botones de la valoración.
 *
 * Se escribe aquí en lugar de usar el `Button` común porque necesita algo que
 * aquel no da y que no debe darse por color: **el estado de selección**. El 👍
 * y el 👎 son verde y rojo, que es exactamente el par que no distingue una de
 * cada doce personas, así que el elegido se marca por tres vías a la vez —el
 * relleno, el borde grueso y el `accessibilityState`— y ninguna de las tres es
 * prescindible.
 */
function OutcomeButton({
  walkId,
  petId,
  value,
  current,
  label,
}: {
  walkId: string;
  petId: string;
  value: WalkOutcome;
  current: WalkOutcome | null;
  label: string;
}) {
  const theme = useTheme();
  const selected = current === value;
  const good = value === 'good';
  const tone = good ? theme.colors.primary : theme.colors.destructive;
  const ink = good ? theme.colors.primaryForeground : theme.colors.destructiveForeground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.tap();
        setWalkOutcome(walkId, petId, value);
      }}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space[2],
        minHeight: theme.touchTarget.min,
        paddingHorizontal: theme.space[3],
        borderRadius: theme.radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? tone : theme.colors.borderStrong,
        backgroundColor: selected ? tone : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon
        icon={good ? ThumbsUp : ThumbsDown}
        size="base"
        color={selected ? ink : theme.colors.mutedForeground}
        decorative
      />
      <Text
        numberOfLines={1}
        style={{
          color: selected ? ink : theme.colors.foreground,
          fontFamily: selected ? fonts.bodyBold : fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        {good ? 'Bien' : 'No fue bien'}
      </Text>
    </Pressable>
  );
}
