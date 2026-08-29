import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { LargeTitle, NAV_BAR_HEIGHT, NavBar } from '@/components/chrome';
import { EmptyState, FootNote, ListGroup } from '@/components/list';
import { Appear } from '@/components/motion';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { SpotCard } from '@/components/spot-card';
import { Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { petHasMeetups, speciesOf, spotsFor } from '@/lib/data';
import { Fence, PawPrint } from '@/lib/icons';
import { speciesName } from '@/lib/labels';
import { useScrollDriver } from '@/lib/scroll';
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
 * en lugar de dejarlo para la letra pequeña — abajo, en la letra pequeña de
 * verdad, y no en dos recuadros grises que antes ocupaban la mitad de la
 * primera pantalla por delante de los espacios.
 *
 * Los espacios se leen ahora como se lee el feed: la galería a sangre, el
 * nombre y los datos debajo, y una línea de un pelo entre uno y el siguiente.
 */
export default function SpotsScreen() {
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
  const available = spotsFor(pet.speciesId);

  if (!social) {
    return (
      <Screen grouped>
        <NavBar
          title="Espacios"
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
            title={`Un espacio compartido no es para ${pet.name}`}
            body={species?.socialNote}
          />
          <FootNote>
            Alquilar un espacio para que conozca a otro animal de su especie sería gastar dinero en
            provocar un problema. En la pestaña de comunidad está lo que sí le sirve a su tutor.
          </FootNote>
        </Animated.ScrollView>
      </Screen>
    );
  }

  return (
    <Screen grouped>
      <NavBar
        title="Espacios"
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
        <LargeTitle
          scrollY={scrollY}
          subtitle="Caro para uno, barato entre cinco. El grupo lo propone el algoritmo."
        >
          Espacios privados
        </LargeTitle>

        {available.length === 0 ? (
          <EmptyState
            icon={Fence}
            title={`Ningún espacio publicado para ${speciesName(pet.speciesId).toLowerCase()}`}
            body="Un espacio declara a qué especies sirve. Un patio pensado para perros no es sitio para presentar conejos, y ofrecerlo igualmente sería el tipo de detalle que acaba en un susto."
          />
        ) : (
          <View style={{ gap: theme.space[4] }}>
            {available.map((spot, index) => (
              /* `flush`: la galería llega a las esquinas de la tarjeta y se
                 recorta con ellas, que es lo que hace que parezca una ficha de
                 la App Store y no una foto con un marco alrededor. */
              <Appear key={spot.id} index={index}>
                <ListGroup flush>
                  <SpotCard pet={pet} spot={spot} />
                </ListGroup>
              </Appear>
            ))}
          </View>
        )}

        <FootNote>
          El pago se acuerda con el anfitrión, todavía no en la aplicación. Repartir dinero entre
          varias personas exige reembolsos parciales cuando alguien se cae, alta fiscal del
          anfitrión y una postura sobre responsabilidad civil: es la única parte de esto de la que
          no se sale iterando, así que se hace bien o no se hace.
        </FootNote>
        <FootNote>
          La dirección exacta llega al confirmar. Antes solo se muestra la zona, y no es una promesa
          de este aviso: hasta que la reserva está confirmada, la dirección no está en la pantalla.
        </FootNote>
      </Animated.ScrollView>
    </Screen>
  );
}
