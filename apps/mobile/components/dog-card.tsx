/**
 * Tarjeta de un perro en el descubrimiento.
 *
 * La decisión de diseño que gobierna este componente: **los tres ejes se
 * muestran por separado**. La afinidad es el titular porque es lo único que
 * habla del carácter del perro; la coincidencia de horarios y la distancia van
 * al lado, con su propia etiqueta. Fundirlos en un solo porcentaje convertiría a
 * un perro mediocre pero cercano en un "95 % compatible", que es mentirle al
 * usuario sobre lo único que le importa.
 */

import { Text, View } from 'react-native';

import type { AffinityBand } from '@doggymeet/core';

import { Badge, Caption, Card, Heading, Row } from './ui';
import { fonts } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';
import type { DiscoveryEntry } from '@/lib/data';

const BAND_LABEL: Record<AffinityBand, string> = {
  great: 'Gran match',
  good: 'Buen match',
  supervised: 'Con supervisión',
  incompatible: 'No compatible',
};

const ENERGY_LABEL: Record<string, string> = {
  couch: 'De sofá',
  explorer: 'Explorador',
  sprinter: 'Velocista',
};

const PLAY_LABEL: Record<string, string> = {
  chase: 'Persecución',
  wrestle: 'Lucha libre',
  toys: 'Juguetes',
  calm_walk: 'Caminata tranquila',
};

const SIZE_LABEL: Record<string, string> = {
  mini: 'Mini',
  small: 'Pequeño',
  medium: 'Mediano',
  large: 'Grande',
  giant: 'Gigante',
};

/**
 * Medidor de afinidad.
 *
 * El color acompaña, pero nunca decide solo: siempre van juntos el número, la
 * etiqueta de la banda y la barra. Alguien que no distinga el verde del ámbar
 * tiene que poder leer lo mismo.
 */
function AffinityMeter({ score, band }: { score: number; band: AffinityBand }) {
  const theme = useTheme();

  const color =
    band === 'great'
      ? theme.colors.success
      : band === 'good'
        ? theme.colors.primary
        : theme.colors.warning;

  return (
    <View
      accessible
      accessibilityLabel={`Afinidad ${score} por ciento. ${BAND_LABEL[band]}.`}
      style={{ gap: theme.space[1] }}
    >
      <Row gap={2}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontSize: theme.fontSize['2xl'],
            fontFamily: fonts.displayExtrabold,
            fontVariant: ['tabular-nums'],
          }}
        >
          {score} %
        </Text>
        <Text style={{ color, fontSize: theme.fontSize.sm, fontFamily: fonts.bodyBold }}>
          {BAND_LABEL[band]}
        </Text>
      </Row>

      <View
        style={{
          height: 6,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.muted,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(100, score))}%`,
            height: '100%',
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function DogCard({ entry }: { entry: DiscoveryEntry }) {
  const theme = useTheme();
  const { dog, match, distanceLabel } = entry;
  const isWalking = dog.walkingUntilMinutes !== null;

  return (
    <Card>
      <Row>
        <Heading>{dog.name}</Heading>
        {dog.isMicrochipVerified ? <Badge tone="verified">✓ Chip verificado</Badge> : null}
        {isWalking ? <Badge tone="live">Paseando ahora</Badge> : null}
      </Row>

      <Caption>
        {dog.breeds.join(', ')} · {Math.floor(dog.ageMonths / 12)} años ·{' '}
        {SIZE_LABEL[dog.size] ?? dog.size}
        {distanceLabel ? ` · a ${distanceLabel}` : ''}
      </Caption>

      {/* Eje 1: temperamento. El titular. */}
      <AffinityMeter score={match.affinity.score} band={match.affinity.band} />

      {match.affinity.reasons.length > 0 ? (
        <Caption>{match.affinity.reasons.slice(0, 2).join(' · ')}</Caption>
      ) : null}

      {/* Eje 2: horarios. Es lo que hace útil la aplicación a cualquier hora. */}
      {match.scheduleSummary ? (
        <View
          style={{
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
            paddingLeft: theme.space[3],
          }}
        >
          <Caption>{match.scheduleSummary}</Caption>
        </View>
      ) : (
        <Caption>Vuestros horarios de paseo no coinciden</Caption>
      )}

      <Row>
        <Badge>{ENERGY_LABEL[dog.energyLevel] ?? dog.energyLevel}</Badge>
        {dog.playStyles.map((style) => (
          <Badge key={style}>{PLAY_LABEL[style] ?? style}</Badge>
        ))}
      </Row>

      {isWalking && dog.placeName ? (
        <Caption>
          En {dog.placeName} · le quedan {dog.walkingUntilMinutes} min
        </Caption>
      ) : null}
    </Card>
  );
}
