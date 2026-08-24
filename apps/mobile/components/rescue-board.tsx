/**
 * El tablero de rescate: lo único que ve una cuenta de protectora.
 *
 * Una protectora no entra aquí a ver fotos del perro de nadie. Entra a ver
 * **qué animal necesita ayuda cerca**, y con eso decide si coge el coche. Por
 * eso esta cuenta no tiene feed social: dejárselo sería convertir una
 * herramienta de trabajo en otra aplicación de la que salir, y de paso darle a
 * una cuenta sin animal propio una ventana al vecindario que no necesita.
 *
 * ## La forma es la de un feed, y el motivo no es la moda
 *
 * Cabecera con marca e iconos, fila de urgencias arriba, tarjetas a lo ancho
 * con su acción debajo. Es la anatomía de Instagram y se usa aquí porque
 * resuelve el mismo problema: **una lista de cosas que llegan, ordenadas por
 * cuándo llegaron, que se recorren con el pulgar**. Quien abre esto a las tres
 * de la mañana porque le ha saltado un aviso no debería tener que aprender una
 * interfaz nueva.
 *
 * Lo que cambia es qué va en cada hueco:
 *
 *  - Las **historias** son los avisos abiertos: cada círculo es un animal
 *    perdido, con el anillo encendido mientras la búsqueda sigue.
 *  - La **tarjeta** no lleva una foto bonita: lleva el mapa del alcance del
 *    aviso, que es lo que hace falta mirar para saber si te toca.
 *  - La **barra de acciones** no es «me gusta, comentar, compartir» sino «voy a
 *    buscar, compartir, guardar». Compartir es la que más importa: es lo único
 *    que saca un aviso del radio en el que se abrió.
 */

import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { describeZone, formatDistance } from '@petnav/core';

import { Avatar } from './avatar';
import { NavBar, Separator, useScrolled } from './chrome';
import { Icon } from './icon';
import { MiniMap } from './mini-map';
import { Pulse } from './motion';
import { Badge, Body, Caption, Screen } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { useWeatherState } from '@/lib/conditions';
import { PLACES } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Bookmark, Footprints, MessageCircleMore, Send, Siren } from '@/lib/icons';
import { useHazardZones } from '@/lib/rescue';
import { formatOpenFor, useAllAlerts } from '@/lib/safety';
import { useTheme } from '@/lib/theme';

export function RescueBoard() {
  const theme = useTheme();
  const router = useRouter();
  const { scrolled, onScroll } = useScrolled();
  const { location } = useWeatherState();
  const account = useAccount();

  const alerts = useAllAlerts(location);
  const open = alerts.filter((live) => !live.alert.resolvedAt);
  const zones = useHazardZones();

  return (
    <Screen>
      <NavBar
        title="Rescate"
        scrolled={scrolled}
        trailing={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mensajes"
              onPress={() => {
                haptics.tap();
                router.push('/mensajes');
              }}
              style={({ pressed }) => ({
                width: theme.touchTarget.min,
                height: theme.touchTarget.min,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon icon={MessageCircleMore} size="lg" decorative />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir un aviso"
              onPress={() => {
                haptics.tap();
                router.push('/sos');
              }}
              style={({ pressed }) => ({
                width: theme.touchTarget.min,
                height: theme.touchTarget.min,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon icon={Siren} size="lg" color={theme.colors.destructive} decorative />
            </Pressable>
          </>
        }
      />

      <ScrollView onScroll={onScroll} scrollEventThrottle={16}>
        {!account.shelterReviewed ? (
          <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[3] }}>
            <Caption>
              Cuenta en revisión. Ves lo que está publicado; los avisos a kilómetros se abren al
              aprobarla.
            </Caption>
          </View>
        ) : null}

        {/* La fila de urgencias, en el sitio de las historias. El anillo pulsa
            mientras la búsqueda sigue abierta: es el mismo movimiento que el
            radar, y significa lo mismo — está pasando ahora. */}
        {open.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: theme.space[4],
              paddingHorizontal: theme.space[4],
              paddingVertical: theme.space[3],
            }}
          >
            {open.map((live) => (
              <Pressable
                key={live.alert.id}
                accessibilityRole="button"
                accessibilityLabel={`${live.alert.petName ?? live.scenario.label}, a ${live.distanceLabel}`}
                onPress={() => {
                  haptics.tap();
                  router.push('/sos');
                }}
                style={({ pressed }) => ({ alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}
              >
                <Pulse active>
                  <View
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      borderWidth: 2,
                      borderColor: theme.colors.destructive,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Avatar
                      id={live.alert.id}
                      name={live.alert.petName ?? live.scenario.label}
                      size={58}
                    />
                  </View>
                </Pulse>
                <Text
                  numberOfLines={1}
                  style={{
                    maxWidth: 72,
                    color: theme.colors.foreground,
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize['2xs'],
                  }}
                >
                  {live.alert.petName ?? 'Peligro'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Separator />

        {open.length === 0 && zones.length === 0 ? (
          <View style={{ padding: theme.space[5], gap: theme.space[2] }}>
            <Body>No hay nada abierto cerca.</Body>
            <Caption>
              Es la buena noticia. Cuando alguien abra un aviso de animal perdido o en peligro,
              aparecerá aquí.
            </Caption>
          </View>
        ) : null}

        {open.map((live) => (
          <View key={live.alert.id} style={{ paddingBottom: theme.space[4] }}>
            {/* Cabecera de tarjeta: quién, dónde y desde cuándo. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[3],
                paddingHorizontal: theme.space[4],
                paddingVertical: theme.space[3],
              }}
            >
              <Avatar
                id={live.alert.id}
                name={live.alert.petName ?? live.scenario.label}
                size={40}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fonts.displayBold,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  {live.alert.petName ?? live.scenario.label}
                </Text>
                <Caption>
                  {live.alert.areaName} · a {live.distanceLabel}
                </Caption>
              </View>
              <Badge tone={live.scenario.severity === 'critical' ? 'live' : 'warning'}>
                {formatOpenFor(live.openForHours)}
              </Badge>
            </View>

            {/* El lienzo. Aquí no va una foto: va el alcance del aviso, que es
                lo que hay que mirar para saber si te toca a ti. */}
            <MiniMap
              center={live.searchPoint}
              markers={[
                {
                  id: live.alert.id,
                  lat: live.searchPoint.lat,
                  lng: live.searchPoint.lng,
                  label: live.alert.petName ?? live.scenario.label,
                  kind: live.scenario.label,
                  detail: live.alert.areaName,
                  icon: Siren,
                  tone: 'alert',
                  radiusM: live.radiusM,
                },
              ]}
              zoom={13}
              width={390}
              height={200}
              selectedId={null}
              onSelect={() => undefined}
            />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[4],
                paddingHorizontal: theme.space[4],
                paddingTop: theme.space[3],
              }}
            >
              <Action
                icon={Footprints}
                label={`Voy a buscar a ${live.alert.petName ?? 'este animal'}`}
                onPress={() => router.push('/sos')}
              />
              <Action
                icon={Send}
                label="Compartir el aviso"
                onPress={() => router.push('/sos')}
              />
              <View style={{ flex: 1 }} />
              <Action icon={Bookmark} label="Guardar el aviso" onPress={() => undefined} />
            </View>

            <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[2], gap: 2 }}>
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize.sm,
                }}
              >
                {live.alert.sightings.length === 0
                  ? 'Sin avistamientos todavía'
                  : live.alert.sightings.length === 1
                    ? '1 avistamiento'
                    : `${live.alert.sightings.length} avistamientos`}
              </Text>
              <Caption>{live.scenario.description}</Caption>
              <Caption>Aviso a {formatDistance(live.radiusM)} a la redonda</Caption>
            </View>
          </View>
        ))}

        {/* Las zonas marcadas van al final: no son una urgencia de esta noche,
            son un sitio al que no llevar animales. */}
        {zones.length > 0 ? (
          <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
            <Separator />
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.lg,
                paddingTop: theme.space[3],
              }}
            >
              Sitios marcados
            </Text>
            {zones.map((zone) => (
              <View key={`${zone.placeId}-${zone.scenarioId}`} style={{ gap: 2 }}>
                <Body>
                  {Object.values(PLACES).find((place) => place.id === zone.placeId)?.name ??
                    'Tu zona'}
                </Body>
                <Caption>{describeZone(zone)}</Caption>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ height: theme.space[16] }} />
      </ScrollView>
    </Screen>
  );
}

/** Un icono de la barra de acciones. Área táctil entera, dibujo pequeño. */
function Action({
  icon,
  label,
  onPress,
}: {
  icon: typeof Siren;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Icon icon={icon} size="lg" color={theme.colors.foreground} decorative />
    </Pressable>
  );
}
