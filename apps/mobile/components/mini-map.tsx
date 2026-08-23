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
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { TileLayer } from './tile-layer';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import type { LucideIcon } from '@/lib/icons';
import { metersPerPixel, project, spanMeters } from '@/lib/tiles';
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
};

/** Cada cuánto cae una línea de la retícula del respaldo, en metros. */
const GRID_STEP_M = 250;

/** ¿Hay algún alcance que no cabe en el cuadro? La pantalla tiene que decirlo. */
export function radiusOverflows(markers: MapMarker[], spanM: number): MapMarker[] {
  return markers.filter((marker) => (marker.radiusM ?? 0) * 2 > spanM * 0.9);
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
}) {
  const theme = useTheme();
  const [tilesDown, setTilesDown] = useState(false);
  const onUnavailable = useCallback((value: boolean) => setTilesDown(value), []);

  const spanM = spanMeters(center.lat, zoom, width);

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
  const layerRank = (tone: MapMarker['tone']) =>
    tone === 'alert' ? 2 : tone === 'friend' ? 1 : 0;
  const ordered = [...markers].sort((a, b) => layerRank(a.tone) - layerRank(b.tone));

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
  const columns = Math.ceil(width / stepPx) + 1;
  const rows = Math.ceil(height / stepPx) + 1;
  /* Ancladas al centro, que es donde está el usuario: si se anclaran a la
     esquina, cambiar de escala movería la retícula bajo los pies. */
  const originX = (width / 2) % stepPx;
  const originY = (height / 2) % stepPx;

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
      accessibilityLabel={`Esquema de la zona, ${spanM >= 1000 ? `${spanM / 1000} kilómetros` : `${spanM} metros`} de lado. ${markers.length} marcadores.`}
      style={{
        width,
        height,
        backgroundColor: theme.colors.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      {/* Las teselas, debajo de todo. Si no llegan, avisan y en su lugar queda
          la retícula, que no necesita red. */}
      <TileLayer
        centerLat={center.lat}
        centerLng={center.lng}
        zoom={zoom}
        width={width}
        height={height}
        onUnavailable={onUnavailable}
      />

      {/* El velo sobre las teselas: lo que hace que el mapa calle.
          Esto es la mitad de por qué el mapa de Snapchat se lee tan rápido, y
          es lo que menos se nota: su cartografía está deliberadamente apagada
          —pocos rótulos, colores lavados— para que lo único con contraste
          fuerte sean las caras. Sobre el estilo estándar de OpenStreetMap, que
          es vivo y lleno de rótulos, un retrato de cuarenta píxeles compite
          con un parque verde chillón y con el nombre de tres calles.
          Se hace con un velo del color de fondo y no cambiando de proveedor de
          teselas a propósito: los cinco que se probaron están bloqueados desde
          este contenedor, así que un estilo nuevo no se podría comprobar y
          además hay que atribuirlo distinto. Un velo es una capa nuestra, se ve
          en la captura, y funciona igual con cualquier proveedor detrás.
          Desaparece cuando no hay imágenes: apagar el respaldo, que ya es
          tenue, lo dejaría en nada. */}
      {tilesDown ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: theme.colors.background,
            /* Más fuerte en oscuro, y por una limitación que conviene decir:
               las teselas de OpenStreetMap son **siempre claras**. No hay tema
               oscuro que valga contra un mapa que llega ya pintado, así que un
               velo del 34 % dejaba la cartografía brillando muy por encima del
               cromo y la pantalla parecía a medio cargar. Un mapa nocturno de
               verdad necesita un estilo de teselas oscuro —eso es cambiar de
               proveedor, con su atribución— y desde este contenedor no se puede
               comprobar ninguno. Apagarlo es lo que sí está en nuestra mano. */
            opacity: theme.isDark ? 0.55 : 0.34,
          }}
        />
      )}

      {/* Retícula: da escala sin fingir que son calles. Sólo cuando no hay
          imágenes — encima de un mapa de verdad sería una reja sobre la calle.
          A un pelo de grosor y muy tenue: marcada era papel milimetrado, y el
          papel milimetrado se mira en vez de mirarse a través. */}
      {tilesDown &&
        Array.from({ length: rows }, (_, index) => (
        <View
          key={`h${index}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: originY + index * stepPx - stepPx,
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
            top: 0,
            bottom: 0,
            left: originX + index * stepPx - stepPx,
            width: 1,
            backgroundColor: theme.colors.border,
            opacity: 0.35,
          }}
        />
        ))}

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
            No llegan las imágenes del mapa. Las posiciones, las distancias y los radios que ves
            son reales y no necesitan conexión.
          </Text>
        </View>
      ) : null}

      {/* Los círculos primero, debajo de todos los marcadores. Para un lugar
          esto no es un «radio de aviso»: es el sitio, dibujado con su tamaño.
          Un parque de 250 m de radio ocupa una manzana, y un alfiler no lo
          dice. */}
      {ordered.map((marker) => {
        if (!marker.radiusM) return null;
        const { x, y } = projectPoint(marker);
        const r = marker.radiusM * pxPerMeter;
        // Un círculo más grande que el cuadro no se dibuja.
        //
        // Se veía en la primera captura: la alerta de petardos tiene 7 km de
        // radio y el cuadro abarcaba 4, así que el disco tapaba la pantalla
        // entera de rosa. Un color que lo cubre todo no informa de nada —deja
        // de haber dentro y fuera— y además esconde los demás marcadores.
        // Cuando pasa, queda el marcador y el aviso de la hoja dice que hay que
        // alejar el cuadro para ver el alcance.
        // El listón es el lado **corto** del cuadro, no el largo. Con el largo,
        // una pantalla de teléfono —alta y estrecha— dejaba pasar discos que
        // tapaban el ancho entero y solo se cortaban por arriba y por abajo.
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
              // —«hasta aquí llega el aviso»— y la mancha de un parque no tiene
              // una linde que nadie pueda enseñar de verdad.
              // La alerta es **un aro sin relleno**; el lugar, una mancha. No es
              // una preferencia: el círculo de una alerta es grande por
              // definición —quinientos metros de radio cubren medio barrio— y
              // cualquier relleno, por flojo que sea, tiñe lo que hay debajo.
              // Se probó al 10 % y el verde del Parque Central salía gris
              // verdoso: se perdía justo el sitio al que iba a ir esa persona.
              // Un aro encierra un área igual de bien y no apaga nada.
              borderWidth: alert ? 2 : 0,
              borderColor: toneColor(marker.tone),
              /* Y desaparece donde hay halo. Dos discos translúcidos sobre el
                 mismo sitio no se leen como dos capas: se leen como una mancha
                 sucia, y en la captura el halo de actividad sobre el verde del
                 parque salió exactamente así. Medir los tokens no lo explicaba
                 —se separan de sobra— porque lo que se confundía era el
                 resultado de componerlos, no los colores de partida. Donde hay
                 gente manda el halo; la forma del parque la sigue diciendo su
                 linde, que se dibuja aparte. */
              backgroundColor:
                alert || (marker.heat ?? 0) >= 2 ? 'transparent' : toneColor(marker.tone),
              // La mancha de un lugar se aclara cuando hay mapa debajo: ahí el
              // parque ya sale verde y con su forma real, así que la mancha
              // deja de tener que dibujarlo y pasa a solo señalarlo. Encima del
              // esquema, en cambio, es lo único que dice que es una superficie.
              opacity: alert ? 0.7 : tilesDown ? 0.3 : 0.18,
            }}
          />
        );
      })}

      {/* El halo de actividad: dónde está pasando algo.
          Es el mapa de calor de Snapchat, con la diferencia que importa: mide
          **el sitio**, no a las personas. Tres círculos concéntricos en vez de
          un degradado radial porque React Native no tiene degradados sin SVG y
          esto se dibuja igual de bien con tres vistas.

          Va **después de la mancha del parque y antes de las caras**, y ese
          orden costó una captura: dibujado antes, la mancha verde del parque lo
          tapaba entero y el halo no existía en pantalla aunque el código lo
          pintara. Detrás de las caras porque un halo encima de un retrato lo
          apaga, y el retrato es lo que se viene a mirar. */}
      {ordered.map((marker) => {
        if (!marker.heat || marker.heat < 2) return null;
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
                    /* Flojo a propósito y creciente hacia dentro. Este mapa ya
                       aprendió una vez que cualquier película sobre un disco
                       grande tiñe lo que hay debajo —por eso la alerta es un
                       aro sin relleno—, así que el halo se queda pequeño (nunca
                       más de 120 px) y translúcido: señala un sitio, no lo
                       pinta. */
                    opacity: 0.12 + index * 0.07,
                  }}
                />
              );
            })}
          </View>
        );
      })}

      {/* La linde de un lugar, aparte y más marcada que su relleno. Dentro del
          mismo `View` compartiría opacidad con la mancha y desaparecería, que
          es lo que convierte un parque en un borrón verde sin forma. */}
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

      {/* El hilo del marcador apartado a su punto de verdad, y el punto en sí:
          un círculo de tres píxeles. Sin esto, apartar el icono sería mover el
          sitio. */}
      {ordered.map((marker) => {
        const offset = offsets.get(marker.id);
        if (!offset) return null;
        const { x, y } = projectPoint(marker);
        if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return null;
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
        // Lo que cae fuera del cuadro no se dibuja pegado al borde: pintarlo ahí
        // diría que está justo en el límite, y no es verdad.
        if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return null;
        const selected = marker.id === selectedId;
        const color = toneColor(marker.tone);
        const dot = selected ? 34 : 28;
        const face = marker.petId !== undefined;
        // La cara es más grande que el punto porque tiene que reconocerse, no
        // solo verse: un retrato de veintiocho píxeles es una mancha de color.
        const puck = face ? (selected ? 48 : 42) : dot;

        return (
          <Pressable
            key={marker.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={marker.label}
            accessibilityHint={marker.detail}
            onPress={() => {
              haptics.tap();
              onSelect(selected ? null : marker.id);
            }}
            style={{
              position: 'absolute',
              // El área táctil son 44 como suelo; cuando la cara es más grande
              // manda la cara. El resto es margen invisible para acertar con el
              // dedo sin que el dibujo crezca.
              left: x - Math.max(22, puck / 2),
              top: y - Math.max(22, puck / 2),
              width: Math.max(44, puck),
              alignItems: 'center',
            }}
          >
            <View style={{ height: Math.max(44, puck), justifyContent: 'center' }}>
              {face ? (
                /* La ficha de una cara: retrato dentro de un aro del color del
                   fondo, como los Bitmoji de Snapchat. El aro no es adorno —es
                   lo que separa la cara de lo que haya debajo, y sin él un
                   perro claro sobre una acera clara desaparece—. El aro exterior
                   va en el color de «en vivo», que en esta aplicación significa
                   una sola cosa y aquí significa exactamente eso. */
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
                  <Icon icon={marker.icon} size="sm" color={theme.colors.background} decorative />
                </View>
              )}
            </View>

            {/* El nombre debajo del punto, en el elegido **y siempre en las
                caras**. Con los iconos, todos los rótulos a la vez serían una
                alfombra de texto solapado; con las caras el nombre es medio
                dato —saber que hay alguien sin saber quién no sirve de nada— y
                son pocas por definición: los que están fuera ahora, no el
                callejero entero. */}
            {selected || face ? (
              <View
                pointerEvents="none"
                style={{
                  maxWidth: 132,
                  /* Pegado al punto, y despegado de la cara. Con el mismo −2
                     para los dos, el rótulo de una cara —que es doce píxeles
                     más grande— se metía dentro del retrato y tapaba el hocico
                     justo del perro que nombra. */
                  marginTop: face ? 2 : -2,
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
                  {marker.label}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}

      {/* Dónde estás. Un aro, no un punto relleno: no es un marcador más. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: width / 2 - 9,
          top: height / 2 - 9,
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 3,
          borderColor: theme.colors.foreground,
          backgroundColor: theme.colors.background,
        }}
      />

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
    </View>
  );
}
