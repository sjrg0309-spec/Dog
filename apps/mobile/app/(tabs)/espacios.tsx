import { ScrollView, View } from 'react-native';

import { formGroup, formatCents, splitCost } from '@petnav/core';

import { NavBar, useScrolled } from '@/components/chrome';
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
import { petHasMeetups, speciesOf, spotsFor } from '@/lib/data';
import { OTHER_PETS } from '@/lib/demo-data';
import { speciesName } from '@/lib/labels';
import { useTheme } from '@/lib/theme';

/**
 * Espacios privados con reserva en grupo.
 *
 * Aquí está la diferencia con un directorio de sitios en alquiler: alquilar un
 * patio a una persona es fácil, y saber qué cinco animales pueden compartirlo
 * sin pelearse requiere conocerlos. Petnav ya lo sabe, así que propone el
 * grupo que maximiza el mínimo y reparte el importe.
 *
 * Para las especies de grupo pequeño esto no es un lujo: presentar dos conejos
 * en el territorio de uno de ellos acaba mal casi siempre, y un terreno neutral
 * alquilado por horas es la forma correcta de hacerlo.
 *
 * El cobro no ocurre dentro de la aplicación en esta fase, y la pantalla lo dice
 * en lugar de dejarlo para la letra pequeña.
 */
export default function SpotsScreen() {
  const theme = useTheme();
  const { scrolled, onScroll } = useScrolled();
  const pet = useActivePet();
  const species = speciesOf(pet);
  const social = petHasMeetups(pet);
  const available = spotsFor(pet.speciesId);

  if (!social) {
    return (
      <Screen>
        <NavBar title="Espacios" scrolled={scrolled} />
        <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
          <PetSwitcher />
          <View style={{ gap: theme.space[2] }}>
            <Eyebrow>Alquilar entre varios</Eyebrow>
            <Title>Un espacio compartido no es para {pet.name}</Title>
          </View>
          <Notice>
            <Body>{species?.socialNote}</Body>
            <Caption>
              Alquilar un espacio para que conozca a otro animal de su especie sería gastar dinero
              en provocar un problema. En la pestaña de comunidad está lo que sí le sirve a su
              tutor.
            </Caption>
          </Notice>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar title="Espacios" scrolled={scrolled} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
        <PetSwitcher />

        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Alquilar entre varios</Eyebrow>
          <Title>Espacios privados</Title>
          <Body muted>
            Un espacio cerrado es caro para uno y barato entre cinco. La aplicación propone el grupo
            usando el mismo algoritmo que el resto: quien encaje con todos, no solo contigo.
          </Body>
        </View>

        {available.length === 0 ? (
          <Notice>
            <Body>
              Todavía no hay ningún espacio publicado para{' '}
              {speciesName(pet.speciesId).toLowerCase()}.
            </Body>
            <Caption>
              Un espacio declara a qué especies sirve. Un patio pensado para perros no es sitio para
              presentar conejos, y ofrecerlo igualmente sería el tipo de detalle que acaba en un
              susto.
            </Caption>
          </Notice>
        ) : null}

        {available.map((spot) => {
          // El grupo se forma solo entre animales de la misma especie: el
          // algoritmo veta el resto, pero filtrar antes evita proponer un grupo
          // vacío y tener que explicarlo después.
          const pool = OTHER_PETS.filter((other) => other.speciesId === pet.speciesId);
          const group = formGroup(pet, pool, { maxPets: spot.maxPets, minAffinity: 60 });
          const shares = splitCost(spot.pricePerSlotCents, group.pets.length);
          const perPet = shares[0] ?? 0;

          return (
            <Card key={spot.id}>
              <Row>
                <Heading>{spot.title}</Heading>
                {spot.isFenced ? <Badge tone="accent">Cerrado</Badge> : null}
              </Row>

              <Caption>
                {spot.zone} · hasta {spot.maxPets} animales ·{' '}
                {formatCents(spot.pricePerSlotCents)} por{' '}
                {spot.slotMinutes >= 60 ? `${spot.slotMinutes / 60} h` : `${spot.slotMinutes} min`}
              </Caption>

              <Caption>Admite: {spot.speciesIds.map(speciesName).join(', ')}</Caption>

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
                  {group.pets.map((member) => (
                    <Badge key={member.id} tone={member.id === pet.id ? 'accent' : 'neutral'}>
                      {'name' in member ? (member as { name: string }).name : member.id}
                    </Badge>
                  ))}
                </Row>
                <Caption>
                  Afinidad del grupo {group.affinity.min} % · {formatCents(perPet)} cada uno
                </Caption>
                {group.rejected.length > 0 ? (
                  <Caption>
                    {group.rejected.length === 1
                      ? '1 quedó fuera del grupo'
                      : `${group.rejected.length} quedaron fuera del grupo`}
                    : {group.rejected[0]?.reason.toLowerCase()}
                  </Caption>
                ) : null}
              </View>

              <Button
                label={`Proponer reserva · ${formatCents(perPet)} cada uno`}
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
