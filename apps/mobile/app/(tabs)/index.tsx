import { useScrollToTop } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { NAV_BAR_HEIGHT, NavBar } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { Appear } from '@/components/motion';
import { PostCard } from '@/components/post-card';
import { ReelTray } from '@/components/reel-tray';
import { StoryRail } from '@/components/story-rail';
import { Toast } from '@/components/toast';
import { Body, Caption, Notice, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { haptics } from '@/lib/haptics';
import { refreshWeather, useConditions, useWeatherState } from '@/lib/conditions';
import { RescueBoard } from '@/components/rescue-board';
import { useAccount, useCan } from '@/lib/account';
import { useVisibleBy, useVisiblePets } from '@/lib/moderation';
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
import { ReelGrid } from '@/components/reel-grid';

/**
 * Las tres caras del feed.
 *
 * Las dos primeras filtran publicaciones —de quién sigues, o de tu barrio— y la
 * tercera no filtra nada: es **otro formato**. Por eso `FeedTab` no es
 * `FeedScope`: el filtro de publicaciones no sabe nada de vídeo, y meterle un
 * tercer valor obligaría a que lo ignorase por dentro, que es como se cuelan
 * los estados imposibles.
 */
type FeedTab = FeedScope | 'reels';

const FEED_TABS: ReadonlyArray<{ id: FeedTab; label: string; hint: string }> = [
  ...FEED_SCOPES,
  { id: 'reels', label: 'Reels', hint: 'Vídeo corto de perros de tu zona.' },
];
import { useUnreadActivity } from '@/lib/activity';
import { totalUnread, useThreads } from '@/lib/messages';
import { useLiveAlerts } from '@/lib/safety';
import { useStoriesOf, useStoryGroups } from '@/lib/stories';
import { setSetting, useSettings } from '@/lib/settings';
import { useScrollDriver } from '@/lib/scroll';
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
  /*
   * Una cuenta de protectora no tiene feed social.
   *
   * No es un filtro sobre el feed: es otra pantalla. Filtrar dejaría la
   * estructura del feed —historias, reels, publicar— alrededor de una lista
   * vacía, y lo que hace falta aquí es lo contrario: que lo primero que se vea
   * al abrir sea qué animal necesita ayuda cerca.
   */
  if (useAccount().kind === 'rescuer') return <RescueBoard />;
  return <PetFeed />;
}

function PetFeed() {
  const theme = useTheme();
  const router = useRouter();
  const pet = useActivePet();
  const social = petHasMeetups(pet);
  const conditions = useConditions(45);
  const { location } = useWeatherState();
  const { welfare } = discover(pet, conditions);
  const { scrollY, onScroll } = useScrollDriver();

  /*
   * Los dos gestos que tiene cualquier feed y este no tenía.
   *
   * **Tocar la pestaña que ya está abierta devuelve el feed arriba.** Es de las
   * cosas que nadie sabe que sabe hasta que falta: cuando alguien lleva cuarenta
   * publicaciones bajando y quiere volver al principio, no arrastra — toca el
   * icono de abajo. `useScrollToTop` es el gancho del propio navegador, así que
   * hace también lo que se espera al abrir la pestaña desde otra pantalla.
   *
   * **Y tirar hacia abajo refresca.** Aquí eso no es decorativo ni finge traer
   * publicaciones que no existen: vuelve a consultar el tiempo —que es el dato
   * que de verdad cambia y del que depende toda la capa de bienestar— y con él
   * se recalculan los radios de los avisos abiertos. Lo que se refresca se dice
   * después, en la píldora.
   */
  /* El tipo del ref es el de la vista animada de Reanimated, no el de
     `ScrollView` a secas: son la misma vista con métodos de más, y el gancho
     del navegador solo necesita `scrollTo`, que ahí está. */
  const scroller = useRef<Animated.ScrollView>(null);
  useScrollToTop(scroller as unknown as Parameters<typeof useScrollToTop>[0]);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    haptics.tap();
    try {
      await refreshWeather(true);
    } finally {
      setRefreshing(false);
      setRefreshed(true);
    }
  }, []);
  const canSeePeople = useCan('live_people');

  const [tab, setTab] = useState<FeedTab>('nearby');
  /* El radio vive en los ajustes y no aquí: es el mismo valor que se toca
     desde configuración, así que dos estados serían dos verdades. La píldora de
     «5 km» de esta barra sigue siendo el camino rápido —se cambia donde se
     nota—, solo que ahora escribe donde lo lee la otra pantalla. */
  const radiusM = useSettings().feedRadiusM;
  const setRadiusM = useCallback((value: NearbyRadius) => setSetting('feedRadiusM', value), []);
  const reeling = tab === 'reels';
  /* Con los reels puestos el filtro sigue calculando el feed de vecindario. Es
     deliberado: es barato, y al volver de los reels la lista ya está hecha en
     vez de aparecer un instante después. */
  const scope: FeedScope = reeling ? 'nearby' : tab;
  /* Todo lo que enseña gente pasa por el mismo filtro. Si el bloqueo se
     aplicara pantalla por pantalla, la que se olvidara sería la que te propone
     quedar con quien bloqueaste. */
  const entries = useVisibleBy(
    useScopedFeed(scope, location, radiusM),
    (entry) => entry.post.petId,
  );
  const outside = useOutsideRadiusCount(location, radiusM);

  const [checkedIn, setCheckedIn] = useState(false);
  /* La etiqueta EN VIVO de la fila de historias dice quién está fuera ahora, así
     que va detrás de la misma puerta que el mapa de gente. */
  const outNow = useVisiblePets(social && canSeePeople ? walkingNow(pet.speciesId) : []);
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
        title="Petnav"
        scrolled={false}
        scrollY={scrollY}
        /* De cristal y encima del feed: las fotos pasan por debajo
           desenfocadas, que es lo que hace Instagram en iOS y lo que faltaba
           aquí para que la cabecera no fuera una franja opaca más. */
        floating
        /* El nombre hace lo que hace el logotipo de Instagram en el navegador:
           subir y actualizar. Y aquí resuelve algo concreto — en web no existe
           el gesto de tirar hacia abajo, así que sin esto refrescar no tendría
           camino fuera del teléfono. */
        onTitlePress={() => {
          scroller.current?.scrollTo({ y: 0, animated: true });
          void refresh();
        }}
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

      <Animated.ScrollView
        ref={scroller}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: NAV_BAR_HEIGHT,
          paddingBottom: theme.space[10],
        }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
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

        <FeedTabs tab={tab} onChange={setTab} radiusM={radiusM} onRadius={setRadiusM} />

        {/* Los «snacks»: quién está fuera ahora. Solo tiene sentido en el feed
            de vecindario, porque es presencia y la presencia es local. */}
        {social && tab === 'nearby' ? (
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

        {reeling ? (
          /* Los reels vivían en Explorar, detrás de un segundo conmutador. Era
             el sitio equivocado por dos motivos: uno, que Explorar es el mapa y
             una pestaña de vídeo encima de un mapa hace que no parezca un mapa;
             y dos, que el vídeo corto es **feed**, no exploración geográfica.
             Aquí está a un toque de las fotos, que es de donde se viene. */
          <ReelGrid onOpen={(id) => router.push(`/reels?id=${id}`)} />
        ) : entries.length === 0 ? (
          <View style={{ paddingHorizontal: theme.space[4] }}>
            <EmptyFeed scope={scope} radiusM={radiusM} outside={outside} onSwitch={setTab} />
          </View>
        ) : (
          entries.map(({ post, distanceLabel }, index) => (
            <Appear key={post.id} index={index}>
              <PostCard post={post} viewerName={pet.ownerName} distanceLabel={distanceLabel} />
              {/* La bandeja de reels va intercalada después de las dos primeras
                  publicaciones, que es donde Instagram la pone: arriba del todo
                  empujaba la primera foto fuera de la pantalla. Convive con la
                  pestaña sin duplicarla, igual que allí: la bandeja es el
                  vistazo que aparece sin buscarlo, y la pestaña es ir a por
                  ellos. Quien nunca cambia de pestaña sigue viéndolos. */}
              {social && index === 1 ? (
                <ReelTray onOpen={(id) => router.push(`/reels?id=${id}`)} />
              ) : null}
            </Appear>
          ))
        )}

        {!reeling && scope === 'nearby' && entries.length > 0 && outside > 0 ? (
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
          {/* Sin `Link asChild`: en web el envoltorio se queda con el estilo
                del `Pressable` y el `<a>` sale en columna, así que la fila de
                icono y texto se convierte en renglones apilados. */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Ver con quién puede salir ${pet.name}`}
            onPress={() => {
              haptics.tap();
              router.push('/descubrir');
            }}
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
        </View>
      </Animated.ScrollView>

      {/* Lo que ha hecho el gesto, dicho y luego apagado solo. Una píldora que
          dijera «3 publicaciones nuevas» sin haberlas traído sería el tipo de
          mentira pequeña que enseña a no fiarse del resto. */}
      {refreshed ? (
        <Toast
          message={
            conditions
              ? `Al día · ${Math.round(conditions.temperatureC)}° donde estáis`
              : 'Al día. No hemos podido saber qué tiempo hace.'
          }
          onDone={() => setRefreshed(false)}
        />
      ) : null}
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
                // Once y no diez: es el suelo de tamaño de texto que fijan Apple
                // y Material, y el globo de no leídos es de las cosas que más se
                // miran de refilón.
                fontSize: theme.fontSize['2xs'],
                lineHeight: 13,
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
 * Ahora son tres palabras con subrayado —el patrón que la gente ya tiene
 * aprendido de cualquier feed moderno— y el radio se convierte en un texto
 * pequeño al lado, que solo aparece en «Cerca de mí» porque es lo único que
 * lo usa.
 *
 * La tercera, **Reels**, vivía en Explorar detrás de un segundo conmutador.
 * Estaba en el sitio equivocado por dos motivos: uno, que Explorar es el mapa y
 * una pestaña de vídeo encima de un mapa hace que deje de parecer un mapa; y
 * dos, que el vídeo corto es feed —se ve pasando el pulgar— y no exploración
 * geográfica. Aquí queda a un toque de las fotos, que es de donde se viene.
 *
 * El alternador sigue visible y no en un desplegable: si no se ven las otras
 * pestañas, no se sabe que existen.
 */
function FeedTabs({
  tab,
  onChange,
  radiusM,
  onRadius,
}: {
  tab: FeedTab;
  onChange: (tab: FeedTab) => void;
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
      {FEED_TABS.map((option) => {
        const active = option.id === tab;
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
              paddingRight: theme.space[4],
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

      {tab === 'nearby' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Radio: ${radiusM / 1000} kilómetros`}
          accessibilityHint="Cambia cuánto barrio entra en el feed"
          onPress={() => {
            haptics.tap();
            const next =
              NEARBY_RADII_M[(NEARBY_RADII_M.indexOf(radiusM) + 1) % NEARBY_RADII_M.length];
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
      /*
       * Una pastilla, no una franja de lado a lado.
       *
       * La franja a sangre en rojo saturado era lo que más alejaba esta
       * pantalla de parecerse a una red social: ninguna pone una barra de
       * alerta del ancho entero encima del contenido — eso es de una aplicación
       * de utilidad, de las de aviso de incidencia.
       *
       * Lo que **no** se ha tocado es que esté siempre y que sea lo primero:
       * eso era una decisión de seguridad, no de estilo. Lo que cambia es su
       * peso visual. Fondo teñido en vez de rojo pleno, texto en rojo, borde
       * fino, márgenes a los lados y esquinas del sistema. Sigue siendo lo
       * único de la pantalla en el rojo de extraviados y sigue llevando icono
       * y texto, así que quien no distinga el color se entera igual.
       */
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        minHeight: theme.touchTarget.min,
        marginHorizontal: theme.space[3],
        marginTop: theme.space[2],
        paddingHorizontal: theme.space[3],
        paddingVertical: theme.space[1.5],
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.destructive,
        backgroundColor: theme.colors.surfaceElevated,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon icon={Siren} size="base" color={theme.colors.destructive} decorative />
      {/* Título y detalle en la misma línea: son doce palabras, y apilarlas
          duplicaba el alto de la franja para no decir nada más. */}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          color: theme.colors.foreground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        <Text style={{ fontFamily: fonts.displayBold, color: theme.colors.destructive }}>
          {title}
        </Text>{' '}
        · {detail}
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
  onSwitch: (tab: FeedTab) => void;
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
