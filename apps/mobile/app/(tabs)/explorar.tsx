import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { distanceMeters, formatDistance } from '@coincide/core';

import { Separator } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { MiniMap, radiusOverflows, type MapMarker } from '@/components/mini-map';
import { Sheet, type SheetPosition } from '@/components/sheet';
import { Body, Caption, Screen } from '@/components/ui';
import { useWeatherState } from '@/lib/conditions';
import { spanMeters } from '@/lib/tiles';
import { PLACES, SERVICES, WATER_POINTS } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  CalendarDays,
  ChevronRight,
  Droplets,
  Fence,
  Footprints,
  Layers,
  Locate,
  Minus,
  Plus,
  Radar,
  Siren,
  Stethoscope,
  Trees,
  Users,
  type LucideIcon,
} from '@/lib/icons';
import { useLiveAlerts } from '@/lib/safety';
import { useTheme } from '@/lib/theme';

/**
 * Explorar: el mapa y lo que hay en él.
 *
 * **El mapa es la pantalla.** Antes era un cuadrado de trescientos píxeles
 * flotando en mitad de un documento que se desplazaba, con el título grande, su
 * párrafo y un segmentado encima —cuatrocientos píxeles antes de ver un solo
 * marcador— y dos bloques de texto explicativo debajo. Ningún mapa que la gente
 * use funciona así: en Google Maps, en Citymapper o en Airbnb el mapa ocupa todo
 * y los controles van **encima**, con la lista en una hoja que sube y baja con
 * el pulgar. Eso es lo que hay ahora.
 *
 * Cuatro capas, y se encienden y apagan por separado porque no se usan a la vez:
 * el agua se busca a 35 grados, el veterinario de guardia a las tres de la
 * mañana, el pipicán cuando te mudas de barrio. Enseñarlas todas siempre
 * convierte el mapa en una alfombra de puntos donde no se distingue nada.
 *
 * Las alertas de seguridad **no se pueden apagar**. Es la única capa fija, y es
 * deliberado: un aviso de cebos envenenados que se puede esconder sin querer con
 * un filtro es un aviso que no sirve.
 *
 * Desde aquí se entra al radar, a las quedadas y a los espacios. Son pantallas
 * enteras, no pestañas: se llega a ellas desde el sitio donde se piensa en ellas,
 * que es mirando el mapa.
 */
type LayerId = 'places' | 'water' | 'vets';

const LAYERS: ReadonlyArray<{ id: LayerId; label: string; icon: LucideIcon; hint: string }> = [
  {
    id: 'places',
    label: 'Pipicanes',
    icon: Trees,
    hint: 'Áreas caninas y parques donde el radar se enciende',
  },
  { id: 'water', label: 'Agua', icon: Droplets, hint: 'Fuentes públicas y bebederos' },
  {
    id: 'vets',
    label: 'Veterinarios',
    icon: Stethoscope,
    hint: 'Clínicas, con las de 24 horas marcadas',
  },
];

/** Lo que asoma de la hoja con el mapa entero a la vista: cabecera y dos filas. */
const PEEK_HEIGHT = 164;

/**
 * Los niveles de acercamiento, de más cerca a más lejos.
 *
 * Antes eran tres anchos en metros —1,5 / 4 / 12 km— y ahora son niveles del
 * esquema XYZ, que es lo que las teselas entienden. No es una traducción
 * cosmética: a un ancho arbitrario le tocaría escalar las imágenes, y una
 * tesela escalada se ve borrosa y con el texto de las calles ilegible. Los
 * niveles enteros salen nítidos.
 *
 * Cuánto abarca cada uno depende de la latitud —Mercator estira hacia los
 * polos—, así que la barra de escala lo dice con números en vez de rotularse
 * «4 km» a lo fijo, que sería mentira en Reikiavik.
 */
const ZOOM_STEPS = [17, 15, 13, 11] as const;

/**
 * Cómo se dice una distancia muy corta.
 *
 * `formatDistance` es correcto y devuelve «0 m» cuando estás dentro del sitio,
 * y «0 m» se lee como un dato roto, no como «ya estás aquí». Es el mismo fallo
 * que tenía una publicación hecha donde estás. Por debajo de treinta metros —el
 * error típico de un GPS urbano— la cifra no significa nada de todas formas.
 */
function nearLabel(meters: number): string {
  return meters < 30 ? 'estás aquí' : `a ${formatDistance(meters)}`;
}

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { location } = useWeatherState();
  const alerts = useLiveAlerts(location);

  const [active, setActive] = useState<Set<LayerId>>(new Set(['places']));
  /* Arranca en el nivel 15 —barrio, algo menos de dos kilómetros de ancho en
     Madrid—, que es donde un mapa de calles se lee y donde caben los sitios de
     alrededor sin que el círculo de una alerta se coma la pantalla. */
  const [zoomIndex, setZoomIndex] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetPosition>('peek');
  const [showLayers, setShowLayers] = useState(false);
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });

  const zoom = ZOOM_STEPS[zoomIndex] ?? ZOOM_STEPS[1];

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];

    if (active.has('places')) {
      for (const place of Object.values(PLACES)) {
        list.push({
          id: place.id,
          lat: place.lat,
          lng: place.lng,
          label: place.name,
          kind: place.kind,
          detail: `El radar se enciende dentro de ${place.radiusM} metros.`,
          icon: place.kind === 'Área canina' ? Fence : Trees,
          tone: 'place',
          radiusM: place.radiusM,
        });
      }
    }

    if (active.has('water')) {
      for (const point of WATER_POINTS) {
        list.push({
          id: point.id,
          lat: point.lat,
          lng: point.lng,
          label: point.name,
          kind: point.hasDogBowl ? 'Fuente con bebedero' : 'Fuente',
          detail: point.hasDogBowl
            ? 'Tiene bebedero bajo, así que le sirve a él y no solo a ti.'
            : 'Fuente alta: hace falta llevar recipiente.',
          icon: Droplets,
          tone: 'water',
        });
      }
    }

    if (active.has('vets')) {
      for (const service of SERVICES) {
        if (service.kind !== 'vet' && service.kind !== 'emergency_vet') continue;
        list.push({
          id: service.id,
          lat: service.lat,
          lng: service.lng,
          label: service.name,
          kind: service.is24h ? 'Veterinario 24 h' : 'Veterinario',
          detail: service.is24h ? 'Abierto 24 horas.' : 'Horario de clínica.',
          icon: Stethoscope,
          tone: 'vet',
        });
      }
    }

    // Las alertas al final y siempre, con su radio real dibujado a escala.
    for (const live of alerts) {
      list.push({
        id: live.alert.id,
        lat: live.searchPoint.lat,
        lng: live.searchPoint.lng,
        label: live.alert.petName
          ? `${live.alert.petName}: ${live.scenario.label.toLowerCase()}`
          : live.scenario.label,
        kind: 'Alerta abierta',
        detail: `${live.alert.areaName}. Radio ${live.radiusM >= 1000 ? `${(live.radiusM / 1000).toFixed(1).replace('.', ',')} km` : `${live.radiusM} m`}.`,
        icon: Siren,
        tone: 'alert',
        radiusM: live.radiusM,
      });
    }

    return list;
  }, [active, alerts]);

  /* Ordenados por lo lejos que están, que es el único orden que sirve andando.
     Y con la distancia calculada aquí y no dentro del mapa: el mapa dibuja, la
     lista mide. */
  const nearby = useMemo(
    () =>
      markers
        .map((marker) => ({ marker, distance: distanceMeters(location, marker) }))
        .sort((a, b) => {
          // Las alertas primero pase lo que pase: si hay una abierta cerca es lo
          // primero que hay que leer, esté a cien metros o a dos kilómetros.
          const alertDelta =
            Number(b.marker.tone === 'alert') - Number(a.marker.tone === 'alert');
          return alertDelta !== 0 ? alertDelta : a.distance - b.distance;
        }),
    [markers, location],
  );

  const selected = markers.find((marker) => marker.id === selectedId) ?? null;
  const overflowing = radiusOverflows(markers, spanMeters(location.lat, zoom, canvas.width || 390));

  const toggle = (id: LayerId) => {
    haptics.tap();
    setActive((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stepZoom = (direction: -1 | 1) => {
    haptics.tap();
    setZoomIndex((current) => Math.min(ZOOM_STEPS.length - 1, Math.max(0, current + direction)));
  };

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCanvas({ width, height });
  };

  return (
    <Screen>
      {/* Sin barra encima. El mapa arranca en el borde de arriba y los controles
          flotan sobre él, esquivando el área segura: es lo que hacen Google Maps
          y Waze, y es lo que se pierde en cuanto se le pone una cabecera. Los
          cuarenta y ocho píxeles que ocupaba el conmutador Mapa/Reels son
          ahora mapa. */}
      <View style={{ flex: 1 }} onLayout={onCanvasLayout}>
          {canvas.width > 0 ? (
            <MiniMap
              center={location}
              markers={markers}
              zoom={zoom}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                // Elegir un marcador sube la hoja: lo que se quiere después de
                // tocar un punto es leer qué es, no seguir mirando puntos.
                if (id) setSheet('open');
              }}
              width={canvas.width}
              height={canvas.height}
              bottomInset={PEEK_HEIGHT}
              topInset={insets.top}
            />
          ) : null}

          {/* Los controles, encima del mapa. Es lo que lo convierte en una
              pantalla en vez de una tarjeta dentro de un documento. */}
          <View
            style={{
              position: 'absolute',
              // Sin cabecera que lo haga por ellos, los botones esquivan la
              // muesca a mano: si no, el de capas se mete debajo del reloj.
              top: insets.top + theme.space[3],
              right: theme.space[3],
              /* Seis píxeles entre botones y no ocho: con la hoja abierta el
                 mapa se queda en unos doscientos cincuenta de alto, y la
                 columna entera tiene que caber ahí o el «−» sale cortado por el
                 borde de la hoja, que se lee como un fallo de dibujo. */
              gap: 6,
            }}
          >
            <MapButton
              icon={Layers}
              label={showLayers ? 'Cerrar las capas' : 'Elegir qué se ve en el mapa'}
              active={showLayers}
              onPress={() => {
                haptics.tap();
                setShowLayers((value) => !value);
              }}
            />
            <View style={{ borderRadius: theme.radius.md, overflow: 'hidden' }}>
              <MapButton
                icon={Plus}
                label="Acercar"
                square
                disabled={zoomIndex === 0}
                onPress={() => stepZoom(-1)}
              />
              <View style={{ height: 1, backgroundColor: theme.colors.border }} />
              <MapButton
                icon={Minus}
                label="Alejar"
                square
                disabled={zoomIndex === ZOOM_STEPS.length - 1}
                onPress={() => stepZoom(1)}
              />
            </View>
            <MapButton
              icon={Locate}
              label="Volver a donde estás"
              onPress={() => {
                haptics.tap();
                setSelectedId(null);
                setZoomIndex(1);
              }}
            />
          </View>

          {/* Las capas, desplegadas sobre el mapa y no en una sección al final
              de la página. Un filtro que hay que ir a buscar debajo del mapa se
              usa una vez. */}
          {showLayers ? (
            <View
              style={{
                position: 'absolute',
                top: insets.top + theme.space[3],
                left: theme.space[3],
                right: 60,
                gap: theme.space[2],
                padding: theme.space[3],
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.background,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              {LAYERS.map((layer) => {
                const on = active.has(layer.id);
                return (
                  <Pressable
                    key={layer.id}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={layer.label}
                    accessibilityHint={layer.hint}
                    onPress={() => toggle(layer.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.space[2],
                      minHeight: theme.touchTarget.min,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: theme.radius.xs,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: on ? 0 : 1.5,
                        borderColor: theme.colors.borderStrong,
                        backgroundColor: on ? theme.colors.primary : 'transparent',
                      }}
                    >
                      <Icon
                        icon={layer.icon}
                        size="sm"
                        color={on ? theme.colors.primaryForeground : theme.colors.mutedForeground}
                        decorative
                      />
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        color: theme.colors.foreground,
                        fontFamily: on ? fonts.bodyBold : fonts.body,
                        fontSize: theme.fontSize.sm,
                      }}
                    >
                      {layer.label}
                    </Text>
                  </Pressable>
                );
              })}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
                <Icon icon={Siren} size="sm" color={theme.colors.destructive} decorative />
                <Text
                  style={{
                    flex: 1,
                    color: theme.colors.mutedForeground,
                    fontFamily: fonts.body,
                    fontSize: 11,
                  }}
                >
                  Las alertas no se apagan: un aviso que se esconde sin querer no sirve.
                </Text>
              </View>
            </View>
          ) : null}

          {canvas.height > 0 ? (
            <Sheet
              available={canvas.height}
              peekHeight={PEEK_HEIGHT}
              position={sheet}
              onPosition={setSheet}
            >
              <ScrollView
                contentContainerStyle={{ paddingBottom: theme.space[8] }}
                showsVerticalScrollIndicator={false}
              >
                {selected ? (
                  <SelectedCard
                    marker={selected}
                    distance={distanceMeters(location, selected)}
                    onClear={() => setSelectedId(null)}
                    onOpenAlert={() => router.push('/sos')}
                  />
                ) : (
                  <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[2] }}>
                    <Text
                      accessibilityRole="header"
                      style={{
                        color: theme.colors.foreground,
                        fontFamily: fonts.displayBold,
                        fontSize: theme.fontSize.lg,
                      }}
                    >
                      {nearby.length === 1 ? '1 sitio cerca' : `${nearby.length} sitios cerca`}
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.mutedForeground,
                        fontFamily: fonts.body,
                        fontSize: theme.fontSize.sm,
                      }}
                    >
                      Ordenados por lo que hay que andar
                    </Text>
                  </View>
                )}

                {!selected
                  ? nearby.map(({ marker, distance }) => (
                      <NearbyRow
                        key={marker.id}
                        marker={marker}
                        distance={distance}
                        onPress={() => {
                          haptics.tap();
                          setSelectedId(marker.id);
                        }}
                      />
                    ))
                  : null}

                {overflowing.length > 0 ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: theme.space[2],
                      paddingHorizontal: theme.space[4],
                      paddingTop: theme.space[3],
                    }}
                  >
                    <View style={{ paddingTop: 3 }}>
                      <Icon
                        icon={Layers}
                        size="sm"
                        color={theme.colors.mutedForeground}
                        decorative
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Caption>
                        {overflowing.length === 1
                          ? '1 alerta avisa más lejos de lo que abarca este cuadro.'
                          : `${overflowing.length} alertas avisan más lejos de lo que abarca este cuadro.`}{' '}
                        Su círculo no se dibuja porque un color que lo tapa todo deja de tener
                        dentro y fuera. Alejando el cuadro se ve el alcance completo.
                      </Caption>
                    </View>
                  </View>
                ) : null}

                <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[3] }}>
                  <Caption>
                    Es un esquema, no un mapa de calles: no hay proveedor de teselas conectado y
                    dibujar calles inventadas sería peor que no dibujarlas. Las posiciones, las
                    distancias y los radios sí son reales.
                  </Caption>
                </View>

                {/* Las pantallas que se piensan mirando el mapa. */}
                <View style={{ paddingTop: theme.space[5] }}>
                  <Separator />
                  <Destination
                    href="/radar"
                    icon={Radar}
                    title="Radar"
                    detail="Quién está paseando ahora, dentro de una zona pet-friendly"
                  />
                  <Separator inset={theme.space[12]} />
                  <Destination
                    href="/encuentros"
                    icon={Footprints}
                    title="Puntos de encuentro"
                    detail="Tu rutina cruzada con la del barrio, con el sitio ya elegido"
                  />
                  <Separator inset={theme.space[12]} />
                  <Destination
                    href="/quedadas"
                    icon={CalendarDays}
                    title="Quedadas"
                    detail="Espontáneas y programadas, con la afinidad del grupo delante"
                  />
                  <Separator inset={theme.space[12]} />
                  <Destination
                    href="/espacios"
                    icon={Fence}
                    title="Espacios privados"
                    detail="Patios cerrados, con el coste ya repartido entre el grupo"
                  />
                  <Separator inset={theme.space[12]} />
                  <Destination
                    href="/comunidad"
                    icon={Users}
                    title="Comunidad y servicios"
                    detail="Grupos de tu zona y quién sabe tratar a tu especie"
                  />
                  <Separator />
                </View>
              </ScrollView>
            </Sheet>
        ) : null}
      </View>
    </Screen>
  );
}

/** Un botón flotando sobre el mapa: fondo sólido, porque debajo hay dibujo. */
function MapButton({
  icon,
  label,
  onPress,
  active = false,
  square = false,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  active?: boolean;
  /** Parte de un grupo pegado —el más y el menos—: sin esquinas propias. */
  square?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: square ? 0 : theme.radius.md,
        backgroundColor: active ? theme.colors.primary : theme.colors.background,
        borderWidth: square ? 0 : 1,
        borderColor: theme.colors.border,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon
        icon={icon}
        size="base"
        color={active ? theme.colors.primaryForeground : theme.colors.foreground}
        decorative
      />
    </Pressable>
  );
}

/** Una fila de la lista: qué es, cómo se llama y cuánto hay que andar. */
function NearbyRow({
  marker,
  distance,
  onPress,
}: {
  marker: MapMarker;
  distance: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const alert = marker.tone === 'alert';
  const tint = alert
    ? theme.colors.destructive
    : marker.tone === 'water'
      ? theme.colors.information
      : marker.tone === 'vet'
        ? theme.colors.warning
        : theme.colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${marker.label}, a ${formatDistance(distance)}`}
      accessibilityHint={marker.detail}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: 56,
        paddingHorizontal: theme.space[4],
        backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tint,
        }}
      >
        <Icon icon={marker.icon} size="sm" color={theme.colors.background} decorative />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: alert ? theme.colors.destructive : theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.sm,
          }}
        >
          {marker.label}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: 12,
          }}
        >
          {marker.kind}
        </Text>
      </View>

      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.bodyBold,
          fontSize: 12,
          fontVariant: ['tabular-nums'],
        }}
      >
        {distance < 30 ? 'aquí' : formatDistance(distance)}
      </Text>
    </Pressable>
  );
}

/** Lo que hay en el punto elegido, ocupando la hoja entera. */
function SelectedCard({
  marker,
  distance,
  onClear,
  onOpenAlert,
}: {
  marker: MapMarker;
  distance: number;
  onClear: () => void;
  onOpenAlert: () => void;
}) {
  const theme = useTheme();
  const alert = marker.tone === 'alert';

  return (
    <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[3] }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alert ? theme.colors.destructive : theme.colors.primary,
          }}
        >
          <Icon icon={marker.icon} size="base" color={theme.colors.background} decorative />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: alert ? theme.colors.destructive : theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.lg,
            }}
          >
            {marker.label}
          </Text>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            {marker.kind} · {nearLabel(distance)}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a la lista"
          onPress={onClear}
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
              fontSize: theme.fontSize.sm,
            }}
          >
            Lista
          </Text>
        </Pressable>
      </View>

      <Body muted>{marker.detail}</Body>

      {alert ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir la alerta en SOS"
          onPress={onOpenAlert}
          style={({ pressed }) => ({
            minHeight: theme.touchTarget.min,
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.destructive,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.base,
            }}
          >
            Ver los pasos y reportar avistamiento
          </Text>
        </Pressable>
      ) : null}

      <Caption>
        Los círculos son alcance real: el de un lugar es la zona donde se puede encender el radar, y
        el de una alerta es a quién está avisando ahora mismo.
      </Caption>
    </View>
  );
}

/*
 * Sin `Link asChild`.
 *
 * En web ese envoltorio se queda con el estilo del `Pressable` que envuelve
 * —sobre todo cuando el estilo es una función de `pressed`— y el `<a>` que
 * genera sale con `flex-direction: column`. El efecto es que una fila de icono,
 * título y flecha se convierte en cuatro renglones apilados a todo lo ancho. No
 * lo dice el tipado ni salta ningún test: hay que ir a mirar el `flexDirection`
 * calculado en el DOM, que es como se encontró. La navegación directa hace lo
 * mismo y se coloca donde toca.
 */
function Destination({
  href,
  icon,
  title,
  detail,
}: {
  href: '/radar' | '/encuentros' | '/quedadas' | '/espacios' | '/comunidad';
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={() => {
        haptics.tap();
        router.push(href);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: 60,
        paddingHorizontal: theme.space[4],
        backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
      })}
    >
      <Icon icon={icon} size="lg" color={theme.colors.primary} decorative />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.sm,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: 12,
          }}
        >
          {detail}
        </Text>
      </View>
      <Icon icon={ChevronRight} size="base" color={theme.colors.mutedForeground} decorative />
    </Pressable>
  );
}
