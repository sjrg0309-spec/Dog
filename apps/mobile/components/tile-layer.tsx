/**
 * Las imágenes del mapa.
 *
 * Es lo que hace que esto se parezca a Google Maps o a Waze en vez de a un
 * esquema: calles con su nombre, manzanas, parques con su forma real, ríos.
 * Y viene de un solo sitio —OpenStreetMap— con cobertura de **todos los
 * países**, sin listas de ciudades soportadas: el nivel de detalle en Nairobi o
 * en Wellington es el que la comunidad haya cartografiado allí, igual que en
 * Madrid.
 *
 * **Y tiene que poder fallar bien.** Un mapa que depende de la red se usa justo
 * donde la red falla: dentro de un parque, en un pueblo, con datos agotados a
 * final de mes. Si las imágenes no llegan, esta capa avisa hacia arriba y el
 * mapa vuelve al esquema de posiciones y distancias, que no necesita red y
 * sigue siendo información correcta. Lo que no hace es quedarse en gris
 * fingiendo que carga.
 *
 * **Aquí dentro no llegan.** El proxy de salida de este contenedor bloquea todos
 * los proveedores de teselas que se probaron —los cinco—, igual que bloquea a
 * Open-Meteo. Así que en las capturas de este entorno sale el respaldo, y lo que
 * se verifica de punta a punta es **qué pide**: el auditor levanta un servidor
 * de teselas de mentira, comprueba que las direcciones son las que tocan y que
 * las imágenes se colocan donde deben. En un teléfono la red es la del teléfono.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { fonts } from '@/lib/fonts';
import { TILE_ATTRIBUTION, TILE_SIZE, tileUrl, visibleTiles } from '@/lib/tiles';
import { useTheme } from '@/lib/theme';

/**
 * Cuántas imágenes pueden fallar antes de dar la capa por perdida.
 *
 * Una sola no basta: un 404 suelto en el borde del mundo o una imagen que llega
 * tarde no significa que no haya red, y tirar el mapa entero por eso sería
 * peor que el fallo. La mitad sí: si la mitad de lo que se ve no llega, lo que
 * queda no es un mapa.
 */
const FAILURE_RATIO = 0.5;

export function TileLayer({
  centerLat,
  centerLng,
  zoom,
  width,
  height,
  onUnavailable,
}: {
  /**
   * El centro llega **en dos números y no en un objeto**, y no es manía.
   *
   * Con un objeto, cualquier render de arriba trae una referencia nueva aunque
   * las coordenadas sean idénticas, el `useMemo` se invalida, las teselas se
   * recalculan y cada `<Image>` recibe un `source` recién creado. React Native
   * lo trata como una imagen distinta y **la vuelve a pedir**.
   *
   * No es teórico: la primera versión pedía **682 imágenes para las seis que se
   * ven**. Contra el servidor comunitario de OpenStreetMap eso es exactamente
   * el abuso que su política prohíbe, y lo paga el usuario en datos. Se vio con
   * un servidor de teselas de mentira contando peticiones, no en una captura:
   * seis imágenes correctas y seiscientas ochenta y dos peticiones se ven
   * exactamente igual.
   */
  centerLat: number;
  centerLng: number;
  zoom: number;
  width: number;
  height: number;
  /** Las imágenes no llegan: quien nos dibuja tiene que enseñar otra cosa. */
  onUnavailable: (unavailable: boolean) => void;
}) {
  const theme = useTheme();

  /* Las teselas **y sus `source`** en el mismo memo, para que el objeto que
     recibe cada `<Image>` sea el mismo mientras no cambie el encuadre. */
  const tiles = useMemo(
    () =>
      visibleTiles({ lat: centerLat, lng: centerLng }, zoom, width, height).map((tile) => ({
        ...tile,
        key: `${tile.z}/${tile.x}/${tile.y}`,
        source: { uri: tileUrl(tile) },
      })),
    [centerLat, centerLng, zoom, width, height],
  );

  const total = tiles.length;

  /**
   * La cuenta va en una `ref` y no en estado, y esto es lo que arregla el
   * bucle de peticiones.
   *
   * Con `useState`, cada imagen que cargaba llamaba a `setLoaded`, eso
   * provocaba un render, y en React Native Web un render de un `<Image>` vuelve
   * a arrancar su carga —así que se disparaba `onLoad` otra vez, y otro
   * `setLoaded`, y otro render—. Un bucle sin fondo: medido contra un servidor
   * de teselas de mentira daba **1240 peticiones en ocho segundos y subiendo**,
   * para seis imágenes que nunca cambian.
   *
   * Lo peor de este fallo es cómo se ve: perfecto. El mapa sale bien, la
   * captura sale bien, y lo único que pasa es que el teléfono no para de pedir
   * y el servidor comunitario de OpenStreetMap recibe cien peticiones por
   * segundo de cada usuario. No hay pantalla donde mirarlo; hay que contarlo.
   *
   * Con la `ref` no hay render al cargar, así que no hay recarga. El estado
   * sólo se toca cuando **cambia el veredicto**, que ocurre una vez.
   */
  const tally = useRef({ key: '', loaded: 0, failed: 0, verdict: false });
  const [, force] = useState(0);

  // Al cambiar de encuadre se empieza a contar de cero: si no, un nivel que
  // falló dejaría marcado como roto al siguiente, que quizá sí carga.
  const key = `${zoom}:${Math.round(centerLat * 1e4)}:${Math.round(centerLng * 1e4)}`;
  if (tally.current.key !== key) {
    tally.current = { key, loaded: 0, failed: 0, verdict: tally.current.verdict };
  }

  const record = useCallback(
    (outcome: 'loaded' | 'failed') => {
      const current = tally.current;
      current[outcome] += 1;
      const seen = current.loaded + current.failed;
      const verdict = seen >= total && current.failed >= total * FAILURE_RATIO;
      if (verdict === current.verdict) return;
      current.verdict = verdict;
      onUnavailable(verdict);
      force((tick) => tick + 1);
    },
    [total, onUnavailable],
  );

  return (
    <View style={{ width, height, overflow: 'hidden', backgroundColor: theme.colors.surfaceSunken }}>
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={tile.source}
          onLoad={() => record('loaded')}
          onError={() => record('failed')}
          // El mapa no aporta nada a un lector de pantalla: lo que hay en él se
          // lee en la lista de la hoja, con nombres y distancias. Describir una
          // imagen de calles como «mapa» es ruido, no información.
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: 'absolute',
            left: tile.left,
            top: tile.top,
            width: TILE_SIZE,
            height: TILE_SIZE,
          }}
        />
      ))}

      {/* La atribución. No es opcional ni decorativa: es la condición de uso de
          los datos, y va visible sobre el mapa como pide la licencia. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          paddingHorizontal: 5,
          paddingVertical: 2,
          borderTopLeftRadius: theme.radius.xs,
          backgroundColor: theme.colors.background,
          opacity: 0.85,
        }}
      >
        {/* Once, no nueve. La atribución es letra pequeña por obligación de la
            licencia, y eso no la exime del mínimo de tamaño: una condición
            legal que no se puede leer tampoco se cumple. */}
        <Text style={{ color: theme.colors.mutedForeground, fontFamily: fonts.body, fontSize: theme.fontSize['2xs'] }}>
          {TILE_ATTRIBUTION}
        </Text>
      </View>
    </View>
  );
}
