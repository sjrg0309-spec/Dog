/**
 * Uno o dos retratos, montados.
 *
 * Existe porque una lista de conversaciones sin caras se lee como una bandeja
 * de notificaciones del sistema: iconos grises de categoría, todos iguales,
 * ninguno de nadie. Lo primero de cada fila en WhatsApp y en los directos de
 * Instagram es la cara de quien te escribe, y es lo que hace que la lista se
 * reconozca de un vistazo sin leer un nombre.
 *
 * Dos caras y no cuatro: una pila de cuatro a cincuenta píxeles es una mancha.
 * Con dos se distingue que es un grupo y se reconoce a alguien, que es todo lo
 * que un retrato de lista tiene que hacer.
 */

import { View } from 'react-native';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { Siren } from '@/lib/icons';
import type { Face } from '@/lib/messages';
import { useTheme } from '@/lib/theme';

export function FacePile({
  faces,
  size,
  alert = false,
}: {
  faces: readonly { id: string; name: string }[];
  size: number;
  /** Es un hilo de alerta: lleva la insignia roja en la esquina. */
  alert?: boolean;
}) {
  const theme = useTheme();
  const [first, second] = faces;

  if (!first) {
    return <View style={{ width: size, height: size }} />;
  }

  const small = Math.round(size * 0.62);

  return (
    <View style={{ width: size, height: size }}>
      <Avatar id={first.id} name={first.name} size={second ? size - small / 2 : size} />

      {second ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: theme.colors.background,
          }}
        >
          <Avatar id={second.id} name={second.name} size={small} />
        </View>
      ) : null}

      {alert ? (
        // La insignia de sirena, encima del retrato. El retrato dice de quién
        // es el hilo y la insignia de qué va: hacen falta las dos, porque una
        // cara sola no distingue «hemos quedado» de «se ha perdido».
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: Math.round(size * 0.5),
            height: Math.round(size * 0.5),
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.destructive,
            borderWidth: 2,
            borderColor: theme.colors.background,
          }}
        >
          <Icon icon={Siren} size="sm" color={theme.colors.destructiveForeground} decorative />
        </View>
      ) : null}
    </View>
  );
}
