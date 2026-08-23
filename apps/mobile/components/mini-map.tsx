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
  detail: string;
  icon: LucideIcon;
  /** `alert` se pinta en rojo y siempre encima de todo lo demás. */
  tone: 'place' | 'water' | 'vet' | 'alert';
  /** Radio en metros a dibujar alrededor. Cero: sin círculo. */
  radiusM?: number;
};

const SIZE = 300;
const METERS_PER_DEGREE_LAT = 111_320;

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
}: {
  center: { lat: number; lng: number };
  markers: MapMarker[];
  /** Cuánto abarca el cuadro de lado a lado, en metros. */
  spanM: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const theme = useTheme();

  const project = useMemo(() => {
    const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180);
    const pxPerMeter = SIZE / spanM;

    return (point: { lat: number; lng: number }) => {
      const dxM = (point.lng - center.lng) * metersPerDegreeLng;
      // La latitud crece hacia el norte y la Y de la pantalla hacia abajo.
      const dyM = -(point.lat - center.lat) * METERS_PER_DEGREE_LAT;
      return { x: SIZE / 2 + dxM * pxPerMeter, y: SIZE / 2 + dyM * pxPerMeter, pxPerMeter };
    };
  }, [center.lat, center.lng, spanM]);

  const toneColor = (tone: MapMarker['tone']) =>
    tone === 'alert'
      ? theme.colors.destructive
      : tone === 'water'
        ? theme.colors.information
        : tone === 'vet'
          ? theme.colors.warning
          : theme.colors.primary;

  // Las alertas al final del array para que queden dibujadas encima.
  const ordered = [...markers].sort((a, b) => Number(a.tone === 'alert') - Number(b.tone === 'alert'));

  return (
    <View
      accessibilityLabel={`Esquema de la zona, ${spanM >= 1000 ? `${spanM / 1000} kilómetros` : `${spanM} metros`} de lado. ${markers.length} marcadores.`}
      style={{
        width: SIZE,
        height: SIZE,
        alignSelf: 'center',
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceSunken,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      {/* Retícula: da escala sin fingir que son calles. */}
      {[0.25, 0.5, 0.75].map((fraction) => (
        <View
          key={`h${fraction}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: SIZE * fraction,
            height: 1,
            backgroundColor: theme.colors.border,
            opacity: 0.6,
          }}
        />
      ))}
      {[0.25, 0.5, 0.75].map((fraction) => (
        <View
          key={`v${fraction}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: SIZE * fraction,
            width: 1,
            backgroundColor: theme.colors.border,
            opacity: 0.6,
          }}
        />
      ))}

      {/* Los círculos primero, debajo de todos los marcadores. */}
      {ordered.map((marker) => {
        if (!marker.radiusM) return null;
        const { x, y, pxPerMeter } = project(marker);
        const r = marker.radiusM * pxPerMeter;
        // Un círculo más grande que el cuadro no se dibuja.
        //
        // Se veía en la primera captura: la alerta de petardos tiene 7 km de
        // radio y el cuadro abarcaba 4, así que el disco tapaba la pantalla
        // entera de rosa. Un color que lo cubre todo no informa de nada —deja
        // de haber dentro y fuera— y además esconde los demás marcadores.
        // Cuando pasa, queda el marcador y el aviso de abajo dice que hay que
        // alejar el cuadro para ver el alcance.
        if (r > SIZE * 0.9) return null;
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
              borderWidth: marker.tone === 'alert' ? 2 : 1,
              borderColor: toneColor(marker.tone),
              backgroundColor: toneColor(marker.tone),
              opacity: marker.tone === 'alert' ? 0.16 : 0.1,
            }}
          />
        );
      })}

      {ordered.map((marker) => {
        const { x, y } = project(marker);
        // Lo que cae fuera del cuadro no se dibuja pegado al borde: pintarlo ahí
        // diría que está justo en el límite, y no es verdad.
        if (x < -20 || x > SIZE + 20 || y < -20 || y > SIZE + 20) return null;
        const selected = marker.id === selectedId;
        const color = toneColor(marker.tone);

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
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: selected ? 34 : 28,
                height: selected ? 34 : 28,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: color,
                borderWidth: selected ? 3 : 2,
                borderColor: theme.colors.background,
              }}
            >
              <Icon icon={marker.icon} size="sm" color={theme.colors.background} decorative />
            </View>
          </Pressable>
        );
      })}

      {/* Dónde estás. Un aro, no un punto relleno: no es un marcador más. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: SIZE / 2 - 9,
          top: SIZE / 2 - 9,
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 3,
          borderColor: theme.colors.foreground,
          backgroundColor: theme.colors.background,
        }}
      />

      {/* Escala. Sin esto el esquema no dice nada: un punto a media pantalla
          podría estar a cien metros o a diez kilómetros. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: theme.space[2],
          bottom: theme.space[2],
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[1],
        }}
      >
        <View
          style={{
            width: SIZE / 4,
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
          {spanM / 4 >= 1000
            ? `${(spanM / 4000).toFixed(1).replace('.', ',')} km`
            : `${Math.round(spanM / 4)} m`}
        </Text>
      </View>

      {/* Norte arriba, porque el esquema no rota. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', right: theme.space[2], top: theme.space[2] }}
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
    </View>
  );
}
