/**
 * El anillo de una historia.
 *
 * Es el patrón que Instagram hizo universal y que aquí ya existía por otro
 * camino: el radar de Petnav era desde el primer día un círculo que indica
 * presencia en vivo y caduca solo. Lo que se toma prestado es la **gramática**,
 * no la marca:
 *
 *  - **Sin ver → degradado.** Dos paradas de la propia paleta, terracota a
 *    ámbar. No el degradado de nadie más: además de ser suyo, sus rosas y
 *    morados no pasan los tests de contraste de este sistema.
 *  - **Ya visto → aro liso y apagado.** La diferencia entre visto y sin ver es
 *    lo único que hace útil una fila de historias; sin ella son adornos.
 *  - **Hueco entre el aro y el retrato.** Sin ese respiro el anillo se lee como
 *    un borde del avatar y deja de significar nada.
 *
 * El anillo nunca va solo: quien lo lleva tiene su rótulo debajo y, en el caso
 * de estar fuera ahora, la etiqueta escrita. El color no informa por sí mismo.
 */

import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/lib/theme';

export function StoryRing({
  size,
  state,
  children,
}: {
  /** Diámetro del retrato de dentro. El anillo crece hacia fuera. */
  size: number;
  state: 'unseen' | 'seen' | 'none';
  children: ReactNode;
}) {
  const theme = useTheme();

  const ring = 3;
  const gap = 3;
  const outer = size + (ring + gap) * 2;

  if (state === 'none') {
    return <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
  }

  const inner = (
    <View
      style={{
        width: size + gap * 2,
        height: size + gap * 2,
        borderRadius: (size + gap * 2) / 2,
        // El hueco se pinta con el fondo de la pantalla, no con blanco fijo: en
        // tema oscuro un aro blanco alrededor de cada retrato es un foco de luz
        // en mitad de la lista.
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );

  if (state === 'seen') {
    return (
      <View
        style={{
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: ring,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {inner}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[theme.colors.liveRing, theme.colors.warning]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{
        width: outer,
        height: outer,
        borderRadius: outer / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {inner}
    </LinearGradient>
  );
}
