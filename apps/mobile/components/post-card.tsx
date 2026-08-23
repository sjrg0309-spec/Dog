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
 */

import { useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { Badge, Row } from './ui';
import { fonts } from '@/lib/fonts';
import { Heart, ImageOff, MapPin, MessageCircle, Send } from '@/lib/icons';
import { addComment, timeAgo, toggleLike, type Post } from '@/lib/posts';
import { useTheme } from '@/lib/theme';

export function PostCard({
  post,
  viewerName,
  affinity,
}: {
  post: Post;
  viewerName: string;
  /** Cómo encaja el perro del tutor con el de la foto, si aplica. */
  affinity?: { score: number; band: string; label: string } | null;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const [showComments, setShowComments] = useState(false);

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
            <Row gap={1}>
              <Icon icon={MapPin} size="sm" color={theme.colors.mutedForeground} decorative />
              <Text
                style={{
                  color: theme.colors.mutedForeground,
                  fontFamily: fonts.body,
                  fontSize: theme.fontSize.sm,
                }}
              >
                {post.placeName}
              </Text>
            </Row>
          ) : null}
        </View>
        {affinity ? (
          <Badge tone="accent">
            {affinity.score} % · {affinity.label}
          </Badge>
        ) : null}
      </View>

      {/* La foto. Cuadrada siempre, para que el feed no dé saltos. */}
      <PostImage uri={post.imageUri} alt={post.imageAlt} />

      {/* Acciones */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[1],
          paddingHorizontal: theme.space[2],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: post.likedByMe }}
          accessibilityLabel={
            post.likedByMe
              ? `Quitar me gusta. ${post.likeCount} en total`
              : `Me gusta. ${post.likeCount} en total`
          }
          onPress={() => toggleLike(post.id)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[2],
            minHeight: theme.touchTarget.min,
            paddingHorizontal: theme.space[3],
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Icon
            icon={Heart}
            size="base"
            color={post.likedByMe ? theme.colors.destructive : theme.colors.foreground}
            strokeWidth={post.likedByMe ? 2.75 : 2}
            decorative
          />
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: post.likedByMe ? fonts.bodyBold : fonts.body,
              fontSize: theme.fontSize.sm,
              fontVariant: ['tabular-nums'],
            }}
          >
            {post.likeCount}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver ${post.comments.length} comentarios`}
          accessibilityState={{ expanded: showComments }}
          onPress={() => setShowComments((value) => !value)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[2],
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
