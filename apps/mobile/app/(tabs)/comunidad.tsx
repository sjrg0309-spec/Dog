import { ScrollView, View } from 'react-native';

import { LargeTitle, NavBar, useScrolled } from '@/components/chrome';
import {
  EmptyState,
  FootNote,
  IconCircle,
  ListRow,
  PillButton,
  RowSeparator,
  SectionHeader,
} from '@/components/list';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { Badge, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { BadgeCheck, Phone, Stethoscope, Users } from '@/lib/icons';
import { communitiesFor, servicesFor, speciesOf } from '@/lib/data';
import { SERVICE_KIND_LABEL, legalSource, legalSummary, speciesName } from '@/lib/labels';
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
  const { scrolled, onScroll } = useScrolled();
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
    <Screen>
      <NavBar title="Comunidad" scrolled={scrolled} trailing={<PetSwitcherCompact />} />
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
      >
        <LargeTitle subtitle={`Tutores de tu zona y quién sabe tratar a ${pet.name}.`}>
          Comunidad
        </LargeTitle>

        {/* Las urgencias van primero. Es el orden que importa con prisa, y por
            eso es también el orden de la consulta en la base de datos. */}
        {emergency.length > 0 ? (
          <>
            <SectionHeader title="Urgencias 24 h" first />
            <RowSeparator full />
            {emergency.map((service, index) => (
              <View key={service.id}>
                {index > 0 ? <RowSeparator /> : null}
                <ListRow
                  leading={<IconCircle icon={Stethoscope} tone="live" />}
                  title={service.name}
                  titleBadge={<Badge tone="live">Abierto</Badge>}
                  subtitle={`A ${service.distanceLabel} · ${served(service.speciesServed)}`}
                  trailing={
                    <PillButton
                      label="Llamar"
                      icon={Phone}
                      accessibilityHint="Abre el teléfono con el número de urgencias"
                    />
                  }
                />
              </View>
            ))}
            <RowSeparator full />
            <FootNote>
              Este directorio se consulta sin cuenta: buscar un veterinario de guardia a las tres de
              la mañana no debería exigir registrarse.
            </FootNote>
          </>
        ) : null}

        <SectionHeader title="Tutores cerca" first={emergency.length === 0} />
        <RowSeparator full />
        {communities.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Todavía no hay ninguna comunidad aquí"
            body={`La primera la abre alguien de tu barrio con ${speciesName(pet.speciesId).toLowerCase()}. Mientras tanto, el directorio de servicios funciona igual.`}
          />
        ) : (
          communities.map((community, index) => (
            <View key={community.id}>
              {index > 0 ? <RowSeparator /> : null}
              <ListRow
                leading={<IconCircle icon={Users} tone="primary" />}
                title={community.name}
                titleBadge={
                  community.speciesId === null ? (
                    <Badge>Todas</Badge>
                  ) : (
                    <Badge tone="accent">{speciesName(community.speciesId)}</Badge>
                  )
                }
                /* El contador va de subtítulo y la descripción de tercera
                   línea, y no al revés: dos líneas de descripción más el
                   contador hacían una fila de ciento veinte puntos, que es el
                   doble de lo que mide una fila de esta aplicación. */
                subtitle={
                  community.memberCount === 1 ? '1 tutor' : `${community.memberCount} tutores`
                }
                detail={community.description}
                trailing={<PillButton label="Unirse" />}
              />
            </View>
          ))
        )}
        <RowSeparator full />
        <FootNote>
          Quién está dentro de una comunidad solo lo ven sus miembros. El contador es público; la
          lista no, y eso está impuesto por la base de datos, no por esta pantalla.
        </FootNote>

        <SectionHeader title={`Servicios para ${speciesName(pet.speciesId).toLowerCase()}`} />
        <RowSeparator full />
        {rest.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="Ningún servicio declarado por aquí"
            body="Un servicio dice a qué especies atiende antes de aparecer, así que la lista vacía es preferible a una que mande un gecko a una peluquería canina."
          />
        ) : (
          rest.map((service, index) => (
            <View key={service.id}>
              {index > 0 ? <RowSeparator /> : null}
              <ListRow
                leading={<IconCircle icon={Stethoscope} />}
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
            </View>
          ))
        )}
        <RowSeparator full />
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
      </ScrollView>
    </Screen>
  );
}
