import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { PetSwitcher } from '@/components/pet-switcher';
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
import { useActivePet } from '@/lib/active-pet';
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
  const pet = useActivePet();
  const species = speciesOf(pet);
  const social = petHasMeetups(pet);
  const others = walkingNow(pet.speciesId);

  const [activeUntil, setActiveUntil] = useState<Date | null>(null);

  const checkIn = (minutes: number) => {
    const until = new Date();
    until.setMinutes(until.getMinutes() + minutes);
    setActiveUntil(until);
  };

  const formatTime = (date: Date) =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (!social) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
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
      <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
        <PetSwitcher />

        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Ahora mismo</Eyebrow>
          <Title>Fuera ahora</Title>
        </View>

        {activeUntil ? (
          <Card>
            <Row>
              <Heading>Estáis visibles</Heading>
              <Badge tone="live">En vivo</Badge>
            </Row>
            <Body>
              {pet.name} aparece en {PLACES.central.name} hasta las {formatTime(activeUntil)}.
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
        ) : (
          <Card>
            <Heading>¿Salís ahora?</Heading>
            <Body muted>
              Elige hasta cuándo. No hay opción de dejarlo indefinido: el check-in caduca solo para
              que nadie se quede visible por olvido.
            </Body>
            <View style={{ gap: theme.space[2] }}>
              {DURATIONS.map((duration) => (
                <Button
                  key={duration.minutes}
                  label={`Estamos fuera · ${duration.label}`}
                  variant={duration.minutes === 120 ? 'live' : 'outline'}
                  accessibilityHint={`Os hará visibles durante ${duration.label} y se apagará solo`}
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
            El radar te sitúa en el punto del check-in, nunca en tus coordenadas exactas, y la
            ubicación que se guarda para avisar a otros va redondeada a un kilómetro. No hay ningún
            punto azul siguiéndote.
          </Caption>
        </Notice>
      </ScrollView>
    </Screen>
  );
}
