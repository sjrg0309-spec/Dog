import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { NavBar, useScrolled } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { Appear } from '@/components/motion';
import { PostCard } from '@/components/post-card';
import { ReelTray } from '@/components/reel-tray';
import { StoryRail } from '@/components/story-rail';
import { Body, Caption, Notice, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { haptics } from '@/lib/haptics';
import { useConditions, useWeatherState } from '@/lib/conditions';
import { discover, petHasMeetups, walkingNow } from '@/lib/data';
import { fonts } from '@/lib/fonts';
import { Compass, Heart, SquarePlus, Send, Siren, type LucideIcon } from '@/lib/icons';
import {
  FEED_SCOPES,
  NEARBY_RADII_M,
  useOutsideRadiusCount,
  useScopedFeed,
  type FeedScope,
  type NearbyRadius,
} from '@/lib/posts';
import { useUnreadActivity } from '@/lib/activity';
import { totalUnread, useThreads } from '@/lib/messages';
import { useLiveAlerts } from '@/lib/safety';
import { useStoriesOf, useStoryGroups } from '@/lib/stories';
import { useTheme } from '@/lib/theme';

/**
 * El feed.
 *
 * Dos caras, y la segunda es la que hace que esto sea una aplicación de barrio:
 *
 *  - **Siguiendo** — lo de siempre. Vacío por definición el primer día, porque
 *    nadie sigue a nadie al instalar una aplicación.
 *  - **Cerca de mí** — todo lo que se ha publicado dentro del radio, siga uno a
 *    quien siga. Es lo que hay que enseñar el primer día, y por eso el
 *    alternador va visible arriba y no escondido en un desplegable: si no se ve
 *    la otra pestaña, no se sabe que existe.
 *
 * El radio se elige entre 5 y 10 km. Se puede cambiar y **se dice cuántas
 * publicaciones deja fuera**, porque un filtro que recorta en silencio parece un
 * barrio vacío en lugar de un radio corto.
 *
 * Lo que **no** hace este feed: ordenar por nada que no sea la hora. Sin
 * algoritmo de interacción, sin «lo que te has perdido». Es el feed de tu
 * barrio, y un barrio va en orden cronológico.
 */
export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const pet = useActivePet();
  const social = petHasMeetups(pet);
  const conditions = useConditions(45);
  const { location } = useWeatherState();
  const { welfare } = discover(pet, conditions);
  const { scrolled, onScroll } = useScrolled();

  const [scope, setScope] = useState<FeedScope>('nearby');
  const [radiusM, setRadiusM] = useState<NearbyRadius>(NEARBY_RADII_M[0]);
  const entries = useScopedFeed(scope, location, radiusM);
  const outside = useOutsideRadiusCount(location, radiusM);

  const [checkedIn, setCheckedIn] = useState(false);
  const outNow = social ? walkingNow(pet.speciesId) : [];
  const stopped = social && welfare?.level === 'stop';

  // Los estados y la presencia son dos cosas distintas que comparten la fila:
  // el anillo dice si has visto algo, la etiqueta EN VIVO dice si está fuera.
  const storyGroups = useStoryGroups();
  const myStories = useStoriesOf(pet.id);
  const liveIds = new Set(outNow.map((other) => other.id));

  // Una alerta abierta cerca se enseña **dentro del feed**, no solo en su
  // pestaña. Quien está mirando fotos no va a ir a mirar la pestaña de SOS por
  // si acaso, y ese es justo el momento en que sirve de algo enterarse.
  const alerts = useLiveAlerts(location);
  const topAlert = alerts[0];
  const unread = totalUnread(useThreads());
  // Un punto, no un número: la actividad no se «responde», así que contarla
  // solo añade una cifra que nadie va a bajar a cero a propósito.
  const newActivity = useUnreadActivity();

  return (
    <Screen>
      <NavBar
        title="Coincide"
        scrolled={scrolled}
        trailing={
          <>
            {/* El animal activo primero: es el contexto de todo lo que hay
                debajo, así que va antes que lo que te ha pasado a ti. */}
            <PetSwitcherCompact />

            {/* Publicar, actividad y mensajes, en ese orden y a la derecha del
                wordmark. Es la cabecera de Instagram, y el orden no es casual:
                publicar es lo que uno viene a hacer, la actividad es lo que te
                ha pasado a ti y los mensajes lo que alguien te está diciendo.
                Lo último espera; lo primero, no.

                Publicar vivía en un botón flotante de sesenta y cuatro píxeles
                encima del feed. Se ha subido aquí por dos razones y la segunda
                pesa más que la primera: una, que un botón flotante es de otra
                familia de interfaces y se notaba; dos, que **tapaba** la barra
                de reacciones de la primera publicación, que es exactamente lo
                que uno quiere tocar al abrir la aplicación. */}
            <HeaderAction
              icon={SquarePlus}
              label="Publicar"
              hint="Subir una foto al feed"
              onPress={() => router.push('/publicar')}
            />

            <HeaderAction
              icon={Heart}
              label={newActivity > 0 ? `Actividad, ${newActivity} sin ver` : 'Actividad'}
              hint="Reacciones, comentarios y lo que pide algo de ti"
              onPress={() => router.push('/actividad')}
              badge={newActivity > 0 ? 'dot' : 'none'}
            />

            <HeaderAction
              icon={Send}
              label={unread > 0 ? `Mensajes, ${unread} sin leer` : 'Mensajes'}
              onPress={() => router.push('/mensajes')}
              badge={unread > 0 ? unread : 'none'}
            />
          </>
        }
      />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[10] }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/*
          Encima del feed no va nada más que esto.
          
          La versión anterior apilaba siete franjas antes de la primera foto
          —conmutador de perro, compositor, alerta, dos segmentados, estados y
          la bandeja de reels— y por eso no se parecía a Instagram por mucho
          que las tarjetas sí lo hicieran: allí ves una foto antes de mover el
          pulgar. Lo que se ha ido no se ha perdido: el conmutador de perro
          está en la cabecera, publicar está en el botón flotante y en el
          compositor, y los reels bajan a después de las primeras
          publicaciones.
        */}
        {topAlert ? (
          <AlertStrip
            title={topAlert.scenario.label}
            detail={`${topAlert.alert.petName ?? topAlert.alert.areaName} · a ${topAlert.distanceLabel}`}
            onPress={() => router.push('/sos')}
          />
        ) : null}

        <FeedTabs
          scope={scope}
          onChange={setScope}
          radiusM={radiusM}
          onRadius={setRadiusM}
        />

        {/* Los «snacks»: quién está fuera ahora. Solo tiene sentido en el feed
            de vecindario, porque es presencia y la presencia es local. */}
        {social && scope === 'nearby' ? (
          <View>
            <StoryRail
              me={pet}
              groups={storyGroups}
              liveIds={liveIds}
              myStoryCount={myStories.length}
              onCreate={() => router.push('/publicar?modo=estado')}
              onOpen={(petId) => router.push(`/estados?pet=${petId}`)}
              checkedIn={checkedIn}
              onCheckIn={() => setCheckedIn((value) => !value)}
              disabled={stopped}
              disabledReason={
                stopped
                  ? `No ofrecemos salir ahora: con estas condiciones no le conviene a ${pet.name}.`
                  : undefined
              }
            />
          </View>
        ) : null}

        {/* El único aire entre los estados y la primera foto. Ocho píxeles: lo
            justo para que el carrete no toque la imagen, y no tanto como para
            que quepa una franja más. */}
        <View style={{ height: theme.space[2] }} />

        {entries.length === 0 ? (
          <View style={{ paddingHorizontal: theme.space[4] }}>
            <EmptyFeed scope={scope} radiusM={radiusM} outside={outside} onSwitch={setScope} />
          </View>
        ) : (
          entries.map(({ post, distanceLabel }, index) => (
            <Appear key={post.id} index={index}>
              <PostCard post={post} viewerName={pet.ownerName} distanceLabel={distanceLabel} />
              {/* Los reels van intercalados después de las dos primeras
                  publicaciones, que es donde Instagram los pone: arriba del
                  todo empujaban la primera foto fuera de la pantalla, y una
                  bandeja de vídeos antes de haber visto nada del barrio
                  convierte el feed en una tienda. */}
              {social && index === 1 ? (
                <ReelTray onOpen={(id) => router.push(`/reels?id=${id}`)} />
              ) : null}
            </Appear>
          ))
        )}

        {scope === 'nearby' && entries.length > 0 && outside > 0 ? (
          <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[5] }}>
            <Caption>
              {outside === 1
                ? 'Hay 1 publicación más allá de este radio.'
                : `Hay ${outside} publicaciones más allá de este radio.`}{' '}
              Ampliarlo a {NEARBY_RADII_M[1] / 1000} km las trae.
            </Caption>
          </View>
        ) : null}

        {/* La salida hacia el motor. El feed entretiene; esto es lo que hace que
            el paseo ocurra, así que no se puede quedar sin puerta. */}
        <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[8] }}>
          <Link href="/descubrir" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Ver con quién puede salir ${pet.name}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[3],
                minHeight: theme.touchTarget.comfortable,
                paddingHorizontal: theme.space[4],
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Icon icon={Compass} size="lg" color={theme.colors.primary} decorative />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fonts.displayBold,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  Con quién puede salir {pet.name}
                </Text>
                <Text
                  style={{
                    color: theme.colors.mutedForeground,
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  Temperamento, horarios y cercanía, por separado
                </Text>
              </View>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Un icono de la cabecera, con su globo.
 *
 * Existe porque los tres eran el mismo bloque de veinte líneas copiado con un
 * icono distinto, y el tercero ya se había desincronizado de los otros dos.
 *
 * El globo tiene dos formas y significan cosas distintas: **punto** para la
 * actividad, **número** para los mensajes. No es capricho. Un mensaje sin leer
 * se lee y baja a cero, así que la cifra es una tarea que se puede terminar;
 * la actividad no se «responde», y ponerle un número solo añadiría una cuenta
 * que nadie va a bajar a cero a propósito.
 */
function HeaderAction({
  icon,
  label,
  hint,
  onPress,
  badge = 'none',
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
  /** `'dot'` para «hay algo», un número para «hay tantas», `'none'` para nada. */
  badge?: 'dot' | 'none' | number;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: theme.touchTarget.min,
        height: theme.touchTarget.min,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={icon} size="lg" decorative />

        {badge === 'dot' ? (
          <View
            style={{
              position: 'absolute',
              right: -6,
              top: -5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: theme.colors.liveRing,
              borderWidth: 2,
              borderColor: theme.colors.background,
            }}
          />
        ) : typeof badge === 'number' ? (
          <View
            style={{
              position: 'absolute',
              right: -8,
              top: -6,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 4,
              borderRadius: 9,
              backgroundColor: theme.colors.destructive,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: theme.colors.background,
            }}
          >
            <Text
              style={{
                color: theme.colors.destructiveForeground,
                fontFamily: fonts.bodyBold,
                fontSize: 10,
                lineHeight: 12,
              }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Las dos caras del feed, y el radio.
 *
 * Antes eran dos segmentados apilados: dos píldoras enormes que ocupaban
 * ciento sesenta píxeles de alto justo donde debería estar la primera foto.
 * Ahora son dos palabras con subrayado —el patrón que la gente ya tiene
 * aprendido de cualquier feed moderno— y el radio se convierte en un texto
 * pequeño al lado, que solo aparece en «Cerca de mí» porque es lo único que
 * lo usa.
 *
 * El alternador sigue visible y no en un desplegable: si no se ve la otra
 * pestaña, no se sabe que existe.
 */
function FeedTabs({
  scope,
  onChange,
  radiusM,
  onRadius,
}: {
  scope: FeedScope;
  onChange: (scope: FeedScope) => void;
  radiusM: NearbyRadius;
  onRadius: (radius: NearbyRadius) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space[4],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.border,
      }}
      accessibilityRole="tablist"
    >
      {FEED_SCOPES.map((option) => {
        const active = option.id === scope;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityHint={option.hint}
            onPress={() => {
              haptics.tap();
              onChange(option.id);
            }}
            style={{
              minHeight: theme.touchTarget.min,
              justifyContent: 'center',
              paddingRight: theme.space[5],
              borderBottomWidth: 2,
              /* El subrayado ocupa sitio siempre, activo o no: sin eso el texto
                 da un salto de dos píxeles al cambiar de pestaña. */
              borderBottomColor: active ? theme.colors.foreground : 'transparent',
            }}
          >
            <Text
              style={{
                color: active ? theme.colors.foreground : theme.colors.mutedForeground,
                fontFamily: active ? fonts.displayBold : fonts.displaySemibold,
                fontSize: theme.fontSize.sm,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}

      {scope === 'nearby' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Radio: ${radiusM / 1000} kilómetros`}
          accessibilityHint="Cambia cuánto barrio entra en el feed"
          onPress={() => {
            haptics.tap();
            const next = NEARBY_RADII_M[(NEARBY_RADII_M.indexOf(radiusM) + 1) % NEARBY_RADII_M.length];
            if (next !== undefined) onRadius(next);
          }}
          style={{
            marginLeft: 'auto',
            minHeight: theme.touchTarget.min,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: fonts.displaySemibold,
              fontSize: theme.fontSize.sm,
            }}
          >
            {radiusM / 1000} km
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Una alerta abierta, en una franja dentro del feed.
 *
 * Va **a sangre y sin esquinas**: una tarjeta redondeada flotando encima del
 * feed se lee como contenido, y esto no es contenido —es una barra de sistema,
 * del mismo tipo que la franja de llamada en curso del teléfono. La forma dice
 * de qué categoría es antes de que se lea la primera palabra.
 *
 * Es lo único de esta pantalla que se pinta en el rojo de extraviados, y va con
 * icono y texto además del color: quien no lo distinga tiene que enterarse
 * igual.
 */
function AlertStrip({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Alerta abierta cerca: ${title}. ${detail}`}
      accessibilityHint="Abre la pantalla de SOS"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        minHeight: theme.touchTarget.min,
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[1.5],
        backgroundColor: theme.colors.destructive,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Icon icon={Siren} size="base" color={theme.colors.destructiveForeground} decorative />
      {/* Título y detalle en la misma línea: son doce palabras, y apilarlas
          duplicaba el alto de la franja para no decir nada más. */}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: theme.colors.destructiveForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        <Text style={{ fontFamily: fonts.displayBold }}>{title}</Text> · {detail}
      </Text>
    </Pressable>
  );
}

/**
 * Los dos vacíos, que no son el mismo vacío.
 *
 * «Siguiendo» vacío es el primer día de cualquiera y tiene salida inmediata:
 * cambiar a vecindario. «Cerca de mí» vacío con publicaciones fuera del radio es
 * un radio corto, no un barrio muerto, y hay que decirlo con el número delante.
 */
function EmptyFeed({
  scope,
  radiusM,
  outside,
  onSwitch,
}: {
  scope: FeedScope;
  radiusM: NearbyRadius;
  outside: number;
  onSwitch: (scope: FeedScope) => void;
}) {
  const theme = useTheme();

  if (scope === 'following') {
    return (
      <Notice>
        <Body>Todavía no sigues a nadie.</Body>
        <Caption>
          Es lo normal el primer día. En «Cerca de mí» hay lo que se publica en tu zona sin que
          tengas que seguir a nadie, y desde ahí se sigue a quien encaje.
        </Caption>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar al feed de cerca de mí"
          onPress={() => onSwitch('nearby')}
          style={({ pressed }) => ({
            minHeight: theme.touchTarget.min,
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.base,
            }}
          >
            Ver lo que hay cerca
          </Text>
        </Pressable>
      </Notice>
    );
  }

  return (
    <Notice>
      <Body>
        {outside > 0
          ? `Nada dentro de ${radiusM / 1000} km, pero hay ${outside} más allá.`
          : 'Todavía no ha publicado nadie por aquí.'}
      </Body>
      <Caption>
        {outside > 0
          ? 'El radio es corto, no el barrio. Ampliarlo arriba las trae.'
          : 'Alguien tiene que ser el primero. Una foto del paseo de esta tarde es suficiente.'}
      </Caption>
    </Notice>
  );
}
