/**
 * El mapa.
 *
 * **Es un esquema, no cartografía, y la pantalla lo dice.** No hay proveedor de
 * teselas conectado: el proxy de salida de este entorno no deja llegar a ninguno,
 * y dibujar un mapa falso con calles inventadas sería peor que no dibujarlo. Lo
 * que sí es real es la geometría —las posiciones relativas, las distancias y los
 * radios salen de las coordenadas de verdad, proyectadas sobre el cuadro—, así
 * que «esto está al norte y a 400 metros» es información correcta.
 *
 * La proyección es equirectangular con corrección de coseno en la longitud. A
 * escala de barrio el error es despreciable, y sin la corrección Madrid saldría
 * estirada un 23 % en horizontal.
 *
 * Los radios de las alertas se dibujan a escala. Es lo que hace entender de un
 * vistazo por qué un cebo envenenado avisa a media manzana y un perro huido por
 * petardos avisa a medio distrito.
 *
 * **Qué ha cambiado y por qué.** Antes era un cuadrado de trescientos píxeles
 * flotando en mitad de una página que se desplazaba, y con una retícula de
 * líneas al 60 % de opacidad encima. Dos problemas distintos: uno, que ningún
 * mapa que la gente use es una tarjeta dentro de un documento —el mapa **es** la
 * pantalla, y los controles van encima—; y dos, que una retícula tan marcada
 * sobre un fondo liso no se lee como terreno, se lee como papel milimetrado.
 * Ahora ocupa lo que le den, la retícula es un pelo tenue con un cuadro cada
 * cuarto de kilómetro, y los lugares se dibujan como **manchas verdes a escala**
 * antes que como puntos: un parque de doscientos cincuenta metros de radio es
 * una superficie, y enseñarlo como un alfiler pierde justo lo que hace que sea
 * un sitio al que ir.
 */

import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from './icon';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import type { LucideIcon } from '@/lib/icons';
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
  tone: 'place' | 'water' | 'vet' | 'alert';
  /** Radio en metros a dibujar alrededor. Cero: sin círculo. */
  radiusM?: number;
};

const METERS_PER_DEGREE_LAT = 111_320;

/** Cada cuánto cae una línea de la retícula, en metros. */
const GRID_STEP_M = 250;

/** ¿Hay algún alcance que no cabe en el cuadro? La pantalla tiene que decirlo. */
export function radiusOverflows(markers: MapMarker[], spanM: number): MapMarker[] {
  return markers.filter((marker) => (marker.radiusM ?? 0) * 2 > spanM * 0.9);
}

export function MiniMap({
  center,
  markers,
  spanM,
  selectedId,
  onSelect,
  width,
  height,
  bottomInset = 0,
}: {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  /** Cuánto abarca el cuadro **de lado a lado**, en metros. */
  spanM: number;
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
}) {
  const theme = useTheme();

  const project = useMemo(() => {
    const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180);
    // La escala la fija el ancho: `spanM` es lo que se abarca en horizontal, y
    // el alto sale de ahí. Si se escalaran los dos ejes por separado, un mapa
    // apaisado deformaría las distancias y un círculo saldría elipse.
    const pxPerMeter = width / spanM;

    return (point: { lat: number; lng: number }) => {
      const dxM = (point.lng - center.lng) * metersPerDegreeLng;
      // La latitud crece hacia el norte y la Y de la pantalla hacia abajo.
      const dyM = -(point.lat - center.lat) * METERS_PER_DEGREE_LAT;
      return { x: width / 2 + dxM * pxPerMeter, y: height / 2 + dyM * pxPerMeter, pxPerMeter };
    };
  }, [center.lat, center.lng, spanM, width, height]);

  const pxPerMeter = width / spanM;

  const toneColor = (tone: MapMarker['tone']) =>
    tone === 'alert'
      ? theme.colors.destructive
      : tone === 'water'
        ? theme.colors.information
        : tone === 'vet'
          ? theme.colors.warning
          : theme.colors.primary;

  // Las alertas al final del array para que queden dibujadas encima.
  const ordered = [...markers].sort(
    (a, b) => Number(a.tone === 'alert') - Number(b.tone === 'alert'),
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
      const { x, y } = project(marker);
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
  }, [ordered, project]);

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
      {/* Retícula: da escala sin fingir que son calles. A un pelo de grosor y
          muy tenue — marcada era papel milimetrado, y el papel milimetrado se
          mira en vez de mirarse a través. */}
      {Array.from({ length: rows }, (_, index) => (
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
      {Array.from({ length: columns }, (_, index) => (
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

      {/* Los círculos primero, debajo de todos los marcadores. Para un lugar
          esto no es un «radio de aviso»: es el sitio, dibujado con su tamaño.
          Un parque de 250 m de radio ocupa una manzana, y un alfiler no lo
          dice. */}
      {ordered.map((marker) => {
        if (!marker.radiusM) return null;
        const { x, y } = project(marker);
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
              backgroundColor: alert ? 'transparent' : toneColor(marker.tone),
              opacity: alert ? 0.7 : 0.3,
            }}
          />
        );
      })}

      {/* La linde de un lugar, aparte y más marcada que su relleno. Dentro del
          mismo `View` compartiría opacidad con la mancha y desaparecería, que
          es lo que convierte un parque en un borrón verde sin forma. */}
      {ordered.map((marker) => {
        if (!marker.radiusM || marker.tone === 'alert') return null;
        const { x, y } = project(marker);
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
        const { x, y } = project(marker);
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
        const anchor = project(marker);
        const offset = offsets.get(marker.id) ?? { dx: 0, dy: 0 };
        const x = anchor.x + offset.dx;
        const y = anchor.y + offset.dy;
        // Lo que cae fuera del cuadro no se dibuja pegado al borde: pintarlo ahí
        // diría que está justo en el límite, y no es verdad.
        if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return null;
        const selected = marker.id === selectedId;
        const color = toneColor(marker.tone);
        const dot = selected ? 34 : 28;

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
              // El área táctil son 44; el punto visible, 28. El resto es margen
              // invisible para que se pueda acertar con el dedo.
              left: x - 22,
              top: y - 22,
              width: 44,
              alignItems: 'center',
            }}
          >
            <View style={{ height: 44, justifyContent: 'center' }}>
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
            </View>

            {/* El nombre debajo del punto, solo en el que está elegido. En
                todos a la vez sería una alfombra de texto solapado; en ninguno,
                un mapa de puntos de colores que hay que ir tocando a ciegas. */}
            {selected ? (
              <View
                pointerEvents="none"
                style={{
                  maxWidth: 132,
                  marginTop: -2,
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
                    fontSize: 11,
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
          top: theme.space[3],
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
