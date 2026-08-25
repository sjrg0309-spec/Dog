/**
 * El retrato de una mascota.
 *
 * En una interfaz de feed la foto es el 70 % de la pantalla, y aquí no hay
 * ninguna: la semilla es de demostración y nadie ha subido nada. En vez de
 * meter fotos de archivo de perros que no son los de nadie —que es exactamente
 * cómo se ve una maqueta y no un producto—, se **dibuja** la cara del animal:
 * pelaje, orejas y collar salen de su identificador, así que siempre es el
 * mismo para el mismo animal y distinto entre vecinos.
 *
 * Antes era su inicial sobre un círculo de color. Funcionaba para distinguir y
 * no para nada más: una fila de letras pálidas es lo que hace que un feed se
 * vea apagado. El retrato ocupa el mismo sitio y sí se mira.
 *
 * El **anillo** es el elemento de marca de Petnav y aquí hace un trabajo
 * concreto: rodea a quien está fuera ahora mismo. Es la misma mecánica que una
 * historia, y no por parecerse a nada: el radar ya era eso, un círculo que
 * indica presencia en vivo y caduca solo.
 */

import { useMemo } from 'react';
import { View } from 'react-native';

import { SceneView } from './scene';
import { buildPortrait } from '@/lib/artwork';
import { useTheme } from '@/lib/theme';

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

  const ring = live ? 3 : 0;
  const inner = size - ring * 2 - (live ? 4 : 0);
  const portrait = useMemo(() => buildPortrait(id, inner), [id, inner]);

  return (
    <View
      // El retrato no aporta información por sí solo: quien lo lleva tiene
      // también su nombre escrito al lado.
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
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SceneView scene={portrait} width={inner} height={inner} />
      </View>
    </View>
  );
}
