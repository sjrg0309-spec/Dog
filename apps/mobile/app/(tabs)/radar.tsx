import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { LargeTitle, NavBar, Separator } from '@/components/chrome';
import { ConditionsControl } from '@/components/conditions-control';
import {
  CardRail,
  EmptyState,
  FootNote,
  IconTile,
  LIST_GUTTER,
  ListGroup,
  ListRow,
  RailCard,
  SectionHeader,
} from '@/components/list';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { WelfareNotice } from '@/components/welfare-notice';
import { Badge, Body, Button, Caption, Heading, Row, Screen } from '@/components/ui';
import {
  ESCORT_LATE_NOTE,
  ESCORT_NOTE,
  assessWelfare,
  type Conditions,
  type WelfareVerdict,
} from '@petnav/core';

import { useActivePet } from '@/lib/active-pet';
import { haptics } from '@/lib/haptics';
import { setLocation, useConditionsBuilder, useWeatherState } from '@/lib/conditions';
import { RADAR_AREA_NOTE, petFriendlyPlaces, placeAt } from '@/lib/geofence';
import { Icon } from '@/components/icon';
import { Footprints, Lock, MapPin, PawPrint, Radar as RadarIcon, ShieldAlert } from '@/lib/icons';
import { fonts } from '@/lib/fonts';
import { useCan, useWhyNot } from '@/lib/account';
import { useVisiblePets } from '@/lib/moderation';
import { petHasMeetups, speciesOf, walkingNow } from '@/lib/data';
import { PLACES } from '@/lib/demo-data';
import { speciesName } from '@/lib/labels';
import {
  cancelEscort,
  closeEscort,
  escortContacts,
  escortPreview,
  startEscort,
  useEscort,
} from '@/lib/escort';
import { setGhostMode, useGhostMode } from '@/lib/presence';
import { useScrollDriver } from '@/lib/scroll';
import { useTheme } from '@/lib/theme';
import { recordWalk, useWalks } from '@/lib/walks';

/** Opciones de duración del check-in. El máximo es cuatro horas, por diseño. */
const DURATIONS = [
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '4 horas', minutes: 240 },
] as const;

/**
 * Radar: "estamos fuera ahora".
 *
 * Dos reglas que no son negociables y que la pantalla explica al usuario en
 * lugar de esconder:
 *
 *  1. El check-in **caduca solo**. No hay opción de dejarlo indefinido. Nadie
 *     debe quedar visible en un mapa por olvidarse de apagar algo.
 *  2. Lo que se comparte es **el lugar, no la persona**. No hay un punto azul
 *     siguiendo a nadie.
 *
 * Con una especie solitaria seleccionada, el radar no existe: no se enseña
 * apagado ni con un aviso de "próximamente", se explica por qué no aplica.
 */
export default function RadarScreen() {
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
  /* Quién está fuera es lo que la puerta protege: la cara, el sitio y la hora.
     Sin chip verificado no se calcula siquiera —no se filtra al dibujar—, que
     es la diferencia entre una lista escondida y una lista que no existe. */
  const canSeePeople = useCan('live_people');
  const whyNotPeople = useWhyNot('live_people');
  const others = useVisiblePets(canSeePeople ? walkingNow(pet.speciesId) : []);
  const declared = useWeatherState();
  const build = useConditionsBuilder();

  // La zona manda antes que el bienestar: si no se puede encender el radar
  // aquí, la temperatura da igual.
  const here = placeAt(declared.location);

  const router = useRouter();
  const walks = useWalks(pet.id);
  const ghost = useGhostMode();
  const escort = useEscort();
  const [escortWith, setEscortWith] = useState<string | null>(null);

  /* Hace falta guardar **cuándo empezó**, no solo hasta cuándo dura: sin eso,
     al cerrar el check-in no hay forma de saber cuánto se estuvo fuera, que es
     el dato del que vive el resumen entero. */
  const [session, setSession] = useState<{
    startedAt: Date;
    until: Date;
    /* Lo que se propuso **al salir**, congelado aquí. Recalcularlo al cerrar
       lo mediría con la temperatura de dentro de dos horas, así que el resumen
       compararía lo que se hizo contra un consejo que nunca se dio. */
    recommendedMinutes: number;
    temperatureC: number | null;
    surface: Conditions['surface'];
    welfareLevel: WelfareVerdict['level'];
  } | null>(null);
  const activeUntil = session?.until ?? null;

  const checkIn = (minutes: number) => {
    /* Si hay alguien elegido, el acompañamiento empieza con el paseo: pedirlo
       aparte sería un segundo botón que se olvida justo el día que importa. */
    if (escortWith !== null && here) {
      const contact = escortContacts().find((candidate) => candidate.id === escortWith);
      if (contact) {
        startEscort({
          contactId: contact.id,
          contactName: contact.name,
          placeName: here.name,
          minutes,
        });
      }
    }

    const until = new Date();
    until.setMinutes(until.getMinutes() + minutes);
    const conditions = build ? build(minutes) : null;
    const verdict = conditions ? assessWelfare(pet, conditions) : null;
    setSession({
      startedAt: new Date(),
      until,
      recommendedMinutes: verdict?.recommendedMinutes ?? minutes,
      temperatureC: conditions?.temperatureC ?? null,
      surface: conditions?.surface ?? 'unknown',
      welfareLevel: verdict?.level ?? 'ok',
    });
  };

  /**
   * Cerrar el paseo: se guarda y se abre su resumen.
   *
   * Hasta ahora esto solo apagaba un booleano. El check-in terminaba, la gente
   * volvía a casa y la aplicación no se enteraba de nada: ni cuánto se estuvo
   * fuera, ni con quién, ni si fue bien. Todo el bucle —«coincidís los martes,
   * ¿lo hacéis fijo?», el 👎 que baja la afinidad— dependía de un dato que no
   * se llegaba a escribir.
   */
  const checkOut = () => {
    if (!session) return;

    /* Con quién se coincidió: los que están fuera **en el mismo sitio**. En
       una aplicación de verdad esto sale del solapamiento de presencias del
       radar; aquí sale de la misma lista que dibuja la pantalla, que es la que
       el usuario tiene delante. */
    const together = others.filter((other) => other.placeName === (here?.name ?? null));

    const id = recordWalk({
      petId: pet.id,
      placeId: here?.id ?? null,
      startedAt: session.startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      recommendedMinutes: session.recommendedMinutes,
      welfareLevel: session.welfareLevel,
      temperatureC: session.temperatureC,
      surface: session.surface,
      companions: together.map((other) => ({ petId: other.id, outcome: null })),
    });

    /* Y se cierra solo al cerrar el paseo. Es lo que evita el fallo obvio: un
       aviso de «no ha vuelto» a la una de la mañana porque alguien se olvidó de
       tocar un segundo botón. */
    closeEscort();
    setSession(null);
    router.push(`/paseo?id=${id}`);
  };

  const formatTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  // El check-in más corto es el que decide si hoy se puede salir siquiera; cada
  // duración se comprueba por separado para no ofrecer las que no convienen.
  //
  // Sin saber qué tiempo hace no se ofrece ninguna: `build` es null y la lista
  // de duraciones permitidas queda vacía, que es lo mismo que hace un veto de
  // calor. Un botón de check-in que aparece igual cuando no sabemos si se puede
  // salir es un botón que decide por su cuenta.
  const welfare = build ? assessWelfare(pet, build(DURATIONS[0].minutes)) : null;
  const allowed = build
    ? DURATIONS.filter(
        (duration) =>
          assessWelfare(pet, build(duration.minutes)).recommendedMinutes >= duration.minutes,
      )
    : [];
  const longest = allowed[allowed.length - 1]?.minutes ?? 0;

  if (!social) {
    return (
      <Screen grouped>
        <NavBar
          title="Radar"
          scrolled={false}
          scrollY={scrollY}
          revealAt={52}
          trailing={<PetSwitcherCompact />}
        />
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: theme.space[16] }}
        >
          <EmptyState
            icon={PawPrint}
            title={`El radar no aplica a ${pet.name}`}
            body={species?.socialNote}
          />
          <FootNote>
            Anunciar que hay otro {speciesName(pet.speciesId).toLowerCase()} a doscientos metros no
            le sirve de nada a nadie, y para el animal sería un encuentro que no debería ocurrir. En
            la pestaña de comunidad sí hay algo que sí le sirve a su tutor.
          </FootNote>
        </Animated.ScrollView>
      </Screen>
    );
  }

  return (
    <Screen grouped>
      <NavBar
        title="Radar"
        scrolled={false}
        scrollY={scrollY}
        revealAt={52}
        trailing={<PetSwitcherCompact />}
      />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
      >
        <LargeTitle subtitle="Quién está fuera ahora, y hasta cuándo estáis vosotros.">
          Fuera ahora
        </LargeTitle>

        <View style={{ paddingHorizontal: LIST_GUTTER, gap: theme.space[5] }}>
          <WhereAmI />
          <ConditionsControl />
        </View>

        {activeUntil ? (
          <Panel>
            <Row>
              <Heading>Estáis visibles</Heading>
              <Badge tone="live">En vivo</Badge>
            </Row>
            <Body>
              {pet.name} aparece en {here?.name ?? PLACES.central.name} hasta las{' '}
              {formatTime(activeUntil)}.
            </Body>
            <Caption>
              Se apaga solo a esa hora. Los tutores con un animal compatible de la misma especie a
              dos kilómetros han recibido un aviso.
            </Caption>
            {/* Lo que le llega a esa persona, tal cual y mientras dura.
                Enseñarlo es la mitad de la promesa: se puede leer y comprobar
                que no lleva nada más que el sitio y la hora. */}
            {escort && !escort.closedAt ? (
              <View
                style={{
                  gap: theme.space[1],
                  padding: theme.space[3],
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surfaceSunken,
                }}
              >
                <Row gap={2}>
                  <Icon icon={ShieldAlert} size="sm" color={theme.colors.foreground} decorative />
                  <Body>{escort.contactName} lo sabe</Body>
                </Row>
                <Caption>«{escortPreview(escort)}»</Caption>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Dejar de avisar a ${escort.contactName}`}
                  onPress={() => {
                    haptics.tap();
                    cancelEscort();
                  }}
                  style={({ pressed }) => ({
                    minHeight: theme.touchTarget.min,
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: theme.colors.primary,
                      fontFamily: fonts.bodyBold,
                      fontSize: theme.fontSize.sm,
                    }}
                  >
                    Dejar de avisar
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Button label="Hemos terminado" variant="outline" onPress={checkOut} />
          </Panel>
        ) : ghost ? (
          /* Con el modo fantasma puesto no se ofrece salir, y no es una
             pantalla de error: el tutor lo ha pedido. Se dice qué está apagado
             y se deja el interruptor al lado, que es lo que separa una decisión
             de un bloqueo.
             El botón de check-in **no está**, no está en gris: es la misma
             regla que con un veto de bienestar, y por el mismo motivo —un
             control desactivado invita a buscar cómo activarlo—. */
          <Panel>
            <Row>
              <Heading>Estáis invisibles</Heading>
              <Badge tone="warning">Modo fantasma</Badge>
            </Row>
            <Body muted>
              {pet.name} no aparece en el mapa de nadie y no puede hacer check-in. Los demás sí se
              siguen viendo: esconderte no te cuesta la función.
            </Body>
            <Button
              label="Volver a aparecer"
              variant="outline"
              onPress={() => setGhostMode(false)}
            />
          </Panel>
        ) : here === null ? (
          <OutsideArea />
        ) : welfare?.level === 'stop' ? (
          // No se enseña el botón en gris ni con un aviso al lado: no está.
          // Un control desactivado invita a buscar cómo activarlo.
          <View style={{ paddingHorizontal: LIST_GUTTER, paddingTop: theme.space[5] }}>
            <WelfareNotice verdict={welfare} petName={pet.name} />
          </View>
        ) : (
          <Panel>
            <Heading>¿Salís ahora?</Heading>
            <Body muted>
              {allowed.length === 0
                ? 'No sabemos qué tiempo hace. Pon la temperatura aquí arriba y te decimos cuánto podéis estar fuera.'
                : 'Elige hasta cuándo. No hay opción de dejarlo indefinido: el check-in caduca solo para que nadie se quede visible por olvido.'}
            </Body>
            {/* Las duraciones que hoy no le convienen no se ofrecen. Enseñar
                "4 horas" a 30 grados y avisar debajo es proponerlo igual. */}
            <View style={{ gap: theme.space[2] }}>
              {allowed.map((duration) => (
                <Button
                  key={duration.minutes}
                  label={`Estamos fuera · ${duration.label}`}
                  variant={duration.minutes === longest ? 'live' : 'outline'}
                  accessibilityHint={`Os hará visibles durante ${duration.label} y se apagará solo`}
                  onPress={() => checkIn(duration.minutes)}
                />
              ))}
            </View>

            {/*
              Avisar a alguien de que has salido.

              Esta aplicación se usa a las seis de la mañana y a las once de la
              noche, que son las horas en las que se pasea solo. Todo lo demás
              de seguridad mira al animal; esto mira a la persona.

              Va **aquí y no en un ajuste** porque es una decisión de cada
              salida: hoy sales de noche y quieres avisar, mañana a mediodía y
              no hace falta.
            */}
            <Separator />
            <View style={{ gap: theme.space[2] }}>
              <Row gap={2}>
                <Icon icon={ShieldAlert} size="base" color={theme.colors.foreground} decorative />
                <Body>¿Aviso a alguien?</Body>
              </Row>
              <Caption>{ESCORT_NOTE}</Caption>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
                {escortContacts().map((contact) => {
                  const on = escortWith === contact.id;
                  return (
                    <Pressable
                      key={contact.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Avisar a ${contact.name}`}
                      onPress={() => {
                        haptics.tap();
                        setEscortWith(on ? null : contact.id);
                      }}
                      style={({ pressed }) => ({
                        minHeight: theme.touchTarget.min,
                        justifyContent: 'center',
                        paddingHorizontal: theme.space[4],
                        borderRadius: theme.radius.full,
                        borderWidth: on ? 2 : 1,
                        borderColor: on ? theme.colors.primary : theme.colors.border,
                        backgroundColor: pressed
                          ? theme.colors.surfaceSunken
                          : theme.colors.surface,
                      })}
                    >
                      <Text
                        style={{
                          color: on ? theme.colors.foreground : theme.colors.mutedForeground,
                          fontFamily: on ? fonts.bodyBold : fonts.body,
                          fontSize: theme.fontSize.sm,
                        }}
                      >
                        {contact.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {escortWith !== null ? <Caption>{ESCORT_LATE_NOTE}</Caption> : null}
            </View>

            {/*
              El caso de cero duraciones existía y escribía una frase rota.
              Sin conexión no se ofrece ninguna —es deliberado: un botón de
              check-in que aparece igual cuando no sabemos si se puede salir
              decide por su cuenta— pero el texto de abajo daba por hecho que
              siempre quedaba al menos una, y salía «aguanta bien  y a partir de
              ahí empieza a costarle», con el hueco donde iba la duración. Se vio
              en una captura, no en un test: la frase estaba bien formada, solo
              que vacía por dentro.
            */}
            {allowed.length > 0 && allowed.length < DURATIONS.length ? (
              <Caption>
                Con estas condiciones no ofrecemos ratos más largos: {pet.name} aguanta bien{' '}
                {allowed[allowed.length - 1]?.label} y a partir de ahí empieza a costarle.
              </Caption>
            ) : null}
          </Panel>
        )}

        <SectionHeader title="Quién está fuera" />

        {!canSeePeople ? (
          /* La puerta del chip verificado. Es una fila como las demás y no un
             recuadro de aviso: lo que hay detrás son personas, así que se dice
             en el sitio donde estarían. */
          <ListGroup>
            <ListRow
              leading={<IconTile icon={Lock} tone="muted" />}
              title="Esto se abre con el chip verificado"
              subtitle={whyNotPeople ?? undefined}
            />
          </ListGroup>
        ) : others.length === 0 ? (
          <EmptyState
            icon={RadarIcon}
            title={`Ningún ${speciesName(pet.speciesId).toLowerCase()} fuera ahora mismo`}
            body="Es lo normal fuera de las horas punta. En descubrir sí puedes ver con quién coincides de horario, aunque no esté conectado."
          />
        ) : (
          /* Quien está fuera **ahora** se hojea, no se recorre: es una decisión
             de un vistazo —con quién voy— y caduca en minutos. En horizontal
             caben las caras grandes con su anillo de en vivo, que es lo que se
             reconoce antes que el nombre. */
          <CardRail>
            {others.map((other) => (
              <RailCard
                key={other.id}
                leading={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
                    <Avatar id={other.id} name={other.name} size={44} live />
                    <Badge tone="live">{other.walkingUntilMinutes} min</Badge>
                  </View>
                }
                title={other.name}
                subtitle={`${other.placeName} · con ${other.ownerName}`}
                action={{ label: 'Vamos' }}
              />
            ))}
          </CardRail>
        )}

        {/* La puerta al historial va aquí y no en el perfil: es la pantalla
            desde la que se sale, así que es donde se piensa en los paseos. Y
            el perfil es lo que más se enseña a otros, que es exactamente donde
            no debe estar la rutina de nadie. */}
        <View style={{ paddingTop: theme.space[5] }}>
          <ListGroup>
            <ListRow
              leading={<IconTile icon={Footprints} tone="primary" />}
              title="Vuestros paseos"
              subtitle={
                walks.length === 0
                  ? 'Se llena solo al cerrar cada check-in'
                  : `${walks.length} guardados · solo los ves tú`
              }
              accessibilityLabel={`Ver vuestros paseos, ${walks.length} guardados`}
              onPress={() => router.push('/historial')}
              chevron
            />
          </ListGroup>
        </View>

        <FootNote>
          Lo que se comparte es el lugar, no tú. El radar solo se enciende dentro de una zona
          pet-friendly y te sitúa en ella, nunca en tus coordenadas. Eso ya no es una promesa de
          esta pantalla: la base de datos rechaza un check-in fuera de zona, así que no depende de
          que el cliente se porte bien.
        </FootNote>
      </Animated.ScrollView>
    </Screen>
  );
}

/**
 * Dónde estás, y a qué distancia queda la zona más cercana.
 *
 * En la aplicación real esto sale del GPS y no se elige. Aquí se elige porque un
 * prototipo que dice «no estás en una zona pet-friendly» y no te deja moverte no
 * enseña la regla: enseña una pared.
 */
function WhereAmI() {
  const theme = useTheme();
  const declared = useWeatherState();
  const here = placeAt(declared.location);

  const options = [
    ...petFriendlyPlaces().map((place) => ({
      key: place.id,
      label: place.name,
      location: { lat: place.lat, lng: place.lng },
    })),
    // Un punto que no cae en ninguna zona: es el caso que hay que poder ver.
    { key: 'casa', label: 'En casa', location: { lat: 40.38, lng: -3.75 } },
  ];

  return (
    <View style={{ gap: theme.space[2] }}>
      <Caption>Dónde estás</Caption>
      <Row gap={2}>
        {options.map((option) => {
          const active =
            option.location.lat === declared.location.lat &&
            option.location.lng === declared.location.lng;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setLocation(option.location)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[2],
                minHeight: theme.touchTarget.min,
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
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </Row>
      <Row gap={2}>
        <Icon
          icon={MapPin}
          size="sm"
          color={here ? theme.colors.success : theme.colors.mutedForeground}
          decorative
        />
        <Caption>
          {here
            ? `${here.name} · ${here.kind}. El radar funciona aquí.`
            : 'Fuera de zona pet-friendly. El radar no se enciende.'}
        </Caption>
      </Row>
    </View>
  );
}

/**
 * Fuera de zona.
 *
 * No es un error del que disculparse: es la regla funcionando. Se explica por
 * qué y se enseña dónde sí, que es lo único accionable.
 */
function OutsideArea() {
  const theme = useTheme();

  return (
    <Panel>
      <Row>
        <Heading>El radar no funciona aquí</Heading>
        <Badge tone="warning">Fuera de zona</Badge>
      </Row>
      <Body muted>{RADAR_AREA_NOTE}</Body>
      <View style={{ gap: theme.space[1] }}>
        {petFriendlyPlaces().map((place) => (
          <Row key={place.id} gap={2}>
            <Icon icon={MapPin} size="sm" color={theme.colors.mutedForeground} decorative />
            <Caption>
              {place.name} · {place.kind}
            </Caption>
          </Row>
        ))}
      </View>
    </Panel>
  );
}

/**
 * Un bloque de control del radar.
 *
 * Es el mismo `ListGroup` que usan las listas de esta pantalla, con un solo
 * hijo: la tarjeta agrupada de iOS. Así el estado de la salida y la lista de
 * quién está fuera se ven como dos piezas del mismo material en vez de como una
 * tarjeta con borde propio al lado de unas filas sueltas, que es lo que pasaba
 * cuando esto era una `Card`.
 *
 * Sigue siendo un bloque y no una fila porque lo que hay dentro no es un
 * elemento de una lista: es el estado de la salida y sus botones.
 */
function Panel({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={{ paddingTop: theme.space[5] }}>
      <ListGroup>
        <View style={{ gap: theme.space[3], padding: theme.space[4] }}>{children}</View>
      </ListGroup>
    </View>
  );
}
