import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { SceneView } from '@/components/scene';
import { buildScene } from '@/lib/artwork';
import { Icon } from '@/components/icon';
import { useActivePet } from '@/lib/active-pet';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Eye, MapPin, Send, Sparkles, Video, X } from '@/lib/icons';
import { useReducedMotion } from '@/lib/motion';
import { timeAgo } from '@/lib/posts';
import { expiresInLabel, markStoryViewed, useStoryGroups, type Story } from '@/lib/stories';
import { useTheme } from '@/lib/theme';

/**
 * El visor de estados.
 *
 * Copia la mecánica de Instagram porque está resuelta y la gente la tiene en el
 * dedo, y cada pieza hace un trabajo concreto:
 *
 *  - **Barras arriba, una por estado.** Dicen cuántos quedan antes de entrar. Un
 *    visor sin ellas se siente infinito y la gente se sale al segundo.
 *  - **Tocar a la derecha avanza, a la izquierda retrocede.** Nunca un botón:
 *    el pulgar ya está en la pantalla.
 *  - **Mantener pulsado pausa.** Es lo que salva un estado con texto que se va
 *    antes de terminar de leerlo, y es justo el caso de esta aplicación, donde
 *    lo que se publica suele ser un aviso —«hay obras en la entrada sur»— y no
 *    una foto bonita.
 *  - **Se marca como visto al abrirlo, no al terminarlo.** Volver a encontrarte
 *    sin ver algo que ya has mirado es la forma más rápida de que el anillo deje
 *    de significar nada.
 *
 * Con movimiento reducido no hay barra que avanza sola: el estado se queda
 * hasta que se toca. La animación era el temporizador, así que quitarla sin más
 * habría dejado el visor congelado.
 */
const STORY_MS = 6_000;

export default function StoriesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const me = useActivePet();
  const groups = useStoryGroups();
  const params = useLocalSearchParams<{ pet?: string }>();

  const startGroup = Math.max(
    0,
    groups.findIndex((group) => group.petId === params.pet),
  );
  const [groupIndex, setGroupIndex] = useState(startGroup);
  const group = groups[groupIndex] ?? null;
  const [index, setIndex] = useState(group?.firstUnseenIndex ?? 0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');

  const story = group?.stories[index] ?? null;
  const progress = useRef(new Animated.Value(0)).current;

  const close = useCallback(() => router.back(), [router]);

  const advance = useCallback(() => {
    if (!group) return close();
    if (index + 1 < group.stories.length) {
      setIndex(index + 1);
      return;
    }
    if (groupIndex + 1 < groups.length) {
      setGroupIndex(groupIndex + 1);
      setIndex(0);
      return;
    }
    close();
  }, [close, group, groupIndex, groups.length, index]);

  const rewind = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
      return;
    }
    if (groupIndex > 0) {
      const previous = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setIndex(previous ? previous.stories.length - 1 : 0);
    }
  }, [groupIndex, groups, index]);

  // Visto al abrir, no al terminar.
  useEffect(() => {
    if (story) markStoryViewed(story.id);
  }, [story]);

  useEffect(() => {
    progress.setValue(0);
    if (!story || reduced || paused) return;

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) advance();
    });
    return () => animation.stop();
  }, [advance, paused, progress, reduced, story]);

  if (!group || !story) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.space[6],
          gap: theme.space[3],
        }}
      >
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.lg,
            textAlign: 'center',
          }}
        >
          No queda ningún estado abierto
        </Text>
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
            textAlign: 'center',
            lineHeight: theme.fontSize.base * 1.5,
          }}
        >
          Caducan a las 24 horas y no se guardan. Es lo que hace que sirvan para avisar de algo que
          pasa hoy.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={close}
          style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.base,
            }}
          >
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  const mine = story.petId === me.id;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* El medio, a pantalla completa y detrás de todo lo demás. */}
      <StoryMedia story={story} width={width} height={height} />

      {/* Zonas táctiles: izquierda retrocede, derecha avanza, mantener pausa.
          No llevan etiqueta visible porque son la pantalla entera, pero sí
          nombre accesible: quien navega con lector necesita los dos botones. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Estado anterior"
          onPress={rewind}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          delayLongPress={220}
          style={{ width: '32%' }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Siguiente estado"
          onPress={advance}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          delayLongPress={220}
          style={{ flex: 1 }}
        />
      </View>

      {/* Barras de progreso, una por estado del mismo animal. */}
      <View
        style={{
          position: 'absolute',
          top: theme.space[3],
          left: theme.space[3],
          right: theme.space[3],
          flexDirection: 'row',
          gap: 3,
        }}
        pointerEvents="none"
      >
        {group.stories.map((item, position) => (
          <View
            key={item.id}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.35)',
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={{
                height: 3,
                backgroundColor: '#fff',
                width:
                  position < index
                    ? '100%'
                    : position > index
                      ? '0%'
                      : reduced
                        ? '100%'
                        : progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
              }}
            />
          </View>
        ))}
      </View>

      {/* Cabecera */}
      <View
        style={{
          position: 'absolute',
          top: theme.space[6],
          left: theme.space[3],
          right: theme.space[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
        }}
      >
        <Avatar id={story.petId} name={story.petName} size={38} />
        <View style={{ flex: 1 }} pointerEvents="none">
          <Text
            style={{ color: '#fff', fontFamily: fonts.displayBold, fontSize: theme.fontSize.base }}
          >
            {story.petName}
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontFamily: fonts.body,
              fontSize: theme.fontSize.xs,
            }}
          >
            {timeAgo(story.createdAt)} · {expiresInLabel(story)}
            {paused ? ' · en pausa' : ''}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar los estados"
          onPress={close}
          style={({ pressed }) => ({
            width: theme.touchTarget.min,
            height: theme.touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon icon={X} size="lg" color="#fff" decorative />
        </Pressable>
      </View>

      {/* Pie: el texto del estado, el lugar, y responder o quién lo ha visto. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: theme.space[4],
          gap: theme.space[3],
          backgroundColor: 'rgba(0,0,0,0.62)',
        }}
      >
        {story.placeName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1] }}>
            <Icon icon={MapPin} size="sm" color="#fff" decorative />
            <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: theme.fontSize.sm }}>
              {story.placeName}
            </Text>
          </View>
        ) : null}

        {story.text.length > 0 && story.kind !== 'text' ? (
          <Text
            style={{
              color: '#fff',
              fontFamily: fonts.body,
              fontSize: theme.fontSize.base,
              lineHeight: theme.fontSize.base * 1.4,
            }}
          >
            {story.text}
          </Text>
        ) : null}

        {mine ? (
          // El autor ve quién lo ha visto. Nadie más: en una aplicación donde se
          // publica dónde estás, saber quién te mira es información sensible en
          // las dos direcciones.
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <Icon icon={Eye} size="base" color="#fff" decorative />
            <Text style={{ color: '#fff', fontFamily: fonts.body, fontSize: theme.fontSize.sm }}>
              {story.viewers.length === 0
                ? 'Todavía no lo ha visto nadie'
                : story.viewers.length === 1
                  ? `Lo ha visto ${story.viewers[0]}`
                  : `Lo han visto ${story.viewers.length}: ${story.viewers.join(', ')}`}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder={`Responder a ${story.petName}`}
              placeholderTextColor="rgba(255,255,255,0.65)"
              accessibilityLabel={`Responder al estado de ${story.petName}`}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              style={{
                flex: 1,
                minHeight: theme.touchTarget.min,
                paddingHorizontal: theme.space[4],
                borderRadius: theme.radius.full,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.6)',
                color: '#fff',
                fontFamily: fonts.body,
                fontSize: theme.fontSize.base,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar la respuesta"
              accessibilityState={{ disabled: reply.trim().length === 0 }}
              disabled={reply.trim().length === 0}
              onPress={() => {
                haptics.commit();
                setReply('');
              }}
              style={({ pressed }) => ({
                width: theme.touchTarget.min,
                height: theme.touchTarget.min,
                borderRadius: theme.radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  reply.trim().length === 0 ? 'rgba(255,255,255,0.2)' : theme.colors.primary,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon icon={Send} size="base" color="#fff" decorative />
            </Pressable>
          </View>
        )}

        {/* Responder a un estado abre una conversación, y esa conversación
            llevará escrito de dónde sale. Se dice aquí para que nadie escriba
            creyendo que es anónimo. */}
        {!mine ? (
          <Text
            style={{
              color: 'rgba(255,255,255,0.75)',
              fontFamily: fonts.body,
              fontSize: theme.fontSize.xs,
            }}
          >
            Tu respuesta abre un mensaje directo con {story.authorName}, no un comentario público.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * El medio del estado.
 *
 * Los estados de texto se pintan sobre un fondo de la propia paleta y se leen
 * en grande: son la mitad de lo que se publica aquí, porque lo que más se avisa
 * —«hay obras», «salimos a las siete»— no necesita foto.
 *
 * Cuando hay archivo se enseña; cuando no, se enseña **su descripción**. La
 * semilla no trae medios a propósito: meter vídeos y fotos de archivo de perros
 * que no son de nadie hace que todo se vea como una maqueta.
 */
function StoryMedia({ story, width, height }: { story: Story; width: number; height: number }) {
  const theme = useTheme();
  const scene = useMemo(
    () => buildScene({ seed: story.id, petId: story.petId, at: story.createdAt, width: 360, height: 640 }),
    [story.id, story.petId, story.createdAt],
  );

  if (story.kind === 'text') {
    return (
      <View
        accessible
        accessibilityLabel={story.text}
        style={{
          width,
          height,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.space[8],
        }}
      >
        <Text
          style={{
            color: theme.colors.primaryForeground,
            fontFamily: fonts.displayExtrabold,
            fontSize: theme.fontSize['2xl'],
            lineHeight: theme.fontSize['2xl'] * 1.25,
            textAlign: 'center',
          }}
        >
          {story.text}
        </Text>
      </View>
    );
  }

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={story.alt} style={{ width, height }}>
      <SceneView scene={scene} width={width} height={height} />

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: height * 0.42,
          paddingHorizontal: theme.space[8],
          alignItems: 'center',
          gap: theme.space[2],
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[1],
            paddingHorizontal: theme.space[2],
            paddingVertical: 2,
            borderRadius: theme.radius.xs,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
        >
          <Icon icon={story.kind === 'video' ? Video : Sparkles} size="sm" color="#fff" decorative />
          <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 11 }}>
            {story.kind === 'video' ? 'Vídeo · ilustración generada' : 'Ilustración generada'}
          </Text>
        </View>
      </View>
    </View>
  );
}