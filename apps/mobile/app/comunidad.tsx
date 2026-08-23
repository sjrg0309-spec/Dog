import { ScrollView, View } from 'react-native';

import { PetSwitcher } from '@/components/pet-switcher';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Eyebrow,
  Heading,
  Notice,
  Row,
  Screen,
  Title,
} from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { communitiesFor, petHasMeetups, servicesFor, speciesOf } from '@/lib/data';
import { SERVICE_KIND_LABEL, legalSource, legalSummary, speciesName } from '@/lib/labels';
import { useTheme } from '@/lib/theme';

/**
 * Comunidad y servicios.
 *
 * Esta pestaña es la razón por la que Coincide sirve a un tutor de gato, de
 * gecko o de betta. Sin ella, la mitad del catálogo de especies tendría una
 * ficha bonita y ningún motivo para volver a abrir la aplicación.
 *
 * También sirve a las especies que sí quedan: el veterinario de urgencias es la
 * misma necesidad para todos, y a las tres de la mañana da igual el modelo
 * social de tu animal.
 */
export default function CommunityScreen() {
  const theme = useTheme();
  const pet = useActivePet();
  const species = speciesOf(pet);
  const communities = communitiesFor(pet.speciesId);
  const services = servicesFor(pet.speciesId);
  const emergency = services.filter((service) => service.is24h);
  const rest = services.filter((service) => !service.is24h);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
        <PetSwitcher />

        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Para tutores de {speciesName(pet.speciesId).toLowerCase()}</Eyebrow>
          <Title>Comunidad y servicios</Title>
          <Body muted>
            {petHasMeetups(pet)
              ? 'Además de las quedadas: gente de tu zona con la misma especie, y quién sabe tratarla cuando hace falta.'
              : 'Lo que de verdad necesita quien tiene una especie que no socializa: otros tutores y un veterinario que sepa de lo suyo.'}
          </Body>
        </View>

        {/* Las urgencias van primero. Es el orden que importa con prisa, y por
            eso es también el orden de la consulta en la base de datos. */}
        {emergency.length > 0 ? (
          <Card>
            <Row>
              <Heading>Urgencias 24 h</Heading>
              <Badge tone="live">Abierto ahora</Badge>
            </Row>
            {emergency.map((service) => (
              <View key={service.id} style={{ gap: theme.space[1] }}>
                <Body>{service.name}</Body>
                <Caption>
                  A {service.distanceLabel} ·{' '}
                  {service.speciesServed.length > 0
                    ? `Atiende: ${service.speciesServed.map(speciesName).join(', ')}`
                    : 'No ha declarado a qué especies atiende'}
                </Caption>
              </View>
            ))}
            <Button label="Llamar" accessibilityHint="Abre el teléfono con el número de urgencias" />
            <Caption>
              Este directorio se consulta sin cuenta: buscar un veterinario de guardia a las tres de
              la mañana no debería exigir registrarse.
            </Caption>
          </Card>
        ) : null}

        <View style={{ gap: theme.space[3] }}>
          <Heading>Tutores cerca</Heading>
          {communities.map((community) => (
            <Card key={community.id}>
              <Row>
                <Heading>{community.name}</Heading>
                {community.speciesId === null ? (
                  <Badge>Todas las especies</Badge>
                ) : (
                  <Badge tone="accent">{speciesName(community.speciesId)}</Badge>
                )}
              </Row>
              <Caption>
                {community.memberCount === 1
                  ? '1 tutor'
                  : `${community.memberCount} tutores`}
              </Caption>
              <Body muted>{community.description}</Body>
              <Button label="Unirse" variant="outline" />
            </Card>
          ))}
          <Caption>
            Quién está dentro de una comunidad solo lo ven sus miembros. El contador es público; la
            lista no, y eso está impuesto por la base de datos, no por esta pantalla.
          </Caption>
        </View>

        <View style={{ gap: theme.space[3] }}>
          <Heading>Servicios que la atienden</Heading>
          {rest.map((service) => (
            <Card key={service.id}>
              <Row>
                <Heading>{service.name}</Heading>
                {service.isVerified ? <Badge tone="verified">✓ Verificado</Badge> : null}
              </Row>
              <Caption>
                {SERVICE_KIND_LABEL[service.kind] ?? service.kind} · a {service.distanceLabel}
              </Caption>
              <Caption>
                {service.speciesServed.length > 0
                  ? `Atiende: ${service.speciesServed.map(speciesName).join(', ')}`
                  : 'No ha declarado a qué especies atiende'}
              </Caption>
            </Card>
          ))}
          <Caption>
            El filtro por especie es el dato que justifica el directorio entero: un veterinario de
            perros y gatos no sabe tratar a un gecko, y mandarle uno es peor que no tener
            directorio.
          </Caption>
        </View>

        {species ? (
          <Notice>
            <Body>
              {species.commonName}: {legalSummary(species)}
            </Body>
            {legalSource(species) ? <Caption>Fuente: {legalSource(species)}</Caption> : null}
            <Caption>
              Coincide no da asesoramiento legal. Esta información es orientativa y puede quedar
              desactualizada: la lista vigente es siempre la del organismo competente.
            </Caption>
          </Notice>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
