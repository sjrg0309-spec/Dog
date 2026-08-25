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
 */

import { ScrollView, View } from 'react-native';

import { NavBar, useScrolled } from '@/components/chrome';
import { MeetupCard } from '@/components/meetup-card';
import { PetSwitcher } from '@/components/pet-switcher';
import { Appear } from '@/components/motion';
import { Body, Caption, Eyebrow, Notice, Screen, Title } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { meetupsFor, petHasMeetups } from '@/lib/data';
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
      <NavBar title="Puntos de encuentro" scrolled={scrolled} />
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: theme.space[4], gap: theme.space[4] }}
      >
        <PetSwitcher />

        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>De coincidir a quedar</Eyebrow>
          <Title>Dónde y a qué hora</Title>
          <Body>
            Cruzamos tu rutina con la de tus vecinos y elegimos el sitio al que llegáis todos
            andando. No hace falta que nadie esté conectado: esto funciona con la aplicación vacía.
          </Body>
        </View>

        {!social ? (
          <Notice>
            <Body>Un {speciesName(pet.speciesId).toLowerCase()} no queda en grupo.</Body>
            <Caption>
              Los puntos de encuentro son para especies que se llevan bien en manada. Para las demás
              la aplicación enseña comunidad y servicios, que es lo que sí sirve.
            </Caption>
          </Notice>
        ) : meetups.length === 0 ? (
          <Notice>
            <Body>Todavía no hay ninguna rutina que cuadre con la tuya.</Body>
            <Caption>
              Hace falta que alguien de tu barrio salga a tu misma hora y al mismo ritmo, y que su
              animal encaje con {pet.name}. Añadir más franjas a tu horario es lo que más
              posibilidades abre; también puedes crear una quedada abierta a una hora concreta.
            </Caption>
          </Notice>
        ) : (
          <View style={{ gap: theme.space[3] }}>
            {meetups.map((meetup, index) => (
              <Appear key={`${meetup.placeId}-${meetup.pace}-${meetup.startMinute}`} index={index}>
                <MeetupCard meetup={meetup} />
              </Appear>
            ))}
          </View>
        )}

        {social && meetups.length > 0 ? (
          <Caption>
            El sitio se elige por la caminata más larga del grupo, no por la media: un punto que
            deja a uno andando el triple que el resto es el que hace que esa persona deje de venir.
            Tu distancia es la única que se enseña; la de los demás no sale del cálculo.
          </Caption>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
