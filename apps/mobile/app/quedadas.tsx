import { ScrollView, View } from 'react-native';

import { groupAffinity } from '@doggymeet/core';

import { Badge, Body, Button, Caption, Card, Eyebrow, Heading, Notice, Row, Screen, Title } from '@/components/ui';
import { dogById, myDog, playdates } from '@/lib/data';
import { useTheme } from '@/lib/theme';

const SIZE_LABEL: Record<string, string> = {
  mini: 'Mini',
  small: 'Pequeño',
  medium: 'Mediano',
  large: 'Grande',
  giant: 'Gigante',
};

const ENERGY_LABEL: Record<string, string> = {
  couch: 'De sofá',
  explorer: 'Explorador',
  sprinter: 'Velocista',
};

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormatter = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

/**
 * Quedadas.
 *
 * Lo importante de esta pantalla es la **afinidad del grupo antes de unirse**, y
 * que se calcula por el mínimo par a par y no por el promedio. Un grupo vale lo
 * que vale su peor pareja: un promedio del 85 % puede esconder un par al 30 %
 * que arruina el paseo, y es justo el conflicto que la aplicación quiere evitar.
 */
export default function PlaydatesScreen() {
  const theme = useTheme();
  const dog = myDog();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Organizar</Eyebrow>
          <Title>Quedadas cerca</Title>
          <Body muted>
            Antes de unirte ves cómo encaja tu perro con el grupo entero, no solo con quien lo
            organiza.
          </Body>
        </View>

        <Button label="Crear una quedada" accessibilityHint="Proponer un paseo con fecha y lugar" />

        {playdates().map((playdate) => {
          const attendees = playdate.attendeeIds
            .map((id) => dogById(id))
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

          // Se simula unirse: la afinidad que se muestra es la que tendría el
          // grupo CON el perro del usuario dentro, que es la pregunta real.
          const withMe = attendees.some((entry) => entry.id === dog.id)
            ? attendees
            : [...attendees, dog];
          const affinity = groupAffinity(withMe);
          const weakest = affinity.weakestPair;
          const weakestNames =
            weakest && weakest.score < 70
              ? [dogById(weakest.a)?.name, dogById(weakest.b)?.name].filter(Boolean).join(' y ')
              : null;

          const alreadyIn = attendees.some((entry) => entry.id === dog.id);

          return (
            <Card key={playdate.id}>
              <Row>
                <Heading>{playdate.title}</Heading>
                {playdate.leashed ? <Badge>Con correa</Badge> : null}
                {alreadyIn ? <Badge tone="accent">Ya vas</Badge> : null}
              </Row>

              <Caption>
                {dateFormatter.format(playdate.startsAt)} ·{' '}
                {timeFormatter.format(playdate.startsAt)}–{timeFormatter.format(playdate.endsAt)}
              </Caption>
              <Caption>
                {playdate.placeName} · {attendees.length} de {playdate.maxDogs} perros
              </Caption>

              <Body muted>{playdate.description}</Body>

              {/* Afinidad grupal: el mínimo, no el promedio. */}
              <View
                style={{
                  backgroundColor: theme.colors.surfaceSunken,
                  borderRadius: theme.radius.md,
                  padding: theme.space[3],
                  gap: theme.space[1],
                }}
              >
                <Row gap={2}>
                  <Body>
                    Afinidad del grupo contigo: <Body>{affinity.min} %</Body>
                  </Body>
                </Row>
                <Caption>
                  {weakestNames
                    ? `Eslabón más débil: ${weakestNames} (${weakest?.score} %)`
                    : 'Ninguna pareja del grupo se queda corta'}
                </Caption>
                <Caption>
                  Se mide por la pareja peor emparejada, no por el promedio: un grupo vale lo que
                  vale su peor pareja.
                </Caption>
              </View>

              <Row>
                {playdate.admitsSizes.map((size) => (
                  <Badge key={size} tone="accent">
                    {SIZE_LABEL[size] ?? size}
                  </Badge>
                ))}
                {playdate.admitsEnergy.map((energy) => (
                  <Badge key={energy}>{ENERGY_LABEL[energy] ?? energy}</Badge>
                ))}
              </Row>

              {affinity.hasVeto ? (
                <Notice>
                  <Body>Tu perro no puede unirse a este grupo.</Body>
                  <Caption>
                    Hay una pareja incompatible por seguridad. No es una puntuación baja: es un
                    límite que no se compensa.
                  </Caption>
                </Notice>
              ) : (
                <Button
                  label={alreadyIn ? 'Ver asistentes' : 'Apuntar a ' + dog.name}
                  variant={alreadyIn ? 'outline' : 'primary'}
                />
              )}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
