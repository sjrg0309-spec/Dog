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

import { ScrollView, View } from 'react-native';

import { LargeTitle, NavBar, useScrolled } from '@/components/chrome';
import { EmptyState, FootNote, RowSeparator } from '@/components/list';
import { MeetupCard } from '@/components/meetup-card';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { Appear } from '@/components/motion';
import { Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { meetupsFor, petHasMeetups } from '@/lib/data';
import { CalendarDays, PawPrint } from '@/lib/icons';
import { speciesName } from '@/lib/labels';
import { useTheme } from '@/lib/theme';

export default function MeetupPointsScreen() {
  const theme = useTheme();
  const { scrolled, onScroll } = useScrolled();
  const pet = useActivePet();
  const social = petHasMeetups(pet);
  const meetups = meetupsFor(pet);

  return (
    <Screen>
      <NavBar title="Puntos de encuentro" scrolled={scrolled} trailing={<PetSwitcherCompact />} />
      <ScrollView
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
          <View>
            <RowSeparator full />
            {meetups.map((meetup, index) => (
              <View key={`${meetup.placeId}-${meetup.pace}-${meetup.startMinute}`}>
                {index > 0 ? <RowSeparator full /> : null}
                <Appear index={index}>
                  <MeetupCard meetup={meetup} />
                </Appear>
              </View>
            ))}
            <RowSeparator full />
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
      </ScrollView>
    </Screen>
  );
}
