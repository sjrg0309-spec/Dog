import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { groupAffinity, groupWelfare } from '@petnav/core';

import { Avatar } from '@/components/avatar';
import { LargeTitle, NAV_BAR_HEIGHT, NavBar } from '@/components/chrome';
import { ConditionsControl } from '@/components/conditions-control';
import { Icon } from '@/components/icon';
import {
  EmptyState,
  FootNote,
  LIST_GUTTER,
  ListGroup,
  PillButton,
  SectionHeader,
} from '@/components/list';
import { Appear } from '@/components/motion';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { WelfareNotice } from '@/components/welfare-notice';
import { Badge, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { useConditionsBuilder } from '@/lib/conditions';
import { allPlaydates, petById, petHasMeetups, playdatesFor, speciesOf } from '@/lib/data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { CalendarDays, CalendarPlus, MapPin, PawPrint, Users } from '@/lib/icons';
import { SIZE_LABEL, energyLabel, speciesName } from '@/lib/labels';
import { useScrollDriver } from '@/lib/scroll';
import { useTheme } from '@/lib/theme';

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormatter = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

/**
 * Quedadas.
 *
 * Dos cosas gobiernan esta pantalla:
 *
 *  1. Una quedada es **de una sola especie**. No es una restricción de la
 *     interfaz que se pueda relajar: un hurón fue criado para cazar conejos, y
 *     ninguna puntuación de carácter debería poder ponerlos en el mismo sitio.
 *     La base de datos lo impide con un disparador; aquí solo se refleja.
 *  2. La **afinidad del grupo antes de unirse**, calculada por el mínimo par a
 *     par y no por el promedio. Un grupo vale lo que vale su peor pareja: un
 *     promedio del 85 % puede esconder un par al 30 % que arruina el encuentro.
 *
 * **Y una tercera que es de forma, no de producto.** Cada quedada era una
 * tarjeta con borde que apilaba ocho párrafos —tres líneas de datos, la
 * descripción, un recuadro gris dentro del recuadro con la afinidad, dos filas
 * de insignias y un botón a lo ancho—, así que en una pantalla cabía una y
 * media. Ahora es una fila del ancho de la pantalla con la fecha a la
 * izquierda, las caras de quien va y la acción en una pastilla: caben cuatro, y
 * el dato que decide —la afinidad con el grupo— se lee sin abrir nada.
 */
export default function PlaydatesScreen() {
  const theme = useTheme();
  /* El desplazamiento en crudo, en el hilo de la interfaz: con él el rótulo
   pequeño de la barra **se cruza** con el título grande —uno se va mientras el
   otro llega— en vez de encenderse de golpe, y de paso la barra de pestañas se
   condensa al bajar. Es el gesto de iOS, y lo que lo hace legible es justo que
   en ningún momento hay dos títulos a plena tinta ni ninguno. */
  const { scrollY, onScroll } = useScrollDriver();
  const pet = useActivePet();
  const species = speciesOf(pet);
  const social = petHasMeetups(pet);
  const mine = playdatesFor(pet.speciesId);
  const otherSpecies = allPlaydates().length - mine.length;
  const build = useConditionsBuilder();

  if (!social) {
    return (
      <Screen grouped>
        <NavBar
          title="Quedadas"
          scrolled={false}
          scrollY={scrollY}
          revealAt={52}
          floating
          trailing={<PetSwitcherCompact />}
        />
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: NAV_BAR_HEIGHT, paddingBottom: theme.space[16] }}
        >
          <EmptyState
            icon={PawPrint}
            title={`No hay quedadas para ${pet.name}`}
            body={species?.socialNote}
          />
          <FootNote>
            No es una limitación de la aplicación, es de la especie. Ofrecer un encuentro que
            termina en estrés o en una pelea sería peor producto que decir esto.
          </FootNote>
        </Animated.ScrollView>
      </Screen>
    );
  }

  return (
    <Screen grouped>
      <NavBar
        title="Quedadas"
        scrolled={false}
        scrollY={scrollY}
        revealAt={52}
        floating
        trailing={
          <>
            <PetSwitcherCompact />
            {/* Crear va en la cabecera, como publicar en el feed, y como allí
                es **un icono**: era un botón a lo ancho encima de la lista, y
                ahí ocupaba el sitio de la primera quedada —lo primero que se
                veía al abrir era una invitación a organizar en vez de lo que ya
                hay organizado—. En pastilla negra tampoco valía: pesaba más que
                el propio título de la pantalla. */}
            <HeaderIcon icon={CalendarPlus} label="Crear una quedada" />
          </>
        }
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: NAV_BAR_HEIGHT, paddingBottom: theme.space[16] }}
      >
        <LargeTitle
          scrollY={scrollY}
          subtitle={`Cómo encaja ${pet.name} con el grupo, antes de apuntarse.`}
        >
          {`Quedadas de ${speciesName(pet.speciesId).toLowerCase()}`}
        </LargeTitle>

        {/* El tiempo, en su propia tarjeta. Es un control, no contenido:
            separarlo en una tarjeta es lo que impide que se lea como la
            primera quedada de la lista. */}
        <ListGroup>
          <View style={{ padding: theme.space[4] }}>
            <ConditionsControl />
          </View>
        </ListGroup>

        <SectionHeader title="Cerca de ti" />

        {mine.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Ninguna quedada de esta especie cerca"
            body="Es el estado normal al empezar en un barrio: la primera la organiza alguien, y a partir de ahí el horario hace el resto. Se crea desde la cabecera."
          />
        ) : (
          mine.map((playdate, index) => {
            const attendees = playdate.attendeeIds
              .map((id) => petById(id))
              .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

            // Se simula apuntarse: la afinidad que se muestra es la que tendría
            // el grupo CON la mascota del usuario dentro, que es la pregunta
            // real.
            const alreadyIn = attendees.some((entry) => entry.id === pet.id);
            const withMine = alreadyIn ? attendees : [...attendees, pet];
            const affinity = groupAffinity(withMine);
            const weakest = affinity.weakestPair;
            const weakestNames =
              weakest && weakest.score < 70
                ? [petById(weakest.a)?.name, petById(weakest.b)?.name].filter(Boolean).join(' y ')
                : null;

            // El bienestar es del grupo entero, incluido el animal del tutor: si
            // a uno de los seis le está prohibiendo el calor, el encuentro no se
            // hace porque a los otros cinco les venga bien. Sin tiempo no se
            // juzga al grupo: la fila se enseña sin veredicto en vez de con uno
            // inventado.
            const welfare = build ? groupWelfare(withMine, build(playdate.sessionMinutes)) : null;

            /*
              La primera pesa más que las demás.

              Una columna de cinco tarjetas idénticas obliga a leerlas todas
              para elegir, y en una lista ordenada por fecha la respuesta casi
              siempre es la de arriba: es la que ocurre antes. Se le da el
              titular grande y el fondo teñido —el resto se queda en su tamaño—
              y con eso la pantalla tiene un sitio por donde empezar en vez de
              cinco iguales.
            */
            const featured = index === 0;

            return (
              <Appear
                key={playdate.id}
                index={index}
                style={{ paddingBottom: index === mine.length - 1 ? 0 : theme.space[3] }}
              >
                <ListGroup>
                  <View
                    style={{
                      padding: theme.space[4],
                      gap: theme.space[3],
                      backgroundColor: featured ? theme.colors.accent : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
                      <DateBlock at={playdate.startsAt} />

                      <View style={{ flex: 1, gap: 2 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: theme.space[1.5],
                          }}
                        >
                          <Text
                            numberOfLines={2}
                            accessibilityRole="header"
                            style={{
                              flexShrink: 1,
                              color: featured
                                ? theme.colors.accentForeground
                                : theme.colors.foreground,
                              fontFamily: fonts.displayBold,
                              fontSize: featured ? theme.fontSize.lg : theme.fontSize.base,
                              lineHeight:
                                (featured ? theme.fontSize.lg : theme.fontSize.base) * 1.2,
                            }}
                          >
                            {playdate.title}
                          </Text>
                          {/* Sobre la tarjeta destacada las insignias cambian de
                            tono: la de acento es del color del propio fondo
                            teñido, así que ahí «Ya vais» se leía en su mismo
                            color. */}
                          {alreadyIn ? (
                            <Badge tone={featured ? 'neutral' : 'accent'}>Ya vais</Badge>
                          ) : null}
                          {playdate.leashed ? <Badge>Con correa</Badge> : null}
                        </View>

                        <Line icon={MapPin}>
                          {`${timeFormatter.format(playdate.startsAt)}–${timeFormatter.format(playdate.endsAt)} · ${playdate.placeName}`}
                        </Line>
                        <Line icon={Users}>
                          {`${attendees.length} de ${playdate.maxPets} · ${playdate.sessionMinutes} min de contacto seguidos`}
                        </Line>
                      </View>
                    </View>

                    <Text
                      numberOfLines={2}
                      style={{
                        color: theme.colors.mutedForeground,
                        fontFamily: fonts.body,
                        fontSize: theme.fontSize.sm,
                        lineHeight: theme.fontSize.sm * 1.4,
                      }}
                    >
                      {playdate.description}
                    </Text>

                    {/* Quién va, con la cara. Una lista de nombres no dice si
                      conoces a alguien; cuatro retratos, sí. */}
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}
                    >
                      <View style={{ flexDirection: 'row' }}>
                        {attendees.slice(0, 4).map((entry, position) => (
                          <View
                            key={entry.id}
                            style={{
                              marginLeft: position === 0 ? 0 : -10,
                              borderRadius: 999,
                              borderWidth: 2,
                              borderColor: theme.colors.background,
                            }}
                          >
                            <Avatar id={entry.id} name={entry.name} size={28} />
                          </View>
                        ))}
                      </View>

                      {/* La afinidad, en una línea y con su número delante. Vivía
                        en un recuadro gris dentro de la tarjeta con tres
                        párrafos de explicación; el porqué del mínimo se dice
                        una vez al final de la pantalla, no seis veces. */}
                      <Text
                        style={{
                          flex: 1,
                          color: theme.colors.mutedForeground,
                          fontFamily: fonts.body,
                          fontSize: theme.fontSize.xs,
                        }}
                      >
                        <Text
                          style={{ fontFamily: fonts.bodyBold, color: theme.colors.foreground }}
                        >
                          {`${affinity.min} % `}
                        </Text>
                        {weakestNames
                          ? `con el grupo · el par más flojo, ${weakestNames}`
                          : 'con el grupo · ninguna pareja se queda corta'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[1.5] }}>
                      {playdate.admitsSizes.map((size) => (
                        <Badge key={size} tone="accent">
                          {SIZE_LABEL[size] ?? size}
                        </Badge>
                      ))}
                      {playdate.admitsEnergy.map((energy) => (
                        <Badge key={energy}>{energyLabel(energy, playdate.speciesId)}</Badge>
                      ))}
                    </View>

                    {/* Va antes que el botón, y cuando dice que no, el botón no está. */}
                    <WelfareNotice verdict={welfare} petName={pet.name} showDisclaimer={false} />

                    {welfare?.level === 'stop' ? null : affinity.hasVeto ? (
                      <Text
                        style={{
                          color: theme.colors.destructive,
                          fontFamily: fonts.bodyBold,
                          fontSize: theme.fontSize.sm,
                        }}
                      >
                        {pet.name} no puede unirse: hay una pareja incompatible por seguridad, y eso
                        no lo compensa ninguna puntuación.
                      </Text>
                    ) : (
                      <View style={{ flexDirection: 'row' }}>
                        <PillButton
                          label={alreadyIn ? 'Ver asistentes' : `Apuntar a ${pet.name}`}
                          variant={alreadyIn ? 'neutral' : 'primary'}
                        />
                      </View>
                    )}
                  </View>
                </ListGroup>
              </Appear>
            );
          })
        )}

        <FootNote>
          La afinidad se mide por la pareja peor emparejada, no por el promedio: un grupo vale lo
          que vale su peor pareja.{' '}
          {otherSpecies > 0
            ? `Hay ${otherSpecies} ${otherSpecies === 1 ? 'quedada más' : 'quedadas más'} cerca, de otras especies, y no aparecen porque no se puede apuntar a un animal a la quedada de otra especie: lo impide la base de datos, no esta pantalla. `
            : ''}
          Las tallas son relativas dentro de cada especie, y da igual: como los encuentros son
          siempre entre la misma, la comparación nunca cruza ese límite.
        </FootNote>
      </Animated.ScrollView>
    </Screen>
  );
}

/**
 * Un icono de la barra: área táctil entera, sin fondo.
 *
 * Es el mismo botón que lleva el feed en su cabecera para publicar. Se escribe
 * aquí y no en `chrome` porque de momento son dos, y dos usos no justifican un
 * componente compartido; el tercero sí.
 */
function HeaderIcon({ icon, label }: { icon: typeof CalendarPlus; label: string }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => haptics.tap()}
      style={({ pressed }) => ({
        width: theme.touchTarget.min,
        height: theme.touchTarget.min,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Icon icon={icon} size="lg" decorative />
    </Pressable>
  );
}

/**
 * La fecha como un bloque, no como una frase.
 *
 * «martes, 12 de agosto · 18:00–19:00» era una línea de texto gris igual que
 * las otras dos, y la fecha es lo primero que se mira de un plan. Como bloque
 * —día grande, mes debajo— se distingue de un vistazo cuál es este fin de
 * semana y cuál el mes que viene, que es la única pregunta que se le hace a una
 * lista de quedadas.
 */
function DateBlock({ at }: { at: Date }) {
  const theme = useTheme();
  const day = at.toLocaleDateString('es-ES', { day: 'numeric' });
  const month = at.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');

  return (
    <View
      accessibilityLabel={dateFormatter.format(at)}
      style={{
        width: 44,
        paddingVertical: theme.space[1],
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceSunken,
      }}
    >
      <Text
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.displayBold,
          fontSize: theme.fontSize.lg,
          lineHeight: theme.fontSize.lg * 1.1,
        }}
      >
        {day}
      </Text>
      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize['2xs'],
          textTransform: 'uppercase',
        }}
      >
        {month}
      </Text>
    </View>
  );
}

/** Una línea de dato con su icono, del tamaño del texto que acompaña. */
function Line({ icon, children }: { icon: typeof MapPin; children: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1.5] }}>
      <Icon icon={icon} size="sm" color={theme.colors.mutedForeground} decorative />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.xs,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
