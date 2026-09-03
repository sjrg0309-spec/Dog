/**
 * El chip de presencia: un solo control para «estamos fuera», desde cualquier
 * pantalla.
 *
 * El check-in vivía en el radar y solo se veía en el radar. Desde el inicio o
 * el mapa no había forma de saber si seguías fuera, y menos de apagarlo: una
 * presencia que se publica a dos kilómetros de vecinos y que solo se puede
 * revisar desde una pestaña es una presencia que se olvida. Este chip es la
 * pieza que va en las cabeceras y lee el mismo almacén que el radar, así que
 * dice lo mismo en todas partes.
 *
 * Tres estados y ninguno más, en el orden en que se comprueban:
 *
 *  1. **Fuera ahora**: el retrato del animal con su anillo de en vivo, el
 *     pulso —el único movimiento continuo de la aplicación, que aquí sigue
 *     significando lo mismo— y cuánto queda. Se apaga solo; el rótulo lo dice.
 *  2. **Invisible**: el modo fantasma está puesto. Se dice, no se esconde: un
 *     interruptor de privacidad tiene que verse encendido desde donde se mira.
 *  3. **Salir ahora**: la invitación.
 *
 * Los tres llevan al radar, que es donde están los botones de verdad: elegir
 * duración, avisar a alguien, cerrar. El chip no decide nada por su cuenta,
 * y por eso no hace check-in con un toque —salir tiene una duración que hay
 * que elegir y un veto de bienestar que hay que ver—.
 *
 * Y no existe para quien no puede hacer check-in: una protectora no tiene
 * animal propio que sacar, y un botón que lleva a una pantalla que va a decir
 * que no es peor que ningún botón.
 */

import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { Press, Pulse } from './motion';
import { useCan } from '@/lib/account';
import { useActivePet } from '@/lib/active-pet';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { EyeOff, PawPrint, type LucideIcon } from '@/lib/icons';
import { remainingMinutes, useGhostMode, useLivePresence } from '@/lib/presence';
import { useTheme } from '@/lib/theme';

export function PresenceChip({ compact }: { compact?: boolean }) {
  const theme = useTheme();
  const router = useRouter();
  const pet = useActivePet();
  const allowed = useCan('check_in');
  const ghost = useGhostMode();
  /* El tic del almacén repinta cada treinta segundos mientras hay sesión, así
     que el «42 min» de abajo se calcula en el render y baja solo. */
  const session = useLivePresence();

  if (!allowed) return null;

  const minutes = session ? remainingMinutes(session.until) : 0;

  const state: {
    label: string;
    a11yLabel: string;
    hint: string;
    icon: LucideIcon | null;
    background: string;
    foreground: string;
  } = session
    ? {
        label: `${minutes} min`,
        a11yLabel: `Estás fuera en ${session.placeName}, se apaga en ${minutes} min`,
        hint: 'Abrir el radar para ver quién está fuera o terminar',
        icon: null,
        background: theme.colors.liveSurface,
        foreground: theme.colors.liveForeground,
      }
    : ghost
      ? {
          label: 'Invisible',
          a11yLabel: 'Estás invisible, modo fantasma puesto',
          hint: 'Abrir el radar para volver a aparecer',
          icon: EyeOff,
          background: theme.colors.surfaceSunken,
          foreground: theme.colors.mutedForeground,
        }
      : {
          label: 'Salir ahora',
          a11yLabel: 'Salir ahora',
          hint: `Hacer visible a ${pet.name} durante un rato; se apaga solo`,
          icon: PawPrint,
          background: theme.colors.surfaceSunken,
          foreground: theme.colors.foreground,
        };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={state.a11yLabel}
      accessibilityHint={state.hint}
      /* Mide treinta y dos, como un chip de Material, y **se toca en cuarenta
         y cuatro** con `hitSlop`: es la salida que da la propia guía para un
         control que tiene que verse pequeño. Los números van escritos y no en
         una constante a propósito: `interface-rules.test.ts` los lee de aquí,
         y un chip que se salta la regla escondiendo el número en una constante
         no la cumple, la esquiva. */
      hitSlop={6}
      onPress={() => {
        haptics.tap();
        router.push('/radar');
      }}
      style={
        compact
          ? { height: 32, width: 32, alignItems: 'center', justifyContent: 'center' }
          : { height: 32, justifyContent: 'center' }
      }
    >
      {({ pressed }) => (
        <Press pressed={pressed} scale={0.94}>
          <View
            style={{
              height: 32,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[2],
              /* Compacto es solo el retrato o el icono, redondo: en una
                 cabecera de cristal no cabe un rótulo y el color del anillo ya
                 dice lo que hace falta. Con rótulo, es una píldora. */
              paddingHorizontal: compact ? 0 : theme.space[3],
              width: compact ? 32 : undefined,
              justifyContent: 'center',
              borderRadius: theme.radius.full,
              backgroundColor: state.background,
            }}
          >
            {session ? (
              <View>
                <Avatar id={pet.id} name={pet.name} size={28} live />
                {/* El punto que late. Es el pulso de siempre —el único
                    movimiento continuo— sobre un punto, no sobre el retrato:
                    a veintiocho píxeles un retrato que respira se lee como
                    que tiembla. */}
                <Pulse
                  active
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: theme.colors.liveRing,
                    borderWidth: 2,
                    borderColor: state.background,
                  }}
                >
                  <View />
                </Pulse>
              </View>
            ) : state.icon ? (
              <Icon icon={state.icon} size="sm" color={state.foreground} decorative />
            ) : null}

            {compact ? null : (
              <Text
                numberOfLines={1}
                style={{
                  color: state.foreground,
                  fontFamily: session ? fonts.bodyBold : fonts.body,
                  fontSize: theme.fontSize.xs,
                  fontVariant: session ? ['tabular-nums'] : undefined,
                }}
              >
                {state.label}
              </Text>
            )}
          </View>
        </Press>
      )}
    </Pressable>
  );
}
