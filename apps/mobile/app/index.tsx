import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LargeTitle, NavBar, useScrolled } from '@/components/chrome';
import { Fab, FAB_CLEARANCE } from '@/components/fab';
import { Icon } from '@/components/icon';
import { PetSwitcher } from '@/components/pet-switcher';
import { PostCard } from '@/components/post-card';
import { StoryRail } from '@/components/story-rail';
import { Body, Caption, Notice, Screen, Segmented } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { useConditions, useDeclaredConditions } from '@/lib/conditions';
import { discover, petHasMeetups, walkingNow } from '@/lib/data';
import { fonts } from '@/lib/fonts';
import { Compass, ImagePlus, Siren } from '@/lib/icons';
import {
  FEED_SCOPES,
  NEARBY_RADII_M,
  useOutsideRadiusCount,
  useScopedFeed,
  type FeedScope,
  type NearbyRadius,
} from '@/lib/posts';
import { useLiveAlerts } from '@/lib/safety';
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
  const { location } = useDeclaredConditions();
  const { welfare } = discover(pet, conditions);
  const { scrolled, onScroll } = useScrolled();

  const [scope, setScope] = useState<FeedScope>('nearby');
  const [radiusM, setRadiusM] = useState<NearbyRadius>(NEARBY_RADII_M[0]);
  const entries = useScopedFeed(scope, location, radiusM);
  const outside = useOutsideRadiusCount(location, radiusM);

  const [checkedIn, setCheckedIn] = useState(false);
  const outNow = social ? walkingNow(pet.speciesId) : [];
  const stopped = social && welfare.level === 'stop';

  // Una alerta abierta cerca se enseña **dentro del feed**, no solo en su
  // pestaña. Quien está mirando fotos no va a ir a mirar la pestaña de SOS por
  // si acaso, y ese es justo el momento en que sirve de algo enterarse.
  const alerts = useLiveAlerts(location);
  const topAlert = alerts[0];

  return (
    <Screen>
      <NavBar
        title="Coincide"
        scrolled={scrolled}
        trailing={
          <Link href="/publicar" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publicar una foto"
              style={({ pressed }) => ({
                width: theme.touchTarget.min,
                height: theme.touchTarget.min,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Icon icon={ImagePlus} size="lg" decorative />
            </Pressable>
          </Link>
        }
      />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: FAB_CLEARANCE }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[3] }}>
          <PetSwitcher />
        </View>

        {topAlert ? (
          <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[4] }}>
            <AlertStrip
              title={topAlert.scenario.label}
              detail={`${topAlert.alert.petName ?? topAlert.alert.areaName} · a ${topAlert.distanceLabel}`}
              onPress={() => router.push('/sos')}
            />
          </View>
        ) : null}

        <View
          style={{
            paddingHorizontal: theme.space[4],
            paddingTop: theme.space[4],
            gap: theme.space[2],
          }}
        >
          <Segmented options={FEED_SCOPES} value={scope} onChange={setScope} />
          {scope === 'nearby' ? <RadiusPicker value={radiusM} onChange={setRadiusM} /> : null}
        </View>

        {/* Los «snacks»: quién está fuera ahora. Solo tiene sentido en el feed
            de vecindario, porque es presencia y la presencia es local. */}
        {social && scope === 'nearby' ? (
          <View style={{ paddingTop: theme.space[4] }}>
            <StoryRail
              me={pet}
              others={outNow}
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

        <View style={{ height: theme.space[4] }} />

        {entries.length === 0 ? (
          <View style={{ paddingHorizontal: theme.space[4] }}>
            <EmptyFeed scope={scope} radiusM={radiusM} outside={outside} onSwitch={setScope} />
          </View>
        ) : (
          entries.map(({ post, distanceLabel }) => (
            <PostCard
              key={post.id}
              post={post}
              viewerName={pet.ownerName}
              distanceLabel={distanceLabel}
            />
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

      <Fab
        label="Publicar"
        icon={ImagePlus}
        accessibilityHint="Subir una foto al feed"
        onPress={() => router.push('/publicar')}
      />
    </Screen>
  );
}

/**
 * El radio del feed de vecindario.
 *
 * Dos opciones y no un deslizador: cinco kilómetros es «mi barrio» y diez es «mi
 * zona». Un deslizador continuo pediría al usuario que eligiera entre 6,4 y 6,8
 * km, que es una decisión que nadie tiene forma de tomar.
 */
function RadiusPicker({
  value,
  onChange,
}: {
  value: NearbyRadius;
  onChange: (radius: NearbyRadius) => void;
}) {
  return (
    <Segmented
      options={NEARBY_RADII_M.map((radius) => ({
        id: String(radius) as `${NearbyRadius}`,
        label: `${radius / 1000} km`,
        hint: radius === 5000 ? 'Tu barrio' : 'Tu zona',
      }))}
      value={String(value) as `${NearbyRadius}`}
      onChange={(id) => onChange(Number(id) as NearbyRadius)}
    />
  );
}

/**
 * Una alerta abierta, en una franja dentro del feed.
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
        gap: theme.space[3],
        minHeight: theme.touchTarget.comfortable,
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[2],
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.destructive,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Icon icon={Siren} size="lg" color={theme.colors.destructiveForeground} decorative />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.destructiveForeground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.sm,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: theme.colors.destructiveForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
          }}
        >
          {detail}
        </Text>
      </View>
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
