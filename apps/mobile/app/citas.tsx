import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { NavBar } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { Badge, Body, Caption, Notice, Row, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { useConditions } from '@/lib/conditions';
import { discover, petHasMeetups, type DiscoveryEntry } from '@/lib/data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Check, Clock, MapPin, Undo2, X, Zap } from '@/lib/icons';
import { PLAY_LABEL, SIZE_LABEL, energyLabel } from '@/lib/labels';
import { useReducedMotion } from '@/lib/motion';
import { useTheme } from '@/lib/theme';

/**
 * Cita de juego: la baraja.
 *
 * Deslizar perfiles es un patrón de aplicación de citas y aquí funciona distinto
 * en la única cosa que importa: **la baraja ya viene filtrada por el algoritmo**.
 * Un veto duro —diferencia de tamaño con riesgo de lesión, «no cachorros
 * hiperactivos» declarado por el tutor— no llega a esta pantalla. No se puede
 * deslizar hacia un mal encuentro, porque el mal encuentro no está en el mazo.
 *
 * Eso es también lo que la hace defendible. Deslizar a ciegas empareja por foto,
 * y por foto se emparejan dos perros que no deberían soltarse en el mismo sitio.
 * Aquí la foto es lo último: primero está la energía, que es la causa número uno
 * de un encuentro que sale mal.
 *
 * El deslizamiento no es la única forma de decidir. Los dos botones de abajo
 * hacen lo mismo, porque un gesto es imposible de descubrir con un lector de
 * pantalla y difícil con una mano ocupada por la correa.
 */
const SWIPE_THRESHOLD = 110;

export default function PlaydateMatchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const pet = useActivePet();
  const conditions = useConditions(45);
  const { entries, welfare } = discover(pet, conditions);
  const social = petHasMeetups(pet);

  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<DiscoveryEntry[]>([]);

  const stopped = social && welfare.level === 'stop';
  const deck = stopped ? [] : entries;
  const current = deck[index] ?? null;
  const next = deck[index + 1] ?? null;

  const decide = (keep: boolean) => {
    if (!current) return;
    haptics.tap();
    if (keep) setLiked((list) => [...list, current]);
    setIndex((value) => value + 1);
  };

  return (
    <Screen>
      <NavBar
        title="Cita de juego"
        scrolled
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: theme.touchTarget.min,
              height: theme.touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Icon icon={X} size="lg" decorative />
          </Pressable>
        }
      />

      {stopped ? (
        <View style={{ padding: theme.space[4] }}>
          <Notice>
            <Body>Hoy no hay baraja, y es por {pet.name}.</Body>
            <Caption>
              Con estas condiciones no le conviene salir, así que no proponemos citas que luego
              habría que cancelar. Cuando cambien, la baraja vuelve sola.
            </Caption>
          </Notice>
        </View>
      ) : current ? (
        <View style={{ flex: 1, padding: theme.space[4], gap: theme.space[4] }}>
          <Caption>
            {deck.length - index === 1
              ? 'Queda 1 perfil'
              : `Quedan ${deck.length - index} perfiles`}
            . Todos pasan ya el veto de seguridad: los que no, no están en el mazo.
          </Caption>

          <View style={{ flex: 1 }}>
            {/* La siguiente carta asoma detrás. Sin ella, la última del mazo se
                siente igual que la primera y no se sabe cuándo se acaba. */}
            {next ? (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 12,
                  bottom: 0,
                  transform: [{ scale: 0.95 }],
                  opacity: 0.5,
                }}
              >
                <MatchCard entry={next} viewerName={pet.name} />
              </View>
            ) : null}

            <SwipeCard entry={current} viewerName={pet.name} onDecide={decide} />
          </View>

          <Row gap={3}>
            <View style={{ flex: 1 }}>
              <DecisionButton
                label="Ahora no"
                icon={X}
                tone="dismiss"
                onPress={() => decide(false)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DecisionButton
                label="Nos vemos"
                icon={Check}
                tone="keep"
                onPress={() => decide(true)}
              />
            </View>
          </Row>
        </View>
      ) : (
        <View style={{ padding: theme.space[4], gap: theme.space[4] }}>
          <Notice>
            <Body>
              {liked.length === 0
                ? 'Se acabó la baraja y no has guardado a nadie.'
                : liked.length === 1
                  ? 'Se acabó la baraja. Has guardado 1.'
                  : `Se acabó la baraja. Has guardado ${liked.length}.`}
            </Body>
            <Caption>
              {liked.length === 0
                ? 'No pasa nada: preferimos un mazo corto y bueno a uno largo con relleno. Vuelve a mirar cuando cambie el horario o el tiempo.'
                : 'Se abre una conversación con cada uno, con el motivo delante: qué días coincidís y a qué hora.'}
            </Caption>
          </Notice>

          {liked.map((entry) => (
            <Row key={entry.pet.id} gap={3}>
              <Avatar id={entry.pet.id} name={entry.pet.name} size={40} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fonts.displayBold,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  {entry.pet.name}
                </Text>
                <Caption>{entry.match.scheduleSummary ?? 'Sin horario en común declarado'}</Caption>
              </View>
            </Row>
          ))}

          {index > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver a empezar la baraja"
              onPress={() => {
                setIndex(0);
                setLiked([]);
                haptics.tap();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[2],
                minHeight: theme.touchTarget.min,
              }}
            >
              <Icon icon={Undo2} size="base" color={theme.colors.primary} decorative />
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize.base,
                }}
              >
                Volver a empezar
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/**
 * La carta que se arrastra.
 *
 * El sello de decisión aparece **mientras** se arrastra y no al soltar: si solo
 * apareciera al final, el gesto sería una apuesta a ciegas y habría que
 * deshacerlo la mitad de las veces.
 */
function SwipeCard({
  entry,
  viewerName,
  onDecide,
}: {
  entry: DiscoveryEntry;
  viewerName: string;
  onDecide: (keep: boolean) => void;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const pan = useRef(new Animated.ValueXY()).current;

  const responder = useRef(
    PanResponder.create({
      // No captura el toque de entrada: los botones de dentro de la carta
      // tienen que poder recibirlo. Solo se apropia del gesto cuando ya se ha
      // movido lo suficiente como para ser un arrastre y no un toque.
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 8,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_event, gesture) => {
        if (Math.abs(gesture.dx) > SWIPE_THRESHOLD) {
          const keep = gesture.dx > 0;
          Animated.timing(pan, {
            toValue: { x: keep ? 500 : -500, y: gesture.dy },
            duration: 180,
            useNativeDriver: false,
          }).start(() => {
            pan.setValue({ x: 0, y: 0 });
            onDecide(keep);
          });
          return;
        }
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          bounciness: 8,
        }).start();
      },
    }),
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });

  const keepOpacity = pan.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const dropOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      {...(reduced ? {} : responder.panHandlers)}
      style={{
        flex: 1,
        transform: reduced
          ? []
          : [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
      }}
    >
      <MatchCard entry={entry} viewerName={viewerName} />

      {!reduced ? (
        <>
          <Stamp text="Nos vemos" tone="keep" opacity={keepOpacity} side="left" />
          <Stamp text="Ahora no" tone="dismiss" opacity={dropOpacity} side="right" />
        </>
      ) : null}
    </Animated.View>
  );
}

function Stamp({
  text,
  tone,
  opacity,
  side,
}: {
  text: string;
  tone: 'keep' | 'dismiss';
  opacity: Animated.AnimatedInterpolation<string | number>;
  side: 'left' | 'right';
}) {
  const theme = useTheme();
  const color = tone === 'keep' ? theme.colors.success : theme.colors.mutedForeground;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 28,
        [side]: 24,
        opacity,
        borderWidth: 3,
        borderColor: color,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.space[3],
        paddingVertical: theme.space[1],
        transform: [{ rotate: side === 'left' ? '-14deg' : '14deg' }],
      }}
    >
      <Text
        style={{ color, fontFamily: fonts.displayExtrabold, fontSize: theme.fontSize.xl }}
      >
        {text}
      </Text>
    </Animated.View>
  );
}

/**
 * El contenido de la carta.
 *
 * La energía va la primera y en grande. No es una preferencia de diseño: un
 * perro de sofá con un velocista es la causa número uno de un mal encuentro, y
 * pesa 35 de los 100 puntos del algoritmo. Enseñarlo debajo de la foto sería
 * invertir el orden de lo que importa.
 */
function MatchCard({ entry, viewerName }: { entry: DiscoveryEntry; viewerName: string }) {
  const theme = useTheme();
  const { pet, match, distanceLabel } = entry;
  const sameEnergy = match.affinity.breakdown.energy >= 35;

  return (
    <View
      style={{
        flex: 1,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        padding: theme.space[5],
        gap: theme.space[4],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Avatar id={pet.id} name={pet.name} size={120} />

      <View style={{ alignItems: 'center', gap: theme.space[1] }}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayExtrabold,
            fontSize: theme.fontSize['2xl'],
            letterSpacing: -0.4,
          }}
        >
          {pet.name}
        </Text>
        <Caption>{pet.breeds.join(' · ')}</Caption>
      </View>

      {/* La energía, en grande y con su veredicto escrito. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          backgroundColor: sameEnergy ? theme.colors.successSurface : theme.colors.warningSurface,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[3],
        }}
      >
        <Icon
          icon={Zap}
          size="lg"
          color={sameEnergy ? theme.colors.success : theme.colors.warning}
          decorative
        />
        <View style={{ flexShrink: 1 }}>
          <Text
            style={{
              color: sameEnergy ? theme.colors.success : theme.colors.warning,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
            }}
          >
            {energyLabel(pet.energyLevel, pet.speciesId)}
          </Text>
          <Text
            style={{
              color: sameEnergy ? theme.colors.success : theme.colors.warning,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
              lineHeight: theme.fontSize.sm * 1.4,
            }}
          >
            {sameEnergy
              ? `La misma marcha que ${viewerName}. Es lo que más pesa.`
              : `Otra marcha que ${viewerName}. Se puede, con un ojo encima.`}
          </Text>
        </View>
      </View>

      <Row gap={2}>
        <Badge tone="accent">{match.affinity.score} % de afinidad</Badge>
        <Badge tone="neutral">{SIZE_LABEL[pet.size] ?? pet.size}</Badge>
        {pet.playStyles.slice(0, 2).map((style) => (
          <Badge key={style} tone="neutral">
            {PLAY_LABEL[style] ?? style}
          </Badge>
        ))}
      </Row>

      <View style={{ gap: theme.space[2], alignSelf: 'stretch' }}>
        <Row gap={2}>
          <Icon icon={Clock} size="sm" color={theme.colors.mutedForeground} decorative />
          <Caption>{match.scheduleSummary ?? 'Sin horario en común declarado'}</Caption>
        </Row>
        {distanceLabel ? (
          <Row gap={2}>
            <Icon icon={MapPin} size="sm" color={theme.colors.mutedForeground} decorative />
            <Caption>A {distanceLabel}</Caption>
          </Row>
        ) : null}
      </View>
    </View>
  );
}

function DecisionButton({
  label,
  icon,
  tone,
  onPress,
}: {
  label: string;
  icon: typeof Check;
  tone: 'keep' | 'dismiss';
  onPress: () => void;
}) {
  const theme = useTheme();
  const keep = tone === 'keep';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={
        keep ? 'Guarda el perfil y abre una conversación' : 'Pasa al siguiente perfil'
      }
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space[2],
        minHeight: theme.touchTarget.floating - 8,
        borderRadius: theme.radius.full,
        borderWidth: keep ? 0 : 2,
        borderColor: theme.colors.borderStrong,
        backgroundColor: keep ? theme.colors.primary : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon
        icon={icon}
        size="lg"
        color={keep ? theme.colors.primaryForeground : theme.colors.foreground}
        strokeWidth={2.5}
        decorative
      />
      <Text
        style={{
          color: keep ? theme.colors.primaryForeground : theme.colors.foreground,
          fontFamily: fonts.displayBold,
          fontSize: theme.fontSize.base,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
