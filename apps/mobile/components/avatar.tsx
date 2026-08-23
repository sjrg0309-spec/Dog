/**
 * El retrato de una mascota.
 *
 * En una interfaz de feed la foto es el 70 % de la pantalla, y aquí no hay
 * ninguna: la semilla es de demostración y nadie ha subido nada. En vez de
 * meter fotos de stock de perros que no son los de nadie —que es exactamente
 * cómo se ve una maqueta y no un producto—, se dibuja un retrato derivado del
 * propio animal: su inicial sobre un fondo que sale de su identificador, así
 * que siempre es el mismo para el mismo animal y distinto entre vecinos.
 *
 * Llevaba también un glifo de la especie debajo de la inicial. Se quitó al
 * verlo: a 44 px de avatar el glifo salía a 7, y un adorno que no se puede leer
 * es ruido. La especie ya está escrita en la tarjeta, que es donde se lee.
 *
 * El **anillo** es el elemento de marca de Coincide y aquí hace un trabajo
 * concreto: rodea a quien está fuera ahora mismo. Es la misma mecánica que una
 * historia, y no por parecerse a nada: el radar ya era eso, un círculo que
 * indica presencia en vivo y caduca solo.
 */

import { Text, View } from 'react-native';

import { fonts } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

/**
 * Un número estable a partir del identificador.
 *
 * Determinista a propósito: si el fondo cambiara entre recargas, el retrato
 * dejaría de servir para reconocer a nadie, que es lo único que hace.
 */
function hashOf(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function Avatar({
  id,
  name,
  size = 56,
  live = false,
}: {
  id: string;
  name: string;
  size?: number;
  /** Está fuera ahora mismo: lleva anillo. */
  live?: boolean;
}) {
  const theme = useTheme();

  // Cuatro fondos del propio sistema, no colores inventados para esto.
  const palette = [
    theme.colors.accent,
    theme.colors.successSurface,
    theme.colors.informationSurface,
    theme.colors.muted,
  ];
  const foregrounds = [
    theme.colors.accentForeground,
    theme.colors.success,
    theme.colors.information,
    theme.colors.mutedForeground,
  ];

  const index = hashOf(id) % palette.length;
  const ring = live ? 3 : 0;
  const inner = size - ring * 2 - (live ? 4 : 0);

  return (
    <View
      // El anillo no aporta información por sí solo: quien lo lleva tiene
      // también la etiqueta «Fuera ahora» escrita debajo o al lado.
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring,
        borderColor: live ? theme.colors.liveRing : 'transparent',
        backgroundColor: live ? theme.colors.background : 'transparent',
      }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: palette[index],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: foregrounds[index],
            fontFamily: fonts.displayExtrabold,
            fontSize: inner * 0.4,
            lineHeight: inner * 0.48,
          }}
        >
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}
