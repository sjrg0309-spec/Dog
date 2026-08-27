/**
 * Puntos de encuentro.
 *
 * Esta pantalla existe para cerrar el hueco que dejaba la coincidencia de
 * horarios. Saber que coincides con alguien cinco días a la semana está bien y
 * no basta: sigue habiendo que escribirle, proponer un sitio y negociar la
 * hora, y ese último paso es el que no ocurre. Aquí el sitio y la hora ya están
 * decididos, y lo único que queda es ir.
 *
 * Es la respuesta al caso de quien sale a correr a las seis: a esa hora no hay
 * radar que valga —no hay nadie conectado— y tampoco hay parque habitual que
 * compartir, porque quien corre sale a la calle. Lo único que queda en común es
 * la rutina, y con la rutina y un catálogo de sitios se puede **elegir dónde**.
 *
 * Lo que la pantalla no enseña, y es deliberado: dónde vive nadie. Sale tu
 * caminata porque es tuya. Las de los demás existen dentro del cálculo y no
 * salen de ahí.
 *
 * De la versión anterior se ha ido el folleto de entrada —antetítulo, titular y
 * dos párrafos explicando el algoritmo antes de enseñar la primera propuesta—.
 * Lo que explicaba sigue dicho, en la letra pequeña del final, que es donde se
 * lee lo que se lee una vez.
 */

import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { LargeTitle, NavBar } from '@/components/chrome';
import { EmptyState, FootNote, ListGroup } from '@/components/list';
import { MeetupCard } from '@/components/meetup-card';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { Appear } from '@/components/motion';
import { Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { meetupsFor, petHasMeetups } from '@/lib/data';
import { CalendarDays, PawPrint } from '@/lib/icons';
import { speciesName } from '@/lib/labels';
import { useScrollDriver } from '@/lib/scroll';
import { useTheme } from '@/lib/theme';

export default function MeetupPointsScreen() {
  const theme = useTheme();
  /* El desplazamiento en crudo, en el hilo de la interfaz: con él el rótulo
   pequeño de la barra **se cruza** con el título grande —uno se va mientras el
   otro llega— en vez de encenderse de golpe, y de paso la barra de pestañas se
   condensa al bajar. Es el gesto de iOS, y lo que lo hace legible es justo que
   en ningún momento hay dos títulos a plena tinta ni ninguno. */
  const { scrollY, onScroll } = useScrollDriver();
  const pet = useActivePet();
  const social = petHasMeetups(pet);
  const meetups = meetupsFor(pet);

  return (
    <Screen grouped>
      <NavBar
        title="Puntos de encuentro"
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
        <LargeTitle subtitle="Tu rutina cruzada con la de tus vecinos, y el sitio al que llegáis todos andando.">
          Dónde y a qué hora
        </LargeTitle>

        {!social ? (
          <EmptyState
            icon={PawPrint}
            title={`Un ${speciesName(pet.speciesId).toLowerCase()} no queda en grupo`}
            body="Los puntos de encuentro son para especies que se llevan bien en manada. Para las demás la aplicación enseña comunidad y servicios, que es lo que sí sirve."
          />
        ) : meetups.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Todavía no cuadra ninguna rutina"
            body={`Hace falta que alguien de tu barrio salga a tu misma hora y al mismo ritmo, y que su animal encaje con ${pet.name}. Añadir más franjas a tu horario es lo que más posibilidades abre.`}
          />
        ) : (
          <View style={{ gap: theme.space[3] }}>
            {meetups.map((meetup, index) => (
              <Appear key={`${meetup.placeId}-${meetup.pace}-${meetup.startMinute}`} index={index}>
                <ListGroup>
                  <MeetupCard meetup={meetup} />
                </ListGroup>
              </Appear>
            ))}
          </View>
        )}

        {social && meetups.length > 0 ? (
          <FootNote>
            El sitio se elige por la caminata más larga del grupo, no por la media: un punto que
            deja a uno andando el triple que el resto es el que hace que esa persona deje de venir.
            Tu distancia es la única que se enseña; la de los demás no sale del cálculo. Y no hace
            falta que nadie esté conectado: esto funciona con la aplicación vacía.
          </FootNote>
        ) : null}
      </Animated.ScrollView>
    </Screen>
  );
}
