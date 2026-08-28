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
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { describeZone, formatDistance, shareAlertText } from '@petnav/core';

import { Avatar } from './avatar';
import { NAV_BAR_HEIGHT, NavBar, Separator } from './chrome';
import { Icon } from './icon';
import { MiniMap } from './mini-map';
import { Press, Pulse } from './motion';
import { Badge, Body, Caption, Screen } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { useWeatherState } from '@/lib/conditions';
import { PLACES } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Bookmark, Footprints, MessageCircleMore, Send, Siren } from '@/lib/icons';
import { useHazardZones } from '@/lib/rescue';
import {
  describeSearchers,
  formatOpenFor,
  toggleSavedAlert,
  toggleSearch,
  useAllAlerts,
  useAmSearching,
  useIsSaved,
  useSavedAlerts,
  type LiveAlert,
} from '@/lib/safety';
import { shareResultNote, shareText } from '@/lib/share';
import { Toast } from './toast';
import { useScrollDriver } from '@/lib/scroll';
import { useTheme } from '@/lib/theme';

export function RescueBoard() {
  const theme = useTheme();
  const router = useRouter();
  const { scrollY, onScroll } = useScrollDriver();
  const { location } = useWeatherState();
  const account = useAccount();

  const alerts = useAllAlerts(location);
  const open = alerts.filter((live) => !live.alert.resolvedAt);
  const savedAlerts = useSavedAlerts(location);
  const zones = useHazardZones();
  /* Lo que se le dice a la persona después de una acción que ocurre fuera de
     la aplicación. Vive aquí y no en la tarjeta porque el aviso se dibuja sobre
     la pantalla entera, no dentro de la tarjeta que lo provocó. */
  const [note, setNote] = useState<string | null>(null);

  return (
    <Screen>
      <NavBar
        title="Rescate"
        scrolled={false}
        scrollY={scrollY}
        /* De cristal, como la del feed: es la misma pantalla de inicio para la
           otra puerta de la aplicación, y no tendría sentido que la de una
           protectora fuera opaca y la de un tutor no. */
        floating
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

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: NAV_BAR_HEIGHT }}
      >
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
                style={{ alignItems: 'center', gap: 6 }}
              >
                {({ pressed }) => (
                  <Press pressed={pressed} scale={0.94} style={{ alignItems: 'center', gap: 6 }}>
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
                  </Press>
                )}
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
          <RescueCard key={live.alert.id} live={live} onNote={setNote} />
        ))}

        {/*
          Los guardados, al final y con su propio rótulo.

          No es un filtro que esconda lo demás: el tablero sigue siendo lo que
          está pasando ahora, y lo guardado es lo que alguien decidió no perder
          de vista. Aquí entran también los resueltos, que es lo que un filtro
          de «solo abiertos» escondería justo cuando interesa — saber si el
          galgo del polígono apareció.
        */}
        {savedAlerts.length > 0 ? (
          <View style={{ paddingTop: theme.space[2] }}>
            <Separator />
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.lg,
                paddingHorizontal: theme.space[4],
                paddingTop: theme.space[4],
                paddingBottom: theme.space[2],
              }}
            >
              Guardados
            </Text>
            {savedAlerts.map((live) => (
              <Pressable
                key={`saved-${live.alert.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${live.alert.petName ?? live.scenario.label}, ${
                  live.alert.resolvedAt ? 'resuelto' : 'abierto'
                }`}
                onPress={() => {
                  haptics.tap();
                  router.push('/sos');
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space[3],
                  paddingHorizontal: theme.space[4],
                  paddingVertical: theme.space[3],
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Avatar
                  id={live.alert.id}
                  name={live.alert.petName ?? live.scenario.label}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <Body>{live.alert.petName ?? live.scenario.label}</Body>
                  <Caption>
                    {live.alert.areaName} · a {live.distanceLabel}
                  </Caption>
                </View>
                <Badge tone={live.alert.resolvedAt ? 'verified' : 'warning'}>
                  {live.alert.resolvedAt ? 'Resuelto' : 'Abierto'}
                </Badge>
              </Pressable>
            ))}
          </View>
        ) : null}

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

      {note ? <Toast message={note} onDone={() => setNote(null)} /> : null}
    </Screen>
  );
}

/**
 * Una tarjeta del tablero: un aviso abierto, con lo que se puede hacer con él.
 *
 * Está fuera de la pantalla y no dentro del bucle porque cada tarjeta tiene
 * **estado propio** —si voy a buscar a este, si lo tengo guardado— y eso son
 * ganchos, que no se pueden llamar dentro de un `map`.
 *
 * Las tres acciones hacen tres cosas distintas, y eso hay que decirlo porque
 * antes las tres llevaban al mismo sitio:
 *
 *  - **Voy a buscar** apunta a esta cuenta en la lista de quien está buscando,
 *    y se puede quitar. Es lo único de aquí que ve el otro lado: quien ha
 *    perdido a su perro a las tres de la mañana ve que hay tres personas
 *    mirando.
 *  - **Compartir** saca el aviso de la aplicación, que es lo único que lo lleva
 *    más allá del radio en el que se abrió.
 *  - **Guardar** lo aparta para volver mañana, cuando ya no esté arriba.
 */
function RescueCard({ live, onNote }: { live: LiveAlert; onNote: (note: string) => void }) {
  const theme = useTheme();
  const router = useRouter();
  const searching = useAmSearching(live.alert.id);
  const isSaved = useIsSaved(live.alert.id);
  const who = live.alert.petName ?? live.scenario.label;
  const searchers = describeSearchers(live.alert);

  return (
    <View style={{ paddingBottom: theme.space[4] }}>
      {/* Cabecera de tarjeta: quién, dónde y desde cuándo. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir el aviso de ${who}`}
        onPress={() => {
          haptics.tap();
          router.push('/sos');
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[3],
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Avatar id={live.alert.id} name={who} size={40} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
            }}
          >
            {who}
          </Text>
          <Caption>
            {live.alert.areaName} · a {live.distanceLabel}
          </Caption>
        </View>
        <Badge tone={live.scenario.severity === 'critical' ? 'live' : 'warning'}>
          {formatOpenFor(live.openForHours)}
        </Badge>
      </Pressable>

      {/* El lienzo. Aquí no va una foto: va el alcance del aviso, que es lo que
          hay que mirar para saber si te toca a ti. Tocarlo abre la ficha, igual
          que tocar la foto de una publicación. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver en el mapa dónde buscar a ${who}`}
        onPress={() => {
          haptics.tap();
          router.push('/sos');
        }}
      >
        <MiniMap
          center={live.searchPoint}
          markers={[
            {
              id: live.alert.id,
              lat: live.searchPoint.lat,
              lng: live.searchPoint.lng,
              label: who,
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
      </Pressable>

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
          label={searching ? `Ya no vas a buscar a ${who}` : `Vas a buscar a ${who}`}
          active={searching}
          onPress={() => {
            toggleSearch(live.alert.id);
            onNote(searching ? 'Ya no apareces buscando.' : `Vas de camino. ${who} lo verá.`);
          }}
        />
        <Action
          icon={Send}
          label={`Compartir el aviso de ${who}`}
          onPress={() => {
            void shareText(
              shareAlertText({
                scenario: live.scenario,
                petName: live.alert.petName,
                areaName: live.alert.areaName,
                openForHours: live.openForHours,
                radiusM: live.radiusM,
                contactPhone: live.alert.contactPhone,
                sightings: live.alert.sightings.length,
              }),
            ).then((result) => {
              const message = shareResultNote(result);
              if (message) onNote(message);
            });
          }}
        />
        <View style={{ flex: 1 }} />
        <Action
          icon={Bookmark}
          label={isSaved ? `Quitar de guardados el aviso de ${who}` : `Guardar el aviso de ${who}`}
          active={isSaved}
          onPress={() => {
            toggleSavedAlert(live.alert.id);
            onNote(isSaved ? 'Quitado de guardados.' : 'Guardado. Lo tienes al final del tablero.');
          }}
        />
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
        {/* Cuánta gente va. Es el estado que hace que el botón de arriba
            signifique algo: sin él, «voy a buscar» solo cambiaría un color en
            este teléfono. */}
        {searchers ? <Caption>{searchers}</Caption> : null}
        <Caption>{live.scenario.description}</Caption>
        <Caption>Aviso a {formatDistance(live.radiusM)} a la redonda</Caption>
      </View>
    </View>
  );
}

/** Un icono de la barra de acciones. Área táctil entera, dibujo pequeño. */
function Action({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: typeof Siren;
  label: string;
  onPress: () => void;
  /** Encendido: vas a buscar, o lo tienes guardado. */
  active?: boolean;
}) {
  const theme = useTheme();

  /*
   * El estado va en el color y en el trazo, y **también en la etiqueta**, que
   * cambia de «Vas a buscar» a «Ya no vas a buscar». Un botón que solo se pone
   * de otro color no le dice nada a quien no ve el color, y aquí el color es
   * lo único que distingue «voy» de «no voy».
   */
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-pressed={active}
      accessibilityState={{ selected: active }}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      hitSlop={10}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Icon
        icon={icon}
        size="lg"
        color={active ? theme.colors.primary : theme.colors.foreground}
        strokeWidth={active ? 2.4 : 1.75}
        decorative
      />
    </Pressable>
  );
}
