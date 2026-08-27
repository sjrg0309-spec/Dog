import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { LargeTitle, NavBar } from '@/components/chrome';
import {
  CardRail,
  EmptyState,
  FootNote,
  IconTile,
  ListGroup,
  ListRow,
  RailCard,
  SectionHeader,
  Spotlight,
  Stagger,
} from '@/components/list';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { Badge, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { BadgeCheck, HeartPulse, Phone, Stethoscope, Users } from '@/lib/icons';
import { communitiesFor, servicesFor, speciesOf } from '@/lib/data';
import { SERVICE_KIND_LABEL, legalSource, legalSummary, speciesName } from '@/lib/labels';
import { useScrollDriver } from '@/lib/scroll';
import { useTheme } from '@/lib/theme';

/**
 * Comunidad y servicios.
 *
 * Esta pestaña es la razón por la que Petnav sirve a un tutor de gato, de
 * gecko o de betta. Sin ella, la mitad del catálogo de especies tendría una
 * ficha bonita y ningún motivo para volver a abrir la aplicación.
 *
 * También sirve a las especies que sí quedan: el veterinario de urgencias es la
 * misma necesidad para todos, y a las tres de la mañana da igual el modelo
 * social de tu animal.
 *
 * **Cómo se ve, que es lo que ha cambiado.** Era un folleto: antetítulo en
 * versalitas, titular, párrafo de presentación y debajo una pila de tarjetas
 * con borde, cada una con su botón a lo ancho. Ahora son tres listas de filas
 * —urgencias, tutores, servicios— con el retrato a la izquierda y la acción en
 * una pastilla a la derecha, que es la forma que tiene el resto de la
 * aplicación. El párrafo de presentación se ha ido entero: lo que hay debajo ya
 * dice qué es esto, y una pantalla de directorio que empieza explicándose es
 * una pantalla que tarda tres segundos en enseñar el primer veterinario.
 */
export default function CommunityScreen() {
  const theme = useTheme();
  /* El desplazamiento en crudo, en el hilo de la interfaz: con él el rótulo
   pequeño de la barra **se cruza** con el título grande —uno se va mientras el
   otro llega— en vez de encenderse de golpe, y de paso la barra de pestañas se
   condensa al bajar. Es el gesto de iOS, y lo que lo hace legible es justo que
   en ningún momento hay dos títulos a plena tinta ni ninguno. */
  const { scrollY, onScroll } = useScrollDriver();
  const pet = useActivePet();
  const species = speciesOf(pet);
  const communities = communitiesFor(pet.speciesId);
  const services = servicesFor(pet.speciesId);
  const emergency = services.filter((service) => service.is24h);
  const rest = services.filter((service) => !service.is24h);

  const served = (list: ReadonlyArray<string>): string =>
    list.length > 0
      ? `Atiende: ${list.map(speciesName).join(', ')}`
      : 'No ha declarado a qué especies atiende';

  return (
    <Screen grouped>
      <NavBar
        title="Comunidad"
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
        <LargeTitle subtitle={`Tutores de tu zona y quién sabe tratar a ${pet.name}.`}>
          Comunidad
        </LargeTitle>

        {/*
          Las urgencias van primero y **van grandes**.

          En una lista donde todo pesa lo mismo, el veterinario de guardia es
          una fila más entre catorce, y es la única de la pantalla que alguien
          puede necesitar a las tres de la mañana con una mano ocupada. Como
          pieza destacada —roja, con su botón de llamar dentro— se encuentra sin
          leer nada, que es justo lo que hace falta a esa hora.
        */}
        {emergency.length > 0 ? (
          <>
            <SectionHeader title="Urgencias 24 h" first />
            <Stagger>
              {emergency.map((service) => (
                <View key={service.id} style={{ paddingBottom: theme.space[2] }}>
                  <Spotlight
                    icon={HeartPulse}
                    eyebrow={`Abierto ahora · a ${service.distanceLabel}`}
                    title={service.name}
                    subtitle={served(service.speciesServed)}
                    action={{
                      label: 'Llamar',
                      icon: Phone,
                      hint: 'Abre el teléfono con el número de urgencias',
                    }}
                  />
                </View>
              ))}
            </Stagger>
            <FootNote>
              Este directorio se consulta sin cuenta: buscar un veterinario de guardia a las tres de
              la mañana no debería exigir registrarse.
            </FootNote>
          </>
        ) : null}

        <SectionHeader title="Tutores cerca" first={emergency.length === 0} />
        {communities.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Todavía no hay ninguna comunidad aquí"
            body={`La primera la abre alguien de tu barrio con ${speciesName(pet.speciesId).toLowerCase()}. Mientras tanto, el directorio de servicios funciona igual.`}
          />
        ) : (
          /*
            En horizontal, y no por hacer algo distinto: una comunidad se
            **elige**, no se recorre. Tres listas verticales seguidas —tutores,
            servicios, urgencias— se leen como un formulario largo por muy bien
            hechas que estén; la fila que se desliza dice «hojea y quédate con
            una», que es la decisión que hay aquí. Y de paso cada comunidad
            recupera su descripción entera, que en fila de lista salía cortada.
          */
          <CardRail>
            {communities.map((community) => (
              <RailCard
                key={community.id}
                leading={<IconTile icon={Users} tone="info" size={36} />}
                title={community.name}
                subtitle={`${
                  community.memberCount === 1 ? '1 tutor' : `${community.memberCount} tutores`
                } · ${community.description}`}
                action={{ label: 'Unirse' }}
              />
            ))}
          </CardRail>
        )}
        <FootNote>
          Quién está dentro de una comunidad solo lo ven sus miembros. El contador es público; la
          lista no, y eso está impuesto por la base de datos, no por esta pantalla.
        </FootNote>

        <SectionHeader title={`Servicios para ${speciesName(pet.speciesId).toLowerCase()}`} />
        {rest.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="Ningún servicio declarado por aquí"
            body="Un servicio dice a qué especies atiende antes de aparecer, así que la lista vacía es preferible a una que mande un gecko a una peluquería canina."
          />
        ) : (
          <ListGroup>
            {rest.map((service) => (
              <ListRow
                key={service.id}
                /* Verde para lo verificado y gris para lo que no: el tinte de
                   la ficha dice lo mismo que la insignia de al lado, y a
                   treinta píxeles se ve antes que la palabra. */
                leading={<IconTile icon={Stethoscope} tone={service.isVerified ? 'ok' : 'muted'} />}
                title={service.name}
                titleBadge={
                  service.isVerified ? (
                    <Badge tone="verified" icon={BadgeCheck}>
                      Verificado
                    </Badge>
                  ) : undefined
                }
                subtitle={`${SERVICE_KIND_LABEL[service.kind] ?? service.kind} · a ${service.distanceLabel}`}
                detail={served(service.speciesServed)}
              />
            ))}
          </ListGroup>
        )}
        <FootNote>
          El filtro por especie es el dato que justifica el directorio entero: un veterinario de
          perros y gatos no sabe tratar a un gecko, y mandarle uno es peor que no tener directorio.
        </FootNote>

        {species ? (
          <FootNote>
            {species.commonName}: {legalSummary(species)}
            {legalSource(species) ? ` Fuente: ${legalSource(species)}.` : ''} Petnav no da
            asesoramiento legal: esta información es orientativa y puede quedar desactualizada. La
            lista vigente es siempre la del organismo competente.
          </FootNote>
        ) : null}
      </Animated.ScrollView>
    </Screen>
  );
}
