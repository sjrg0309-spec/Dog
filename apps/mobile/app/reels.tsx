import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { SceneView } from '@/components/scene';
import { buildScene } from '@/lib/artwork';
import { Icon } from '@/components/icon';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Bone,
  Ellipsis,
  MapPin,
  MessageCircle,
  Play,
  Share2,
  Thermometer,
  TriangleAlert,
  Video,
  Volume2,
  VolumeOff,
  X,
} from '@/lib/icons';
import { SURFACE_LABEL } from '@/lib/conditions';
import { barkReel, reactToReel, reelWarning, REPORT_REASONS, useReels, type Reel } from '@/lib/reels';
import { timeAgo } from '@/lib/posts';
import { useTheme } from '@/lib/theme';

/**
 * El reproductor de reels.
 *
 * Una lista vertical con paginación por pantalla, que es la mecánica que
 * inventó TikTok y que Instagram y YouTube copiaron después. Funciona por una
 * razón concreta: no hay que elegir nada. El siguiente llega con un gesto que
 * el pulgar ya sabe hacer.
 *
 * Lo que esta pantalla añade y ninguna de las tres tiene:
 *
 *  - **El reel dice en qué condiciones se grabó**, abajo, junto al lugar. 19 °C
 *    sobre hierba. No es letra pequeña: es el mismo dato que la aplicación pide
 *    antes de proponer un paseo.
 *  - **Lo grabado en condiciones que la propia aplicación habría desaconsejado
 *    sale con su etiqueta**, y la etiqueta explica por qué usando el mismo juez
 *    que el resto del producto. No se oculta: quien lo grabó no ha hecho nada
 *    ilegal. Pero quien lo copia sí necesita saberlo.
 *  - **Denunciar tiene un motivo para esto**: «esto no es un reto».
 */
export default function ReelsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const reels = useReels();
  const params = useLocalSearchParams<{ id?: string }>();

  const startIndex = Math.max(
    0,
    reels.findIndex((reel) => reel.id === params.id),
  );
  const [current, setCurrent] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const listRef = useRef<FlatList<Reel>>(null);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / height);
    if (index !== current) {
      setCurrent(index);
      // Un toque al cambiar de reel. Es la única háptica automática de la
      // aplicación aparte de la alarma, y se justifica igual que en el resto:
      // confirma que el gesto ha enganchado antes de que el vídeo arranque.
      haptics.tap();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={(reel) => reel.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialScrollIndex={startIndex}
        getItemLayout={(_data, index) => ({ length: height, offset: height * index, index })}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item, index }) => (
          <ReelPage
            reel={item}
            width={width}
            height={height}
            active={index === current}
            muted={muted}
            onToggleMute={() => setMuted((value) => !value)}
          />
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar los reels"
        onPress={() => router.back()}
        style={({ pressed }) => ({
          position: 'absolute',
          top: theme.space[6],
          left: theme.space[3],
          width: theme.touchTarget.min,
          height: theme.touchTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon icon={X} size="lg" color="#fff" decorative />
      </Pressable>

      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: theme.space[6] + 10, alignSelf: 'center' }}
      >
        <Text style={{ color: '#fff', fontFamily: fonts.displayBold, fontSize: theme.fontSize.base }}>
          Reels
        </Text>
      </View>
    </View>
  );
}

function ReelPage({
  reel,
  width,
  height,
  active,
  muted,
  onToggleMute,
}: {
  reel: Reel;
  width: number;
  height: number;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const theme = useTheme();
  const [reporting, setReporting] = useState(false);
  const warning = reelWarning(reel);
  const scene = useMemo(
    () => buildScene({ seed: reel.id, petId: reel.petId, at: reel.createdAt, width: 360, height: 640, pose: 'run' }),
    [reel.id, reel.petId, reel.createdAt],
  );

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* El vídeo. Sin archivo se enseña su descripción, igual que en el feed:
          meter vídeos de archivo de perros que no son de nadie hace que todo se
          vea como una maqueta, y además esos vídeos tienen dueño. */}
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={reel.alt}
        style={{ width, height }}
      >
        <SceneView scene={scene} width={width} height={height} />

        {/* El sello de que es un dibujo, y la duración. Van juntos abajo a la
            izquierda porque son la misma clase de dato: qué estás mirando. */}
        <View
          style={{
            position: 'absolute',
            left: theme.space[4],
            bottom: height * 0.42,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[1],
            paddingHorizontal: theme.space[2],
            paddingVertical: 2,
            borderRadius: theme.radius.xs,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        >
          <Icon icon={active ? Video : Play} size="sm" color="#fff" decorative />
          <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: theme.fontSize['2xs'] }}>
            {reel.durationS} s · ilustración generada{active ? '' : ' · en pausa'}
          </Text>
        </View>
      </View>

      {/* La etiqueta de condiciones, arriba y no escondida abajo. */}
      {warning ? (
        <View
          style={{
            position: 'absolute',
            top: theme.space[16],
            left: theme.space[4],
            right: theme.space[4],
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: theme.space[3],
            padding: theme.space[3],
            borderRadius: theme.radius.md,
            backgroundColor:
              warning.level === 'stop' ? theme.colors.destructive : theme.colors.warning,
          }}
        >
          <Icon
            icon={TriangleAlert}
            size="base"
            color={
              warning.level === 'stop'
                ? theme.colors.destructiveForeground
                : theme.colors.warningForeground
            }
            decorative
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color:
                  warning.level === 'stop'
                    ? theme.colors.destructiveForeground
                    : theme.colors.warningForeground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.sm,
              }}
            >
              {warning.headline}
            </Text>
            <Text
              style={{
                color:
                  warning.level === 'stop'
                    ? theme.colors.destructiveForeground
                    : theme.colors.warningForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
                lineHeight: theme.fontSize.sm * 1.4,
              }}
            >
              {warning.detail}
            </Text>
          </View>
        </View>
      ) : null}

      {/* La columna de acciones a la derecha, como en cualquier reproductor
          vertical: es donde cae el pulgar sin tapar el vídeo. */}
      <View
        style={{
          position: 'absolute',
          right: theme.space[2],
          bottom: theme.space[20],
          alignItems: 'center',
          gap: theme.space[4],
        }}
      >
        <ReelAction
          icon={Bone}
          label={reel.reactedByMe ? 'Quitar la reacción' : 'Lamer'}
          count={reel.reactions}
          active={reel.reactedByMe}
          onPress={() => {
            haptics.tap();
            reactToReel(reel.id);
          }}
        />
        <ReelAction
          icon={MessageCircle}
          label={`Ver ${reel.commentCount} comentarios`}
          count={reel.commentCount}
          onPress={() => haptics.tap()}
        />
        <ReelAction
          icon={Share2}
          label={reel.barkedByMe ? 'Ya has ladrado este reel' : 'Ladrar: compartirlo'}
          count={reel.barkCount}
          active={reel.barkedByMe}
          disabled={reel.barkedByMe}
          onPress={() => {
            haptics.commit();
            barkReel(reel.id);
          }}
        />
        <ReelAction
          icon={Ellipsis}
          label="Más opciones"
          onPress={() => {
            haptics.tap();
            setReporting((value) => !value);
          }}
        />
        <ReelAction
          icon={muted ? VolumeOff : Volume2}
          label={muted ? 'Activar el sonido' : 'Silenciar'}
          active={!muted}
          onPress={() => {
            haptics.tap();
            onToggleMute();
          }}
        />
      </View>

      {/* El pie: quién, qué, dónde y en qué condiciones. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 72,
          bottom: 0,
          padding: theme.space[4],
          gap: theme.space[2],
          backgroundColor: 'rgba(0,0,0,0.62)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
          <Avatar id={reel.petId} name={reel.petName} size={36} />
          <Text
            style={{ color: '#fff', fontFamily: fonts.displayBold, fontSize: theme.fontSize.base }}
          >
            {reel.petName}
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontFamily: fonts.body,
              fontSize: theme.fontSize.xs,
            }}
          >
            {timeAgo(reel.createdAt)}
          </Text>
        </View>

        <Text
          style={{
            color: '#fff',
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
            lineHeight: theme.fontSize.base * 1.4,
          }}
        >
          {reel.caption}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3], flexWrap: 'wrap' }}>
          {reel.placeName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1] }}>
              <Icon icon={MapPin} size="sm" color="#fff" decorative />
              <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: theme.fontSize.xs }}>
                {reel.placeName}
              </Text>
            </View>
          ) : null}

          {/* Las condiciones declaradas, siempre y no solo cuando son malas. Un
              dato que solo aparece cuando algo va mal se lee como una acusación;
              siempre presente, se lee como lo que es. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1] }}>
            <Icon icon={Thermometer} size="sm" color="#fff" decorative />
            <Text
              style={{
                color: '#fff',
                fontFamily: fonts.body,
                fontSize: theme.fontSize.xs,
              }}
            >
              {reel.recordedIn.temperatureC} °C ·{' '}
              {(SURFACE_LABEL[reel.recordedIn.surface] ?? '').toLowerCase()}
            </Text>
          </View>
        </View>

        <Text
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontFamily: fonts.body,
            fontSize: theme.fontSize.xs,
          }}
        >
          {reel.soundName}
        </Text>
      </View>

      {reporting ? (
        <View
          style={{
            position: 'absolute',
            left: theme.space[4],
            right: theme.space[4],
            bottom: theme.space[16],
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.space[4],
            paddingVertical: theme.space[2],
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
              paddingVertical: theme.space[2],
            }}
          >
            Denunciar este reel
          </Text>
          {REPORT_REASONS.map((reason, position) => (
            <Pressable
              key={reason}
              accessibilityRole="button"
              accessibilityLabel={reason}
              onPress={() => {
                haptics.commit();
                setReporting(false);
              }}
              style={({ pressed }) => ({
                minHeight: theme.touchTarget.min,
                justifyContent: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Text
                style={{
                  // El primero es el que recoge el daño que este formato puede
                  // hacer aquí, así que va destacado y no perdido en la lista.
                  color: position === 0 ? theme.colors.destructive : theme.colors.foreground,
                  fontFamily: position === 0 ? fonts.bodyBold : fonts.body,
                  fontSize: theme.fontSize.base,
                }}
              >
                {reason}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ReelAction({
  icon,
  label,
  count,
  active = false,
  disabled = false,
  onPress,
}: {
  icon: typeof Bone;
  label: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}. ${count} en total`}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: theme.touchTarget.comfortable,
        alignItems: 'center',
        gap: 2,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon
        icon={icon}
        size="xl"
        color={active ? theme.colors.liveRing : '#fff'}
        fill={active ? theme.colors.liveRing : 'none'}
        strokeWidth={active ? 2.5 : 2}
        decorative
      />
      {count !== undefined ? (
        <Text
          style={{
            color: '#fff',
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.xs,
            fontVariant: ['tabular-nums'],
          }}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
