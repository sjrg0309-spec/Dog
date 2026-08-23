import { ScrollView, View } from 'react-native';

import { formGroup, formatCents, splitCost } from '@doggymeet/core';

import { Badge, Body, Button, Caption, Card, Eyebrow, Heading, Notice, Row, Screen, Title } from '@/components/ui';
import { myDog, spots } from '@/lib/data';
import { OTHER_DOGS } from '@/lib/demo-data';
import { useTheme } from '@/lib/theme';

/**
 * Espacios privados con reserva en grupo.
 *
 * Aquí está la diferencia con un directorio de sitios en alquiler: alquilar un
 * patio a una persona es fácil, y saber qué cinco perros pueden compartirlo sin
 * pelearse requiere conocer a los perros. DoggyMeet ya lo sabe, así que propone
 * el grupo que maximiza el mínimo y reparte el importe.
 *
 * El cobro no ocurre dentro de la aplicación en esta fase, y la pantalla lo dice
 * en lugar de dejarlo para la letra pequeña.
 */
export default function SpotsScreen() {
  const theme = useTheme();
  const dog = myDog();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Alquilar entre varios</Eyebrow>
          <Title>Espacios privados</Title>
          <Body muted>
            Un patio cerrado es caro para uno y barato entre cinco. La aplicación propone el grupo
            usando el mismo algoritmo que el resto: quien encaje con todos, no solo contigo.
          </Body>
        </View>

        {spots().map((spot) => {
          const group = formGroup(dog, OTHER_DOGS, { maxDogs: spot.maxDogs, minAffinity: 60 });
          const shares = splitCost(spot.pricePerSlotCents, group.dogs.length);
          const perDog = shares[0] ?? 0;

          return (
            <Card key={spot.id}>
              <Row>
                <Heading>{spot.title}</Heading>
                {spot.isFenced ? <Badge tone="accent">Vallado</Badge> : null}
              </Row>

              <Caption>
                {spot.zone} · hasta {spot.maxDogs} perros ·{' '}
                {formatCents(spot.pricePerSlotCents)} por {spot.slotMinutes / 60} h
              </Caption>

              <Body muted>{spot.description}</Body>

              <View
                style={{
                  backgroundColor: theme.colors.surfaceSunken,
                  borderRadius: theme.radius.md,
                  padding: theme.space[3],
                  gap: theme.space[2],
                }}
              >
                <Body>Grupo propuesto</Body>
                <Row>
                  {group.dogs.map((member) => (
                    <Badge key={member.id} tone={member.id === dog.id ? 'accent' : 'neutral'}>
                      {'name' in member ? (member as { name: string }).name : member.id}
                    </Badge>
                  ))}
                </Row>
                <Caption>
                  Afinidad del grupo {group.affinity.min} % · {formatCents(perDog)} por perro
                </Caption>
                {group.rejected.length > 0 ? (
                  <Caption>
                    {group.rejected.length === 1
                      ? '1 perro quedó fuera del grupo'
                      : `${group.rejected.length} perros quedaron fuera del grupo`}
                    : {group.rejected[0]?.reason.toLowerCase()}
                  </Caption>
                ) : null}
              </View>

              <Button
                label={`Proponer reserva · ${formatCents(perDog)} cada uno`}
                accessibilityHint="Envía la propuesta al grupo y al anfitrión"
              />
            </Card>
          );
        })}

        <Notice>
          <Body>El pago se acuerda con el anfitrión, todavía no en la aplicación.</Body>
          <Caption>
            Repartir dinero entre varias personas exige reembolsos parciales cuando alguien se cae,
            alta fiscal del anfitrión y una postura sobre responsabilidad civil. Es la única parte
            de esto de la que no se sale iterando, así que se hace bien o no se hace.
          </Caption>
        </Notice>

        <Notice>
          <Body>La dirección exacta llega al confirmar.</Body>
          <Caption>
            Antes solo se muestra la zona: es la propiedad privada de alguien y no se publica a
            cualquiera que abra la aplicación.
          </Caption>
        </Notice>
      </ScrollView>
    </Screen>
  );
}
