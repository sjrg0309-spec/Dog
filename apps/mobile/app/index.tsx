import { ScrollView, View } from 'react-native';

import { ConditionsControl } from '@/components/conditions-control';
import { PetCard } from '@/components/pet-card';
import { PetSwitcher } from '@/components/pet-switcher';
import { WelfareNotice } from '@/components/welfare-notice';
import { Body, Caption, Eyebrow, Notice, Screen, Title } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { useConditions } from '@/lib/conditions';
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
  // 45 minutos es lo que dura un paseo normal; si el animal aguanta menos, el
  // veredicto lo recorta y la pantalla enseña el número recortado.
  const conditions = useConditions(45);
  const { entries, emptyReason, safetyVetoed, otherSpeciesNearby, welfare, restingNearby } =
    discover(pet, conditions);

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
          {/* El titular tiene que decir lo mismo que el veredicto. Dejar "con
              quién puede salir" encima de un "hoy no" es contradecirse en dos
              líneas seguidas, y de las dos el usuario se cree la primera. */}
          <Title>
            {!social
              ? 'Su especie no queda con nadie'
              : welfare.level === 'stop'
                ? `Hoy no toca salir`
                : 'Con quién puede salir'}
          </Title>
          <Body muted>
            {!social
              ? species?.socialNote
              : welfare.level === 'stop'
                ? `Con estas condiciones no le conviene a ${pet.name}, así que no proponemos a nadie. Cuando cambien, la lista vuelve sola.`
                : 'Ordenado por temperamento, coincidencia de horarios y cercanía. Los tres se muestran por separado: mezclarlos daría un número más bonito y menos cierto.'}
          </Body>
        </View>

        {social ? (
          <>
            <ConditionsControl />

            {/* El veredicto va antes que la lista. Si apareciese debajo de doce
                tarjetas de animales compatibles, la pantalla ya habría dicho lo
                contrario de lo que dice el texto. */}
            <WelfareNotice verdict={welfare} petName={pet.name} />

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

            {restingNearby > 0 ? (
              <Caption>
                {restingNearby === 1
                  ? 'Hay 1 compañero que hoy descansa: a él tampoco le convienen estas condiciones.'
                  : `Hay ${restingNearby} compañeros que hoy descansan: a ellos tampoco les convienen estas condiciones.`}{' '}
                Volverán a aparecer cuando cambien, sin que nadie tenga que hacer nada.
              </Caption>
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

  if (reason === 'welfare_stop') {
    // El motivo ya lo ha explicado el aviso de arriba con todo el detalle.
    // Repetirlo aquí sería decir dos veces lo mismo; lo que falta es qué hacer.
    return (
      <Notice>
        <Body>Hoy no proponemos a nadie, y es por {name}.</Body>
        <Caption>
          No es que no haya con quien: es que hoy no le conviene. En la pestaña de comunidad hay
          cosas que sí sirven ahora mismo, y mañana la lista vuelve sola.
        </Caption>
      </Notice>
    );
  }

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
