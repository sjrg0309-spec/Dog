import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { NavBar, useScrolled } from '@/components/chrome';
import { ConditionsControl } from '@/components/conditions-control';
import { PetSwitcher } from '@/components/pet-switcher';
import { WelfareNotice } from '@/components/welfare-notice';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Eyebrow,
  Heading,
  Notice,
  Row,
  Screen,
  Title,
} from '@/components/ui';
import { assessWelfare, type Conditions, type WelfareVerdict } from '@petnav/core';

import { useActivePet } from '@/lib/active-pet';
import { setLocation, useConditionsBuilder, useWeatherState } from '@/lib/conditions';
import { RADAR_AREA_NOTE, petFriendlyPlaces, placeAt } from '@/lib/geofence';
import { Icon } from '@/components/icon';
import { ChevronRight, Footprints, Lock, MapPin } from '@/lib/icons';
import { fonts } from '@/lib/fonts';
import { useCan, useWhyNot } from '@/lib/account';
import { petHasMeetups, speciesOf, walkingNow } from '@/lib/data';
import { PLACES } from '@/lib/demo-data';
import { speciesName } from '@/lib/labels';
import { setGhostMode, useGhostMode } from '@/lib/presence';
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
  const { scrolled, onScroll } = useScrolled();
  const pet = useActivePet();
  const species = speciesOf(pet);
  const social = petHasMeetups(pet);
  /* Quién está fuera es lo que la puerta protege: la cara, el sitio y la hora.
     Sin chip verificado no se calcula siquiera —no se filtra al dibujar—, que
     es la diferencia entre una lista escondida y una lista que no existe. */
  const canSeePeople = useCan('live_people');
  const whyNotPeople = useWhyNot('live_people');
  const others = canSeePeople ? walkingNow(pet.speciesId) : [];
  const declared = useWeatherState();
  const build = useConditionsBuilder();

  // La zona manda antes que el bienestar: si no se puede encender el radar
  // aquí, la temperatura da igual.
  const here = placeAt(declared.location);

  const router = useRouter();
  const walks = useWalks(pet.id);
  const ghost = useGhostMode();

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
      <Screen>
        <NavBar title="Radar" scrolled={scrolled} />
        <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
          <PetSwitcher />
          <View style={{ gap: theme.space[2] }}>
            <Eyebrow>Ahora mismo</Eyebrow>
            <Title>El radar no aplica a {pet.name}</Title>
          </View>
          <Notice>
            <Body>{species?.socialNote}</Body>
            <Caption>
              Anunciar que hay otro {speciesName(pet.speciesId).toLowerCase()} a doscientos metros
              no le sirve de nada a nadie, y para el animal sería un encuentro que no debería
              ocurrir. En la pestaña de comunidad sí hay algo que sí le sirve a su tutor.
            </Caption>
          </Notice>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar title="Radar" scrolled={scrolled} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
        <PetSwitcher />

        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Ahora mismo</Eyebrow>
          <Title>Fuera ahora</Title>
        </View>

        <WhereAmI />

        <ConditionsControl />

        {activeUntil ? (
          <Card>
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
            <Button label="Hemos terminado" variant="outline" onPress={checkOut} />
          </Card>
        ) : ghost ? (
          /* Con el modo fantasma puesto no se ofrece salir, y no es una
             pantalla de error: el tutor lo ha pedido. Se dice qué está apagado
             y se deja el interruptor al lado, que es lo que separa una decisión
             de un bloqueo.
             El botón de check-in **no está**, no está en gris: es la misma
             regla que con un veto de bienestar, y por el mismo motivo —un
             control desactivado invita a buscar cómo activarlo—. */
          <Card>
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
          </Card>
        ) : here === null ? (
          <OutsideArea />
        ) : welfare?.level === 'stop' ? (
          // No se enseña el botón en gris ni con un aviso al lado: no está.
          // Un control desactivado invita a buscar cómo activarlo.
          <WelfareNotice verdict={welfare} petName={pet.name} />
        ) : (
          <Card>
            <Heading>¿Salís ahora?</Heading>
            <Body muted>
              Elige hasta cuándo. No hay opción de dejarlo indefinido: el check-in caduca solo para
              que nadie se quede visible por olvido.
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

            {allowed.length < DURATIONS.length ? (
              <Caption>
                Con estas condiciones no ofrecemos ratos más largos: {pet.name} aguanta bien{' '}
                {allowed[allowed.length - 1]?.label} y a partir de ahí empieza a costarle.
              </Caption>
            ) : null}
          </Card>
        )}

        <View style={{ gap: theme.space[3] }}>
          <Heading>Quién está fuera</Heading>

          {!canSeePeople ? (
            <Notice>
              <Row gap={2}>
                <Icon icon={Lock} size="base" color={theme.colors.mutedForeground} decorative />
                <Body>Esto se abre con el chip verificado</Body>
              </Row>
              <Caption>{whyNotPeople}</Caption>
            </Notice>
          ) : others.length === 0 ? (
            <Notice>
              <Body>
                Ahora mismo no hay ningún {speciesName(pet.speciesId).toLowerCase()} fuera cerca.
              </Body>
              <Caption>
                Es lo normal fuera de las horas punta. En la pestaña de descubrir sí puedes ver con
                quién coincides de horario, aunque no esté conectado.
              </Caption>
            </Notice>
          ) : (
            others.map((other) => (
              <Card key={other.id}>
                <Row>
                  <Heading>{other.name}</Heading>
                  <Badge tone="live">Le quedan {other.walkingUntilMinutes} min</Badge>
                </Row>
                <Caption>
                  {other.placeName} · con {other.ownerName}
                </Caption>
                <Button label="Vamos" accessibilityHint={`Avisar a ${other.ownerName} de que vais`} />
              </Card>
            ))
          )}
        </View>

        {/* La puerta al historial va aquí y no en el perfil: es la pantalla
            desde la que se sale, así que es donde se piensa en los paseos. Y
            el perfil es lo que más se enseña a otros, que es exactamente donde
            no debe estar la rutina de nadie. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver vuestros paseos, ${walks.length} guardados`}
          onPress={() => router.push('/historial')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[3],
            minHeight: theme.touchTarget.comfortable,
            paddingHorizontal: theme.space[4],
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
          })}
        >
          <Icon icon={Footprints} size="base" color={theme.colors.mutedForeground} decorative />
          <View style={{ flex: 1 }}>
            <Body>Vuestros paseos</Body>
            <Caption>
              {walks.length === 0
                ? 'Se llena solo al cerrar cada check-in'
                : `${walks.length} guardados · solo los ves tú`}
            </Caption>
          </View>
          <Icon icon={ChevronRight} size="base" color={theme.colors.mutedForeground} decorative />
        </Pressable>

        <Notice>
          <Body>Lo que se comparte es el lugar, no tú.</Body>
          <Caption>
            El radar solo se enciende dentro de una zona pet-friendly y te sitúa en ella, nunca en
            tus coordenadas. Eso ya no es una promesa de esta pantalla: la base de datos rechaza un
            check-in fuera de zona, así que no depende de que el cliente se porte bien.
          </Caption>
        </Notice>
      </ScrollView>
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
    <Card>
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
    </Card>
  );
}
