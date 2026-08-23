import { ScrollView, View } from 'react-native';

import { DogCard } from '@/components/dog-card';
import { Body, Caption, Eyebrow, Notice, Screen, Title } from '@/components/ui';
import { discover, myDog } from '@/lib/data';
import { useTheme } from '@/lib/theme';

/**
 * Descubrimiento.
 *
 * Es la pantalla principal a propósito, y no el radar. Un radar sin gente es una
 * pantalla vacía, y al empezar en un barrio esa es la situación normal. La
 * coincidencia de horarios, en cambio, funciona desde el segundo usuario y sin
 * que nadie tenga que estar conectado.
 */
export default function DiscoverScreen() {
  const theme = useTheme();
  const dog = myDog();
  const { entries, emptyReason, vetoedCount } = discover();

  const walkingNow = entries.filter((entry) => entry.dog.walkingUntilMinutes !== null);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Para {dog.name}</Eyebrow>
          <Title>Con quién puede salir</Title>
          <Body muted>
            Ordenado por temperamento, coincidencia de horarios y cercanía. Los tres se muestran por
            separado: mezclarlos daría un número más bonito y menos cierto.
          </Body>
        </View>

        {walkingNow.length > 0 ? (
          <Caption>
            {walkingNow.length === 1
              ? '1 de ellos está paseando ahora mismo'
              : `${walkingNow.length} de ellos están paseando ahora mismo`}
          </Caption>
        ) : null}

        {entries.length === 0 ? <EmptyState reason={emptyReason} /> : null}

        <View style={{ gap: theme.space[4] }}>
          {entries.map((entry) => (
            <DogCard key={entry.dog.id} entry={entry} />
          ))}
        </View>

        {vetoedCount > 0 ? (
          <Notice>
            <Body>
              {vetoedCount === 1
                ? 'Hay 1 perro cerca que no aparece aquí.'
                : `Hay ${vetoedCount} perros cerca que no aparecen aquí.`}
            </Body>
            <Caption>
              Quedan fuera por seguridad: diferencia de tamaño con riesgo de lesión, o un límite que
              su tutor ha declarado. No es una puntuación baja que se pueda compensar.
            </Caption>
          </Notice>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * Los estados vacíos de esta aplicación no son excepciones que disimular: son
 * la norma al empezar en un barrio. Cada uno dice lo que de verdad pasa y
 * propone la salida concreta, en vez de enseñar la misma pantalla en blanco.
 */
function EmptyState({ reason }: { reason: string }) {
  if (reason === 'no_candidates') {
    return (
      <Notice>
        <Body>Todavía no hay ningún perro registrado cerca de ti.</Body>
        <Caption>
          Alguien tiene que ser el primero del barrio. Crear una quedada abierta es la forma más
          rápida de que aparezca el segundo.
        </Caption>
      </Notice>
    );
  }

  if (reason === 'no_schedule_overlap') {
    return (
      <Notice>
        <Body>Hay perros cerca, pero ninguno pasea a tus horas.</Body>
        <Caption>
          Puedes añadir otra franja a tu horario o proponer una quedada a una hora concreta.
        </Caption>
      </Notice>
    );
  }

  return (
    <Notice>
      <Body>Hay perros cerca, pero ninguno encaja con el tuyo.</Body>
      <Caption>
        Preferimos decirlo a rellenar la lista con malos emparejamientos: un encuentro que va mal
        cuesta más que una pantalla vacía.
      </Caption>
    </Notice>
  );
}
