/**
 * El mapa.
 *
 * **Ahora son teselas de verdad.** OpenStreetMap, el mismo esquema XYZ que usan
 * Google Maps y Waze, con calles, manzanas, parques con su forma y ríos, y con
 * cobertura de **todos los países** sin listas de ciudades soportadas. Lo que
 * antes había aquí era un esquema dibujado a mano porque no había proveedor
 * conectado; ahora el esquema es el **respaldo**, no el producto.
 *
 * Y sigue haciendo falta, por dos motivos distintos:
 *
 *  1. **Sin red no hay imágenes**, y un mapa de paseo se usa justo donde la red
 *     falla —dentro del parque, en un pueblo, con los datos agotados—. El
 *     esquema no necesita red y sigue diciendo la verdad: dónde está cada cosa,
 *     a qué distancia y en qué dirección.
 *  2. **En este contenedor no llegan.** El proxy de salida bloquea los cinco
 *     proveedores que se probaron, igual que bloquea a Open-Meteo, así que las
 *     capturas de aquí enseñan el respaldo. Lo que sí se comprueba de punta a
 *     punta es qué pide la aplicación, contra un servidor de teselas de mentira.
 *
 * La proyección es **Web Mercator**, la de las teselas. Antes era
 * equirectangular, y mezclar las dos no es un detalle estético: los marcadores
 * caerían fuera de su calle, y cuanto más al norte, peor —en Madrid más de
 * doscientos metros; en Oslo, más de un kilómetro—.
 *
 * Los radios de las alertas se dibujan a escala. Es lo que hace entender de un
 * vistazo por qué un cebo envenenado avisa a media manzana y un perro huido por
 * petardos avisa a medio distrito.
 *
 * **Y se mueve con el dedo.** Arrastrar y pellizcar, como cualquier mapa desde
 * 2007; hasta ahora solo se movía con los botones de más y menos, y un mapa que
 * no se arrastra parece una foto de un mapa. Cómo está hecho importa, porque
 * este mapa no es una vista nativa sino un montón de imágenes y vistas
 * colocadas a mano:
 *
 *  - **Durante el gesto no se vuelve a calcular nada.** El lienzo entero
 *    —teselas, discos, caras— es una sola vista animada que se traslada y
 *    escala en el hilo de interfaz. Recalcular teselas a cada píxel pediría
 *    imágenes nuevas a cada píxel, que es justo el abuso que esta capa aprendió
 *    a no cometer.
 *  - **Al soltar se hace la cuenta una vez.** Se deshace la transformación,
 *    se averigua qué coordenada ha quedado bajo los dedos y se le dice al
 *    padre «el centro es este, el nivel es aquel», con el centro elegido para
 *    que esa coordenada no se mueva de sitio. El padre vuelve a dibujar y el
 *    lienzo vuelve a cero **en el mismo cuadro**, así que no hay salto.
 *  - **El nivel se ajusta al escalón más cercano.** Una tesela escalada a
 *    2,3× se ve borrosa y con las calles ilegibles; los niveles enteros salen
 *    nítidos. Lo que sobra entre lo que pellizcó el dedo y el escalón se
 *    asienta con un muelle, para que el ajuste se vea como el mapa colocándose
 *    y no como un tirón.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { springs } from './motion';
import { TileAttribution, TileLayer } from './tile-layer';
import { clusterMarkers, placeNameOf } from '@/lib/clusters';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import type { LucideIcon } from '@/lib/icons';
import { useReducedMotion } from '@/lib/motion';
import { TILE_SIZE, metersPerPixel, project, spanMeters, unproject } from '@/lib/tiles';
import { useTheme } from '@/lib/theme';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /**
   * Qué es, en dos palabras: «Área canina», «Fuente con bebedero», «Alerta
   * abierta». Va en la lista, donde `detail` no cabe y además se repetía —la
   * fila decía «Lugar · Parque. El radar se enciende dentro de…» y se cortaba
   * justo antes del número, así que gastaba una línea para no decir nada.
   *
   * `'cluster'` es el valor reservado para la burbuja que agrupa varias caras
   * en el mismo sitio; la fabrica `lib/clusters`, no la pantalla.
   */
  kind: string;
  detail: string;
  icon: LucideIcon;
  /** `alert` se pinta en rojo y siempre encima de todo lo demás. */
  tone: 'place' | 'water' | 'vet' | 'alert' | 'friend';
  /** Radio en metros a dibujar alrededor. Cero: sin círculo. */
  radiusM?: number;
  /**
   * Quién es, cuando el marcador es un animal.
   *
   * Con esto el marcador deja de ser un punto de color y pasa a ser **su
   * cara**, que es lo que hace que el mapa de Snapchat se lea de un vistazo:
   * no hay que tocar nada para saber quién hay en el parque. Los retratos ya
   * existían —son los mismos del feed y de los mensajes, deterministas por
   * identificador—, así que la cara del mapa es la misma cara de todas
   * partes. Un mapa donde alguien tiene otro aspecto que en el feed no sirve
   * para reconocer a nadie, que es lo único que hace.
   */
  petId?: string;
  /**
   * Cuánta gente hay aquí ahora, para el halo de actividad.
   *
   * Es el equivalente honesto del mapa de calor de Snapchat: dice **dónde está
   * pasando algo** sin decir quién está dónde. Un halo sobre un parque es
   * información agregada del sitio; un punto por persona sería otra cosa.
   */
  heat?: number;
  /**
   * El nombre del sitio donde está, para una cara.
   *
   * Hoy `kind` dice «Paseando en <sitio>» y de ahí se puede sacar, pero un
   * texto es un sitio frágil para guardar un dato: basta con reescribir la
   * frase para que la burbuja de grupo se llame «Paseando en El Retiro» en vez
   * de «El Retiro». Si viene, manda.
   */
  placeName?: string;
  /** Cuántas caras resume, cuando es una burbuja de grupo. */
  clusterCount?: number;
  /** Cuáles, para que quien acerque el mapa sepa a quién enseñar. */
  clusterIds?: string[];
};

/** Cada cuánto cae una línea de la retícula del respaldo, en metros. */
const GRID_STEP_M = 250;

/** Los niveles que ofrece la aplicación si el padre no dice otros. */
const DEFAULT_ZOOM_STEPS: readonly number[] = [17, 15, 13, 11];

/**
 * Cuánto lienzo se dibuja de más por cada lado, para que un arrastre enseñe
 * mapa y no fondo liso hasta soltar. Media tesela: cubre el recorrido normal
 * de un pulgar y cuesta pocas imágenes más por encuadre.
 */
const OVERSCAN = TILE_SIZE / 2;

/**
 * Recorrido a partir del cual un toque pasa a ser un arrastre.
 *
 * Es lo que deja que las caras se sigan tocando: un toque no recorre diez
 * puntos, un arrastre sí. Sin este umbral el gesto se llevaba cada pulsación y
 * los marcadores dejaban de responder, que es el peor fallo que puede tener un
 * mapa: se ve, se toca, y no pasa nada.
 */
const PAN_SLOP = 10;

/** Hasta dónde se dibujan marcadores fuera del cuadro: el anillo, y un poco. */
const CULL = OVERSCAN + 20;

/** ¿Hay algún alcance que no cabe en el cuadro? La pantalla tiene que decirlo. */
export function radiusOverflows(markers: MapMarker[], spanM: number): MapMarker[] {
  return markers.filter((marker) => (marker.radiusM ?? 0) * 2 > spanM * 0.9);
}

/**
 * El escalón más cercano a un nivel fraccionario.
 *
 * Un pellizco deja un 14,3 y ahí no hay teselas nítidas: se va al 15 o al 13,
 * al que esté más cerca. Con empate exacto gana el primero de la lista, que
 * va de más cerca a más lejos: ante la duda, más detalle.
 */
function snapZoom(value: number, steps: readonly number[]): number {
  let best = steps[0] ?? value;
  for (const step of steps) {
    if (Math.abs(step - value) < Math.abs(best - value)) best = step;
  }
  return best;
}

export function MiniMap({
  center,
  markers,
  zoom,
  selectedId,
  onSelect,
  width,
  height,
  bottomInset = 0,
  topInset = 0,
  onCenterChange,
  onZoomChange,
  zoomSteps = DEFAULT_ZOOM_STEPS,
  user,
}: {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  /** Nivel de acercamiento del esquema XYZ: 17 es manzana, 11 es ciudad. */
  zoom: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  width: number;
  height: number;
  /**
   * Cuánto tapa la hoja por abajo.
   *
   * La escala y el rótulo del norte no pueden vivir en el borde inferior cuando
   * encima de ese borde hay una hoja: se quedan debajo y el esquema pierde lo
   * único que le da sentido —un punto a media pantalla podría estar a cien
   * metros o a diez kilómetros—. El centro tampoco se mueve: lo que se aparta
   * es el cromo, no el terreno.
   */
  bottomInset?: number;
  /** Cuánto hay que bajar el cromo de arriba para esquivar la muesca. */
  topInset?: number;
  /**
   * El dedo ha arrastrado y el centro ya es otro.
   *
   * El mapa no guarda el centro: lo pide. Sin este manejador el arrastre se
   * deshace al soltar, que es lo honesto —un mapa que se mueve y no se queda
   * es peor que uno que no se mueve—.
   */
  onCenterChange?: (center: { lat: number; lng: number }) => void;
  /** El pellizco ha caído en otro escalón de `zoomSteps`. */
  onZoomChange?: (zoom: number) => void;
  /**
   * Los niveles a los que se puede acabar tras un pellizco, en cualquier
   * orden. Solo enteros: una tesela a escala fraccionaria sale borrosa.
   */
  zoomSteps?: readonly number[];
  /**
   * Dónde está la persona, que ya no es el centro del cuadro: en cuanto el
   * mapa se arrastra, el centro es lo que se mira y esto es donde se está. Sin
   * él, se supone que en el centro, como hasta ahora.
   */
  user?: { lat: number; lng: number };
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [tilesDown, setTilesDown] = useState(false);
  const onUnavailable = useCallback((value: boolean) => setTilesDown(value), []);

  const spanM = spanMeters(center.lat, zoom, width);

  /* Lo que se dibuja, que no es lo que llega: de lejos, las caras del mismo
     sitio son una burbuja con un número. Se agrupa aquí y no en la pantalla
     para que el mapa lo haga solo esté donde esté; la operación es idempotente
     —una burbuja no tiene `petId`, así que pasa de largo— por si alguien de
     arriba ya lo hizo. */
  const shown = useMemo(() => clusterMarkers(markers, zoom), [markers, zoom]);

  /* La misma proyección que las teselas, y por eso se importa en vez de
     escribirse aquí: dos Mercator escritos dos veces son dos oportunidades de
     que uno se desvíe, y el síntoma sería que los marcadores se despegan de sus
     calles sin que nada falle. */
  const projectPoint = useMemo(() => {
    const middle = project({ lat: center.lat, lng: center.lng }, zoom);
    return (point: { lat: number; lng: number }) => {
      const pixel = project(point, zoom);
      return { x: width / 2 + (pixel.x - middle.x), y: height / 2 + (pixel.y - middle.y) };
    };
    // Las dependencias son las coordenadas y no el objeto, por lo mismo que en
    // la capa de teselas: con el objeto, cualquier render de arriba invalidaría
    // el memo aunque no se haya movido nada, y con él el corro de marcadores
    // solapados, que se recalcula entero.
  }, [center.lat, center.lng, zoom, width, height]);

  /* Metros por píxel **en el centro del cuadro**. Mercator estira con la
     latitud, así que a escala de barrio esto es exacto y a escala de continente
     sería una aproximación; el mapa no llega a esa escala. */
  const pxPerMeter = 1 / metersPerPixel(center.lat, zoom);

  /* Dónde está la persona, en píxeles del lienzo. Antes era el centro por
     definición; ahora el centro se arrastra y el aro se queda donde se está. */
  const userPoint = projectPoint(user ?? center);

  /* ------------------------------------------------------------------ */
  /* Los gestos                                                          */
  /* ------------------------------------------------------------------ */

  /* Lo que el dedo ha movido desde el último encuadre. Vive en el hilo de
     interfaz: durante el gesto no hay render de React, solo una transformación
     sobre el lienzo entero. */
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  /* Alrededor de qué punto se escala. Un pellizco agranda lo que hay entre
     los dedos, no el centro de la pantalla; con el foco en el centro, el sitio
     que se quiere ver de cerca se escapa por el borde. */
  const focalX = useSharedValue(width / 2);
  const focalY = useSharedValue(height / 2);
  const pinchBase = useSharedValue(1);
  const panActive = useSharedValue(false);
  const pinchActive = useSharedValue(false);

  /* No se puede pellizcar más allá del último escalón: sin tope, el dedo
     agrandaba a 4× y al soltar el mapa volvía de golpe al 17, que se lee como
     un fallo. Con el tope, lo que se ve al pellizcar es lo que va a quedar. */
  const minScale = 2 ** (Math.min(...zoomSteps) - zoom);
  const maxScale = 2 ** (Math.max(...zoomSteps) - zoom);

  /**
   * Al soltar: qué ha quedado bajo el centro, y a qué nivel.
   *
   * Se deshace la transformación que se ve —traslación más escala alrededor
   * del foco— para saber qué coordenada hay bajo el punto del pellizco, se
   * ajusta el nivel al escalón más cercano y se calcula el centro que deja esa
   * coordenada **en el mismo sitio de la pantalla** al nivel nuevo. Así el
   * parque que se pellizcó sigue entre los dedos después del ajuste.
   *
   * Va en una `ref` y no en el gesto para leer siempre el centro y el nivel de
   * este render: el gesto se crea por render, pero `runOnJS` puede llegar un
   * render tarde, y con un centro viejo el mapa saltaría atrás.
   */
  const commitRef = useRef<(tx: number, ty: number, s: number, fx: number, fy: number) => void>(
    () => {},
  );
  commitRef.current = (tx, ty, s, fx, fy) => {
    const cx = width / 2;
    const cy = height / 2;
    const middle = project(center, zoom);

    /* La traslación total que se ve: la del dedo más la que añade escalar
       alrededor de un punto que no es el centro (escalar alrededor de F es
       escalar alrededor de C y trasladar `(1 − s)·(F − C)`). */
    const shiftX = tx + (1 - s) * (fx - cx);
    const shiftY = ty + (1 - s) * (fy - cy);
    /* Qué píxel del mundo, a este nivel, ha quedado bajo el foco. */
    const underFocal = unproject(
      { x: middle.x + (fx - cx - shiftX) / s, y: middle.y + (fy - cy - shiftY) / s },
      zoom,
    );

    /* Sin manejador, ese cambio no existe: el mapa vuelve a su sitio. */
    const step = onZoomChange ? snapZoom(zoom + Math.log2(s), zoomSteps) : zoom;
    const focalAtStep = project(underFocal, step);
    const nextCenter = unproject(
      { x: focalAtStep.x - (fx - cx), y: focalAtStep.y - (fy - cy) },
      step,
    );

    /* Lo que el padre va a aplicar de verdad, contra lo que pellizcó el dedo.
       El cociente es lo que le sobra al lienzo, y es lo que se asienta con el
       muelle en vez de saltar. */
    const applied = 2 ** (step - zoom);
    const leftover = s / applied;

    /* **El reinicio va aquí, justo antes de avisar, y no en el hilo de
       interfaz.** Las dos cosas —el lienzo a cero y el padre dibujando con el
       centro nuevo— tienen que caer en el mismo cuadro: si el lienzo vuelve a
       cero un cuadro antes, el mapa salta atrás y luego adelante; si vuelve un
       cuadro después, se ve el doble de recorrido. Desde el mismo tramo de
       JavaScript, el valor compartido y el estado de React se aplican en el
       siguiente cuadro los dos. */
    translateX.value = 0;
    translateY.value = 0;
    if (reduced || Math.abs(leftover - 1) < 0.001) {
      scale.value = 1;
    } else {
      /* El foco se queda como está: con `leftover` alrededor del mismo foco,
         lo que se ve es exactamente lo que había al soltar, y de ahí al
         escalón con un muelle. */
      scale.value = leftover;
      scale.value = withSpring(1, springs.settle);
    }

    if (step !== zoom) onZoomChange?.(step);
    onCenterChange?.(nextCenter);
  };
  const commit = useCallback(
    (tx: number, ty: number, s: number, fx: number, fy: number) =>
      commitRef.current(tx, ty, s, fx, fy),
    [],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-PAN_SLOP, PAN_SLOP])
    .activeOffsetY([-PAN_SLOP, PAN_SLOP])
    .onStart(() => {
      panActive.value = true;
    })
    .onChange((event) => {
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onEnd(() => {
      panActive.value = false;
      /* Con dos dedos, arrastre y pellizco acaban por separado: hace la cuenta
         el último en soltar, con lo que dejaron los dos. */
      if (!pinchActive.value) {
        runOnJS(commit)(
          translateX.value,
          translateY.value,
          scale.value,
          focalX.value,
          focalY.value,
        );
      }
    });

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      pinchActive.value = true;
      pinchBase.value = scale.value;
      /* Si el lienzo aún se estaba asentando alrededor del foco anterior,
         cambiar de foco de golpe lo movería: se pasa a la traslación lo que
         aportaba el foco viejo, y así no se nota el relevo. */
      translateX.value += (1 - scale.value) * (focalX.value - event.focalX);
      translateY.value += (1 - scale.value) * (focalY.value - event.focalY);
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onUpdate((event) => {
      scale.value = Math.min(maxScale, Math.max(minScale, pinchBase.value * event.scale));
    })
    .onEnd(() => {
      pinchActive.value = false;
      if (!panActive.value) {
        runOnJS(commit)(
          translateX.value,
          translateY.value,
          scale.value,
          focalX.value,
          focalY.value,
        );
      }
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + (1 - scale.value) * (focalX.value - width / 2) },
      { translateY: translateY.value + (1 - scale.value) * (focalY.value - height / 2) },
      { scale: scale.value },
    ],
  }));

  /* ------------------------------------------------------------------ */
  /* Lo que se dibuja                                                    */
  /* ------------------------------------------------------------------ */

  const toneColor = (tone: MapMarker['tone']) =>
    tone === 'alert'
      ? theme.colors.destructive
      : tone === 'water'
        ? theme.colors.information
        : tone === 'vet'
          ? theme.colors.warning
          : tone === 'friend'
            ? theme.colors.liveRing
            : theme.colors.primary;

  /* Orden de pintado: primero los sitios, luego las caras, y las alertas
     siempre las últimas. Las caras van por encima de los iconos porque son lo
     que se viene a mirar, y por debajo de las alertas porque un aviso de cebos
     tapado por un retrato es un aviso que no se ha dado. */
  const layerRank = (tone: MapMarker['tone']) => (tone === 'alert' ? 2 : tone === 'friend' ? 1 : 0);
  const ordered = useMemo(
    () => [...shown].sort((a, b) => layerRank(a.tone) - layerRank(b.tone)),
    [shown],
  );

  /* La retícula en metros y no en fracciones del cuadro: así una casilla mide
     siempre lo mismo sobre el terreno y el paso de una escala a otra se ve como
     un acercamiento, no como un dibujo distinto. Cuando el cuadro abarca mucho,
     las líneas se juntarían hasta ser una mancha, así que se salta de 250 en
     250 metros a 500, 1000, 2000… hasta que respiran. */
  const stepM = useMemo(() => {
    let step = GRID_STEP_M;
    while (step * pxPerMeter < 28) step *= 2;
    return step;
  }, [pxPerMeter]);

  const stepPx = stepM * pxPerMeter;
  /* Anclada a la persona, no al centro del cuadro. Antes eran lo mismo; ahora
     el centro se arrastra, y una retícula anclada al centro se recolocaría a
     cada suelte bajo los pies. Anclada a un punto del mundo, se desplaza lo
     mismo que el lienzo y no se nota el relevo. Cubre también el anillo de
     más, que es lo que asoma al arrastrar. */
  const originX = ((userPoint.x % stepPx) + stepPx) % stepPx;
  const originY = ((userPoint.y % stepPx) + stepPx) % stepPx;
  const firstColumn = Math.floor((-OVERSCAN - originX) / stepPx);
  const firstRow = Math.floor((-OVERSCAN - originY) / stepPx);
  const columns = Math.ceil((width + OVERSCAN * 2) / stepPx) + 2;
  const rows = Math.ceil((height + OVERSCAN * 2) / stepPx) + 2;

  const scaleBarM = stepM * (stepPx < width / 5 ? 2 : 1);

  /**
   * Marcadores que caen unos encima de otros.
   *
   * Lo destapó el auditor de capturas, no el tipado: el aviso de cebos está a
   * ciento cincuenta metros del Parque Central, así que a cuatro kilómetros de
   * cuadro quedan a catorce píxeles y sus dos áreas táctiles de cuarenta y
   * cuatro se solapan por completo. Playwright lo dijo con todas las letras
   * —«Cebos envenenados intercepta los eventos de puntero»— después de treinta
   * segundos intentando pulsar el parque. **Un marcador que se ve y no se puede
   * tocar es peor que uno que no está**: se intenta, no pasa nada, y la
   * conclusión es que la aplicación no responde.
   *
   * Se agrupan los que se pisan y se reparten en corro alrededor del centro del
   * grupo, con una línea fina que devuelve cada uno a su punto. El radio del
   * corro sale de cuántos son: con `n` alrededor de un círculo de radio `R` la
   * separación entre vecinos es `2·R·sin(π/n)`, y hace falta que pase de los
   * cuarenta y cuatro del área táctil. Con un radio fijo no bastaba —el primer
   * intento apartó veintiséis píxeles y las cajas seguían solapando—, y esa es
   * justo la clase de arreglo que parece bien en el código y falla en el dedo.
   *
   * **La posición no se falsea:** el punto de verdad se sigue dibujando, con su
   * hilo hasta el icono. Es lo que hace cualquier mapa cuando dos cosas
   * comparten portal.
   *
   * De lejos, las caras del mismo sitio ya llegan fundidas en una burbuja
   * (`lib/clusters`), así que aquí el corro solo tiene que separar lo que es
   * distinto de verdad: la burbuja del parque, el parque y la alerta de al lado.
   */
  const offsets = useMemo(() => {
    const TOUCH = 44;
    const clusters: Array<Array<{ id: string; x: number; y: number }>> = [];

    for (const marker of ordered) {
      const { x, y } = projectPoint(marker);
      const near = clusters.find((cluster) =>
        cluster.some((member) => Math.hypot(member.x - x, member.y - y) < TOUCH),
      );
      if (near) near.push({ id: marker.id, x, y });
      else clusters.push([{ id: marker.id, x, y }]);
    }

    const result = new Map<string, { dx: number; dy: number }>();
    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      const cx = cluster.reduce((sum, member) => sum + member.x, 0) / cluster.length;
      const cy = cluster.reduce((sum, member) => sum + member.y, 0) / cluster.length;
      // 24 y no 22 para dejar dos píxeles de aire entre cajas contiguas.
      const radius = Math.max(26, 24 / Math.sin(Math.PI / cluster.length));
      cluster.forEach((member, index) => {
        // Se empieza arriba: el rótulo del marcador elegido cuelga por debajo,
        // así que es por arriba por donde menos estorba el corro.
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / cluster.length;
        result.set(member.id, {
          dx: cx + Math.cos(angle) * radius - member.x,
          dy: cy + Math.sin(angle) * radius - member.y,
        });
      });
    }
    return result;
  }, [ordered, projectPoint]);

  return (
    <View
      accessibilityLabel={`Esquema de la zona, ${spanM >= 1000 ? `${spanM / 1000} kilómetros` : `${spanM} metros`} de lado. ${shown.length} marcadores.`}
      style={{
        width,
        height,
        backgroundColor: theme.colors.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      {/* El lienzo: todo lo que es terreno va aquí dentro y se mueve junto
          con el dedo. El cromo —norte, escala, atribución, avisos— va fuera y
          se queda quieto, porque no está en el terreno: está en la pantalla. */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[{ position: 'absolute', left: 0, top: 0, width, height }, canvasStyle]}
        >
          {/* Las teselas, debajo de todo. Si no llegan, avisan y en su lugar
              queda la retícula, que no necesita red. */}
          <TileLayer
            centerLat={center.lat}
            centerLng={center.lng}
            zoom={zoom}
            width={width}
            height={height}
            overscan={OVERSCAN}
            attribution={false}
            onUnavailable={onUnavailable}
          />

          {/* El velo sobre las teselas: lo que hace que el mapa calle.
              Esto es la mitad de por qué el mapa de Snapchat se lee tan rápido,
              y es lo que menos se nota: su cartografía está deliberadamente
              apagada —pocos rótulos, colores lavados— para que lo único con
              contraste fuerte sean las caras. Sobre el estilo estándar de
              OpenStreetMap, que es vivo y lleno de rótulos, un retrato de
              cuarenta píxeles compite con un parque verde chillón y con el
              nombre de tres calles.
              Se hace con un velo del color de fondo y no cambiando de proveedor
              de teselas a propósito: los cinco que se probaron están bloqueados
              desde este contenedor, así que un estilo nuevo no se podría
              comprobar y además hay que atribuirlo distinto. Un velo es una
              capa nuestra, se ve en la captura, y funciona igual con cualquier
              proveedor detrás.
              Desaparece cuando no hay imágenes: apagar el respaldo, que ya es
              tenue, lo dejaría en nada. Cubre también el anillo de más: si no,
              al arrastrar asomaba una franja de mapa sin velar. */}
          {tilesDown ? null : (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: -OVERSCAN,
                right: -OVERSCAN,
                top: -OVERSCAN,
                bottom: -OVERSCAN,
                backgroundColor: theme.colors.background,
                /* Más fuerte en oscuro, y por una limitación que conviene decir:
                   las teselas de OpenStreetMap son **siempre claras**. No hay
                   tema oscuro que valga contra un mapa que llega ya pintado,
                   así que un velo del 34 % dejaba la cartografía brillando muy
                   por encima del cromo y la pantalla parecía a medio cargar. Un
                   mapa nocturno de verdad necesita un estilo de teselas oscuro
                   —eso es cambiar de proveedor, con su atribución— y desde este
                   contenedor no se puede comprobar ninguno. Apagarlo es lo que
                   sí está en nuestra mano. */
                opacity: theme.isDark ? 0.55 : 0.34,
              }}
            />
          )}

          {/* Retícula: da escala sin fingir que son calles. Sólo cuando no hay
              imágenes — encima de un mapa de verdad sería una reja sobre la
              calle. A un pelo de grosor y muy tenue: marcada era papel
              milimetrado, y el papel milimetrado se mira en vez de mirarse a
              través. */}
          {tilesDown &&
            Array.from({ length: rows }, (_, index) => (
              <View
                key={`h${index}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: -OVERSCAN,
                  right: -OVERSCAN,
                  top: originY + (firstRow + index) * stepPx,
                  height: 1,
                  backgroundColor: theme.colors.border,
                  opacity: 0.35,
                }}
              />
            ))}
          {tilesDown &&
            Array.from({ length: columns }, (_, index) => (
              <View
                key={`v${index}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -OVERSCAN,
                  bottom: -OVERSCAN,
                  left: originX + (firstColumn + index) * stepPx,
                  width: 1,
                  backgroundColor: theme.colors.border,
                  opacity: 0.35,
                }}
              />
            ))}

          {/* Los círculos primero, debajo de todos los marcadores. Para un lugar
              esto no es un «radio de aviso»: es el sitio, dibujado con su
              tamaño. Un parque de 250 m de radio ocupa una manzana, y un alfiler
              no lo dice. */}
          {ordered.map((marker) => {
            if (!marker.radiusM) return null;
            const { x, y } = projectPoint(marker);
            const r = marker.radiusM * pxPerMeter;
            // Un círculo más grande que el cuadro no se dibuja.
            //
            // Se veía en la primera captura: la alerta de petardos tiene 7 km de
            // radio y el cuadro abarcaba 4, así que el disco tapaba la pantalla
            // entera de rosa. Un color que lo cubre todo no informa de nada
            // —deja de haber dentro y fuera— y además esconde los demás
            // marcadores. Cuando pasa, queda el marcador y el aviso de la hoja
            // dice que hay que alejar el cuadro para ver el alcance.
            // El listón es el lado **corto** del cuadro, no el largo. Con el
            // largo, una pantalla de teléfono —alta y estrecha— dejaba pasar
            // discos que tapaban el ancho entero y solo se cortaban por arriba
            // y por abajo.
            if (r > Math.min(width, height) * 0.9) return null;
            const alert = marker.tone === 'alert';
            return (
              <View
                key={`r-${marker.id}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: x - r,
                  top: y - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: r,
                  // La alerta lleva borde y el lugar no: el borde es un límite
                  // —«hasta aquí llega el aviso»— y la mancha de un parque no
                  // tiene una linde que nadie pueda enseñar de verdad.
                  // La alerta es **un aro sin relleno**; el lugar, una mancha.
                  // No es una preferencia: el círculo de una alerta es grande
                  // por definición —quinientos metros de radio cubren medio
                  // barrio— y cualquier relleno, por flojo que sea, tiñe lo que
                  // hay debajo. Se probó al 10 % y el verde del Parque Central
                  // salía gris verdoso: se perdía justo el sitio al que iba a ir
                  // esa persona. Un aro encierra un área igual de bien y no
                  // apaga nada.
                  borderWidth: alert ? 2 : 0,
                  borderColor: toneColor(marker.tone),
                  /* Y desaparece donde hay halo. Dos discos translúcidos sobre
                     el mismo sitio no se leen como dos capas: se leen como una
                     mancha sucia, y en la captura el halo de actividad sobre el
                     verde del parque salió exactamente así. Medir los tokens no
                     lo explicaba —se separan de sobra— porque lo que se
                     confundía era el resultado de componerlos, no los colores
                     de partida. Donde hay gente manda el halo; la forma del
                     parque la sigue diciendo su linde, que se dibuja aparte. */
                  backgroundColor:
                    alert || (marker.heat ?? 0) >= 2 ? 'transparent' : toneColor(marker.tone),
                  // La mancha de un lugar se aclara cuando hay mapa debajo: ahí
                  // el parque ya sale verde y con su forma real, así que la
                  // mancha deja de tener que dibujarlo y pasa a solo señalarlo.
                  // Encima del esquema, en cambio, es lo único que dice que es
                  // una superficie.
                  opacity: alert ? 0.7 : tilesDown ? 0.3 : 0.18,
                }}
              />
            );
          })}

          {/* El halo de actividad: dónde está pasando algo.
              Es el mapa de calor de Snapchat, con la diferencia que importa:
              mide **el sitio**, no a las personas. Tres círculos concéntricos
              en vez de un degradado radial porque React Native no tiene
              degradados sin SVG y esto se dibuja igual de bien con tres vistas.

              Va **después de la mancha del parque y antes de las caras**, y ese
              orden costó una captura: dibujado antes, la mancha verde del
              parque lo tapaba entero y el halo no existía en pantalla aunque el
              código lo pintara. Detrás de las caras porque un halo encima de un
              retrato lo apaga, y el retrato es lo que se viene a mirar.

              La burbuja de grupo no lleva halo aunque alguien se lo ponga: el
              halo es del parque, que está en el mismo punto, y dos halos
              superpuestos son el doble de mancha diciendo lo mismo. */}
          {ordered.map((marker) => {
            if (!marker.heat || marker.heat < 2 || marker.kind === 'cluster') return null;
            const { x, y } = projectPoint(marker);
            const base = Math.min(120, 46 + marker.heat * 16);
            return (
              <View key={`h-${marker.id}`} pointerEvents="none">
                {[1, 0.66, 0.4].map((ratio, index) => {
                  const r = base * ratio;
                  return (
                    <View
                      key={ratio}
                      style={{
                        position: 'absolute',
                        left: x - r,
                        top: y - r,
                        width: r * 2,
                        height: r * 2,
                        borderRadius: r,
                        backgroundColor: theme.colors.mapHeat,
                        /* Flojo a propósito y creciente hacia dentro. Este mapa
                           ya aprendió una vez que cualquier película sobre un
                           disco grande tiñe lo que hay debajo —por eso la
                           alerta es un aro sin relleno—, así que el halo se
                           queda pequeño (nunca más de 120 px) y translúcido:
                           señala un sitio, no lo pinta. */
                        opacity: 0.12 + index * 0.07,
                      }}
                    />
                  );
                })}
              </View>
            );
          })}

          {/* La linde de un lugar, aparte y más marcada que su relleno. Dentro
              del mismo `View` compartiría opacidad con la mancha y
              desaparecería, que es lo que convierte un parque en un borrón
              verde sin forma. */}
          {ordered.map((marker) => {
            if (!marker.radiusM || marker.tone === 'alert') return null;
            const { x, y } = projectPoint(marker);
            const r = marker.radiusM * pxPerMeter;
            if (r > Math.min(width, height) * 0.9) return null;
            return (
              <View
                key={`e-${marker.id}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: x - r,
                  top: y - r,
                  width: r * 2,
                  height: r * 2,
                  borderRadius: r,
                  borderWidth: 1,
                  borderColor: toneColor(marker.tone),
                  opacity: 0.55,
                }}
              />
            );
          })}

          {/* El hilo del marcador apartado a su punto de verdad, y el punto en
              sí: un círculo de tres píxeles. Sin esto, apartar el icono sería
              mover el sitio. */}
          {ordered.map((marker) => {
            const offset = offsets.get(marker.id);
            if (!offset) return null;
            const { x, y } = projectPoint(marker);
            if (x < -CULL || x > width + CULL || y < -CULL || y > height + CULL) return null;
            const length = Math.hypot(offset.dx, offset.dy);
            return (
              <View key={`t-${marker.id}`} pointerEvents="none">
                <View
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y - 1,
                    width: length,
                    height: 2,
                    backgroundColor: toneColor(marker.tone),
                    opacity: 0.5,
                    transform: [
                      { translateX: -length / 2 },
                      { rotate: `${Math.atan2(offset.dy, offset.dx)}rad` },
                      { translateX: length / 2 },
                    ],
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    left: x - 3,
                    top: y - 3,
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: toneColor(marker.tone),
                  }}
                />
              </View>
            );
          })}

          {ordered.map((marker) => {
            const anchor = projectPoint(marker);
            const offset = offsets.get(marker.id) ?? { dx: 0, dy: 0 };
            const x = anchor.x + offset.dx;
            const y = anchor.y + offset.dy;
            // Lo que cae fuera del cuadro no se dibuja pegado al borde: pintarlo
            // ahí diría que está justo en el límite, y no es verdad. El margen
            // es el anillo de más, para que un arrastre lo encuentre ya puesto.
            if (x < -CULL || x > width + CULL || y < -CULL || y > height + CULL) return null;
            const selected = marker.id === selectedId;
            const color = toneColor(marker.tone);
            const dot = selected ? 34 : 28;
            const face = marker.petId !== undefined;
            const cluster = marker.kind === 'cluster';
            // La cara es más grande que el punto porque tiene que reconocerse,
            // no solo verse: un retrato de veintiocho píxeles es una mancha de
            // color. La burbuja mide lo que el área táctil, ni más ni menos:
            // es un número y un número se lee a ese tamaño.
            const puck = cluster ? 44 : face ? (selected ? 48 : 42) : dot;
            /* La burbuja se rotula con el sitio, no con «3 perros en…»: la
               cifra ya va dentro y repetirla debajo era decirlo dos veces. */
            const caption = cluster ? placeNameOf(marker) : marker.label;

            return (
              <Pressable
                key={marker.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  cluster
                    ? `${marker.clusterCount} perros en ${caption}. Toca para acercar`
                    : marker.label
                }
                accessibilityHint={marker.detail}
                onPress={() => {
                  haptics.tap();
                  /* Tocar una burbuja no la elige ni la deselige: pide acercar,
                     y eso lo hace quien tiene el nivel. Siempre con su id. */
                  onSelect(cluster || !selected ? marker.id : null);
                }}
                style={{
                  position: 'absolute',
                  // El área táctil son 44 como suelo; cuando la cara es más
                  // grande manda la cara. El resto es margen invisible para
                  // acertar con el dedo sin que el dibujo crezca.
                  left: x - Math.max(22, puck / 2),
                  top: y - Math.max(22, puck / 2),
                  width: Math.max(44, puck),
                  alignItems: 'center',
                }}
              >
                <View style={{ height: Math.max(44, puck), justifyContent: 'center' }}>
                  {cluster ? (
                    /* La burbuja de grupo: el color de marca con la cifra
                       encima, en tipo de titular. Es lo único del mapa que se
                       pinta del color de marca a propósito —las caras van en
                       «en vivo», los sitios en su tono— para que de lejos lo
                       primero que se vea sea dónde hay gente, que es la
                       pregunta que trae aquí a la gente. */
                    <View
                      style={{
                        width: puck,
                        height: puck,
                        borderRadius: puck / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.primary,
                        borderWidth: selected ? 3 : 2,
                        borderColor: theme.colors.background,
                      }}
                    >
                      <Text
                        style={{
                          color: theme.colors.primaryForeground,
                          fontFamily: fonts.displayBold,
                          fontSize: theme.fontSize.base,
                        }}
                      >
                        {marker.clusterCount}
                      </Text>
                    </View>
                  ) : face ? (
                    /* La ficha de una cara: retrato dentro de un aro del color
                       del fondo, como los Bitmoji de Snapchat. El aro no es
                       adorno —es lo que separa la cara de lo que haya debajo, y
                       sin él un perro claro sobre una acera clara desaparece—.
                       El aro exterior va en el color de «en vivo», que en esta
                       aplicación significa una sola cosa y aquí significa
                       exactamente eso. */
                    <View
                      style={{
                        width: puck,
                        height: puck,
                        borderRadius: puck / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.colors.background,
                        borderWidth: selected ? 3 : 2,
                        borderColor: color,
                      }}
                    >
                      <Avatar id={marker.petId!} name={marker.label} size={puck - 8} />
                    </View>
                  ) : (
                    <View
                      style={{
                        width: dot,
                        height: dot,
                        borderRadius: dot / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: color,
                        borderWidth: selected ? 3 : 2,
                        borderColor: theme.colors.background,
                      }}
                    >
                      <Icon
                        icon={marker.icon}
                        size="sm"
                        color={theme.colors.background}
                        decorative
                      />
                    </View>
                  )}
                </View>

                {/* El nombre debajo del punto, en el elegido, **siempre en las
                    caras** y en las burbujas. Con los iconos, todos los rótulos
                    a la vez serían una alfombra de texto solapado; con las
                    caras el nombre es medio dato —saber que hay alguien sin
                    saber quién no sirve de nada— y son pocas por definición:
                    los que están fuera ahora, no el callejero entero. La
                    burbuja dice el sitio por lo mismo: «3» solo no es un dato. */}
                {selected || face || cluster ? (
                  <View
                    pointerEvents="none"
                    style={{
                      maxWidth: 132,
                      /* Pegado al punto, y despegado de la cara. Con el mismo −2
                         para los dos, el rótulo de una cara —que es doce
                         píxeles más grande— se metía dentro del retrato y
                         tapaba el hocico justo del perro que nombra. */
                      marginTop: face || cluster ? 2 : -2,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: theme.radius.sm,
                      backgroundColor: theme.colors.background,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: theme.colors.foreground,
                        fontFamily: fonts.bodyBold,
                        fontSize: theme.fontSize['2xs'],
                        textAlign: 'center',
                      }}
                    >
                      {caption}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          {/* Dónde estás. Un aro, no un punto relleno: no es un marcador más.
              Sin nombre y sin cara, y no por descuido: la persona dueña del
              teléfono no aparece en el mapa. Va dentro del lienzo porque está
              en el terreno: al arrastrar, se va con las calles. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: userPoint.x - 9,
              top: userPoint.y - 9,
              width: 18,
              height: 18,
              borderRadius: 9,
              borderWidth: 3,
              borderColor: theme.colors.foreground,
              backgroundColor: theme.colors.background,
            }}
          />
        </Animated.View>
      </GestureDetector>

      {/* Sin mapa debajo hay que decirlo, y decir qué sigue siendo cierto: el
          esquema no es un mapa a medio cargar, es otra cosa que sirve igual
          para lo que hace falta. */}
      {tilesDown ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: theme.space[3],
            // Hasta donde empieza la columna de botones, no hasta el borde: con
            // el margen normal el texto pasaba por debajo del «+» y se cortaba
            // a media frase.
            right: 60,
            top: topInset + theme.space[3] + 30,
            paddingHorizontal: theme.space[3],
            paddingVertical: theme.space[2],
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.xs,
            }}
          >
            Sin las calles, de momento
          </Text>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize['2xs'],
            }}
          >
            No llegan las imágenes del mapa. Las posiciones, las distancias y los radios que ves son
            reales y no necesitan conexión.
          </Text>
        </View>
      ) : null}

      {/* Norte arriba, porque el esquema no rota. A la izquierda: la derecha
          es de los botones. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: theme.space[3],
          top: topInset + theme.space[3],
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.background,
        }}
      >
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.xs,
          }}
        >
          N ↑
        </Text>
      </View>

      {/* Escala. Sin esto el esquema no dice nada: un punto a media pantalla
          podría estar a cien metros o a diez kilómetros. Sobre una pastilla,
          porque debajo hay dibujo y el texto suelto se pierde encima de una
          mancha verde. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: theme.space[3],
          bottom: bottomInset + theme.space[3],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[1],
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.background,
        }}
      >
        <View
          style={{
            width: scaleBarM * pxPerMeter,
            height: 3,
            backgroundColor: theme.colors.foreground,
            borderRadius: 2,
          }}
        />
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.xs,
          }}
        >
          {scaleBarM >= 1000
            ? `${(scaleBarM / 1000).toFixed(1).replace('.', ',')} km`
            : `${scaleBarM} m`}
        </Text>
      </View>

      {/* La atribución, en el cromo fijo: es una condición de la licencia y
          tiene que quedarse en su esquina aunque el terreno se arrastre. */}
      <TileAttribution />
    </View>
  );
}
