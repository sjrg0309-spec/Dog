/**
 * El ☰ del perfil.
 *
 * Instagram tiene **dos capas** ahí y merece la pena copiar las dos, porque la
 * separación es lo que hace que la de arriba sea rápida: el ☰ abre una lista
 * corta de atajos —lo que se toca a menudo— y **Configuración** es una pantalla
 * aparte, con buscador, para lo que se toca una vez.
 *
 * Cinco filas y ni una más. La tentación es meter aquí todo lo que hay en
 * ajustes, y entonces esto deja de ser un atajo y pasa a ser el índice de
 * ajustes con menos sitio.
 *
 * Se cierra con el gesto de cada plataforma —atrás en Android, Escape en la
 * web— por el mismo `useBackDismiss` que cierra el buscador del mapa: lo último
 * que se abre es lo primero que se cierra, y una capa que no atiende a atrás
 * saca de la pestaña entera.
 */

import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from './icon';
import { Caption } from '@/components/ui';
import { useBackDismiss } from '@/lib/back';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Bell,
  Bookmark,
  Footprints,
  QrCode,
  Settings,
  type LucideIcon,
} from '@/lib/icons';
import { useTheme } from '@/lib/theme';

export function ProfileMenu({
  onClose,
  onSaved,
  onWalkMode,
}: {
  onClose: () => void;
  /** Guardados no es una pantalla: es una pestaña de este mismo perfil. */
  onSaved: () => void;
  onWalkMode: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();

  useBackDismiss(true, onClose);

  const rows: ReadonlyArray<{ icon: LucideIcon; label: string; go: () => void }> = [
    {
      icon: Settings,
      label: 'Configuración',
      go: () => router.push('/ajustes'),
    },
    { icon: Bell, label: 'Tu actividad', go: () => router.push('/actividad') },
    { icon: Bookmark, label: 'Guardados', go: onSaved },
    { icon: Footprints, label: 'Historial de paseos', go: () => router.push('/historial') },
    { icon: QrCode, label: 'Modo Paseo', go: onWalkMode },
  ];

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* El velo. Es un botón de verdad con su etiqueta: tocar fuera para
          cerrar es el gesto que hace todo el mundo, y un lector de pantalla
          tiene que poder hacerlo también. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar el menú"
        onPress={() => {
          haptics.tap();
          onClose();
        }}
        style={{ flex: 1, backgroundColor: theme.colors.overlay }}
      />

      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius['2xl'],
          borderTopRightRadius: theme.radius['2xl'],
          paddingBottom: theme.space[8],
          paddingTop: theme.space[3],
        }}
      >
        {/* El tirador. No hace nada y no está de adorno: es lo que dice que
            esto es una hoja que se va hacia abajo y no una pantalla nueva. */}
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.border,
            marginBottom: theme.space[2],
          }}
        />

        {rows.map((row) => (
          <Pressable
            key={row.label}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            onPress={() => {
              haptics.tap();
              onClose();
              row.go();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[4],
              minHeight: theme.touchTarget.comfortable,
              paddingHorizontal: theme.space[5],
              backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
            })}
          >
            <Icon icon={row.icon} size="lg" decorative />
            <Text
              style={{
                flex: 1,
                color: theme.colors.foreground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.base,
              }}
            >
              {row.label}
            </Text>
          </Pressable>
        ))}

        <View style={{ paddingHorizontal: theme.space[5], paddingTop: theme.space[3] }}>
          <Caption>
            Lo de aquí es tuyo y no lo ve nadie con quien quedes. Lo que se enseña es lo de arriba:
            el nombre, la raza y las fotos.
          </Caption>
        </View>
      </View>
    </View>
  );
}
