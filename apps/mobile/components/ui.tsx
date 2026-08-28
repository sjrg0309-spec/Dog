/**
 * Componentes base de la aplicación móvil.
 *
 * Son propios y no compartidos con la web a propósito: Tailwind y shadcn/ui no
 * corren en React Native. Lo que sí se comparte son los tokens, así que el color
 * y el espaciado de estos componentes salen del mismo sitio que los de la web.
 */

import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';
import { Press } from './motion';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import type { LucideIcon } from '@/lib/icons';
import { useRelief } from '@/lib/relieve';
import { useGroupedSurfaces, useTheme } from '@/lib/theme';

/**
 * El marco de una pantalla, con las zonas seguras puestas.
 *
 * Esto era un `View` con `flex: 1` y nada más, y era el fallo de adaptación más
 * gordo que tenía la aplicación: en un teléfono con muesca o isla dinámica el
 * contenido **nacía debajo del reloj**. En el navegador no se veía —no hay
 * barra de estado que esquivar—, así que todas las capturas salían bien y el
 * problema solo aparecía en el aparato de verdad.
 *
 * Qué lados y por qué cada uno:
 *
 *  - **Arriba, siempre.** Es la barra de estado, la muesca y la isla dinámica.
 *  - **Los costados, siempre.** En horizontal la muesca se pone de lado y se
 *    come una franja entera; en vertical estos valores son cero y no estorban.
 *  - **Abajo, solo si se pide.** Las pantallas con barra de pestañas no lo
 *    quieren: la barra ya reserva el indicador de inicio por su cuenta, y
 *    sumarlo dos veces deja un hueco muerto de treinta y cuatro puntos. Las que
 *    van sin barra —una hoja, un chat— lo piden con `bottom`.
 *
 * `full` es para lo que de verdad ocupa la pantalla entera y pinta por debajo
 * de todo: el visor de estados y los reels. Ahí el contenido es la imagen, y
 * apartarla de los bordes sería enmarcar un vídeo a pantalla completa.
 */
export function Screen({
  children,
  bottom = false,
  full = false,
  grouped = false,
}: {
  children: ReactNode;
  /** Reservar también el indicador de inicio. Para pantallas sin barra. */
  bottom?: boolean;
  /** A pantalla completa, sin apartar nada. Para el visor y los reels. */
  full?: boolean;
  /**
   * Pantalla de listas agrupadas: el fondo se hunde para que las tarjetas se
   * levanten sobre él.
   *
   * Es la mitad del efecto —la otra la pone `ListGroup`— y por eso el par sale
   * del mismo sitio, `useGroupedSurfaces`. Pintar aquí un `surfaceSunken` a
   * mano funcionaría en claro y dejaría las tarjetas invisibles en «Nocturno»,
   * donde la superficie y el fondo son el mismo negro.
   */
  grouped?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { ground } = useGroupedSurfaces();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: grouped ? ground : theme.colors.background,
        paddingTop: full ? 0 : insets.top,
        paddingLeft: full ? 0 : insets.left,
        paddingRight: full ? 0 : insets.right,
        paddingBottom: bottom && !full ? insets.bottom : 0,
      }}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: theme.colors.foreground,
        fontSize: theme.fontSize['3xl'],
        fontFamily: fonts.displayExtrabold,
        letterSpacing: -0.5,
        lineHeight: theme.fontSize['3xl'] * 1.1,
      }}
    >
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: theme.colors.foreground,
        fontSize: theme.fontSize.xl,
        fontFamily: fonts.displayBold,
      }}
    >
      {children}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: muted ? theme.colors.mutedForeground : theme.colors.foreground,
        fontSize: theme.fontSize.base,
        fontFamily: fonts.body,
        lineHeight: theme.fontSize.base * 1.5,
      }}
    >
      {children}
    </Text>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.mutedForeground,
        fontSize: theme.fontSize.sm,
        fontFamily: fonts.body,
      }}
    >
      {children}
    </Text>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.mutedForeground,
        fontSize: theme.fontSize.xs,
        fontFamily: fonts.bodyBold,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  const relief = useRelief();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          /* En claro, el filete de un pelo; en oscuro sobra, porque ahí lo que
             separa la tarjeta del fondo es que está más clara. Es la misma
             regla que sigue `ListGroup`, y por eso las dos se ven del mismo
             material aunque una viva en el SOS y la otra en una lista. */
          borderWidth: relief.on ? 0 : theme.isDark ? 0 : StyleSheet.hairlineWidth,
          borderRadius: theme.radius['2xl'],
          padding: theme.space[5],
          gap: theme.space[3],
          shadowColor: '#000',
          shadowOpacity: relief.on || theme.isDark ? 0 : 0.05,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type BadgeTone = 'neutral' | 'accent' | 'live' | 'verified' | 'warning';

export function Badge({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  /**
   * Icono del estado, opcional.
   *
   * Antes esto se hacía metiendo un «✓» o un «×» dentro del texto de la
   * insignia. Además de descuadrar la línea base, obligaba al lector de pantalla
   * a leer el carácter, así que el estado se anunciaba como «por Verificado» o
   * cosas parecidas según la fuente. Como icono es decorativo y la palabra que
   * va al lado ya dice de qué estado se trata.
   */
  icon?: LucideIcon;
}) {
  const theme = useTheme();

  const palette: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.muted, fg: theme.colors.mutedForeground },
    accent: { bg: theme.colors.accent, fg: theme.colors.accentForeground },
    live: { bg: theme.colors.liveSurface, fg: theme.colors.liveForeground },
    verified: { bg: theme.colors.successSurface, fg: theme.colors.success },
    warning: { bg: theme.colors.warningSurface, fg: theme.colors.warning },
  };

  const { bg, fg } = palette[tone];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[1],
        backgroundColor: bg,
        borderRadius: theme.radius.full,
        paddingHorizontal: theme.space[2],
        paddingVertical: theme.space[0.5],
      }}
    >
      {icon ? <Icon icon={icon} size="sm" color={fg} decorative /> : null}
      <Text style={{ color: fg, fontSize: theme.fontSize.xs, fontFamily: fonts.bodyBold }}>
        {children}
      </Text>
    </View>
  );
}

export function Row({ children, gap = 2 }: { children: ReactNode; gap?: 1 | 2 | 3 }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.space[gap],
      }}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  accessibilityHint,
  icon,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'live';
  accessibilityHint?: string;
  icon?: LucideIcon;
  /** Deshabilitado con motivo: quien lo pone debería poder explicarlo al lado. */
  disabled?: boolean;
  /**
   * En curso.
   *
   * Ocupa el mismo sitio que el estado normal a propósito: sustituir la etiqueta
   * por un indicador haría saltar el botón de tamaño y moverse todo lo de abajo
   * justo cuando el usuario acaba de tocarlo.
   */
  loading?: boolean;
}) {
  const theme = useTheme();
  const relief = useRelief();

  const styles = {
    primary: {
      bg: theme.colors.primary,
      fg: theme.colors.primaryForeground,
      border: 'transparent',
    },
    outline: {
      bg: 'transparent',
      fg: theme.colors.foreground,
      border: theme.colors.borderStrong,
    },
    live: {
      bg: theme.colors.liveRing,
      fg: theme.colors.background,
      border: 'transparent',
    },
  } as const;

  const style = styles[variant];
  const inert = disabled || loading;

  // El foco se lleva aparte porque el estado que expone `Pressable` no lo
  // incluye en esta versión. En web —donde vive el teclado— `onFocus` sí llega.
  const [focused, setFocused] = useState(false);
  /* Y el dedo también, por el mismo motivo: lo que se encoge es el botón
     entero con su fondo, así que la escala vive fuera del `Pressable` y no
     puede leer su estado desde dentro. */
  const [down, setDown] = useState(false);

  return (
    <Press pressed={down && !inert}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        // Se anuncia el estado además de pintarlo: un botón atenuado que el lector
        // de pantalla presenta como pulsable es una trampa.
        accessibilityState={{ disabled: inert, busy: loading }}
        disabled={inert}
        onPress={onPress}
        onPressIn={() => setDown(true)}
        onPressOut={() => setDown(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={({ pressed }) => [
          {
            // 44 es el suelo del área táctil, no el objetivo.
            minHeight: theme.touchTarget.min,
            flexDirection: 'row',
            gap: theme.space[2],
            /* Antes eran 20 a cada lado. En un botón ancho no se notaba; en dos
               botones que comparten una fila de 390 puntos, esos 40 puntos son
               la diferencia entre «Lo he visto» en una línea y en dos. Se vio
               en la captura de la ficha de una alerta, con cuatro acciones en
               rejilla. */
            paddingHorizontal: theme.space[3],
            borderRadius: theme.radius.md,
            /* El filete del botón «outline» desaparece con relieve: ahí el
               botón secundario no es un contorno, es una pieza del mismo gris
               que sobresale. El del foco se queda, porque eso no es estilo. */
            borderWidth: relief.on && !focused ? 0 : 1,
            borderColor: focused ? theme.colors.focusRing : style.border,
            backgroundColor: style.bg,
            alignItems: 'center',
            justifyContent: 'center',
            // El foco se ve, y se ve por algo más que el color del borde: en web
            // esta es la única pista que tiene quien navega con teclado.
            outlineColor: theme.colors.focusRing,
            outlineWidth: focused ? 3 : 0,
            outlineStyle: 'solid',
            outlineOffset: 2,
            opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          },
          /* El botón cede de verdad. Con las otras direcciones esto lo dice la
             opacidad y el muelle de `Press`; aquí lo dice además el material. */
          pressed && !inert ? relief.pressed('md') : relief.raised('md'),
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={style.fg} />
        ) : icon ? (
          <Icon icon={icon} size="base" color={style.fg} decorative />
        ) : null}
        <Text
          numberOfLines={1}
          style={{
            color: style.fg,
            fontSize: theme.fontSize.base,
            fontFamily: fonts.bodyBold,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Press>
  );
}

/**
 * Aviso informativo.
 *
 * Se usa sobre todo para los estados vacíos, que en esta aplicación son la
 * norma al empezar en un barrio y no una excepción que haya que disimular.
 */
export function Notice({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const relief = useRelief();
  return (
    <View
      style={[
        {
          /* Sin borde y con la esquina del resto de bloques. El recuadro con
             filete es el aviso de un formulario, y este componente se usa sobre
             todo para lo contrario: explicar por qué una lista está vacía. Lo
             que lo separa del fondo es el tono, no una raya alrededor. */
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radius['2xl'],
          padding: theme.space[4],
          gap: theme.space[2],
        },
        /* Hundido y no elevado, y la diferencia importa: un aviso no se toca.
           Con relieve, lo que sobresale invita a un dedo; lo que se hunde es
           una hendidura en la pantalla donde alguien ha escrito algo. */
        relief.pressed('sm'),
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Control segmentado.
 *
 * Dos o tres opciones excluyentes, todas visibles a la vez. Se usa para el
 * alternador del feed y para las capas del mapa, y en los dos sitios importa lo
 * mismo: **poder ver la otra opción sin tocarla**. Un desplegable escondería que
 * existe un feed de vecindario, que es justo lo que hace distinta a esta
 * aplicación de una red social cualquiera.
 *
 * Se anuncia como una lista de pestañas y no como botones sueltos, para que un
 * lector de pantalla diga «2 de 2» y no obligue a adivinar cuántas hay.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ id: T; label: string; hint?: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();
  const relief = useRelief();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: 'row',
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radius.full,
          padding: theme.space[0.5],
          gap: theme.space[0.5],
        },
        /* La pista es una ranura y la opción puesta, la pieza que va dentro.
           Es el control donde mejor se lee este estilo, porque el relieve dice
           lo mismo que dice el color: una de las dos está encima. */
        relief.pressed('sm'),
      ]}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            onPress={() => {
              if (selected) return;
              haptics.tap();
              onChange(option.id);
            }}
            style={({ pressed }) => [
              {
                flex: 1,
                minHeight: theme.touchTarget.min - 6,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: theme.radius.full,
                backgroundColor: selected ? theme.colors.surface : 'transparent',
                opacity: pressed ? 0.7 : 1,
              },
              selected ? relief.raised('sm') : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                color: selected ? theme.colors.foreground : theme.colors.mutedForeground,
                fontFamily: selected ? fonts.displayBold : fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Fila de datos: rótulo a la izquierda, valor a la derecha.
 *
 * Existe porque la ficha médica y la del espacio la repetían con estilos
 * ligeramente distintos cada una, y dos tablas que deberían leerse igual se
 * leían distinto.
 */
export function DataRow({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  /** `alert` para lo que está vencido o falta. */
  tone?: 'default' | 'alert';
}) {
  const theme = useTheme();
  const color = tone === 'alert' ? theme.colors.destructive : theme.colors.foreground;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: theme.touchTarget.min,
      }}
    >
      {icon ? (
        <Icon icon={icon} size="base" color={theme.colors.mutedForeground} decorative />
      ) : null}
      <Text
        style={{
          flex: 1,
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color,
          fontFamily: tone === 'alert' ? fonts.bodyBold : fonts.body,
          fontSize: theme.fontSize.sm,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}
