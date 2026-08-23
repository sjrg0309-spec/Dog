/**
 * Una publicación del feed: foto, texto y conversación.
 *
 * Tres decisiones que no son estéticas:
 *
 *  1. **La foto ocupa el ancho completo y es cuadrada.** No por copiar a nadie:
 *     una relación fija hace que el feed no dé saltos mientras cargan las
 *     imágenes, que es la diferencia entre poder desplazarse y perder el sitio
 *     cada dos tarjetas.
 *  2. **El texto alternativo es obligatorio y se enseña cuando no hay foto.**
 *     Una aplicación que eligió Atkinson Hyperlegible por accesibilidad no puede
 *     permitirse imágenes sin describir.
 *  3. **La afinidad va en la tarjeta.** Es lo que esta aplicación tiene y una
 *     red social genérica no: el perro de la foto está identificado, así que se
 *     puede decir «el tuyo encaja con este al 92 %». Sin eso, el feed sería
 *     bonito y no serviría para nada.
 *  4. **El doble toque tiene su botón.** Deja caer el rastro de huellas y pone
 *     la reacción, pero no es la única forma de ponerla: un gesto oculto que sea
 *     el único camino a una función deja fuera a quien navega con lector de
 *     pantalla, que no puede descubrirlo. La barra de abajo hace lo mismo con
 *     etiquetas.
 */

import { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { Link } from 'expo-router';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { PawTrail } from './paw-trail';
import { Badge, Row } from './ui';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Bone, ImageOff, MapPin, MessageCircle, PawPrint, Send, Share2 } from '@/lib/icons';
import { addComment, bark, react, REACTIONS, timeAgo, type Post } from '@/lib/posts';
import { useTheme } from '@/lib/theme';

/** El icono de cada reacción. El nombre y el texto viven en `lib/posts`. */
const REACTION_ICON = { lick: Bone, wag: PawPrint } as const;

export function PostCard({
  post,
  viewerName,
  affinity,
  distanceLabel = null,
}: {
  post: Post;
  viewerName: string;
  /** Cómo encaja el perro del tutor con el de la foto, si aplica. */
  affinity?: { score: number; band: string; label: string } | null;
  /** A qué distancia se publicó. Solo aparece en el feed de vecindario. */
  distanceLabel?: string | null;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const [showComments, setShowComments] = useState(false);

  /**
   * El doble toque.
   *
   * Se resuelve a mano y no con `Pressable`, porque lo que hace falta no es
   * «pulsación doble» sino **dónde** cayó el segundo dedo: el rastro de huellas
   * empieza ahí. Y no se implementa como pulsación larga ni desliza nada: es un
   * gesto conocido que no compite con el desplazamiento de la lista.
   */
  const lastTap = useRef(0);
  const [trail, setTrail] = useState<{ key: number; x: number; y: number } | null>(null);

  const onImageTap = (event: GestureResponderEvent) => {
    const now = Date.now();
    const { locationX, locationY } = event.nativeEvent;

    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      setTrail({ key: now, x: locationX, y: locationY });
      // El doble toque siempre pone la reacción, nunca la quita. Quitarla por
      // accidente al tocar dos veces de más sería el peor resultado posible.
      if (post.myReaction !== 'wag') react(post.id, 'wag');
      haptics.commit();
      return;
    }
    lastTap.current = now;
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        paddingTop: theme.space[3],
        paddingBottom: theme.space[4],
        gap: theme.space[3],
      }}
    >
      {/* Autor */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          paddingHorizontal: theme.space[4],
        }}
      >
        <Avatar id={post.petId} name={post.petName} size={40} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
            }}
          >
            {post.petName}
          </Text>
          {post.placeName ? (
            // El lugar se toca y lleva al mapa. Un rótulo de ubicación que no
            // hace nada es decoración con forma de enlace, y engaña dos veces:
            // al dedo y al lector de pantalla, que lo anuncia como texto.
            <Link href="/explorar" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Ver ${post.placeName} en el mapa`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space[1],
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Icon icon={MapPin} size="sm" color={theme.colors.primary} decorative />
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: fonts.bodyBold,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {post.placeName}
                </Text>
                {distanceLabel ? (
                  <Text
                    style={{
                      color: theme.colors.mutedForeground,
                      fontFamily: fonts.body,
                      fontSize: theme.fontSize.sm,
                    }}
                  >
                    · a {distanceLabel}
                  </Text>
                ) : null}
              </Pressable>
            </Link>
          ) : null}
        </View>
        {affinity ? (
          <Badge tone="accent">
            {affinity.score} % · {affinity.label}
          </Badge>
        ) : null}
      </View>

      {/* La foto. Doble toque para mover la cola, con el rastro cayendo desde
          donde tocó el dedo. */}
      <View>
        <Pressable
          onPress={onImageTap}
          // El gesto no se anuncia como botón: el lector de pantalla ya tiene
          // los botones de la barra de abajo, y aquí anunciaría dos veces lo
          // mismo. Lo que sí necesita es la descripción de la imagen, que la
          // pone `PostImage`.
          accessible={false}
        >
          <PostImage uri={post.imageUri} alt={post.imageAlt} />
        </Pressable>
        {trail ? (
          <PawTrail
            key={trail.key}
            origin={{ x: trail.x, y: trail.y }}
            onDone={() => setTrail(null)}
          />
        ) : null}
      </View>

      {/* Acciones */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[0.5],
          paddingHorizontal: theme.space[2],
        }}
      >
        {REACTIONS.map((reaction) => {
          const mine = post.myReaction === reaction.id;
          const count = post.reactions[reaction.id];
          return (
            <Pressable
              key={reaction.id}
              accessibilityRole="button"
              accessibilityState={{ selected: mine }}
              accessibilityLabel={
                mine
                  ? `Quitar «${reaction.label}». ${count} en total`
                  : `${reaction.label}. ${count} en total`
              }
              accessibilityHint={reaction.hint}
              onPress={() => {
                haptics.tap();
                react(post.id, reaction.id);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[1.5],
                minHeight: theme.touchTarget.min,
                paddingHorizontal: theme.space[3],
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Icon
                icon={REACTION_ICON[reaction.id]}
                size="base"
                // Puesta se pinta en terracota, que es el acento de la marca. No
                // en rojo: el rojo de esta aplicación significa perro perdido.
                color={mine ? theme.colors.liveRing : theme.colors.foreground}
                strokeWidth={mine ? 2.75 : 2}
                decorative
              />
              <Text
                style={{
                  color: mine ? theme.colors.liveRing : theme.colors.foreground,
                  fontFamily: mine ? fonts.bodyBold : fonts.body,
                  fontSize: theme.fontSize.sm,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {count}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver ${post.comments.length} comentarios`}
          accessibilityState={{ expanded: showComments }}
          onPress={() => setShowComments((value) => !value)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[1.5],
            minHeight: theme.touchTarget.min,
            paddingHorizontal: theme.space[3],
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Icon icon={MessageCircle} size="base" decorative />
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
              fontVariant: ['tabular-nums'],
            }}
          >
            {post.comments.length}
          </Text>
        </Pressable>

        {/* Ladrar es compartir, no reaccionar. Va separado del par de arriba a
            propósito: manda la publicación a gente que no la tenía. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: post.barkedByMe, selected: post.barkedByMe }}
          accessibilityLabel={
            post.barkedByMe
              ? `Ya has ladrado esta publicación. ${post.barkCount} en total`
              : `Ladrar: compartirla. ${post.barkCount} en total`
          }
          accessibilityHint={
            post.barkedByMe
              ? undefined
              : 'La verá gente que no sigue a este perro. No se puede deshacer.'
          }
          disabled={post.barkedByMe}
          onPress={() => {
            haptics.commit();
            bark(post.id);
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[1.5],
            minHeight: theme.touchTarget.min,
            paddingHorizontal: theme.space[3],
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Icon
            icon={Share2}
            size="base"
            color={post.barkedByMe ? theme.colors.primary : theme.colors.foreground}
            strokeWidth={post.barkedByMe ? 2.75 : 2}
            decorative
          />
          <Text
            style={{
              color: post.barkedByMe ? theme.colors.primary : theme.colors.foreground,
              fontFamily: post.barkedByMe ? fonts.bodyBold : fonts.body,
              fontSize: theme.fontSize.sm,
              fontVariant: ['tabular-nums'],
            }}
          >
            {post.barkCount}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.xs,
            paddingRight: theme.space[3],
          }}
        >
          {timeAgo(post.createdAt)}
        </Text>
      </View>

      {/* Texto */}
      {post.caption.length > 0 ? (
        <Text
          style={{
            paddingHorizontal: theme.space[4],
            color: theme.colors.foreground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
            lineHeight: theme.fontSize.base * 1.45,
          }}
        >
          <Text style={{ fontFamily: fonts.bodyBold }}>{post.petName}</Text> {post.caption}
        </Text>
      ) : null}

      {showComments ? (
        <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[3] }}>
          {post.comments.map((comment) => (
            <Text
              key={comment.id}
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
                lineHeight: theme.fontSize.sm * 1.5,
              }}
            >
              <Text style={{ fontFamily: fonts.bodyBold }}>{comment.authorName}</Text>{' '}
              {comment.body}
            </Text>
          ))}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe un comentario"
              placeholderTextColor={theme.colors.inputPlaceholder}
              accessibilityLabel={`Comentar la publicación de ${post.petName}`}
              multiline
              style={{
                flex: 1,
                minHeight: theme.touchTarget.min,
                paddingHorizontal: theme.space[3],
                paddingVertical: theme.space[2],
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.input,
                color: theme.colors.inputForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.base,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enviar comentario"
              accessibilityState={{ disabled: draft.trim().length === 0 }}
              disabled={draft.trim().length === 0}
              onPress={() => {
                addComment(post.id, draft, viewerName);
                setDraft('');
              }}
              style={({ pressed }) => ({
                width: theme.touchTarget.min,
                height: theme.touchTarget.min,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  draft.trim().length === 0 ? theme.colors.muted : theme.colors.primary,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Icon
                icon={Send}
                size="base"
                color={
                  draft.trim().length === 0
                    ? theme.colors.mutedForeground
                    : theme.colors.primaryForeground
                }
                decorative
              />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * El hueco de la foto.
 *
 * Cuando hay imagen se enseña; cuando no, se enseña **su descripción**, no un
 * icono genérico de foto rota. Las publicaciones de la semilla no traen fotos a
 * propósito: meter imágenes de archivo de perros que no son de nadie hace que
 * todo se vea como una maqueta, y además esas fotos tienen dueño.
 */
function PostImage({ uri, alt }: { uri: string | null; alt: string }) {
  const theme = useTheme();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessibilityLabel={alt}
        accessible
        style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.colors.muted }}
        resizeMode="cover"
      />
    );
  }

  // Sin imagen, el marco se ajusta a su texto.
  //
  // El cuadrado de la versión anterior existía para reservar el hueco mientras
  // carga una foto y que el feed no diera saltos. Cuando no hay foto que cargar
  // no hay nada que reservar, y un cuadrado vacío de 390 px con una línea de
  // texto en medio se come la pantalla entera para no decir casi nada.
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={alt}
      style={{
        width: '100%',
        backgroundColor: theme.colors.surfaceSunken,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.space[6],
        paddingHorizontal: theme.space[6],
        gap: theme.space[2],
      }}
    >
      <Icon icon={ImageOff} size="lg" color={theme.colors.mutedForeground} decorative />
      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
          lineHeight: theme.fontSize.sm * 1.5,
          textAlign: 'center',
        }}
      >
        {alt}
      </Text>
      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize.xs,
          textAlign: 'center',
        }}
      >
        Sin foto en la demostración
      </Text>
    </View>
  );
}
