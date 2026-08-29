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
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { useRouter } from 'expo-router';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { Counter, Pop, enter, exit, reflow } from './motion';
import { Drawer } from './drawer';
import { PawTrail } from './paw-trail';
import { SceneView } from './scene';
import { buildScene } from '@/lib/artwork';
import { photoSource, type PhotoRef } from '@/lib/photos';
import { Badge, Caption, Row } from './ui';
import { BLOCK_NOTE, REPORT_NOTE, REPORT_REASONS } from '@petnav/core';
import { blockOwnerOf, reportOwnerOf } from '@/lib/moderation';
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
import { useRelief } from '@/lib/relieve';
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
  const relief = useRelief();
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
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
            paddingVertical: theme.space[2],
            gap: theme.space[1],
          }}
        >
          {/*
            Este menú tenía tres opciones y ninguna hacía nada: silenciar, dejar
            de seguir y denunciar cerraban la hoja y ya. Ahora son dos y las dos
            funcionan.

            Bloquear saca a esa persona del feed, del mapa, del radar y de las
            quedadas, porque el filtro es uno solo y pasa por él todo lo que
            enseña gente. Denunciar pide un motivo de una lista: no hay dónde
            escribir, por lo mismo que en los avisos de rescate.
          */}
          {reporting ? (
            <>
              <Caption>{REPORT_NOTE}</Caption>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.id}
                  accessibilityRole="button"
                  accessibilityLabel={reason.label}
                  accessibilityHint={reason.hint}
                  onPress={() => {
                    haptics.commit();
                    reportOwnerOf(post.petId, reason.id);
                    setReporting(false);
                    setShowOptions(false);
                    setDone('Gracias. Lo revisamos con las demás denuncias.');
                  }}
                  style={({ pressed }) => ({
                    minHeight: theme.touchTarget.min,
                    justifyContent: 'center',
                    opacity: pressed ? 0.5 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: theme.colors.foreground,
                      fontFamily: fonts.body,
                      fontSize: theme.fontSize.base,
                    }}
                  >
                    {reason.label}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Bloquear a ${post.authorName}`}
                accessibilityHint={BLOCK_NOTE}
                onPress={() => {
                  haptics.commit();
                  blockOwnerOf(post.petId);
                  setShowOptions(false);
                  setDone(`Has bloqueado a ${post.authorName}. ${BLOCK_NOTE}`);
                }}
                style={({ pressed }) => ({
                  minHeight: theme.touchTarget.min,
                  justifyContent: 'center',
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  Bloquear a {post.authorName}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Denunciar"
                onPress={() => {
                  haptics.tap();
                  setReporting(true);
                }}
                style={({ pressed }) => ({
                  minHeight: theme.touchTarget.min,
                  justifyContent: 'center',
                  opacity: pressed ? 0.5 : 1,
                })}
              >
                <Text
                  style={{
                    color: theme.colors.destructive,
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  Denunciar
                </Text>
              </Pressable>

              <Caption>{BLOCK_NOTE}</Caption>
            </>
          )}
        </View>
      ) : null}

      {done ? (
        <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[2] }}>
          <Caption>{done}</Caption>
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
          <PostCarousel post={post} />
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
              <Counter
                value={count}
                size={theme.fontSize.sm}
                style={{
                  color: theme.colors.foreground,
                  fontFamily: mine ? fonts.bodyBold : fonts.body,
                }}
              />
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
            {totalReactions(post) === 1 ? '1 reacción' : `${totalReactions(post)} reacciones`}
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

      {/*
        Los comentarios, en una hoja que se arrastra hacia abajo.

        Antes se desplegaban dentro de la tarjeta, y eso tenía dos efectos que
        solo se ven usándolo: la publicación crecía de golpe y empujaba a las de
        abajo —se perdía el sitio donde se estaba leyendo—, y el campo de
        escribir quedaba a media pantalla, encima del teclado, en el punto peor
        de la mano. En una hoja, el texto está siempre abajo, la lista se
        desplaza dentro, y se cierra con el gesto que ya hace todo el mundo.
      */}
      {showComments ? (
        <Drawer title="Comentarios" onClose={() => setShowComments(false)}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.space[4],
              paddingBottom: theme.space[4],
              gap: theme.space[3],
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.base,
                paddingBottom: theme.space[1],
              }}
            >
              {post.comments.length === 0
                ? 'Sin comentarios'
                : post.comments.length === 1
                  ? '1 comentario'
                  : `${post.comments.length} comentarios`}
            </Text>

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
          </ScrollView>

          {/* El compositor, pegado abajo y fuera de la lista: es lo único que
              no debe moverse al desplazar los comentarios. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[2],
              paddingHorizontal: theme.space[4],
              paddingTop: theme.space[3],
              paddingBottom: theme.space[3],
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe un comentario"
              placeholderTextColor={theme.colors.inputPlaceholder}
              accessibilityLabel={`Comentar la publicación de ${post.petName}`}
              multiline
              style={[
                {
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
                },
                /* La ranura: con relieve un campo es un hueco, no una caja encima. */
                relief.pressed('sm'),
              ]}
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
        </Drawer>
      ) : null}
    </View>
  );
}

/**
 * El carrusel de la publicación.
 *
 * Una salida no es una foto: el charco, el perro empapado y la cara de después
 * son la misma historia. Obligar a elegir una convierte el feed en un
 * muestrario, y por eso Instagram lleva diez años con el contador «1/3».
 *
 * Tres decisiones que no son evidentes:
 *
 *  - **Con una sola foto no hay carrusel.** Ni puntos, ni contador, ni
 *    desplazamiento horizontal: una publicación de una foto tiene que
 *    comportarse exactamente como antes. Un paginador de un punto es ruido que
 *    además promete algo que no hay.
 *  - **El paginador va dentro de la imagen y arriba**, no debajo. Debajo se
 *    comía el sitio de la barra de reacciones, que es lo que uno quiere tocar.
 *  - **Cada foto se anuncia con su descripción y su posición** —«2 de 3»—.
 *    Quien no ve la pantalla no tiene los puntos, así que la única forma de
 *    saber que hay más es que se lo digan.
 *
 * El desplazamiento va con `pagingEnabled`, que en React Native web se traduce
 * a `scroll-snap`: el navegador hace el enganche, así que se siente como el del
 * sistema y no como una animación imitándolo.
 */
function PostCarousel({ post }: { post: Post }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const photos = post.photos;

  /*
   * A sangre o con marco, según la dirección visual.
   *
   * No es un adorno: es la diferencia de forma más visible entre las tres.
   * «Nocturno» y «Papel» cortan la pantalla de lado a lado —la foto manda y
   * nada la enmarca—; «Señal» la mete en la tarjeta, con esquina blanda y aire
   * alrededor, porque ahí lo que manda es el dato y no la imagen.
   *
   * El ancho de página del carrusel **tiene que descontar el marco**: con
   * `pagingEnabled` el enganche es del ancho del hijo, así que con márgenes y
   * páginas de ancho de pantalla la segunda foto quedaba siempre medio
   * asomando.
   */
  const inset = theme.direction.media === 'inset' ? theme.space[3] : 0;
  const page = width - inset * 2;
  const corner = inset > 0 ? theme.radius.lg : 0;

  if (photos.length === 1) {
    const only = photos[0]!;
    return (
      <View style={{ paddingHorizontal: inset }}>
        <PostImage
          photo={only}
          alt={only.alt}
          seed={post.id}
          petId={post.petId}
          at={post.createdAt}
          size={page}
          corner={corner}
        />
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: inset }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        /* El índice sale del desplazamiento y se redondea al ancho de la
           pantalla. Con `Math.floor` el punto cambiaba un pelo antes de que la
           foto acabara de encajar, y se veía. */
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / page);
          if (next !== index) setIndex(next);
        }}
        scrollEventThrottle={16}
      >
        {photos.map((photo, position) => (
          <PostImage
            key={photo.path}
            photo={photo}
            alt={`${photo.alt}. Foto ${position + 1} de ${photos.length}`}
            seed={`${post.id}-${position}`}
            petId={post.petId}
            at={post.createdAt}
            size={page}
            corner={corner}
          />
        ))}
      </ScrollView>

      {/* El contador, arriba a la derecha, como en Instagram. Es lo que dice
          que hay más antes de que el dedo lo descubra por casualidad. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: theme.space[3],
          right: theme.space[3],
          paddingHorizontal: theme.space[2],
          paddingVertical: 2,
          borderRadius: theme.radius.full,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize['2xs'],
          }}
        >
          {index + 1}/{photos.length}
        </Text>
      </View>

      {/* Los puntos. Decorativos a propósito: la posición ya va en la etiqueta
          de cada foto, y anunciarlos otra vez sería leer «2 de 3» dos veces. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          bottom: theme.space[3],
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {photos.map((photo, position) => (
          <View
            key={`dot-${photo.path}`}
            style={{
              width: position === index ? 7 : 6,
              height: position === index ? 7 : 6,
              borderRadius: theme.radius.full,
              backgroundColor: position === index ? '#fff' : 'rgba(255,255,255,0.5)',
            }}
          />
        ))}
      </View>
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
  photo,
  alt,
  seed,
  petId,
  at,
  size,
  corner,
}: {
  photo: PhotoRef;
  alt: string;
  seed: string;
  petId: string;
  at: Date;
  /** Ancho de la foto ya descontado el marco, si la dirección lo pone. */
  size: number;
  corner: number;
}) {
  const theme = useTheme();
  /*
   * Cuatro a cinco, no cuadrado.
   *
   * El cuadrado es de la primera Instagram, la de 2010, y hoy no lo usa nadie:
   * las fotos del feed son verticales 4:5 desde hace años, y la razón es
   * aritmética y no estética — en una pantalla de 390 × 844 una foto cuadrada
   * ocupa el 46 % del alto y una de 4:5 el 58 %. Es un cuarto más de foto por
   * el mismo desplazamiento, en la aplicación donde la foto **es** el
   * contenido.
   *
   * La escena se genera en la misma proporción, no cuadrada y estirada: el
   * horizonte y el sujeto se calculan sobre el alto, así que una escena
   * cuadrada dentro de un marco vertical dejaba al perro flotando por encima
   * del suelo.
   */
  const tall = Math.round(size * 1.25);
  const scene = useMemo(
    () => buildScene({ seed, petId, at, width: 400, height: 500 }),
    [seed, petId, at],
  );

  /* La foto de verdad si la hay —del carrete del tutor, empaquetada con la
     aplicación o servida por una URL—, y si no, la escena dibujada. Antes esto
     sólo miraba `uri`, así que las publicaciones de la semilla, que traen
     `path` y no `uri`, salían todas dibujadas aunque hubiera fichero. */
  const source = photoSource(photo);

  /*
   * Si la foto no llega, se dibuja.
   *
   * Una `<Image>` con un origen que falla no enseña nada: deja el rectángulo
   * del color de fondo, sin decir por qué. Y falla más de lo que parece —una
   * URL caducada, un objeto borrado del almacenamiento, un móvil sin cobertura
   * a mitad del parque—, así que sin esto el modo de fallo normal de una
   * aplicación de fotos es un hueco gris.
   *
   * El respaldo ya existía y era bueno: la escena generada, que además lleva su
   * etiqueta diciendo que es un dibujo. Lo único que faltaba era llegar a ella
   * cuando la foto se cae, y no sólo cuando no la hay.
   */
  const [failed, setFailed] = useState(false);

  if (source && !failed) {
    return (
      <Image
        source={source}
        accessibilityLabel={alt}
        accessible
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: tall,
          borderRadius: corner,
          backgroundColor: theme.colors.muted,
        }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={alt}
      style={{ width: size, borderRadius: corner, overflow: 'hidden' }}
    >
      <SceneView scene={scene} width={size} height={tall} />
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
        <Text
          style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: theme.fontSize['2xs'] }}
        >
          Ilustración generada
        </Text>
      </View>
    </View>
  );
}
