import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ConditionsControl } from '@/components/conditions-control';
import { FeedCard } from '@/components/feed-card';
import { LargeTitle, NavBar, useScrolled } from '@/components/chrome';
import { PetSwitcher } from '@/components/pet-switcher';
import { StoryRail } from '@/components/story-rail';
import { WelfareNotice } from '@/components/welfare-notice';
import { Body, Caption, Notice, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { useConditions } from '@/lib/conditions';
import {
  communitiesFor,
  discover,
  petHasMeetups,
  servicesFor,
  speciesOf,
  walkingNow,
} from '@/lib/data';
import { SERVICE_KIND_LABEL, speciesName } from '@/lib/labels';
import { fonts } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

/**
 * El feed.
 *
 * Es la pantalla principal a propósito, y no el radar. Un radar sin gente es una
 * pantalla vacía, y al empezar en un barrio esa es la situación normal. La
 * coincidencia de horarios, en cambio, funciona desde el segundo usuario y sin
 * que nadie tenga que estar conectado.
 *
 * La forma es la de un feed —fila de burbujas arriba, entradas a sangre debajo—
 * porque es la que la gente ya sabe leer sin que nadie se lo explique. Lo que
 * **no** cambia por eso es el contenido: la afinidad sigue siendo el titular, los
 * tres ejes siguen separados, y el bienestar sigue mandando por encima de todo.
 *
 * Con una especie solitaria seleccionada la pantalla cambia de contenido, no se
 * queda vacía con una disculpa.
 */
export default function FeedScreen() {
  const theme = useTheme();
  const pet = useActivePet();
  const species = speciesOf(pet);
  const social = petHasMeetups(pet);
  const conditions = useConditions(45);
  const { entries, emptyReason, safetyVetoed, otherSpeciesNearby, welfare, restingNearby } =
    discover(pet, conditions);
  const { scrolled, onScroll } = useScrolled();

  const [checkedIn, setCheckedIn] = useState(false);
  const outNow = social ? walkingNow(pet.speciesId) : [];
  const stopped = social && welfare.level === 'stop';

  const title = !social
    ? 'Su especie no queda con nadie'
    : stopped
      ? 'Hoy no toca salir'
      : 'Con quién puede salir';

  const subtitle = !social
    ? species?.socialNote
    : stopped
      ? `Con estas condiciones no le conviene a ${pet.name}, así que no proponemos a nadie. Cuando cambien, la lista vuelve sola.`
      : 'Por temperamento, horarios y cercanía. Los tres van por separado: mezclarlos daría un número más bonito y menos cierto.';

  return (
    <Screen>
      <NavBar title="Coincide" scrolled={scrolled} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ paddingTop: theme.space[3], paddingBottom: theme.space[4] }}>
          <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[4] }}>
            <PetSwitcher />
          </View>

          {social ? (
            <StoryRail
              me={pet}
              others={outNow}
              checkedIn={checkedIn}
              onCheckIn={() => setCheckedIn((value) => !value)}
              disabled={stopped}
              disabledReason={
                stopped
                  ? `No ofrecemos salir ahora: con estas condiciones no le conviene a ${pet.name}.`
                  : undefined
              }
            />
          ) : null}
        </View>

        <LargeTitle subtitle={subtitle}>{title}</LargeTitle>

        {social ? (
          <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[4] }}>
            <ConditionsControl />
          </View>
        ) : null}

        {social && welfare.level !== 'ok' ? (
          <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[4] }}>
            <WelfareNotice verdict={welfare} petName={pet.name} />
          </View>
        ) : null}

        {social ? (
          <>
            {entries.length === 0 ? (
              <View style={{ paddingHorizontal: theme.space[4] }}>
                <EmptyState reason={emptyReason} speciesId={pet.speciesId} name={pet.name} />
              </View>
            ) : null}

            {entries.map((entry) => (
              <FeedCard key={entry.pet.id} entry={entry} viewerName={pet.name} />
            ))}

            <View
              style={{
                paddingHorizontal: theme.space[4],
                paddingTop: theme.space[6],
                gap: theme.space[3],
              }}
            >
              {safetyVetoed > 0 ? (
                <Notice>
                  <Body>
                    {safetyVetoed === 1
                      ? `Hay 1 ${speciesName(pet.speciesId).toLowerCase()} cerca que no aparece aquí.`
                      : `Hay ${safetyVetoed} cerca que no aparecen aquí.`}
                  </Body>
                  <Caption>
                    Quedan fuera por seguridad: diferencia de tamaño con riesgo de lesión, o un
                    límite que su tutor ha declarado. No es una puntuación baja que se pueda
                    compensar.
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
            </View>
          </>
        ) : (
          <View style={{ paddingHorizontal: theme.space[4] }}>
            <SolitaryPlan speciesId={pet.speciesId} name={pet.name} />
          </View>
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

      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
          lineHeight: theme.fontSize.sm * 1.5,
        }}
      >
        {communities.length === 1
          ? '1 comunidad de tutores cerca'
          : `${communities.length} comunidades de tutores cerca`}
        {' · '}
        {services.length === 1
          ? '1 servicio que la atiende'
          : `${services.length} servicios que la atienden`}
        {services[0]
          ? `. El más específico: ${services[0].name} (${SERVICE_KIND_LABEL[services[0].kind] ?? services[0].kind}). En la pestaña de comunidad está el resto.`
          : '.'}
      </Text>
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
