import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { LargeTitle, NavBar, Separator, useScrolled } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { Body, Caption, Notice, Screen } from '@/components/ui';
import {
  markActivityRead,
  useActivity,
  type ActivityItem,
  type ActivityKind,
} from '@/lib/activity';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Bone,
  Clock,
  Eye,
  MessageCircle,
  Share2,
  Syringe,
  UserPlus,
  type LucideIcon,
} from '@/lib/icons';
import { timeAgo } from '@/lib/posts';
import { useTheme } from '@/lib/theme';

/**
 * Actividad.
 *
 * Está separada de los mensajes a propósito, y no por ordenar: una reacción es
 * algo que ya ha ocurrido y un mensaje es alguien esperando respuesta.
 * Mezclarlos hace que lo segundo se pierda entre lo primero, y aquí lo segundo
 * puede ser «he visto a tu perro cruzando la calle».
 *
 * Por eso lo accionable va arriba y separado: un avistamiento y una vacuna
 * vencida piden hacer algo hoy; que alguien haya movido la cola con tu foto,
 * no.
 *
 * Y una cosa que esta lista **no** tiene: motivos inventados para volver. Nada
 * de «hace tres días que no publicas». Todo lo que hay aquí lo ha hecho una
 * persona.
 */
const META: Record<ActivityKind, { icon: LucideIcon; tint: 'primary' | 'live' | 'alert' }> = {
  reaction: { icon: Bone, tint: 'live' },
  comment: { icon: MessageCircle, tint: 'primary' },
  bark: { icon: Share2, tint: 'primary' },
  follow: { icon: UserPlus, tint: 'primary' },
  schedule_match: { icon: Clock, tint: 'primary' },
  sighting: { icon: Eye, tint: 'alert' },
  reminder: { icon: Syringe, tint: 'alert' },
};

export default function ActivityScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { scrolled, onScroll } = useScrolled();
  const items = useActivity();

  // Se marca leído al abrir la pantalla, no al tocar cada línea. Una lista que
  // exige tocarlo todo para vaciar el contador se acaba ignorando entera.
  useEffect(() => {
    markActivityRead();
  }, []);

  const actionable = items.filter((item) => item.actionable);
  const rest = items.filter((item) => !item.actionable);

  return (
    <Screen>
      <NavBar title="Actividad" scrolled={scrolled} showTitle={scrolled} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
      >
        <LargeTitle subtitle="Lo que ha hecho alguien. Aquí no hay nada que te hayamos inventado para que vuelvas.">
          Actividad
        </LargeTitle>

        {actionable.length > 0 ? (
          <>
            <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[2] }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.displayBold,
                  fontSize: theme.fontSize.lg,
                }}
              >
                Pide algo de ti
              </Text>
            </View>
            <Separator />
            {actionable.map((item) => (
              <Row
                key={item.id}
                item={item}
                onPress={() => {
                  haptics.tap();
                  if (item.kind === 'sighting') router.push('/sos');
                  else if (item.kind === 'reminder') router.push('/perfil');
                  else router.push('/descubrir');
                }}
              />
            ))}
            <Separator />
          </>
        ) : null}

        <View
          style={{
            paddingHorizontal: theme.space[4],
            paddingTop: theme.space[6],
            paddingBottom: theme.space[2],
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.lg,
            }}
          >
            Lo demás
          </Text>
        </View>
        <Separator />
        {rest.map((item) => (
          <Row key={item.id} item={item} onPress={() => haptics.tap()} />
        ))}

        {items.length === 0 ? (
          <View style={{ padding: theme.space[4] }}>
            <Notice>
              <Body>Todavía no ha pasado nada.</Body>
              <Caption>
                Cuando alguien reaccione, comente o coincida contigo, aparecerá aquí. No rellenamos
                esta lista con sugerencias.
              </Caption>
            </Notice>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  const theme = useTheme();
  const meta = META[item.kind];
  const tint =
    meta.tint === 'alert'
      ? theme.colors.destructive
      : meta.tint === 'live'
        ? theme.colors.liveRing
        : theme.colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.actorName ? `${item.actorName} ` : ''}${item.body}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[3],
        minHeight: theme.touchTarget.comfortable,
        backgroundColor: pressed
          ? theme.colors.surfaceSunken
          : item.read
            ? 'transparent'
            : theme.colors.surface,
      })}
    >
      {item.actorPetId ? (
        <Avatar id={item.actorPetId} name={item.actorName ?? '·'} size={44} />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceSunken,
          }}
        >
          <Icon icon={meta.icon} size="lg" color={tint} decorative />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
            lineHeight: theme.fontSize.sm * 1.45,
          }}
        >
          {item.actorName ? (
            <Text style={{ fontFamily: fonts.bodyBold }}>{item.actorName} </Text>
          ) : null}
          {item.body}
        </Text>
        <Caption>{timeAgo(item.at)}</Caption>
      </View>

      {item.actorPetId ? (
        <Icon icon={meta.icon} size="base" color={tint} decorative />
      ) : null}
    </Pressable>
  );
}
