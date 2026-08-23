import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ConditionsControl } from '@/components/conditions-control';
import { Icon } from '@/components/icon';
import { FeedCard } from '@/components/feed-card';
import { LargeTitle, NavBar, useScrolled } from '@/components/chrome';
import { PetSwitcher } from '@/components/pet-switcher';
import { WelfareNotice } from '@/components/welfare-notice';
import { Body, Caption, Notice, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { useConditions } from '@/lib/conditions';
import { communitiesFor, discover, petHasMeetups, servicesFor, speciesOf } from '@/lib/data';
import { Sparkles } from '@/lib/icons';
import { SERVICE_KIND_LABEL, speciesName } from '@/lib/labels';
import { fonts } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

/**
 * Con quién puede salir: el motor del producto.
 *
 * Vive en su propia pantalla y no en el feed porque son dos cosas distintas y
 * mezclarlas las estropeaba las dos. El feed es lo que trae a alguien a abrir la
 * aplicación un día que no piensa salir; esto es la respuesta a «con quién
 * salgo», y es lo que hace que la aplicación funcione **a cualquier hora**,
 * también con el radar vacío, que al empezar en un barrio es la situación
 * normal.
 *
 * Lo que no cambia: la afinidad es el titular, los tres ejes van separados, y el
 * bienestar manda por encima de todo. Con una especie solitaria seleccionada la
 * pantalla cambia de contenido, no se queda vacía con una disculpa.
 */
export default function DiscoverScreen() {
  const theme = useTheme();
  const pet = useActivePet();
  const species = speciesOf(pet);
  const social = petHasMeetups(pet);
  const conditions = useConditions(45);
  const { entries, emptyReason, safetyVetoed, otherSpeciesNearby, welfare, restingNearby } =
    discover(pet, conditions);
  const { scrolled, onScroll } = useScrolled();
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
      <NavBar
        title="Con quién salir"
        scrolled={scrolled}
        trailing={
          social ? (
            <Link href="/citas" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Modo cita de juego"
                accessibilityHint="Ver los perfiles compatibles de uno en uno"
                style={({ pressed }) => ({
                  width: theme.touchTarget.min,
                  height: theme.touchTarget.min,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Icon icon={Sparkles} size="lg" decorative />
              </Pressable>
            </Link>
          ) : undefined
        }
      />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ paddingTop: theme.space[3], paddingBottom: theme.space[4] }}>
          <View style={{ paddingHorizontal: theme.space[4] }}>
            <PetSwitcher />
          </View>
        </View>

        {/* Con el bienestar en «hoy no», el titular sigue mandando; con la lista
            llena, el feed no necesita un título encima de cada cosa. */}
        {stopped || !social ? <LargeTitle subtitle={subtitle}>{title}</LargeTitle> : null}

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
