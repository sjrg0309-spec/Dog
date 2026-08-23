/**
 * Tarjeta de una mascota en el descubrimiento.
 *
 * La decisión de diseño que gobierna este componente: **los tres ejes se
 * muestran por separado**. La afinidad es el titular porque es lo único que
 * habla del carácter del animal; la coincidencia de horarios y la distancia van
 * al lado, con su propia etiqueta. Fundirlos en un solo porcentaje convertiría a
 * un animal mediocre pero cercano en un "95 % compatible", que es mentirle al
 * usuario sobre lo único que le importa.
 *
 * Lo que cambia respecto a una tarjeta de perro: el vocabulario. "Velocista"
 * describe a un Border Collie y no significa nada en un conejo, así que las
 * etiquetas de actividad se traducen con la especie delante.
 *
 * Lo que **no** lleva es una insignia de especie. Todo lo que llega a esta lista
 * es de la misma especie que la mascota del tutor —no hay otra forma de que
 * llegue—, así que repetirla en cada tarjeta sería una etiqueta que no informa
 * de nada. La especie aparece cuando aporta algo: en la línea de descripción de
 * los animales que no tienen raza.
 */

import { Text, View } from 'react-native';

import type { AffinityBand } from '@coincide/core';

import { Badge, Caption, Card, Heading, Row } from './ui';
import { fonts } from '@/lib/fonts';
import { PLAY_LABEL, SIZE_LABEL, energyLabel, speciesName } from '@/lib/labels';
import { useTheme } from '@/lib/theme';
import type { DiscoveryEntry } from '@/lib/data';

const BAND_LABEL: Record<AffinityBand, string> = {
  great: 'Gran match',
  good: 'Buen match',
  supervised: 'Con supervisión',
  incompatible: 'No compatible',
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

/** Edad en el lenguaje que le corresponde: meses hasta el año, años después. */
function ageLabel(ageMonths: number): string {
  if (ageMonths < 12) return `${ageMonths} meses`;
  const years = Math.floor(ageMonths / 12);
  return years === 1 ? '1 año' : `${years} años`;
}

export function PetCard({ entry }: { entry: DiscoveryEntry }) {
  const theme = useTheme();
  const { pet, match, distanceLabel } = entry;
  const isWalking = pet.walkingUntilMinutes !== null;
  const descriptor = pet.breeds.length > 0 ? pet.breeds.join(', ') : speciesName(pet.speciesId);

  return (
    <Card>
      <Row>
        <Heading>{pet.name}</Heading>
        {pet.isMicrochipVerified ? <Badge tone="verified">✓ Chip verificado</Badge> : null}
        {isWalking ? <Badge tone="live">Fuera ahora</Badge> : null}
      </Row>

      <Caption>
        {descriptor} · {ageLabel(pet.ageMonths)} · {SIZE_LABEL[pet.size] ?? pet.size}
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
        <Caption>Vuestros horarios de salida no coinciden</Caption>
      )}

      <Row>
        <Badge>{energyLabel(pet.energyLevel, pet.speciesId)}</Badge>
        {pet.playStyles.map((style) => (
          <Badge key={style}>{PLAY_LABEL[style] ?? style}</Badge>
        ))}
      </Row>

      {isWalking && pet.placeName ? (
        <Caption>
          En {pet.placeName} · le quedan {pet.walkingUntilMinutes} min
        </Caption>
      ) : null}
    </Card>
  );
}
