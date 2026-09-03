import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
/* El `ScrollView` del gestor de gestos y no el de React Native: la hoja se
   arrastra desde su cuerpo cuando no está del todo abierta, y un ScrollView
   nativo se queda con el gesto antes de que la hoja lo vea. El del gestor
   entra en el mismo arbitraje que el arrastre. */
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { distanceMeters, formatDistance } from '@petnav/core';

import { Separator } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { LayerChips, PersonPanel, PlacePanel, PresenceStrip } from '@/components/map-panels';
import { MiniMap, radiusOverflows, type MapMarker } from '@/components/mini-map';
import { SearchBar, SearchPanel } from '@/components/map-search';
import { AddToMapSheet, CONTRIBUTABLE_PLACES } from '@/components/add-to-map';
import { PetSwitcherCompact } from '@/components/pet-switcher';
import { ReportSheet } from '@/components/report-sheet';
import { Sheet, type SheetPosition } from '@/components/sheet';
import { Caption, Row, Screen } from '@/components/ui';
import { useBackDismiss } from '@/lib/back';
import { clusterMarkers } from '@/lib/clusters';
import { setLocation, useConditions, useWeatherState } from '@/lib/conditions';
import { detentOffsets, visibleHeight } from '@/lib/sheet-detents';
import { useStoryGroups } from '@/lib/stories';
import {
  SUGGESTION_MIN_CONFIRMATIONS,
  addPlaceSuggestion,
  isConfirmed,
  usePlaceSuggestions,
} from '@/lib/contributions';
import { placeAt } from '@/lib/geofence';
import { reportRescue } from '@/lib/rescue';
import { setGhostMode, useGhostMode, useLivePresence } from '@/lib/presence';
import { metersPerPixel, spanMeters } from '@/lib/tiles';
import { useCan, useHandlerNeed, useWhyNot } from '@/lib/account';
import { useVisiblePets } from '@/lib/moderation';
import { discover, petById, walkingNow } from '@/lib/data';
import { PLACES, SERVICES, WATER_POINTS } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  CalendarDays,
  ChevronRight,
  Droplets,
  Fence,
  Footprints,
  Check,
  Clock,
  Layers,
  Locate,
  Map as MapIcon,
  Minus,
  Plus,
  Radar,
  Siren,
  Stethoscope,
  TriangleAlert,
  Eye,
  EyeOff,
  PawPrint,
  Trees,
  Users,
  type LucideIcon,
} from '@/lib/icons';
import { openAlert, useLiveAlerts } from '@/lib/safety';
import { useActivePet } from '@/lib/active-pet';
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
type LayerId = 'friends' | 'places' | 'water' | 'vets';

const LAYERS: ReadonlyArray<{ id: LayerId; label: string; icon: LucideIcon; hint: string }> = [
  {
    id: 'friends',
    label: 'Quién está fuera',
    icon: PawPrint,
    hint: 'Las caras de los perros que están paseando ahora, en su parque',
  },
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

/**
 * Lo que asoma de la hoja con el mapa entero a la vista.
 *
 * El asa, la tira de quién está fuera —caras con nombre— y la primera fila
 * de la lista. Es la posición en la que se vive: el mapa entero delante y lo
 * justo de la hoja para saber que hay más debajo. Las otras dos posiciones
 * salen de `lib/sheet-detents`, no de aquí.
 */
const PEEK_HEIGHT = 200;

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

/** Metros por grado de latitud. Constante en todo el globo, a diferencia de la longitud. */
const METERS_PER_DEGREE_LAT = 111_320;

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { location } = useWeatherState();
  const pet = useActivePet();
  const alerts = useLiveAlerts(location);

  const [active, setActive] = useState<Set<LayerId>>(new Set(['friends', 'places']));
  /* Arranca en el nivel 15 —barrio, algo menos de dos kilómetros de ancho en
     Madrid—, que es donde un mapa de calles se lee y donde caben los sitios de
     alrededor sin que el círculo de una alerta se coma la pantalla. */
  const [zoomIndex, setZoomIndex] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetPosition>('peek');
  const [showLayers, setShowLayers] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [adding, setAdding] = useState(false);
  /* Los últimos sitios buscados. En memoria y en el dispositivo: una lista de
     sitios buscados es una lista de dónde ha estado alguien y por qué. */
  const [recents, setRecents] = useState<string[]>([]);
  const [canvas, setCanvas] = useState({ width: 0, height: 0 });

  /* Quién está fuera ahora, de la misma especie. Con el modo fantasma puesto
     esta lista sigue llegando: apagarse a uno mismo no es dejar de ver a los
     demás, que es lo que hace Snapchat y es lo correcto —esconderte no debería
     costarte la función—. Lo que se apaga es tu presencia, y eso lo decide el
     radar, no esta pantalla. */
  /* Las caras del mapa son lo que la puerta protege. Sin chip verificado no se
     calculan: el mapa sigue siendo el mapa —parques, agua, sombra,
     veterinarios— y deja de ser el directorio de quién pasea y a qué hora. */
  const canSeePeople = useCan('live_people');
  const outNow = useVisiblePets(
    useMemo(() => (canSeePeople ? walkingNow(pet.speciesId) : []), [pet.speciesId, canSeePeople]),
  );
  /* El sitio en el que se está, si es uno del catálogo. Es a lo que se pega un
     aporte: «una fuente en el Parque Central» y no «una fuente en 40.4098,
     −3.6939», que además publicaría una coordenada. */
  const nearestPlace = placeAt(location);
  const suggestions = usePlaceSuggestions();
  const ghost = useGhostMode();
  const live = useLivePresence();
  const canCheckIn = useCan('check_in');
  const whyNotCheckIn = useWhyNot('check_in');
  /* Lo que hoy le conviene al animal, para decidir si la ficha de un sitio
     ofrece salir. Es el mismo juez que vacía la lista de Descubrir y quita el
     botón del radar: aquí no se relaja. */
  const conditions = useConditions(45);
  const discovery = useMemo(() => discover(pet, conditions), [pet, conditions]);
  const storyGroups = useStoryGroups();

  /*
   * El centro del mapa es del mapa, no de la persona.
   *
   * Antes el centro era la posición del tutor y no se podía mover: un mapa
   * que no se arrastra es una foto de un mapa. Ahora el centro es estado de
   * esta pantalla; la posición de la persona sigue siendo la que dibuja el
   * anillo de «estás aquí» y la que ordena la lista, y «volver a donde
   * estás» es justo eso: devolver el centro a ella.
   */
  const [center, setCenter] = useState(location);
  const panned = center.lat !== location.lat || center.lng !== location.lng;

  /*
   * Llegar con un sitio puesto: `/explorar?sitio=Parque Central` desde la
   * publicación que lo nombra. El mapa lo elige, se centra en él y sube su
   * ficha, que es lo que un enlace de lugar tiene que hacer. Va por
   * parámetro y no por estado inicial porque esta pantalla es una pestaña y
   * ya está montada cuando se llega desde el feed.
   */
  const params = useLocalSearchParams<{ sitio?: string }>();
  /* Con el lienzo medido, o el encuadre sale a cero: la primera vez que se
     llega con un sitio puesto la pantalla se monta, el efecto corre antes de
     que `onLayout` haya dicho cuánto mide el mapa, y desplazar el centro «la
     mitad de la hoja» sobre un alto de cero es no desplazarlo. Se vio en una
     captura: la ficha abierta y el parque debajo de ella. */
  const measured = canvas.height > 0;
  useEffect(() => {
    if (!params.sitio || !measured) return;
    const place = Object.values(PLACES).find((candidate) => candidate.name === params.sitio);
    if (!place) return;
    setActive((current) => new Set(current).add('places'));
    setSelectedId(place.id);
    focusOn(place);
    setSheet('mid');
  }, [params.sitio, measured]);

  /* El botón atrás de Android cierra lo que esté abierto encima del mapa, y no
     la pestaña. Van por separado y no en un solo manejador porque React Native
     atiende al último registrado primero: así, si alguna vez se solapan dos, se
     cierra la de arriba. Los cierres van en `useCallback` porque el gancho los
     usa de dependencia. */
  useBackDismiss(
    searching,
    useCallback(() => setSearching(false), []),
  );
  useBackDismiss(
    reporting,
    useCallback(() => setReporting(false), []),
  );
  useBackDismiss(
    showLayers,
    useCallback(() => setShowLayers(false), []),
  );

  /* El constructor toma las capas como argumento, y eso existe por un fallo que
     salió en la auditoría de capturas: buscar «veterinario» no encontraba nada
     porque esa capa viene apagada, y el buscador sólo miraba lo que estaba
     dibujado. Un buscador que no encuentra un veterinario **porque hay un
     filtro puesto** no sirve, y menos en una urgencia. Ahora se construyen dos
     listas: la que se dibuja, con las capas encendidas, y la que se busca, con
     todas. Al elegir un resultado de una capa apagada, se enciende. */
  const buildMarkers = useCallback(
    (layers: ReadonlySet<LayerId>): MapMarker[] => {
      const list: MapMarker[] = [];

      /* Cuántos hay fuera en cada sitio. Alimenta el halo de actividad, que es
       lo único de esta pantalla que habla de varios a la vez. */
      const crowd = new Map<string, number>();
      for (const other of outNow) {
        if (other.placeName) crowd.set(other.placeName, (crowd.get(other.placeName) ?? 0) + 1);
      }

      if (layers.has('places')) {
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
            heat: crowd.get(place.name) ?? 0,
          });
        }
      }

      /*
       * Las caras, y aquí está la decisión que separa esto de copiar Snapchat.
       *
       * En el mapa de Snapchat tu Bitmoji está **en tu sitio exacto**, y eso es
       * justo lo que esta aplicación lleva prometiendo desde el primer día que no
       * va a hacer: el radar ancla al lugar y nunca a la persona, no hay un punto
       * azul siguiendo a nadie. Copiarlo tal cual sería tirar la regla por una
       * pantalla más bonita.
       *
       * Así que la cara se coloca **en el parque**, no en las coordenadas de
       * quien pasea. Se pierde una cosa —saber en qué esquina del parque está— y
       * se conserva todo lo demás: quién hay, dónde, y con quién coincides. Y
       * como varios caen exactamente en el mismo punto, el corro de marcadores
       * solapados que ya existía los abre en anillo alrededor del sitio, que
       * además se lee como lo que es: un grupo en un parque.
       *
       * Lo que **no** aparece nunca aquí es el propio tutor. En el mapa de
       * Snapchat te ves a ti mismo, y aquí eso sería enseñar en pantalla una
       * posición que la aplicación no publica: el círculo del centro dice «estás
       * aquí» y no lleva cara ni nombre.
       */
      if (layers.has('friends')) {
        for (const other of outNow) {
          const place = Object.values(PLACES).find(
            (candidate) => candidate.name === other.placeName,
          );
          if (!place) continue;
          list.push({
            id: `pet-${other.id}`,
            lat: place.lat,
            lng: place.lng,
            label: other.name,
            kind: `Paseando en ${place.name}`,
            detail: `${other.ownerName} y ${other.name} están fuera. Se apaga solo${
              other.walkingUntilMinutes ? ` en ${other.walkingUntilMinutes} min` : ''
            }.`,
            icon: PawPrint,
            tone: 'friend',
            petId: other.id,
          });
        }
      }

      if (layers.has('water')) {
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

      if (layers.has('vets')) {
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
    },
    /* `outNow` va en las dependencias y no es opcional: sin él, la función se
       quedaría con la lista de quién estaba fuera **la primera vez que se
       montó la pantalla**, y las caras del mapa se congelarían mientras el
       resto de la aplicación sigue actualizándose. El tipado no ve un cierre
       obsoleto; el mapa tampoco falla, simplemente miente despacio. */
    [alerts, outNow],
  );

  const zoom = ZOOM_STEPS[zoomIndex] ?? ZOOM_STEPS[1];

  /* Lo que se dibuja: con las caras agrupadas por sitio cuando el mapa está
     lejos. A nivel de barrio cada cara va suelta y el corro las separa; a
     nivel de ciudad tres parques con cuatro caras cada uno serían doce
     retratos encima de tres puntos. Un globo con la cifra dice lo mismo y se
     lee; tocarlo acerca. */
  const markers = useMemo(
    () => clusterMarkers(buildMarkers(active), zoom),
    [buildMarkers, active, zoom],
  );
  /* Todo, aunque no se dibuje. El buscador mira aquí. */
  const searchable = useMemo(
    () => buildMarkers(new Set(LAYERS.map((layer) => layer.id))),
    [buildMarkers],
  );

  /** De qué capa vino un resultado, para poder encenderla al elegirlo. */
  const layerOf = (marker: MapMarker): LayerId | null =>
    marker.tone === 'place'
      ? 'places'
      : marker.tone === 'water'
        ? 'water'
        : marker.tone === 'vet'
          ? 'vets'
          : marker.tone === 'friend'
            ? 'friends'
            : null;

  /* Ordenados por lo lejos que están, que es el único orden que sirve andando.
     Y con la distancia calculada aquí y no dentro del mapa: el mapa dibuja, la
     lista mide. */
  /*
   * «Prefiero sitios tranquilos», que es un acomodo de la persona y no un
   * filtro más.
   *
   * Cambia el **orden** y no la lista: esconder sitios porque ahora hay gente
   * sería quitarle a alguien el parque de siempre por una tarde concurrida. Y
   * cuenta cabezas, no caras: cuánta gente hay en un sitio es un número, y un
   * número no dice quién. Por eso esto sigue funcionando con la cuenta recién
   * hecha, cuando el mapa de gente está cerrado.
   */
  const quietFirst = useHandlerNeed('quiet_places');
  const crowdAt = useMemo(() => {
    const counts = new Map<string, number>();
    for (const other of walkingNow(pet.speciesId)) {
      if (!other.placeName) continue;
      counts.set(other.placeName, (counts.get(other.placeName) ?? 0) + 1);
    }
    return counts;
  }, [pet.speciesId]);

  const nearby = useMemo(
    () =>
      markers
        .map((marker) => ({
          marker,
          distance: distanceMeters(location, marker),
          crowd: crowdAt.get(marker.label) ?? 0,
        }))
        .sort((a, b) => {
          // Las alertas primero pase lo que pase: si hay una abierta cerca es lo
          // primero que hay que leer, esté a cien metros o a dos kilómetros.
          const alertDelta = Number(b.marker.tone === 'alert') - Number(a.marker.tone === 'alert');
          if (alertDelta !== 0) return alertDelta;
          if (quietFirst && a.crowd !== b.crowd) return a.crowd - b.crowd;
          return a.distance - b.distance;
        }),
    [markers, location, quietFirst, crowdAt],
  );

  const selected = markers.find((marker) => marker.id === selectedId) ?? null;
  const overflowing = radiusOverflows(markers, spanMeters(center.lat, zoom, canvas.width || 390));

  /* La hoja, en píxeles: cuánto asoma en cada posición. El mapa lo usa para
     apartar su cromo y para que lo elegido quede por encima de la hoja. */
  const offsets = detentOffsets({ available: canvas.height || 1, peekHeight: PEEK_HEIGHT });
  const sheetVisible = visibleHeight(sheet, offsets);

  /**
   * Centrar el mapa en un punto de forma que quede a la vista **por encima de
   * la hoja a media altura**, y no debajo de ella.
   *
   * El centro del lienzo cae bajo la hoja cuando está a medias, así que
   * centrar «en el punto» lo tapaba con la ficha que habla de él —se vio en la
   * primera captura—. Se desplaza el centro hacia el sur la mitad de lo que
   * ocupa la hoja, medido en metros al nivel actual, para que el punto caiga
   * en mitad de lo que queda de mapa.
   */
  const focusOn = (point: { lat: number; lng: number }) => {
    const covered = visibleHeight('mid', offsets);
    const shiftMeters = (covered / 2) * metersPerPixel(point.lat, zoom);
    setCenter({ lat: point.lat - shiftMeters / METERS_PER_DEGREE_LAT, lng: point.lng });
  };

  /* El perro elegido en el mapa, si lo elegido es una cara. */
  const selectedPet = selected?.petId ? petById(selected.petId) : null;
  const selectedEntry = selectedPet
    ? (discovery.entries.find((entry) => entry.pet.id === selectedPet.id) ?? null)
    : null;
  /* Quién está en el sitio elegido, para la tira de caras de su ficha. */
  const hereAtSelected =
    selected && selected.tone === 'place'
      ? outNow.filter((other) => other.placeName === selected.label)
      : [];
  const alertsReaching = selected
    ? alerts.filter((live) => distanceMeters(live.searchPoint, selected) <= live.radiusM).length
    : 0;

  /*
   * Por qué no se ofrece salir en la ficha de un sitio, o null si se ofrece.
   *
   * El orden importa: primero la puerta (sin animal no hay radar), luego el
   * modo fantasma (lo puso la persona), luego el tiempo (sin dato no se
   * juzga) y al final el veredicto. Cada uno con su frase, porque «no» a
   * secas manda a buscar el interruptor equivocado.
   */
  const checkInNote: string | null = !canCheckIn
    ? (whyNotCheckIn ?? 'Todavía no puedes encender el radar.')
    : ghost
      ? 'Con el modo fantasma puesto no se sale: apágalo en el botón del ojo para aparecer.'
      : live
        ? `Ya estás fuera en ${live.placeName}. Se apaga solo.`
        : conditions === null
          ? 'Sin saber qué tiempo hace no se propone salir. En el radar puedes ponerlo a mano.'
          : discovery.welfare?.level === 'stop'
            ? `No ofrecemos salir ahora: con estas condiciones no le conviene a ${pet.name}.`
            : null;

  /** Tocar una cara o un globo del mapa: el globo acerca, la cara abre su ficha. */
  const onSelectMarker = (id: string | null) => {
    const marker = markers.find((candidate) => candidate.id === id) ?? null;
    if (marker?.clusterCount) {
      haptics.tap();
      setCenter({ lat: marker.lat, lng: marker.lng });
      setZoomIndex((current) => Math.max(0, current - 1));
      return;
    }
    setSelectedId(id);
    // Elegir un marcador sube la hoja a media altura: lo que se quiere
    // después de tocar un punto es leer qué es sin perder el mapa de vista.
    if (id) setSheet('mid');
    if (marker) focusOn(marker);
  };

  const selectPlaceByName = (name: string | null) => {
    const place = Object.values(PLACES).find((candidate) => candidate.name === name);
    if (!place) return;
    setActive((current) => new Set(current).add('places'));
    setSelectedId(place.id);
    focusOn(place);
    setSheet('mid');
  };

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

  /* `full`: en una pantalla de mapa la zona segura no se aparta, se cruza. El
     mapa llega hasta el borde —es lo que hace que parezca un mapa y no una foto
     de uno— y los controles flotantes se apartan ellos solos con `insets.top`,
     que es lo que ya venían haciendo aquí abajo. */
  return (
    <Screen full>
      {/* Sin barra encima. El mapa arranca en el borde de arriba y los controles
          flotan sobre él, esquivando el área segura: es lo que hacen Google Maps
          y Waze, y es lo que se pierde en cuanto se le pone una cabecera. Los
          cuarenta y ocho píxeles que ocupaba el conmutador Mapa/Reels son
          ahora mapa. */}
      <View style={{ flex: 1 }} onLayout={onCanvasLayout}>
        {canvas.width > 0 ? (
          <MiniMap
            center={center}
            user={location}
            markers={markers}
            zoom={zoom}
            zoomSteps={ZOOM_STEPS}
            selectedId={selectedId}
            onSelect={onSelectMarker}
            onCenterChange={setCenter}
            onZoomChange={(step) => {
              const index = ZOOM_STEPS.indexOf(step as (typeof ZOOM_STEPS)[number]);
              if (index >= 0) setZoomIndex(index);
            }}
            width={canvas.width}
            height={canvas.height}
            /* Lo que tapa la hoja ahora mismo, no lo que asoma en reposo:
                 con la hoja a media altura la barra de escala y el aviso de
                 «sin calles» tienen que subir con ella. */
            bottomInset={Math.min(sheetVisible, canvas.height * 0.55)}
            /* La muesca **y la fila de controles**, no solo la muesca. Con
                 el cromo repartido en una sola fila de arriba, el aviso de «sin
                 calles» se metía justo debajo de la píldora de búsqueda y salía
                 cortado por ella. Es de los fallos que el tipado no ve y que
                 solo aparecen mirando: la vista se dibujaba entera, encima de
                 otra. */
            topInset={insets.top + theme.space[3] + 44}
          />
        ) : null}

        {/* Buscar, flotando encima del mapa. Faltaba entera: el mapa enseñaba
              lo que hubiera dentro del cuadro y no había forma de preguntar por
              algo. */}
        {/* La fila de arriba, con la anatomía del mapa de Snapchat: el
              retrato a la izquierda, la píldora de búsqueda en medio y los
              controles redondos a la derecha. Antes la búsqueda ocupaba casi
              todo el ancho y los botones se apilaban en una columna que bajaba
              media pantalla; así la fila dice de un vistazo quién eres, qué
              puedes preguntar y qué puedes tocar. */}
        {!showLayers ? (
          <>
            <View
              style={{
                position: 'absolute',
                top: insets.top + theme.space[3],
                left: theme.space[3],
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.background,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <PetSwitcherCompact />
            </View>
            <SearchBar
              onOpen={() => setSearching(true)}
              topInset={insets.top}
              left={theme.space[3] + 44 + 6}
              right={theme.space[3] + 44 + 6}
            />
          </>
        ) : null}

        {/* Avisar de algo, en rojo y abajo a la derecha: la mano ya está ahí,
              y el momento de usarlo es andando. El catálogo de peligros existía
              desde el principio en el núcleo y no tenía puerta desde el mapa. */}
        {/* Dos botones y no uno, y el de peligro **se queda directo**.
              La tentación era meterlo todo detrás del «+», como hace Snapchat,
              y eso le añade un toque a la única acción de esta pantalla que es
              urgente: avisar de unos cristales o de un cebo se hace andando y
              con una mano. Lo que va detrás del «+» es lo que no corre —una
              fuente, una zona de sombra— y lo que necesita elegir entre varias
              cosas. */}
        {/* Los dos botones suben con la hoja y desaparecen cuando la hoja
              es la pantalla entera: ahí no hay mapa sobre el que flotar, y un
              botón rojo encima de una lista se lee como parte de la lista. */}
        {sheet !== 'full' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Añadir algo al mapa"
            accessibilityHint="Un sitio que falta, un animal que necesita ayuda, o salir ahora"
            onPress={() => {
              haptics.tap();
              setAdding(true);
            }}
            style={({ pressed }) => ({
              position: 'absolute',
              right: theme.space[3],
              bottom: sheetVisible + theme.space[3] + 52 + 8,
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon icon={Plus} size="lg" color={theme.colors.primaryForeground} decorative />
          </Pressable>
        ) : null}

        {sheet !== 'full' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Avisar de un peligro aquí"
            accessibilityHint="Perro suelto, cristales, asfalto que quema, cebos o procesionaria"
            onPress={() => {
              haptics.tap();
              setReporting(true);
            }}
            style={({ pressed }) => ({
              position: 'absolute',
              right: theme.space[3],
              bottom: sheetVisible + theme.space[3],
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.destructive,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon
              icon={TriangleAlert}
              size="lg"
              color={theme.colors.destructiveForeground}
              decorative
            />
          </Pressable>
        ) : null}

        {/* Los controles, encima del mapa. Es lo que lo convierte en una
              pantalla en vez de una tarjeta dentro de un documento. */}
        <View
          style={{
            position: 'absolute',
            // Sin cabecera que lo haga por ellos, los botones esquivan la
            // muesca a mano: si no, el de capas se mete debajo del reloj.
            top: insets.top + theme.space[3],
            // Y quedan a la altura de la barra de búsqueda, que ocupa el resto
            // de esa fila.
            right: theme.space[3],
            /* Seis píxeles entre botones y no ocho: con la hoja abierta el
                 mapa se queda en unos doscientos cincuenta de alto, y la
                 columna entera tiene que caber ahí o el «−» sale cortado por el
                 borde de la hoja, que se lee como un fallo de dibujo. */
            gap: 6,
          }}
        >
          {/* Modo fantasma, y va **aquí**: en el mapa, con un toque, a la
                vista. Es lo mejor que tiene el mapa de Snapchat y lo que menos
                se copia, porque no luce en una captura. Escondido en ajustes
                sería un interruptor que nadie encuentra el día que hace falta,
                y ese día es justo cuando alguien decide que hoy no quiere que
                su barrio sepa a qué hora sale. */}
          <MapButton
            icon={ghost ? EyeOff : Eye}
            label={ghost ? 'Salir del modo fantasma' : 'Modo fantasma: dejar de aparecer'}
            active={ghost}
            onPress={() => {
              haptics.tap();
              setGhostMode(!ghost);
            }}
          />
          <MapButton
            icon={Layers}
            label={showLayers ? 'Cerrar las capas' : 'Elegir qué se ve en el mapa'}
            active={showLayers}
            onPress={() => {
              haptics.tap();
              setShowLayers((value) => !value);
            }}
          />
          {/* El más y el menos siguen siendo una pieza, pero con las
                esquinas del grupo redondeadas como el resto: un bloque cuadrado
                entre botones circulares se lee como algo de otra aplicación. */}
          <View style={{ borderRadius: 22, overflow: 'hidden' }}>
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
            active={panned}
            onPress={() => {
              haptics.tap();
              setSelectedId(null);
              setCenter(location);
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
                  fontSize: theme.fontSize['2xs'],
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
              {/* Lo que has aportado, y en qué estado está. Sin esto, tocar
                    «una fuente» no enseñaba nada y se leía como un botón roto
                    — el mismo fallo que ya costó un arreglo con el buscador. Y
                    además dice la regla: un sitio no entra porque lo diga una
                    persona. */}
              {suggestions.length > 0 ? (
                <View
                  style={{
                    paddingHorizontal: theme.space[5],
                    paddingBottom: theme.space[4],
                    gap: theme.space[2],
                  }}
                >
                  {suggestions.map((suggestion) => {
                    const kind = CONTRIBUTABLE_PLACES.find(
                      (candidate) => candidate.id === suggestion.kind,
                    );
                    const done = isConfirmed(suggestion);
                    const missing = SUGGESTION_MIN_CONFIRMATIONS - suggestion.confirmedBy.length;
                    return (
                      <Row key={suggestion.id} gap={2}>
                        <Icon
                          icon={done ? Check : Clock}
                          size="sm"
                          color={done ? theme.colors.primary : theme.colors.mutedForeground}
                          decorative
                        />
                        <Caption>
                          {kind?.label ?? 'Un sitio'}
                          {suggestion.placeId
                            ? ` en ${placeNameById(suggestion.placeId)}`
                            : ' por la calle'}
                          {done
                            ? ' · ya está en el mapa'
                            : ` · falta ${missing === 1 ? 'que lo confirme alguien más' : `${missing} confirmaciones`}`}
                        </Caption>
                      </Row>
                    );
                  })}
                </View>
              ) : null}

              {selected && selectedPet ? (
                <PersonPanel
                  pet={selectedPet}
                  entry={selectedEntry}
                  placeName={selectedPet.placeName ?? 'un sitio pet-friendly'}
                  hasUnseenStory={storyGroups.some(
                    (group) => group.petId === selectedPet.id && group.hasUnseen,
                  )}
                  onClose={() => setSelectedId(null)}
                  onStory={() => router.push(`/estados?pet=${selectedPet.id}`)}
                  onPlace={() => selectPlaceByName(selectedPet.placeName)}
                />
              ) : selected ? (
                <PlacePanel
                  marker={selected}
                  distance={distanceMeters(location, selected)}
                  here={hereAtSelected}
                  checkInNote={checkInNote}
                  alertsInRange={alertsReaching}
                  onClose={() => setSelectedId(null)}
                  onCheckIn={() => {
                    /* Salir «aquí» es ponerse aquí y abrir el radar, que es
                         quien pregunta cuánto rato y quien enciende la
                         presencia. Esta ficha no hace check-in por su cuenta:
                         una sola puerta para salir, con su veredicto delante. */
                    haptics.tap();
                    setLocation({ lat: selected.lat, lng: selected.lng });
                    router.push('/radar');
                  }}
                  onPerson={(petId) => {
                    setSelectedId(`pet-${petId}`);
                  }}
                  onAlerts={() => router.push('/sos')}
                />
              ) : (
                <View style={{ gap: theme.space[2], paddingBottom: theme.space[2] }}>
                  {/* Quién está fuera, lo primero y en caras: es lo que se
                        mira con el mapa delante, y es la mitad del radar
                        traída a donde se piensa en ella. */}
                  <PresenceStrip pets={outNow} onOpen={(petId) => onSelectMarker(`pet-${petId}`)} />
                  {sheet !== 'peek' ? (
                    <LayerChips options={LAYERS} active={active} onToggle={toggle} />
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      paddingHorizontal: theme.space[4],
                    }}
                  >
                    <View style={{ flex: 1 }}>
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
                        {quietFirst
                          ? 'Los más tranquilos ahora, primero'
                          : 'Ordenados por lo que hay que andar'}
                      </Text>
                    </View>
                    {/* Con la hoja a pantalla entera el mapa ha desaparecido
                          y hace falta una salida que se llame por su nombre;
                          el asa sigue valiendo, pero un asa no dice «mapa». */}
                    {sheet === 'full' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Ver el mapa"
                        hitSlop={6}
                        onPress={() => {
                          haptics.tap();
                          setSheet('peek');
                        }}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: theme.space[1.5],
                          height: 32,
                          paddingHorizontal: theme.space[3],
                          borderRadius: 16,
                          backgroundColor: theme.colors.foreground,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Icon icon={MapIcon} size="sm" color={theme.colors.background} decorative />
                        <Text
                          style={{
                            color: theme.colors.background,
                            fontFamily: fonts.bodyBold,
                            fontSize: theme.fontSize.xs,
                          }}
                        >
                          Mapa
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              )}

              {!selected
                ? nearby.map(({ marker, distance, crowd }) => (
                    <NearbyRow
                      key={marker.id}
                      marker={marker}
                      distance={distance}
                      crowd={quietFirst && marker.tone === 'place' ? crowd : null}
                      onPress={() => {
                        haptics.tap();
                        setSelectedId(marker.id);
                        /* Elegir desde la lista también lleva el mapa al
                           sitio: una fila que abre la ficha y deja el mapa
                           mirando a otra parte obliga a buscar lo que se
                           acaba de tocar. */
                        focusOn(marker);
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
                    <Icon icon={Layers} size="sm" color={theme.colors.mutedForeground} decorative />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Caption>
                      {overflowing.length === 1
                        ? '1 alerta avisa más lejos de lo que abarca este cuadro.'
                        : `${overflowing.length} alertas avisan más lejos de lo que abarca este cuadro.`}{' '}
                      Su círculo no se dibuja porque un color que lo tapa todo deja de tener dentro
                      y fuera. Alejando el cuadro se ve el alcance completo.
                    </Caption>
                  </View>
                </View>
              ) : null}

              <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[3] }}>
                {/* Este texto decía que no había proveedor de teselas
                      conectado. Dejó de ser verdad al conectar OpenStreetMap, y
                      un párrafo que explica una limitación que ya no existe es
                      peor que no tenerlo: hace dudar de lo que sí se ve. Lo que
                      queda es lo que sigue siendo cierto y no es evidente. */}
                <Caption>
                  Las calles son de OpenStreetMap. Los círculos no: son alcance real calculado aquí
                  —el de un lugar es donde se puede encender el radar, el de una alerta es a quién
                  está avisando—. Sin conexión el mapa se queda en su esquema y esos números siguen
                  siendo correctos.
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

        {/* Añadir al mapa: el «+» de Snap Map, con lo que aquí se puede aportar. */}
        {adding ? (
          <AddToMapSheet
            areaName={selected?.label ?? nearestPlace?.name ?? 'donde estás ahora'}
            onClose={() => setAdding(false)}
            onReportHazard={() => setReporting(true)}
            onCheckIn={() => router.push('/radar')}
            onAddPlace={(kind) => {
              /* Se apunta y se dice qué falta para que salga de verdad. Un
                 sitio aportado por una persona todavía no es un sitio: entra
                 cuando lo confirma alguien más, por lo mismo que una zona
                 marcada necesita tres personas distintas. */
              addPlaceSuggestion({ kind, placeId: nearestPlace?.id ?? null });
              setActive((current) => new Set(current).add('places'));
            }}
            onReportRescue={(scenario) => {
              reportRescue({
                scenarioId: scenario.id,
                placeId: nearestPlace?.id ?? PLACES.central.id,
                reporterId: pet.ownerId,
                reportedAt: new Date().toISOString(),
              });
            }}
          />
        ) : null}

        {/* Avisar de algo: hoja al fondo, sobre el mapa y sobre la lista. */}
        {reporting ? (
          <ReportSheet
            areaName={selected?.label ?? 'tu zona'}
            onClose={() => setReporting(false)}
            onReport={(scenario) => {
              /* El aviso se abre **donde estás**, no donde se haya dejado el
                 mapa: un peligro se reporta desde delante del peligro, y usar
                 el centro del cuadro pondría el cristal a dos calles si alguien
                 había arrastrado la vista. */
              openAlert({
                scenarioId: scenario.id,
                ownerName: pet.ownerName,
                point: location,
                areaName: 'donde estás ahora',
              });
              setReporting(false);
              setSheet('mid');
            }}
          />
        ) : null}

        {/* El buscador, a pantalla completa y por encima del mapa. */}
        {searching ? (
          <SearchPanel
            items={searchable.map((marker) => ({
              id: marker.id,
              label: marker.label,
              kind: marker.kind,
            }))}
            recents={recents}
            topInset={insets.top}
            onClose={() => setSearching(false)}
            onPick={(item) => {
              setRecents((current) =>
                [item.id, ...current.filter((id) => id !== item.id)].slice(0, 5),
              );
              /* Encender la capa del resultado. Sin esto, elegir un veterinario
                 con su capa apagada cierra el buscador y no pasa nada visible,
                 que es la peor respuesta posible a un toque. */
              const found = searchable.find((marker) => marker.id === item.id);
              const layer = found ? layerOf(found) : null;
              if (layer) setActive((current) => new Set(current).add(layer));
              setSelectedId(item.id);
              if (found) focusOn(found);
              setSearching(false);
              setSheet('mid');
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

/** Un botón flotando sobre el mapa: fondo sólido, porque debajo hay dibujo. */
function placeNameById(placeId: string): string {
  return Object.values(PLACES).find((place) => place.id === placeId)?.name ?? 'tu zona';
}

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
        /* Círculos, no cuadrados con esquinas suaves. Sobre un mapa a sangre
           un rectángulo se lee como una capa pegada encima y un círculo se lee
           como un control que flota — es la diferencia que hace que el cromo
           de Snapchat no compita con el terreno. Los del grupo pegado (más y
           menos) siguen siendo rectos: son una pieza, no dos. */
        borderRadius: square ? 0 : 22,
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
  crowd,
  onPress,
}: {
  marker: MapMarker;
  distance: number;
  /**
   * Cuánta gente hay ahí ahora, cuando se ha pedido lo tranquilo primero.
   *
   * Es la mitad que faltaba del acomodo: ordenar por eso y no decirlo obliga a
   * fiarse de un orden que no se ve. Y es una cuenta, no una lista de caras: un
   * número no dice quién, así que esto sigue estando aunque el mapa de gente
   * esté cerrado por no tener el chip verificado.
   */
  crowd: number | null;
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
      accessibilityLabel={`${marker.label}, a ${formatDistance(distance)}${
        crowd === null ? '' : crowd === 0 ? ', tranquilo ahora' : `, ${crowd} ahora`
      }`}
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
            fontSize: theme.fontSize.xs,
          }}
        >
          {marker.kind}
          {crowd === null
            ? ''
            : crowd === 0
              ? ' · tranquilo ahora'
              : ` · ${crowd} ${crowd === 1 ? 'perro' : 'perros'} ahora`}
        </Text>
      </View>

      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize.xs,
          fontVariant: ['tabular-nums'],
        }}
      >
        {distance < 30 ? 'aquí' : formatDistance(distance)}
      </Text>
    </Pressable>
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
            fontSize: theme.fontSize.xs,
          }}
        >
          {detail}
        </Text>
      </View>
      <Icon icon={ChevronRight} size="base" color={theme.colors.mutedForeground} decorative />
    </Pressable>
  );
}
