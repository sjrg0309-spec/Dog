/**
 * El historial de paseos.
 *
 * Aquí está la frase que sostiene el producto entero, comprobada en lugar de
 * declarada: **el horario del registro es una intención; el historial es lo que
 * pasó**. Toda la aplicación cruza intenciones —«salgo de siete a ocho, de
 * lunes a viernes»— y hasta ahora nadie miraba si eso era verdad.
 *
 * La pantalla tiene cuatro piezas y ninguna es decorativa:
 *
 *  1. **El mes en cuatro cifras.** Paseos, tiempo, días distintos y con
 *     cuántos perros. Días y paseos van por separado a propósito: dos salidas
 *     el sábado y ninguna en toda la semana es un dato distinto de dos días.
 *  2. **El ritmo semanal**, que compara lo declarado con lo hecho. Es el único
 *     gráfico de la aplicación y está explicado más abajo.
 *  3. **El paseo fijo**, cuando hay patrón. Es lo que convierte tres martes en
 *     una costumbre con nombre, y la regla que lo gobierna —ningún 👎— vive en
 *     el núcleo con sus tests.
 *  4. **La lista**, que es la tabla: cada paseo con su fecha, su sitio y su
 *     duración, y cada uno abre su resumen.
 *
 * **Es privado y lo dice.** Un historial de paseos es la rutina diaria de una
 * persona: a qué hora sale de casa, qué días no está, por dónde anda. Por eso
 * no vive en el perfil, que es la pantalla que más se enseña a otros, sino
 * detrás de una puerta propia — la misma postura que ya tienen la ficha médica
 * y los pings del collar.
 */

import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import {
  companionTally,
  describeRecurring,
  recurringCandidates,
  walkMinutes,
  walkTotals,
  weekdayName,
  weeklyRhythm,
  type RhythmDay,
  type WalkRecord,
} from '@petnav/core';

import { Avatar } from '@/components/avatar';
import { BackBar, Separator } from '@/components/chrome';
import { EmptyState, LIST_GUTTER, ListGroup, ListRow, SectionHeader } from '@/components/list';
import { StatStrip } from '@/components/stats';
import { Icon } from '@/components/icon';
import { Body, Caption, Heading, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { petById } from '@/lib/data';
import { PLACES } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { ChevronRight, Footprints, Repeat } from '@/lib/icons';
import { useTheme, type Theme } from '@/lib/theme';
import { useWalks } from '@/lib/walks';
import { Pressable } from 'react-native';

import { formatMinutes } from './paseo';

/** El mes, que es el periodo en el que una rutina se ve y no se adivina. */
const WINDOW_DAYS = 30;

/**
 * Los días en el orden en que se lee una semana aquí.
 *
 * `Date#getDay` empieza en domingo y la escala del gráfico empieza en lunes,
 * que es donde empieza la semana de quien va a mirarlo. Se reordena al
 * dibujar y no en el núcleo: cambiar allí el índice rompería la
 * correspondencia con `Availability`, que usa el mismo cero.
 */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Las iniciales del eje, y el miércoles no lleva la suya.
 *
 * En castellano martes y miércoles empiezan los dos por eme, así que cortar la
 * primera letra del nombre daba **L M M J V S D**: dos columnas idénticas en
 * mitad de la semana, imposibles de distinguir sin contarlas desde el lunes.
 * Es la convención de cualquier calendario español —y salió mirando la
 * captura, no leyendo el código—.
 */
const AXIS_INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

function placeName(placeId: string | null): string {
  if (placeId === null) return 'Por la calle';
  return Object.values(PLACES).find((place) => place.id === placeId)?.name ?? 'Tu zona';
}

export default function HistoryScreen() {
  const theme = useTheme();
  const pet = useActivePet();
  const walks = useWalks(pet.id);

  const totals = walkTotals(walks, { sinceDays: WINDOW_DAYS });
  const rhythm = weeklyRhythm(walks);
  const tally = companionTally(walks);
  const patterns = recurringCandidates(walks);

  /* Lo declarado, en minutos por día de la semana. Es el otro lado de la
     comparación: sin esto el gráfico solo diría cuánto se sale, y lo que
     interesa es si eso se parece a lo que su tutor dijo que hacía. */
  const declared = declaredMinutes(pet.availability);

  if (walks.length === 0) {
    return (
      <Screen>
        <BackBar title="Vuestros paseos" subtitle={pet.name} />
        <EmptyState
          icon={Footprints}
          title="Todavía no hay ningún paseo cerrado"
          body="El historial se llena solo: cada vez que termina un check-in del radar queda su resumen. No hace falta apuntar nada."
        />
      </Screen>
    );
  }

  return (
    <Screen grouped>
      <BackBar title="Vuestros paseos" subtitle={`${pet.name} · últimos ${WINDOW_DAYS} días`} />

      <ScrollView
        contentContainerStyle={{ paddingTop: theme.space[4], paddingBottom: theme.space[8] }}
      >
        {/* Las cifras, en su tarjeta. Sueltas sobre el fondo eran cuatro
            números flotando; dentro del bloque son un resumen, que es lo que
            son. */}
        <ListGroup leading="none">
          <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
            {/* Dos por fila y no cuatro sueltas. Con `flexWrap` y anchos
                libres, «7 h 40 min» empujaba la cuarta cifra a una segunda
                fila ella sola, y una cifra huérfana debajo de tres se lee como
                si fuera de otra cosa. Se vio en la captura. */}
            <StatStrip
              stats={[
                { value: String(totals.walks), label: 'paseos' },
                { value: formatMinutes(totals.minutes), label: 'fuera' },
                { value: String(totals.days), label: 'días distintos' },
                { value: String(totals.companions), label: 'perros' },
              ]}
            />
            {totals.overruns > 0 ? (
              <Caption>
                {totals.overruns === 1
                  ? 'Uno se pasó del rato propuesto.'
                  : `${totals.overruns} se pasaron del rato propuesto.`}{' '}
                Se apunta, no se regaña: sirve para la próxima vez.
              </Caption>
            ) : null}
          </View>
        </ListGroup>

        <View style={{ height: theme.space[5] }} />

        <ListGroup leading="none">
          <View style={{ padding: theme.space[4] }}>
            <Rhythm days={rhythm} declared={declared} weeks={weeksCovered(walks)} />
          </View>
        </ListGroup>

        <View
          style={{
            paddingHorizontal: LIST_GUTTER,
            gap: theme.space[5],
            paddingTop: theme.space[5],
          }}
        >
          {patterns.length > 0 ? (
            <View style={{ gap: theme.space[3] }}>
              <Heading>Esto ya es una costumbre</Heading>
              {patterns.map((pattern) => {
                const companion = petById(pattern.petId);
                return (
                  <View
                    key={`${pattern.petId}-${pattern.weekday}`}
                    style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[3] }}
                  >
                    <Icon icon={Repeat} size="base" color={theme.colors.primary} decorative />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Body>
                        Coincidís con {companion?.name ?? 'otro perro'} {describeRecurring(pattern)}
                        , {pattern.weeks} semanas seguidas.
                      </Body>
                      <Caption>
                        {pattern.placeId === null
                          ? 'Por la calle, sin parque fijo.'
                          : `En ${placeName(pattern.placeId)}.`}{' '}
                        Hacerlo fijo es proponerlo una vez en vez de cruzaros y saludaros.
                      </Caption>
                    </View>
                  </View>
                );
              })}
              <Caption>
                Solo aparece con tres semanas seguidas y sin ningún «no fue bien». Tres paseos el
                mismo sábado no son una costumbre, y proponer un paseo fijo con un perro que
                marcaste como mal encuentro sería insistir en lo único que dijiste que no.
              </Caption>
            </View>
          ) : null}
        </View>

        {tally.length > 0 ? (
          <>
            <SectionHeader title="Con quién salís" />
            <ListGroup leading="avatar">
              {tally.map((entry) => {
                const companion = petById(entry.petId);
                return (
                  <ListRow
                    key={entry.petId}
                    leading={
                      <Avatar id={entry.petId} name={companion?.name ?? 'Perro'} size={44} />
                    }
                    title={companion?.name ?? 'Otro perro'}
                    subtitle={`${entry.walks} ${entry.walks === 1 ? 'paseo' : 'paseos'} en ${
                      entry.weeks
                    } ${entry.weeks === 1 ? 'semana' : 'semanas'}${
                      entry.negatives > 0 ? ' · uno no fue bien' : ''
                    }`}
                  />
                );
              })}
            </ListGroup>
          </>
        ) : null}

        <SectionHeader title="Todos los paseos" />

        {/* La lista es la tabla del gráfico: los mismos datos, uno a uno y con
            sus cifras escritas. Un gráfico sin su tabla deja fuera a quien lo
            necesita leído. */}
        <ListGroup leading="none">
          {walks.map((walk) => (
            <WalkRow key={walk.id} walk={walk} />
          ))}
        </ListGroup>

        <View style={{ padding: theme.space[5] }}>
          <Caption>
            Esto solo lo ves tú. Un historial de paseos dice a qué hora sales de casa, qué días no
            estás y por dónde andas, así que va con las mismas reglas que la ficha médica: no
            aparece en tu perfil ni en ninguna vista pública.
          </Caption>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Minutos declarados por día de la semana, a partir del horario del registro.
 *
 * Cruza medianoche igual que `toWeeklyIntervals`, y se resuelve igual: si el
 * final no es mayor que el comienzo, la franja sigue en el día siguiente y se
 * le suman las veinticuatro horas. Los minutos se apuntan enteros en el día en
 * que **empieza** el paseo, que es el que su tutor tiene en la cabeza cuando
 * dice «los martes».
 */
function declaredMinutes(
  availability: readonly { weekday: number; startTime: string; endTime: string }[],
): number[] {
  const minutes = Array.from({ length: 7 }, () => 0);

  for (const window of availability) {
    const [startHour = 0, startMinute = 0] = window.startTime.split(':').map(Number);
    const [endHour = 0, endMinute = 0] = window.endTime.split(':').map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const span = end > start ? end - start : end + 24 * 60 - start;
    const day = minutes[window.weekday];
    if (day === undefined) continue;
    minutes[window.weekday] = day + span;
  }

  return minutes;
}

/**
 * El ritmo semanal: lo declarado contra lo que pasó.
 *
 * **Por qué barras y no una línea.** Los días de la semana son categorías, no
 * un continuo: no hay tendencia entre el domingo y el lunes, y una línea la
 * dibujaría igual. Lo que se pregunta es magnitud por categoría, y eso son
 * barras.
 *
 * **Por qué dos marcas.** La barra maciza es lo que se salió de media cada
 * semana; la hueca de detrás es lo que su tutor declaró al registrarse. Puestas
 * una sobre otra contestan de un vistazo la única pregunta interesante del
 * historial —si la rutina declarada existe— y comparten unidad y eje, que es lo
 * que hace legal superponerlas.
 *
 * **Cómo se distinguen sin depender del color.** Una es maciza y la otra
 * hueca; hay leyenda, que con dos series no es opcional; y cada barra lleva su
 * lectura completa en la etiqueta accesible, que es lo que en una pantalla táctil
 * hace el trabajo del cursor encima. Los colores además están medidos: la banda
 * llega a 3:1 contra su superficie y se separa del primario en los dos temas,
 * con un test que lo comprueba.
 *
 * **Qué se etiqueta.** Solo el día más alto. Un número sobre cada barra
 * convierte el gráfico en una tabla mal maquetada, y la tabla de verdad está
 * justo debajo.
 */
function Rhythm({
  days,
  declared,
  weeks,
}: {
  days: readonly RhythmDay[];
  declared: readonly number[];
  /** Semanas que cubre el historial. Es el divisor, y sale de las fechas. */
  weeks: number;
}) {
  const theme = useTheme();

  /* La media por semana y no el total: con cuatro semanas de historial, un
     total haría parecer que se sale cuatro veces más de lo que se sale, y
     encima no habría forma de compararlo con lo declarado, que es semanal por
     definición. */
  const actual = days.map((day) => Math.round(day.minutes / weeks));

  const ceiling = Math.max(...actual, ...declared, 1);
  const tallest = actual.indexOf(Math.max(...actual));

  return (
    <View style={{ gap: theme.space[3] }}>
      <Heading>Vuestra semana</Heading>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 120 }}>
        {DISPLAY_ORDER.map((weekday) => (
          <Bar
            key={weekday}
            weekday={weekday}
            actual={actual[weekday] ?? 0}
            declared={declared[weekday] ?? 0}
            ceiling={ceiling}
            label={weekday === tallest}
            theme={theme}
          />
        ))}
      </View>

      {/* Con dos marcas la leyenda no es opcional: sin ella, cuál es cuál solo
          se puede adivinar. */}
      <View style={{ flexDirection: 'row', gap: theme.space[4] }}>
        <LegendKey filled label="lo que salís, de media por semana" />
        <LegendKey filled={false} label="lo que declaraste" />
      </View>
    </View>
  );
}

/**
 * Cuántas semanas cubre el historial, del paseo más viejo a hoy.
 *
 * Sale de las fechas y no de una constante, porque es el divisor de la media
 * que se dibuja: con un número fijo, alguien con dos semanas de historial
 * vería la mitad de lo que sale de verdad, y el gráfico estaría mintiendo con
 * aritmética en vez de con colores. Mínimo una, para no dividir entre cero el
 * primer día.
 */
function weeksCovered(walks: readonly WalkRecord[]): number {
  const times = walks.map((walk) => Date.parse(walk.startedAt)).filter(Number.isFinite);
  if (times.length === 0) return 1;
  const span = Date.now() - Math.min(...times);
  return Math.max(1, Math.ceil(span / (7 * 86_400_000)));
}

function Bar({
  weekday,
  actual,
  declared,
  ceiling,
  label,
  theme,
}: {
  weekday: number;
  actual: number;
  declared: number;
  ceiling: number;
  label: boolean;
  theme: Theme;
}) {
  const name = weekdayName(weekday);
  const height = (value: number) => Math.max(value > 0 ? 3 : 0, (value / ceiling) * 92);

  return (
    <View
      accessible
      accessibilityLabel={
        actual === 0 && declared === 0
          ? `${name}: no salís`
          : `${name}: ${actual} minutos de media, ${declared} declarados`
      }
      style={{ flex: 1, alignItems: 'center', gap: theme.space[1] }}
    >
      {/* El renglón del rótulo se reserva **en todas las columnas**, lleven
          número o no. En la primera versión solo lo tenía la más alta, así que
          su zona de dibujo era más corta que la de las demás y la barra
          mayor salía encogida: el gráfico se distorsionaba a sí mismo, y solo
          se veía renderizándolo. */}
      <View style={{ height: 16, justifyContent: 'flex-end' }}>
        {label && actual > 0 ? (
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize['2xs'],
              fontVariant: ['tabular-nums'],
            }}
          >
            {actual}
          </Text>
        ) : null}
      </View>

      <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
        {/* La banda de lo declarado, hueca y detrás. Cuando no hay barra
            encima, ese hueco es el dato: el día que dijiste que sales y no
            saliste. Por eso tiene que verse, y por eso se midió. */}
        {declared > 0 ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: height(declared),
              borderWidth: 1,
              borderColor: theme.colors.chartTrack,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
            }}
          />
        ) : null}

        {actual > 0 ? (
          <View
            style={{
              height: height(actual),
              backgroundColor: theme.colors.primary,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
            }}
          />
        ) : null}
      </View>

      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize['2xs'],
        }}
      >
        {AXIS_INITIALS[weekday]}
      </Text>
    </View>
  );
}

function LegendKey({ filled, label }: { filled: boolean; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2], flex: 1 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 3,
          borderWidth: 1,
          borderColor: filled ? theme.colors.primary : theme.colors.chartTrack,
          backgroundColor: filled ? theme.colors.primary : 'transparent',
        }}
      />
      <Text
        style={{
          flex: 1,
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize['2xs'],
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function WalkRow({ walk }: { walk: WalkRecord }) {
  const theme = useTheme();
  const router = useRouter();
  const date = new Date(walk.startedAt);
  const minutes = walkMinutes(walk);
  const names = walk.companions
    .map((companion) => petById(companion.petId)?.name)
    .filter((name): name is string => name !== undefined);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Paseo del ${weekdayName(date.getDay())} ${date.getDate()}, ${minutes} minutos en ${placeName(walk.placeId)}`}
      onPress={() => {
        haptics.tap();
        router.push(`/paseo?id=${walk.id}`);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: theme.touchTarget.comfortable,
        paddingHorizontal: theme.space[3] + 2,
        paddingVertical: theme.space[3],
        backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
      })}
    >
      <View style={{ width: 44, alignItems: 'center' }}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.lg,
            fontVariant: ['tabular-nums'],
          }}
        >
          {date.getDate()}
        </Text>
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize['2xs'],
          }}
        >
          {weekdayName(date.getDay()).slice(0, 3)}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.sm,
          }}
        >
          {formatMinutes(minutes)} · {placeName(walk.placeId)}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize['2xs'],
          }}
        >
          {names.length === 0 ? 'Vosotros dos solos' : `Con ${names.join(', ')}`}
        </Text>
      </View>

      <Icon
        icon={ChevronRight}
        size="base"
        strokeWidth={2.5}
        color={theme.colors.mutedForeground}
        decorative
      />
    </Pressable>
  );
}
