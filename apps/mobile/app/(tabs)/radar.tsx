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
import { assessWelfare } from '@coincide/core';

import { useActivePet } from '@/lib/active-pet';
import { setLocation, useConditionsBuilder, useWeatherState } from '@/lib/conditions';
import { RADAR_AREA_NOTE, petFriendlyPlaces, placeAt } from '@/lib/geofence';
import { Icon } from '@/components/icon';
import { MapPin } from '@/lib/icons';
import { fonts } from '@/lib/fonts';
import { petHasMeetups, speciesOf, walkingNow } from '@/lib/data';
import { PLACES } from '@/lib/demo-data';
import { speciesName } from '@/lib/labels';
import { useTheme } from '@/lib/theme';

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
  const others = walkingNow(pet.speciesId);
  const declared = useWeatherState();
  const build = useConditionsBuilder();

  // La zona manda antes que el bienestar: si no se puede encender el radar
  // aquí, la temperatura da igual.
  const here = placeAt(declared.location);

  const [activeUntil, setActiveUntil] = useState<Date | null>(null);

  const checkIn = (minutes: number) => {
    const until = new Date();
    until.setMinutes(until.getMinutes() + minutes);
    setActiveUntil(until);
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
            <Button
              label="Dejar de estar visible"
              variant="outline"
              onPress={() => setActiveUntil(null)}
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

          {others.length === 0 ? (
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
