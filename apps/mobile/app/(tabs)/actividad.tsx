import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { LargeTitle, NAV_BAR_HEIGHT, NavBar } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { EmptyState, IconTile, ListGroup, SectionHeader } from '@/components/list';
import { Caption, Screen } from '@/components/ui';
import {
  markActivityRead,
  useActivity,
  type ActivityItem,
  type ActivityKind,
} from '@/lib/activity';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Bell,
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
import { useScrollDriver } from '@/lib/scroll';
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
  /* El desplazamiento en crudo: el rótulo de la barra se cruza con el título
     grande, el grande se encoge y la barra de pestañas se condensa al bajar.
     Los tres salen del mismo valor, calculado en el hilo de la interfaz. */
  const { scrollY, onScroll } = useScrollDriver();
  const items = useActivity();

  // Se marca leído al abrir la pantalla, no al tocar cada línea. Una lista que
  // exige tocarlo todo para vaciar el contador se acaba ignorando entera.
  useEffect(() => {
    markActivityRead();
  }, []);

  const actionable = items.filter((item) => item.actionable);
  const rest = items.filter((item) => !item.actionable);

  return (
    <Screen grouped>
      <NavBar title="Actividad" scrolled={false} scrollY={scrollY} revealAt={52} floating />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: NAV_BAR_HEIGHT, paddingBottom: theme.space[16] }}
      >
        <LargeTitle
          scrollY={scrollY}
          subtitle="Lo que ha hecho alguien. Aquí no hay nada inventado para que vuelvas."
        >
          Actividad
        </LargeTitle>

        {/* Lo accionable, en su propio grupo y arriba. La separación no es de
            orden: un avistamiento y una vacuna vencida piden hacer algo hoy, y
            que alguien haya movido la cola con tu foto, no. */}
        {actionable.length > 0 ? (
          <>
            <SectionHeader title="Pide algo de ti" first />
            <ListGroup leading="avatar">
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
            </ListGroup>
          </>
        ) : null}

        {rest.length > 0 ? (
          <>
            <SectionHeader title="Lo demás" first={actionable.length === 0} />
            <ListGroup leading="avatar">
              {rest.map((item) => (
                <Row key={item.id} item={item} onPress={() => haptics.tap()} />
              ))}
            </ListGroup>
          </>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Todavía no ha pasado nada"
            body="Cuando alguien reaccione, comente o coincida contigo, aparecerá aquí. No rellenamos esta lista con sugerencias."
          />
        ) : null}
      </Animated.ScrollView>
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
        paddingHorizontal: theme.space[3] + 2,
        paddingVertical: theme.space[3],
        minHeight: theme.touchTarget.comfortable,
        /* Lo no leído se tiñe del acento, no de la superficie. Dentro de la
           tarjeta agrupada la superficie **es** el fondo de la fila, así que
           marcar así lo nuevo no marcaba nada. */
        backgroundColor: pressed
          ? theme.colors.surfaceSunken
          : item.read
            ? 'transparent'
            : theme.colors.accent,
      })}
    >
      {item.actorPetId ? (
        <Avatar id={item.actorPetId} name={item.actorName ?? '·'} size={44} />
      ) : (
        /* Sin cara detrás, la ficha teñida: el icono dice de qué es el aviso
           —una vacuna, un avistamiento— y el tinte, si corre prisa. */
        <IconTile
          icon={meta.icon}
          tone={meta.tint === 'alert' ? 'alert' : meta.tint === 'live' ? 'live' : 'primary'}
          size={44}
        />
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

      {item.actorPetId ? <Icon icon={meta.icon} size="base" color={tint} decorative /> : null}
    </Pressable>
  );
}
