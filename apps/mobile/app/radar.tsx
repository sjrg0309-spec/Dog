import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Eyebrow, Heading, Notice, Row, Screen, Title } from '@/components/ui';
import { PLACES } from '@/lib/demo-data';
import { myDog, walkingNow } from '@/lib/data';
import { useTheme } from '@/lib/theme';

/** Opciones de duración del check-in. El máximo es cuatro horas, por diseño. */
const DURATIONS = [
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '4 horas', minutes: 240 },
] as const;

/**
 * Radar: "estoy paseando ahora".
 *
 * Dos reglas que no son negociables y que la pantalla explica al usuario en
 * lugar de esconder:
 *
 *  1. El check-in **caduca solo**. No hay opción de dejarlo indefinido. Nadie
 *     debe quedar visible en un mapa por olvidarse de apagar algo.
 *  2. Lo que se comparte es **el parque, no la persona**. No hay un punto azul
 *     siguiendo a nadie.
 */
export default function RadarScreen() {
  const theme = useTheme();
  const dog = myDog();
  const others = walkingNow();

  const [activeUntil, setActiveUntil] = useState<Date | null>(null);

  const checkIn = (minutes: number) => {
    const until = new Date();
    until.setMinutes(until.getMinutes() + minutes);
    setActiveUntil(until);
  };

  const formatTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Ahora mismo</Eyebrow>
          <Title>Paseando ahora</Title>
        </View>

        {activeUntil ? (
          <Card>
            <Row>
              <Heading>Estás visible</Heading>
              <Badge tone="live">En vivo</Badge>
            </Row>
            <Body>
              {dog.name} aparece en {PLACES.central.name} hasta las {formatTime(activeUntil)}.
            </Body>
            <Caption>
              Se apaga solo a esa hora. Los tutores con un perro compatible a dos kilómetros han
              recibido un aviso.
            </Caption>
            <Button label="Dejar de estar visible" variant="outline" onPress={() => setActiveUntil(null)} />
          </Card>
        ) : (
          <Card>
            <Heading>¿Sales ahora?</Heading>
            <Body muted>
              Elige hasta cuándo. No hay opción de dejarlo indefinido: el check-in caduca solo para
              que nadie se quede visible por olvido.
            </Body>
            <View style={{ gap: theme.space[2] }}>
              {DURATIONS.map((duration) => (
                <Button
                  key={duration.minutes}
                  label={`Estoy en el parque · ${duration.label}`}
                  variant={duration.minutes === 120 ? 'live' : 'outline'}
                  accessibilityHint={`Te hará visible durante ${duration.label} y se apagará solo`}
                  onPress={() => checkIn(duration.minutes)}
                />
              ))}
            </View>
          </Card>
        )}

        <View style={{ gap: theme.space[3] }}>
          <Heading>Quién está fuera</Heading>

          {others.length === 0 ? (
            <Notice>
              <Body>Ahora mismo no hay nadie paseando cerca.</Body>
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
                <Button label="Voy" accessibilityHint={`Avisar a ${other.ownerName} de que vas`} />
              </Card>
            ))
          )}
        </View>

        <Notice>
          <Body>Lo que se comparte es el parque, no tú.</Body>
          <Caption>
            El radar te sitúa en el lugar del check-in, nunca en tus coordenadas exactas, y la
            ubicación que se guarda para avisar a otros va redondeada a un kilómetro. No hay ningún
            punto azul siguiéndote.
          </Caption>
        </Notice>
      </ScrollView>
    </Screen>
  );
}
