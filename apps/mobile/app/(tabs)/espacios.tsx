import { ScrollView, View } from 'react-native';


import { NavBar, useScrolled } from '@/components/chrome';
import { PetSwitcher } from '@/components/pet-switcher';
import { SpotCard } from '@/components/spot-card';
import {
  Body,
  Caption,
  Card,
  Eyebrow,
  Notice,
  Screen,
  Title,
} from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { petHasMeetups, speciesOf, spotsFor } from '@/lib/data';
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

        {available.map((spot) => (
          <SpotCard key={spot.id} pet={pet} spot={spot} />
        ))}

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
            Antes solo se muestra la zona. Y no es una promesa de este aviso: hasta que la reserva
            está confirmada, la dirección no está en la pantalla.
          </Caption>
        </Notice>
      </ScrollView>
    </Screen>
  );
}
