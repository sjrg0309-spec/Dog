import { ScrollView, View } from 'react-native';

import { PetCard } from '@/components/pet-card';
import { PetSwitcher } from '@/components/pet-switcher';
import { Body, Caption, Eyebrow, Notice, Screen, Title } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { communitiesFor, discover, petHasMeetups, servicesFor, speciesOf } from '@/lib/data';
import { SERVICE_KIND_LABEL, speciesName } from '@/lib/labels';
import { useTheme } from '@/lib/theme';

/**
 * Descubrimiento.
 *
 * Es la pantalla principal a propósito, y no el radar. Un radar sin gente es una
 * pantalla vacía, y al empezar en un barrio esa es la situación normal. La
 * coincidencia de horarios, en cambio, funciona desde el segundo usuario y sin
 * que nadie tenga que estar conectado.
 *
 * Con una especie solitaria seleccionada esta pantalla **cambia de contenido**,
 * no se queda vacía con una disculpa. Un gato no debe conocer a otro gato; su
 * tutor sí necesita a otros tutores y un veterinario que sepa tratarlo, y eso es
 * lo que se enseña en su lugar.
 */
export default function DiscoverScreen() {
  const theme = useTheme();
  const pet = useActivePet();
  const species = speciesOf(pet);
  const social = petHasMeetups(pet);
  const { entries, emptyReason, safetyVetoed, otherSpeciesNearby } = discover(pet);

  const outNow = entries.filter((entry) => entry.pet.walkingUntilMinutes !== null);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <PetSwitcher />

        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Para {pet.name}</Eyebrow>
          <Title>{social ? 'Con quién puede salir' : 'Su especie no queda con nadie'}</Title>
          <Body muted>
            {social
              ? 'Ordenado por temperamento, coincidencia de horarios y cercanía. Los tres se muestran por separado: mezclarlos daría un número más bonito y menos cierto.'
              : species?.socialNote}
          </Body>
        </View>

        {social ? (
          <>
            {outNow.length > 0 ? (
              <Caption>
                {outNow.length === 1
                  ? '1 de ellos está fuera ahora mismo'
                  : `${outNow.length} de ellos están fuera ahora mismo`}
              </Caption>
            ) : null}

            {entries.length === 0 ? (
              <EmptyState reason={emptyReason} speciesId={pet.speciesId} name={pet.name} />
            ) : null}

            <View style={{ gap: theme.space[4] }}>
              {entries.map((entry) => (
                <PetCard key={entry.pet.id} entry={entry} />
              ))}
            </View>

            {safetyVetoed > 0 ? (
              <Notice>
                <Body>
                  {safetyVetoed === 1
                    ? `Hay 1 ${speciesName(pet.speciesId).toLowerCase()} cerca que no aparece aquí.`
                    : `Hay ${safetyVetoed} cerca que no aparecen aquí.`}
                </Body>
                <Caption>
                  Quedan fuera por seguridad: diferencia de tamaño con riesgo de lesión, o un límite
                  que su tutor ha declarado. No es una puntuación baja que se pueda compensar.
                </Caption>
              </Notice>
            ) : null}

            {otherSpeciesNearby > 0 ? (
              <Caption>
                Hay {otherSpeciesNearby} animales de otras especies registrados cerca. No aparecen
                porque los encuentros son siempre entre animales de la misma especie: un hurón fue
                criado para cazar conejos, y ninguna puntuación de carácter debería poder ponerlos
                en el mismo sitio.
              </Caption>
            ) : null}
          </>
        ) : (
          <SolitaryPlan speciesId={pet.speciesId} name={pet.name} />
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * Lo que hay para una especie solitaria.
 *
 * No es una pantalla de consolación: es el producto para la mitad del catálogo.
 * Un tutor de reptiles no necesita una quedada, necesita saber qué veterinario
 * de exóticos está abierto un domingo.
 */
function SolitaryPlan({ speciesId, name }: { speciesId: string; name: string }) {
  const theme = useTheme();
  const communities = communitiesFor(speciesId);
  const services = servicesFor(speciesId);
  const emergency = services.filter((service) => service.is24h);

  return (
    <View style={{ gap: theme.space[4] }}>
      <Notice>
        <Body>No todas las mascotas socializan; todos los tutores sí.</Body>
        <Caption>
          Meter a {name} en un encuentro para conocer a otro animal de su especie sería estresarla.
          La aplicación no lo ofrece, y lo dice en lugar de callarlo.
        </Caption>
      </Notice>

      {emergency.length > 0 ? (
        <Notice>
          <Body>Urgencias cerca: {emergency.map((service) => service.name).join(', ')}.</Body>
          <Caption>
            Buscar un veterinario de guardia a las tres de la mañana no debería exigir registrarse
            ni recordar dónde estaba el número.
          </Caption>
        </Notice>
      ) : null}

      <View style={{ gap: theme.space[2] }}>
        <Caption>
          {communities.length === 1
            ? '1 comunidad de tutores cerca'
            : `${communities.length} comunidades de tutores cerca`}
          {' · '}
          {services.length === 1
            ? '1 servicio que la atiende'
            : `${services.length} servicios que la atienden`}
        </Caption>
        <Caption>
          El más específico: {services[0]?.name}
          {services[0] ? ` · ${SERVICE_KIND_LABEL[services[0].kind] ?? services[0].kind}` : ''}. En
          la pestaña de comunidad está el resto.
        </Caption>
      </View>
    </View>
  );
}

/**
 * Los estados vacíos de esta aplicación no son excepciones que disimular: son
 * la norma al empezar en un barrio. Cada uno dice lo que de verdad pasa y
 * propone la salida concreta, en vez de enseñar la misma pantalla en blanco.
 */
function EmptyState({
  reason,
  speciesId,
  name,
}: {
  reason: string;
  speciesId: string;
  name: string;
}) {
  const kind = speciesName(speciesId).toLowerCase();

  if (reason === 'no_candidates') {
    return (
      <Notice>
        <Body>Todavía no hay ningún otro {kind} registrado cerca de ti.</Body>
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
        <Body>Hay más cerca, pero ninguno sale a tus horas.</Body>
        <Caption>
          Puedes añadir otra franja a tu horario o proponer una quedada a una hora concreta.
        </Caption>
      </Notice>
    );
  }

  return (
    <Notice>
      <Body>Hay más cerca, pero ninguno encaja con {name}.</Body>
      <Caption>
        Preferimos decirlo a rellenar la lista con malos emparejamientos: un encuentro que va mal
        cuesta más que una pantalla vacía.
      </Caption>
    </Notice>
  );
}
