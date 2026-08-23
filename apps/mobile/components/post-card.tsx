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

import { useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { useRouter } from 'expo-router';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { Pop } from './motion';
import { PawTrail } from './paw-trail';
import { SceneView } from './scene';
import { buildScene } from '@/lib/artwork';
import { Badge, Row } from './ui';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Bone,
  Bookmark,
  Ellipsis,
  MessageCircle,
  PawPrint,
  Send,
  Share2,
  Sparkles,
} from '@/lib/icons';
import {
  addComment,
  bark,
  react,
  REACTIONS,
  timeAgo,
  toggleSaved,
  totalReactions,
  type Post,
} from '@/lib/posts';
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
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const saved = post.savedByMe;

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
        // Abajo y no arriba, y de un pelo en vez de un píxel entero. Lo de
        // «un pelo» es densidad: en una pantalla de 3×, «1» son tres píxeles
        // físicos y la separación entre dos fotos deja de ser una separación
        // para ser una raya. Lo de «abajo» es más tonto y más visible: con el
        // borde arriba, la primera tarjeta pintaba su línea justo debajo de la
        // que ya trae la fila de pestañas, y dos pelos separados por nada son
        // exactamente el borde grueso que se estaba evitando.
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
        paddingTop: theme.space[2],
        paddingBottom: theme.space[3],
        gap: theme.space[2],
      }}
    >
      {/* Autor */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          paddingHorizontal: theme.space[4],
        }}
      >
        <Avatar id={post.petId} name={post.petName} size={34} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.sm,
            }}
          >
            {post.petName}
          </Text>
          {post.placeName ? (
            // El lugar se toca y lleva al mapa. Un rótulo de ubicación que no
            // hace nada es decoración con forma de enlace, y engaña dos veces:
            // al dedo y al lector de pantalla, que lo anuncia como texto.
            //
            // En negrita, a quince y con chincheta competía con el nombre del
            // perro: dos líneas del mismo peso, y la segunda encima pintada de
            // color. Ahora es la subordinada que siempre fue —doce, sin
            // negrita, sin icono—, y el color sigue diciendo que se toca.
            // Sin `Link asChild`: en web el `<a>` que genera se queda con el
            // estilo del `Pressable`, así que el gesto de pulsado se pierde.
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Ver ${post.placeName} en el mapa`}
              onPress={() => router.push('/explorar')}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
            >
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: fonts.body,
                  fontSize: theme.fontSize.xs,
                }}
              >
                {post.placeName}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {affinity ? (
          <Badge tone="accent">
            {affinity.score} % · {affinity.label}
          </Badge>
        ) : null}

        {/* El menú de tres puntos. Es donde Instagram pone lo que no cabe en la
            tarjeta, y aquí lo que hay dentro importa: silenciar, denunciar y
            dejar de seguir son las tres salidas de alguien que se está sintiendo
            incómodo, y tienen que estar en el sitio donde se buscan. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Opciones de la publicación de ${post.petName}`}
          accessibilityState={{ expanded: showOptions }}
          onPress={() => {
            haptics.tap();
            setShowOptions((value) => !value);
          }}
          style={({ pressed }) => ({
            width: theme.touchTarget.min,
            height: theme.touchTarget.min,
            marginRight: -theme.space[3],
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Icon icon={Ellipsis} size="base" color={theme.colors.foreground} decorative />
        </Pressable>
      </View>

      {showOptions ? (
        <View
          style={{
            marginHorizontal: theme.space[4],
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceSunken,
            paddingHorizontal: theme.space[4],
          }}
        >
          {['Silenciar a este perro', 'Dejar de seguir', 'Denunciar la publicación'].map(
            (option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={option}
                onPress={() => {
                  haptics.tap();
                  setShowOptions(false);
                }}
                style={({ pressed }) => ({
                  minHeight: theme.touchTarget.min,
                  justifyContent: 'center',
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text
                  style={{
                    color:
                      option === 'Denunciar la publicación'
                        ? theme.colors.destructive
                        : theme.colors.foreground,
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      ) : null}

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
          <PostImage
            uri={post.imageUri}
            alt={post.imageAlt}
            seed={post.id}
            petId={post.petId}
            at={post.createdAt}
          />
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
              {/* El rebote es la confirmación de que el toque ha entrado, y
                  llega antes de que cambie el número. */}
              <Pop trigger={mine}>
                <Icon
                  icon={REACTION_ICON[reaction.id]}
                  size="base"
                  // Puesta se pinta en terracota, que es el acento de la marca.
                  // No en rojo: el rojo de esta aplicación significa perro
                  // perdido.
                  color={mine ? theme.colors.liveRing : theme.colors.foreground}
                  // Y se rellena, además de cambiar de color. Es el gesto de
                  // Instagram y funciona por una razón que no es la moda: el
                  // relleno se ve en una captura en blanco y negro, y el cambio
                  // de color no.
                  fill={mine ? theme.colors.liveRing : 'none'}
                  strokeWidth={mine ? 2.75 : 2}
                  decorative
                />
              </Pop>
              {/* El número **no** se pinta en terracota aunque el icono sí.
                  El terracota del estado en vivo da 3,55 sobre el fondo claro:
                  suficiente para un anillo o un icono, por debajo de AA para
                  texto de quince píxeles. No se nota mirando —el color se ve
                  perfectamente— y por eso llevaba aquí desde el principio; lo
                  descubrió una aserción nueva de la paleta. Lo que dice que la
                  reacción es tuya sigue siendo el icono: relleno y en color. */}
              <Text
                style={{
                  color: theme.colors.foreground,
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

        {/* Guardar va solo a la derecha, separado del resto. Es la única acción
            de esta fila que **no** ve nadie más: las otras cuatro publican algo
            —una reacción, un comentario, un ladrido—, y esta se queda en tu
            cuenta. Ponerla en el mismo grupo las haría parecer lo mismo. */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar la publicación'}
          accessibilityHint={saved ? undefined : 'Solo la ves tú'}
          onPress={() => {
            haptics.tap();
            toggleSaved(post.id);
          }}
          style={({ pressed }) => ({
            minHeight: theme.touchTarget.min,
            justifyContent: 'center',
            paddingHorizontal: theme.space[3],
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Icon
            icon={Bookmark}
            size="base"
            color={theme.colors.foreground}
            fill={saved ? theme.colors.foreground : 'none'}
            strokeWidth={saved ? 2.5 : 2}
            decorative
          />
        </Pressable>
      </View>

      {/* El resumen, la firma y la entrada a los comentarios: el orden exacto de
          Instagram, y no por copiarlo. Es el que responde en ese orden a «cuánta
          gente», «de quién es» y «qué se está diciendo», que es como se lee una
          publicación cuando se pasa el dedo deprisa. */}
      <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[1] }}>
        {totalReactions(post) > 0 ? (
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.sm,
            }}
          >
            {totalReactions(post) === 1
              ? '1 reacción'
              : `${totalReactions(post)} reacciones`}
            {post.barkCount > 0
              ? ` · ${post.barkCount === 1 ? '1 ladrido' : `${post.barkCount} ladridos`}`
              : ''}
          </Text>
        ) : null}
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

      <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[0.5] }}>
        {post.comments.length > 0 && !showComments ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver los ${post.comments.length} comentarios`}
            onPress={() => setShowComments(true)}
            style={({ pressed }) => ({
              minHeight: theme.touchTarget.min - 12,
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              {post.comments.length === 1
                ? 'Ver el comentario'
                : `Ver los ${post.comments.length} comentarios`}
            </Text>
          </Pressable>
        ) : null}

        {/* La hora abajo y en pequeño, no en la cabecera. Es el dato menos
            importante de la tarjeta y arriba competía con el nombre. */}
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.xs,
          }}
        >
          {timeAgo(post.createdAt)}
          {distanceLabel ? ` · a ${distanceLabel}` : ''}
        </Text>
      </View>

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
 * La imagen de la publicación.
 *
 * Cuando el tutor ha subido una foto, se enseña. Cuando no —que es el caso de
 * toda la semilla— se dibuja una escena generada del propio animal a la hora en
 * que se publicó, y **se dice que es un dibujo**. Es la diferencia entre una
 * demostración que se puede leer y un rectángulo gris con una línea de texto
 * dentro, que es lo que había antes y por lo que el feed se veía muerto.
 *
 * Lo que la ilustración **no** hace es sustituir al texto alternativo: sigue
 * siendo obligatorio y sigue describiendo lo que el tutor dice que hay en la
 * imagen, no lo que este generador ha dibujado.
 */
function PostImage({
  uri,
  alt,
  seed,
  petId,
  at,
}: {
  uri: string | null;
  alt: string;
  seed: string;
  petId: string;
  at: Date;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const scene = useMemo(
    () => buildScene({ seed, petId, at, width: 400, height: 400 }),
    [seed, petId, at],
  );

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

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={alt} style={{ width: '100%' }}>
      <SceneView scene={scene} width={width} height={width} />
      <View
        style={{
          position: 'absolute',
          left: theme.space[3],
          bottom: theme.space[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[1],
          paddingHorizontal: theme.space[2],
          paddingVertical: 2,
          borderRadius: theme.radius.xs,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      >
        <Icon icon={Sparkles} size="sm" color="#fff" decorative />
        <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 11 }}>
          Ilustración generada
        </Text>
      </View>
    </View>
  );
}
