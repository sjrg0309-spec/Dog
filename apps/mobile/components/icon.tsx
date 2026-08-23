/**
 * Envoltorio de icono.
 *
 * Existe para que ningún icono se dibuje sin decidir dos cosas que en la versión
 * anterior se decidían solas y mal:
 *
 *  1. **Si aporta significado o no.** Un icono decorativo se oculta al lector de
 *     pantalla porque su texto ya está al lado; uno que va solo necesita
 *     etiqueta. No hay tercera opción, y el tipo lo obliga.
 *  2. **Qué tamaño tiene respecto al texto.** Se deriva de la escala tipográfica
 *     en lugar de ser un número suelto, así que crece con ella.
 */

import { View } from 'react-native';

import type { LucideIcon } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

type Props = {
  icon: LucideIcon;
  /** Tamaño relativo al texto con el que convive. */
  size?: 'sm' | 'base' | 'lg' | 'xl';
  color?: string;
  strokeWidth?: number;
} & ({ label: string; decorative?: false } | { label?: never; decorative: true });

const SCALE = { sm: 16, base: 20, lg: 24, xl: 28 } as const;

export function Icon({ icon: Glyph, size = 'base', color, strokeWidth = 2, ...rest }: Props) {
  const theme = useTheme();
  const decorative = 'decorative' in rest && rest.decorative === true;

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : rest.label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      <Glyph size={SCALE[size]} color={color ?? theme.colors.foreground} strokeWidth={strokeWidth} />
    </View>
  );
}
