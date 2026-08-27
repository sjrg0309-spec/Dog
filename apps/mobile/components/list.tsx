/**
 * El vocabulario de listas, que es la mitad de la aplicación que no es una foto.
 *
 * El feed, el perfil y los reels ya se veían como se tienen que ver. Lo que no
 * casaba era todo lo demás —comunidad, quedadas, espacios, puntos de encuentro,
 * radar—, y no por el color ni por la letra, que salen del mismo sitio: casaba
 * mal por la **forma**. Aquellas pantallas se escribieron como un folleto
 * —antetítulo, titular, párrafo, y debajo una pila de tarjetas con borde
 * redondo separadas por aire— y una red social no se lee así. Se lee en filas
 * que llegan de un borde al otro, separadas por un pelo, con el retrato a la
 * izquierda, dos líneas de texto y la acción a la derecha.
 *
 * Las tres reglas que se siguen aquí, y que son las de Instagram:
 *
 *  1. **La fila ocupa el ancho.** Nada de tarjeta dentro de un margen dentro de
 *     otro margen. El contenido nace en el borde y lo que lo separa de la
 *     siguiente fila es una línea de un pelo, no veinte puntos de hueco.
 *  2. **El texto manda sobre el marco.** Nombre en negrita, segunda línea en
 *     gris y nada más. Los bordes, los fondos de color y los recuadros dentro
 *     del recuadro compiten con lo único que hay que leer.
 *  3. **La acción es una pastilla pequeña a la derecha.** Del alto de un dedo,
 *     no de una fila entera: un botón a lo ancho de la pantalla por cada
 *     elemento convierte una lista de ocho en ocho pantallas.
 *
 * Lo que **no** se ha tirado al hacer esto: las explicaciones. Esta aplicación
 * dice por qué hace lo que hace —por qué no aparece una quedada de otra
 * especie, por qué el pago no está dentro— y eso se queda. Lo que cambia es su
 * peso visual: baja a `FootNote`, gris y pequeña, debajo de la lista. Antes
 * eran párrafos del mismo tamaño que el contenido, y una lista con un ensayo
 * entre cada dos elementos no es una lista.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './icon';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { ChevronRight, type LucideIcon } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

/**
 * El margen lateral de todo lo que va en una lista.
 *
 * Vive aquí y no en cada pantalla porque el fallo que arregla es exactamente
 * ese: comunidad usaba veinte y el feed dieciséis, así que al
 * pasar de una pestaña a otra el texto daba un salto de cuatro puntos. Son los
 * mismos dieciséis del feed, que es la pantalla con la que se compara todo.
 */
export const LIST_GUTTER = 16;

/** El retrato de una fila. Es el que fija dónde empieza el texto. */
export const LIST_LEADING = 44;

/**
 * Dónde empieza la línea que separa dos filas.
 *
 * Bajo el texto y no bajo el retrato: es lo que hace que una lista se lea como
 * una columna de nombres y no como una rejilla. Si la línea cruzara entera, el
 * retrato quedaría encerrado en su celda.
 */
export const LIST_SEPARATOR_INSET = LIST_GUTTER + LIST_LEADING + 12;

/**
 * Cabecera de sección.
 *
 * El antetítulo en versalitas —«PARA TUTORES DE PERRO»— se ha ido de todas
 * partes. Decía la categoría de lo que venía debajo, que es información que ya
 * da el propio contenido, y ocupaba una línea entera en mayúsculas: el recurso
 * de una revista, no el de una lista que se recorre con el pulgar.
 *
 * Lo que queda es el nombre de la sección en negrita y, si hace falta, una
 * salida a la derecha en el color de acción. Es la fila de «Sugerencias para ti
 * · Ver todo».
 */
export function SectionHeader({
  title,
  action,
  first = false,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  /** Es la primera de la pantalla: no necesita el aire que la separa de la anterior. */
  first?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space[3],
        paddingHorizontal: LIST_GUTTER,
        paddingTop: first ? theme.space[2] : theme.space[6],
        paddingBottom: theme.space[2],
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.displayBold,
          fontSize: theme.fontSize.base,
        }}
      >
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => {
            haptics.tap();
            action.onPress();
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.sm,
            }}
          >
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Una fila de lista: retrato, dos líneas y una acción.
 *
 * Es el elemento con el que se dibujan ahora los tutores de una comunidad, los
 * servicios del directorio, las quedadas, los espacios y quien está fuera en el
 * radar. Los cinco eran cinco tarjetas distintas escritas por separado, y se
 * notaba: el mismo dato —a cuánto está— aparecía en tres tamaños de letra
 * distintos según la pantalla.
 *
 * `leading` es cualquier cosa de 44 × 44: un `Avatar`, una miniatura, un icono
 * dentro de un círculo. `trailing` es la pastilla, la flecha o nada.
 */
export function ListRow({
  leading,
  title,
  titleBadge,
  subtitle,
  detail,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  chevron = false,
}: {
  leading?: ReactNode;
  title: string;
  /** Insignia pegada al nombre: verificado, la especie, «ya vais». */
  titleBadge?: ReactNode;
  subtitle?: string;
  /** Tercera línea, para lo que es dato y no descripción. Se usa poco a propósito. */
  detail?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** La flecha de «esto lleva a otra pantalla». Nunca junto a una pastilla. */
  chevron?: boolean;
}) {
  const theme = useTheme();

  const body = (
    <>
      {leading ? (
        <View style={{ width: LIST_LEADING, alignItems: 'center' }}>{leading}</View>
      ) : null}

      <View style={{ flex: 1, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1.5] }}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              color: theme.colors.foreground,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.sm,
            }}
          >
            {title}
          </Text>
          {titleBadge}
        </View>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
              lineHeight: theme.fontSize.sm * 1.35,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
        {detail ? (
          <Text
            /* Una línea y no dos: es la tercera de la fila, y a la tercera
               línea que se parte se le ha ido el tamaño a la fila entera. */
            numberOfLines={1}
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.xs,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>

      {trailing}
      {chevron && !trailing ? (
        <Icon icon={ChevronRight} size="base" color={theme.colors.mutedForeground} decorative />
      ) : null}
    </>
  );

  const layout = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    paddingHorizontal: LIST_GUTTER,
    paddingVertical: theme.space[2],
    minHeight: theme.touchTarget.comfortable + 8,
  } as const;

  if (!onPress) return <View style={layout}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join('. ')}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        ...layout,
        backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
      })}
    >
      {body}
    </Pressable>
  );
}

/**
 * La pastilla de acción de una fila.
 *
 * Es el «Seguir» / «Siguiendo»: azul relleno cuando es lo que se espera que
 * hagas, gris relleno cuando ya está hecho o es secundario. **Sin borde en
 * ninguno de los dos casos** —el contorno es de un formulario— y sin ocupar el
 * ancho de la fila.
 *
 * El `Button` general de la aplicación sigue existiendo y sigue siendo el
 * correcto para lo que es la acción principal de una pantalla entera. Este es
 * para cuando hay ocho en la misma columna.
 */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'neutral';
  icon?: LucideIcon;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const theme = useTheme();

  const primary = variant === 'primary';
  const fg = primary ? theme.colors.primaryForeground : theme.colors.foreground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled || !onPress}
      /* La pastilla se dibuja de 34 y **se toca en 44**, que es la salida que
         da la propia guía para un control que tiene que verse pequeño: un chip
         de Material mide 32 de alto y amplía su área. Sin esto, una fila con
         retrato y dos líneas de texto no cabría en la pantalla junto a un botón
         de 44 sin partir el nombre en dos renglones. */
      hitSlop={5}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space[1.5],
        /* 34 y no 44: es una acción dentro de una fila que ya es pulsable
           entera, así que el suelo táctil lo pone la fila. Una pastilla de 44
           dentro de una fila de 56 no deja sitio para la segunda línea. */
        minHeight: 34,
        paddingHorizontal: theme.space[3],
        borderRadius: theme.radius.md,
        backgroundColor: primary ? theme.colors.primary : theme.colors.surfaceSunken,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Icon icon={icon} size="sm" color={fg} decorative /> : null}
      <Text
        numberOfLines={1}
        style={{ color: fg, fontFamily: fonts.bodyBold, fontSize: theme.fontSize.sm }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Un círculo con un icono dentro, del tamaño de un retrato.
 *
 * Para las filas que no son de nadie: un veterinario, un parque, una papelera.
 * Ocupa exactamente lo que ocupa el `Avatar` para que el texto de una lista
 * mixta empiece en la misma columna, que es lo que se rompía cuando cada
 * pantalla se inventaba su propio icono suelto de dieciséis puntos.
 */
export function IconCircle({
  icon,
  tone = 'muted',
  size = LIST_LEADING,
}: {
  icon: LucideIcon;
  tone?: 'muted' | 'primary' | 'live' | 'alert';
  size?: number;
}) {
  const theme = useTheme();

  const palette = {
    muted: { bg: theme.colors.surfaceSunken, fg: theme.colors.mutedForeground },
    primary: { bg: theme.colors.accent, fg: theme.colors.accentForeground },
    live: { bg: theme.colors.liveSurface, fg: theme.colors.liveForeground },
    alert: { bg: theme.colors.warningSurface, fg: theme.colors.warning },
  }[tone];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.bg,
      }}
    >
      <Icon icon={icon} size="lg" color={palette.fg} decorative />
    </View>
  );
}

/**
 * Estado vacío.
 *
 * En esta aplicación no son una excepción que haya que disimular: empezar en un
 * barrio donde no hay nadie **es** el primer día de todo el mundo. Lo que
 * cambia es cómo se dicen. Eran un recuadro gris con borde a lo ancho de la
 * pantalla —el aviso de un formulario—, y ahora son lo que enseña Instagram
 * cuando no tienes nada: centrado, con un icono grande en un círculo fino, un
 * titular corto y una frase debajo.
 *
 * La acción es opcional y va de última: un vacío que solo se pueda mirar es un
 * callejón sin salida, y uno con tres botones ya no es un vacío.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.space[3],
        paddingHorizontal: theme.space[8],
        paddingVertical: theme.space[10],
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: theme.colors.borderStrong,
        }}
      >
        <Icon icon={icon} size="xl" color={theme.colors.foreground} decorative />
      </View>

      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.displayBold,
          fontSize: theme.fontSize.xl,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>

      {body ? (
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
            lineHeight: theme.fontSize.sm * 1.45,
            textAlign: 'center',
          }}
        >
          {body}
        </Text>
      ) : null}

      {action ? (
        <View style={{ paddingTop: theme.space[1] }}>
          <PillButton label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * La letra pequeña de una lista.
 *
 * Aquí es donde han bajado las explicaciones que antes iban a cuerpo de texto
 * entre elemento y elemento: por qué no salen las quedadas de otra especie, por
 * qué el pago se acuerda fuera, quién ve la lista de miembros. Siguen estando
 * —esta aplicación explica lo que hace— y ya no interrumpen la columna.
 */
export function FootNote({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={{
        paddingHorizontal: LIST_GUTTER,
        paddingTop: theme.space[3],
        paddingBottom: theme.space[1],
      }}
    >
      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.xs,
          lineHeight: theme.fontSize.xs * 1.5,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * La línea entre dos filas, con la sangría puesta.
 *
 * `Separator` de `chrome` sigue siendo la línea genérica; esta sabe dónde
 * empieza el texto de una `ListRow` y se alinea con él sola, que es lo que
 * cada pantalla estaba calculando a mano —y con números distintos.
 */
export function RowSeparator({ full = false }: { full?: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginLeft: full ? 0 : LIST_SEPARATOR_INSET,
      }}
    />
  );
}
