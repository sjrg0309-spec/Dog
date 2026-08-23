/**
 * Una entrada del feed.
 *
 * Cambia la forma respecto a la tarjeta de lista anterior, no el contenido: la
 * afinidad sigue siendo el titular y los tres ejes siguen mostrándose por
 * separado. Lo que cambia es que ahora ocupa el ancho completo, tiene cabecera
 * de autor y una fila de acciones abajo, que es como se lee un feed y como la
 * gente ya sabe leerlo.
 *
 * Tres decisiones que vienen de la guía de interfaz y no del parecido:
 *
 *  - **Los bordes van a sangre y los márgenes por dentro.** Una tarjeta flotante
 *    dentro de otra tarjeta es una caja anidada, y anidar cajas era una de las
 *    cosas que este proyecto se prohibió desde el principio.
 *  - **Las acciones son texto además de icono.** Un corazón solo no dice qué
 *    hace, y aquí «guardar» y «saludar» no son lo mismo.
 *  - **Área táctil de 44 como suelo**, contando el relleno y no solo el glifo.
 */

import { Pressable, Text, View } from 'react-native';

import type { AffinityBand } from '@coincide/core';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { Badge, Row } from './ui';
import { fonts } from '@/lib/fonts';
import { BadgeCheck, Bookmark, CalendarPlus, Hand, Timer, type LucideIcon } from '@/lib/icons';
import { PLAY_LABEL, SIZE_LABEL, energyLabel, speciesName } from '@/lib/labels';
import { useTheme } from '@/lib/theme';
import type { DiscoveryEntry } from '@/lib/data';

const BAND_LABEL: Record<AffinityBand, string> = {
  great: 'Gran match',
  good: 'Buen match',
  supervised: 'Con supervisión',
  incompatible: 'No compatible',
};

function ageLabel(ageMonths: number): string {
  if (ageMonths < 12) return `${ageMonths} meses`;
  const years = Math.floor(ageMonths / 12);
  return years === 1 ? '1 año' : `${years} años`;
}

export function FeedCard({ entry, viewerName }: { entry: DiscoveryEntry; viewerName: string }) {
  const theme = useTheme();
  const { pet, match, distanceLabel } = entry;
  const isOut = pet.walkingUntilMinutes !== null;

  // El color de la banda no usa `primary`.
  //
  // Dos motivos, y el segundo lo destapó la revisión: `primary` es el color con
  // el que esta aplicación dice «esto se puede tocar» —pestaña activa, chip
  // seleccionado, botón—, y usarlo también para un estado que no se toca hace
  // que deje de significar nada. Y en tema oscuro `primary` y `success` son
  // exactamente el mismo valor, así que «Gran match» y «Buen match» salían
  // pintados igual: el color no aportaba, solo ocupaba.
  const bandColor =
    match.affinity.band === 'great'
      ? theme.colors.success
      : match.affinity.band === 'good'
        ? theme.colors.information
        : theme.colors.warning;

  const descriptor = pet.breeds.length > 0 ? pet.breeds.join(', ') : speciesName(pet.speciesId);

  return (
    <View
      style={{
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingVertical: theme.space[4],
        gap: theme.space[3],
      }}
    >
      {/* Cabecera: quién es, y dónde está si está fuera. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          paddingHorizontal: theme.space[4],
        }}
      >
        <Avatar id={pet.id} name={pet.name} size={44} live={isOut} />
        <View style={{ flex: 1, gap: 1 }}>
          <Row gap={1}>
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.lg,
              }}
            >
              {pet.name}
            </Text>
            {pet.isMicrochipVerified ? (
              <Icon icon={BadgeCheck} size="sm" color={theme.colors.success} label="Chip verificado" />
            ) : null}
          </Row>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            {isOut && pet.placeName
              ? `${pet.placeName} · le quedan ${pet.walkingUntilMinutes} min`
              : `${descriptor} · ${ageLabel(pet.ageMonths)}`}
          </Text>
        </View>
        {isOut ? <Badge tone="live">Fuera ahora</Badge> : null}
      </View>

      {/* El titular. Ocupa el ancho porque es lo que se mira primero al pasar. */}
      <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[2] }}>
        <View
          accessible
          accessibilityLabel={`Afinidad ${match.affinity.score} por ciento con ${viewerName}. ${BAND_LABEL[match.affinity.band]}.`}
          style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space[2] }}
        >
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayExtrabold,
              fontSize: theme.fontSize['3xl'],
              letterSpacing: -1,
              fontVariant: ['tabular-nums'],
            }}
          >
            {match.affinity.score} %
          </Text>
          {/* La banda va escrita: el color acompaña, nunca decide solo. */}
          <Text
            style={{ color: bandColor, fontFamily: fonts.bodyBold, fontSize: theme.fontSize.base }}
          >
            {BAND_LABEL[match.affinity.band]}
          </Text>
        </View>

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
              width: `${Math.max(0, Math.min(100, match.affinity.score))}%`,
              height: '100%',
              backgroundColor: bandColor,
            }}
          />
        </View>

        {match.affinity.reasons.length > 0 ? (
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.base,
              lineHeight: theme.fontSize.base * 1.45,
            }}
          >
            {match.affinity.reasons.slice(0, 2).join(' · ')}
          </Text>
        ) : null}

        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
          }}
        >
          {match.scheduleSummary ?? 'Vuestros horarios de salida no coinciden'}
          {distanceLabel ? ` · a ${distanceLabel}` : ''}
          {` · ${SIZE_LABEL[pet.size] ?? pet.size}`}
        </Text>

        {match.welfare && match.welfare.level === 'caution' ? (
          <Row gap={2}>
            <Icon icon={Timer} size="sm" color={theme.colors.warning} decorative />
            <Text
              style={{
                color: theme.colors.warning,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.sm,
              }}
            >
              Se propone {match.welfare.recommendedMinutes} min y luego descanso
            </Text>
          </Row>
        ) : null}

        <Row gap={1}>
          <Badge>{energyLabel(pet.energyLevel, pet.speciesId)}</Badge>
          {pet.playStyles.map((style) => (
            <Badge key={style}>{PLAY_LABEL[style] ?? style}</Badge>
          ))}
        </Row>
      </View>

      {/* Acciones. Con icono y palabra: un glifo suelto no dice qué hace. */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: theme.space[2],
          paddingTop: theme.space[1],
        }}
      >
        <Action icon={Hand} label="Saludar" hint={`Enviar un saludo al tutor de ${pet.name}`} />
        <Action
          icon={CalendarPlus}
          label="Proponer paseo"
          hint={`Proponer una salida con ${pet.name}`}
        />
        <Action icon={Bookmark} label="Guardar" hint={`Guardar a ${pet.name} para más tarde`} />
      </View>
    </View>
  );
}

function Action({ icon, label, hint }: { icon: LucideIcon; label: string; hint: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        // 44 de alto por relleno, no por el tamaño del glifo.
        minHeight: theme.touchTarget.min,
        paddingHorizontal: theme.space[3],
        opacity: pressed ? 0.5 : 1,
      })}
    >
      {/* Decorativo: la palabra va justo al lado y dice lo mismo. */}
      <Icon icon={icon} size="base" decorative />
      <Text
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
