/**
 * El vocabulario de listas, que es la mitad de la aplicación que no es una foto.
 *
 * Esto llegó primero como filas a sangre separadas por un pelo —el patrón del
 * feed— y resolvió el problema que tenía delante: aquellas pantallas estaban
 * escritas como un folleto y no cabía nada. Lo que dejó a cambio fue una
 * interfaz **plana**: texto sobre el fondo, líneas de un pelo y poco más.
 * Correcta y sosa, sobre todo en las pantallas que son lista de arriba abajo.
 *
 * Ahora la forma es la de una aplicación de iOS moderna, que arregla eso sin
 * volver al folleto:
 *
 *  1. **Grupos, no filas sueltas.** Las filas van dentro de un bloque con las
 *     esquinas redondeadas, separado de los bordes y **sobre un fondo más
 *     hundido que él**. Es la lista agrupada de iOS, y hace dos cosas a la vez:
 *     dice qué filas van juntas —sin necesitar un titular por cada grupo— y
 *     despega el contenido del fondo, que es justo lo que le faltaba.
 *  2. **Color en el sitio pequeño.** Cada fila que no es de una persona lleva su
 *     ficha de icono: un cuadrado redondeado y teñido del tamaño de una uña. Es
 *     de donde sale el color de un iOS —un panel de ajustes es una columna de
 *     gris con treinta manchas de color— y cuesta treinta píxeles por fila.
 *  3. **La lista tiene fondo propio.** El bloque es `surface` en claro y
 *     `surfaceElevated` en oscuro, sobre `surfaceSunken` y `background`
 *     respectivamente. No es un capricho: en la dirección «Nocturno» la
 *     superficie **es** el fondo —los dos son negro puro—, así que una tarjeta
 *     pintada de `surface` sobre `background` sería invisible. Los dos pares
 *     salen de `useGroupedSurfaces`, no de cada pantalla.
 *
 * Lo que **no** cambia respecto a la versión plana: la fila sigue siendo retrato
 * o ficha, dos líneas de texto y la acción a la derecha; la acción sigue siendo
 * una pastilla y no un botón del ancho de la pantalla; y las explicaciones
 * siguen en `FootNote`, gris y pequeña, debajo del grupo — que es exactamente
 * donde iOS pone el pie de una sección.
 *
 * Y una cosa manda sobre todo esto: **la dirección visual**. Los radios salen de
 * `theme.radius`, así que «Papel» —que es de imprenta y tiene el filete recto—
 * conserva las esquinas casi cuadradas y «Señal» las tiene blandas. Un radio
 * escrito a mano aquí las aplanaría todas a una.
 */

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Icon } from './icon';
import { Appear, Press } from './motion';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { ChevronRight, type LucideIcon } from '@/lib/icons';
import { useRelief } from '@/lib/relieve';
import { useGroupedSurfaces, useTheme } from '@/lib/theme';

/**
 * El margen lateral de todo lo que va en una lista.
 *
 * Vive aquí y no en cada pantalla porque el fallo que arregla es exactamente
 * ese: comunidad usaba veinte y el feed dieciséis, así que al pasar de una
 * pestaña a otra el texto daba un salto de cuatro puntos. Son los mismos
 * dieciséis del feed, que es la pantalla con la que se compara todo.
 */
export const LIST_GUTTER = 16;

/** El retrato de una fila. Es el que fija dónde empieza el texto. */
export const LIST_LEADING = 44;

/** La ficha de icono: más pequeña que un retrato, porque no es una cara. */
export const TILE_SIZE = 30;

/** El relleno de dentro del grupo. Menor que el de fuera, como en iOS. */
const GROUP_PADDING = 14;

/** El hueco entre lo que va delante y el texto. */
const GAP = 12;

/**
 * Dónde empieza la línea que separa dos filas.
 *
 * Bajo el texto y no bajo el retrato: es lo que hace que una lista se lea como
 * una columna de nombres y no como una rejilla. Cambia con lo que la fila lleve
 * delante, y por eso son tres valores y no uno escrito a ojo.
 */
export const SEPARATOR_INSET = {
  avatar: GROUP_PADDING + LIST_LEADING + GAP,
  tile: GROUP_PADDING + TILE_SIZE + GAP,
  none: GROUP_PADDING,
} as const;

/** Qué lleva delante cada fila del grupo, que es lo que sangra la línea. */
type Leading = keyof typeof SEPARATOR_INSET;

const InGroup = createContext(false);

/**
 * Un grupo de filas: el bloque con esquinas de una lista de iOS.
 *
 * Las líneas entre filas las pone **el grupo**, no las filas, y esa es la razón
 * de que exista como componente en vez de ser un estilo copiado: cuando cada
 * pantalla las ponía a mano, la última fila se quedaba con su línea colgando
 * contra la esquina redondeada. Aquí no hay forma de que eso pase — se inserta
 * entre hijos, nunca detrás del último.
 *
 * Un solo hijo también vale, y entonces es una tarjeta: es lo que usan la ficha
 * de una quedada y la de un espacio.
 */
export function ListGroup({
  children,
  leading = 'tile',
  /** Sin sangrar la línea: para lo que trae su propio marco, como una galería. */
  flush = false,
}: {
  children: ReactNode;
  leading?: Leading;
  flush?: boolean;
}) {
  const theme = useTheme();
  const relief = useRelief();
  const { card } = useGroupedSurfaces();

  /* Los nulos se filtran antes de repartir las líneas: una fila condicional que
     no se pinta dejaba su separador puesto, y eso son dos líneas seguidas con
     nada en medio. */
  const items = Children.toArray(children).filter((child) => isValidElement(child));

  return (
    <InGroup.Provider value={true}>
      <View
        style={[
          {
            marginHorizontal: LIST_GUTTER,
            borderRadius: theme.radius['2xl'],
            backgroundColor: card,
            /* Recorta a las filas, no a la sombra: lo que una vista con
               `overflow` esconde son sus hijos, y el relieve se pinta por
               fuera del marco. */
            overflow: 'hidden',
            /* El borde de un pelo hace el trabajo en claro, donde la tarjeta
               blanca sobre gris casi no tiene contraste; en oscuro sobra,
               porque ahí lo que la separa es que está más clara que el fondo.
               Y con relieve sobra siempre: ahí la tarjeta **es** del color del
               fondo y quien la levanta es la luz, así que un filete alrededor
               sería el recorte del papel asomando por debajo del efecto. */
            borderWidth: relief.on ? 0 : theme.isDark ? 0 : StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            /* Una sombra corta y muy suave. No es una tarjeta de Material
               flotando dos centímetros: es el pelo de profundidad que despega
               la lista del fondo cuando los dos son casi del mismo gris. */
            shadowColor: '#000',
            shadowOpacity: relief.on || theme.isDark ? 0 : 0.05,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          },
          relief.raised('md'),
        ]}
      >
        {items.map((child, index) => (
          <View key={index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.border,
                  marginLeft: flush ? 0 : SEPARATOR_INSET[leading],
                }}
              />
            ) : null}
            {child}
          </View>
        ))}
      </View>
    </InGroup.Provider>
  );
}

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
        /* Cuatro puntos más que el margen del grupo: el rótulo de una sección
           de iOS no está a plomo con el borde de la tarjeta, va un poco dentro
           y por eso se lee como su cabecera y no como otra fila. */
        paddingHorizontal: LIST_GUTTER + 4,
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
 * Una fila de lista: lo que va delante, dos líneas y una acción.
 *
 * Es el elemento con el que se dibujan los tutores de una comunidad, los
 * servicios del directorio, quien está fuera en el radar y los ajustes. Eran
 * cinco tarjetas distintas escritas por separado, y se notaba: el mismo dato —a
 * cuánto está— aparecía en tres tamaños de letra distintos según la pantalla.
 *
 * `leading` es un `Avatar` de 44 o una `IconTile` de 30. `trailing` es la
 * pastilla, la flecha o nada. **Dentro de un `ListGroup` el relleno lateral es
 * el de dentro del grupo; suelta, se pone el margen de la pantalla** — así la
 * misma fila sirve en los dos sitios sin que ninguna pantalla la parchee.
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
  const grouped = useContext(InGroup);
  /* El estado del dedo vive aquí y no dentro del `Pressable`: lo que se encoge
     es la fila entera con su fondo, así que la animación tiene que envolverlo. */
  const [down, setDown] = useState(false);

  const body = (
    <>
      {leading}

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
        /* La flecha de iOS: fina, pequeña y del gris del texto secundario. A
           plena tinta parecía un botón de «siguiente» en vez de la marca de que
           la fila lleva a algún sitio. */
        <Icon
          icon={ChevronRight}
          size="base"
          strokeWidth={2.5}
          color={theme.colors.mutedForeground}
          decorative
        />
      ) : null}
    </>
  );

  const layout = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: grouped ? GROUP_PADDING : LIST_GUTTER,
    paddingVertical: theme.space[2],
    minHeight: theme.touchTarget.comfortable + 8,
  } as const;

  if (!onPress) return <View style={layout}>{body}</View>;

  return (
    /* La fila **cede** bajo el dedo, no solo se tiñe. El tinte es lo que hace
       una tabla; el muelle es lo que hace que se sienta un botón, y aquí es
       gratis: el estado ya se conocía para pintar el fondo. */
    <Press pressed={down}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join('. ')}
        accessibilityHint={accessibilityHint}
        onPressIn={() => setDown(true)}
        onPressOut={() => setDown(false)}
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
    </Press>
  );
}

/**
 * La pastilla de acción de una fila.
 *
 * Es el «Seguir» / «Siguiendo»: relleno con el color de acción cuando es lo que
 * se espera que hagas, gris relleno cuando ya está hecho o es secundario. **Sin
 * borde en ninguno de los dos casos** —el contorno es de un formulario— y sin
 * ocupar el ancho de la fila.
 *
 * El `Button` general de la aplicación sigue existiendo y sigue siendo el
 * correcto para la acción principal de una pantalla entera. Este es para cuando
 * hay ocho en la misma columna.
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
  const relief = useRelief();

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
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space[1.5],
          minHeight: 34,
          paddingHorizontal: theme.space[3],
          /* Redonda del todo, como los botones de una ficha de iOS. El radio
             medio la dejaba a medio camino entre una pastilla y un botón de
             formulario. */
          borderRadius: theme.radius.full,
          backgroundColor: primary ? theme.colors.primary : theme.colors.surfaceSunken,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        /* Con relieve el aviso de que se ha pulsado deja de ser una opacidad y
           pasa a ser la propia pastilla hundiéndose. Es el único gesto que el
           estilo trae de fábrica y sale gratis: el dedo aprieta, la pieza cede
           y vuelve. */
        pressed ? relief.pressed('sm') : relief.raised('sm'),
      ]}
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

/** Los tintes de una ficha de icono. Cada uno dice algo distinto. */
type TileTone = 'primary' | 'live' | 'alert' | 'ok' | 'info' | 'muted';

/**
 * La ficha de icono: un cuadrado redondeado y teñido.
 *
 * Es de donde sale el color de una aplicación de iOS. Un panel de ajustes es
 * una columna de gris con treinta manchas de color del tamaño de una uña, y sin
 * ellas la misma columna es una hoja de cálculo. Aquí hace además un trabajo
 * que el círculo gris de antes no hacía: **el tinte dice de qué va la fila** —el
 * rojo de urgencias, el naranja de «ahora mismo», el verde de lo verificado—
 * antes de leer una palabra.
 *
 * El icono va a plena tinta sobre el color, no en el color sobre un tinte
 * pálido: lo segundo se ve lavado a treinta píxeles, que es el tamaño real de
 * esto.
 */
export function IconTile({
  icon,
  tone = 'primary',
  size = TILE_SIZE,
}: {
  icon: LucideIcon;
  tone?: TileTone;
  size?: number;
}) {
  const theme = useTheme();
  const relief = useRelief();

  const palette: Record<TileTone, { fill: string; ink: string }> = {
    primary: { fill: theme.colors.primary, ink: theme.colors.primaryForeground },
    live: { fill: theme.colors.liveRing, ink: theme.colors.background },
    alert: { fill: theme.colors.destructive, ink: theme.colors.destructiveForeground },
    ok: { fill: theme.colors.success, ink: theme.colors.successForeground },
    info: { fill: theme.colors.information, ink: theme.colors.informationForeground },
    muted: { fill: theme.colors.mutedForeground, ink: theme.colors.background },
  };

  const { fill, ink } = palette[tone];

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          /* Cuadrado de esquina blanda y no círculo: el círculo es para las
             caras, y mezclar los dos en la misma columna hace que las personas
             y las cosas se lean igual. */
          borderRadius: theme.radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fill,
        },
        /* Sobresale aunque vaya teñida: en una columna de treinta fichas, un
           relieve pequeño es lo que las separa de una mancha impresa. */
        relief.raised('sm'),
      ]}
    >
      <Icon icon={icon} size="sm" color={ink} strokeWidth={2.4} decorative />
    </View>
  );
}

/**
 * Estado vacío.
 *
 * En esta aplicación no son una excepción que haya que disimular: empezar en un
 * barrio donde no hay nadie **es** el primer día de todo el mundo. Lo que cambia
 * es cómo se dicen. Eran un recuadro gris con borde a lo ancho de la pantalla
 * —el aviso de un formulario— y ahora son lo que enseña una aplicación de
 * teléfono cuando no tienes nada: centrado, con el icono en un disco teñido, un
 * titular corto y una frase debajo.
 *
 * La acción es opcional y va la última: un vacío que solo se pueda mirar es un
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
          width: 76,
          height: 76,
          borderRadius: 38,
          alignItems: 'center',
          justifyContent: 'center',
          /* Teñido y sin aro: el contorno fino sobre el fondo era justo el
             gesto que hacía que una pantalla vacía se viera más vacía. */
          backgroundColor: theme.colors.surfaceSunken,
        }}
      >
        <Icon icon={icon} size="xl" color={theme.colors.mutedForeground} decorative />
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
 * —esta aplicación explica lo que hace— y ya no interrumpen la columna. Es,
 * literalmente, el pie de sección de una lista agrupada.
 */
export function FootNote({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={{
        paddingHorizontal: LIST_GUTTER + 4,
        paddingTop: theme.space[2],
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
 * La línea entre dos bloques que no son un grupo.
 *
 * Dentro de un `ListGroup` las líneas las pone el grupo. Esta queda para lo que
 * separa secciones enteras a sangre —una pila de fichas del ancho de la
 * pantalla, el feed— y para lo que todavía no está agrupado.
 */
export function RowSeparator({ full = false }: { full?: boolean }) {
  const theme = useTheme();

  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginLeft: full ? 0 : SEPARATOR_INSET.avatar,
      }}
    />
  );
}

/**
 * Una fila de filtros en chips.
 *
 * Existe porque `Segmented` reparte el ancho entre todas las opciones y con
 * cinco deja cada rótulo en «Tratami…», «Adopci…», «Adopta…». Su propia
 * documentación lo dice: es para dos o tres opciones excluyentes y todas
 * visibles a la vez. En cuanto son cuatro o más, lo correcto es una fila que se
 * desliza, donde cada chip mide lo que mide su palabra.
 *
 * El chip mide treinta de alto —los de Material miden treinta y dos— y **se
 * toca en cuarenta y cuatro** con `hitSlop`, que es la salida que da la guía
 * para un control que tiene que verse pequeño.
 *
 * Se anuncia como lista de pestañas y no como botones sueltos: así un lector de
 * pantalla dice «3 de 5» en vez de obligar a adivinar cuántas hay.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();
  const relief = useRelief();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.space[2], paddingHorizontal: LIST_GUTTER }}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            hitSlop={8}
            onPress={() => {
              if (active) return;
              haptics.tap();
              onChange(option.id);
            }}
            style={({ pressed }) => [
              {
                height: 30,
                justifyContent: 'center',
                paddingHorizontal: theme.space[3],
                borderRadius: theme.radius.full,
                backgroundColor: active ? theme.colors.accent : theme.colors.surfaceSunken,
                opacity: pressed ? 0.7 : 1,
              },
              /* El filtro puesto se queda hundido y los demás sobresalen. Es la
                 lectura más literal que tiene este estilo —un interruptor de
                 verdad se queda dentro— y ahorra tener que fiarlo todo al
                 tinte del acento. */
              active ? relief.pressed('sm') : relief.raised('sm'),
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? theme.colors.accentForeground : theme.colors.mutedForeground,
                fontFamily: active ? fonts.bodyBold : fonts.body,
                fontSize: theme.fontSize.xs,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * El despliegue de una pantalla: cada pieza entra un poco después que la
 * anterior.
 *
 * Una pantalla de listas aparece de golpe o aparece **contándose**: primero lo
 * de arriba, luego lo siguiente, con cincuenta y cinco milisegundos entre una
 * cosa y la otra. La diferencia no es decorativa — el escalonado dice en qué
 * orden mirar, y es lo que separa una interfaz que se siente montada de una que
 * se siente dibujada.
 *
 * Se para en el sexto: escalonar el elemento número treinta lo haría entrar
 * segundo y medio después de abrir, que ya no es una entrada sino una espera.
 * Y con movimiento reducido no hay trayecto: cada pieza aparece ya colocada,
 * porque eso es exactamente lo que esa preferencia pide.
 */
export function Stagger({ children, from = 0 }: { children: ReactNode; from?: number }) {
  const items = Children.toArray(children).filter((child) => isValidElement(child));
  return (
    <>
      {items.map((child, index) => (
        <Appear key={index} index={from + index}>
          {child}
        </Appear>
      ))}
    </>
  );
}

/**
 * Un carrusel de fichas.
 *
 * Es el cambio de ritmo que le faltaba a estas pantallas: tres listas verticales
 * seguidas se leen como un formulario largo por muy bien hechas que estén. Una
 * fila que se desliza en horizontal dice otra cosa —«esto es para hojear, no
 * para recorrer»— y es lo que usan la App Store, Música y las sugerencias de
 * cualquier red social para lo mismo: contenido que se mira de reojo y del que
 * se elige uno.
 *
 * Engancha por ficha (`snapToInterval`) en vez de rodar libre: una fila que
 * queda a medio elemento parece rota, y con el enganche siempre se ve una ficha
 * entera y el borde de la siguiente, que es lo que dice que hay más.
 */
export function CardRail({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const relief = useRelief();
  const { width } = useWindowDimensions();
  /* La ficha ocupa el 72 % de la pantalla: lo justo para que la siguiente
     asome. Con el 100 % nadie sabe que hay más; con el 50 % la ficha es un
     sello y no cabe el texto. */
  const card = Math.round(Math.min(width, 520) * 0.72);
  const gap = theme.space[3];

  const items = Children.toArray(children).filter((child) => isValidElement(child));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={card + gap}
      snapToAlignment="start"
      contentContainerStyle={{ paddingHorizontal: LIST_GUTTER, gap }}
      /* Sitio arriba y abajo para que quepa la sombra. Un `ScrollView` recorta
         a la caja de su contenido, y sin este margen el brillo de la ficha se
         cortaba en una banda recta justo encima —se veía en la captura del
         carrusel de comunidades—. En las otras tres direcciones no hay nada que
         recortar, así que no se les mueve el carrusel de sitio. */
      style={relief.on ? { marginVertical: -theme.space[3] } : undefined}
    >
      {items.map((child, index) => (
        <Appear key={index} index={index}>
          <View style={{ width: card, paddingVertical: relief.on ? theme.space[3] : 0 }}>
            {child}
          </View>
        </Appear>
      ))}
    </ScrollView>
  );
}

/**
 * La ficha de un carrusel.
 *
 * Lleva lo mismo que una fila —ficha de icono, nombre, una línea y una acción—
 * y lo coloca en vertical, que es lo que permite que quepa en el 72 % de una
 * pantalla sin recortar el nombre a la mitad.
 */
export function RailCard({
  leading,
  title,
  subtitle,
  action,
  onPress,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress?: () => void };
  onPress?: () => void;
}) {
  const theme = useTheme();
  const relief = useRelief();
  const { card } = useGroupedSurfaces();
  const [down, setDown] = useState(false);

  const content = (
    <View
      style={[
        {
          gap: theme.space[2],
          padding: theme.space[4],
          borderRadius: theme.radius['2xl'],
          backgroundColor: card,
          /* Mismo trato que `ListGroup`: con relieve el filete sobra, porque la
             ficha es del color del fondo y quien la levanta es la luz. */
          borderWidth: relief.on ? 0 : theme.isDark ? 0 : StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          shadowColor: '#000',
          shadowOpacity: relief.on || theme.isDark ? 0 : 0.05,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          minHeight: 148,
        },
        relief.raised('md'),
      ]}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={2}
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.base,
            lineHeight: theme.fontSize.base * 1.2,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.xs,
              lineHeight: theme.fontSize.xs * 1.4,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <View style={{ flexDirection: 'row' }}>
          <PillButton label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Press pressed={down}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, subtitle].filter(Boolean).join('. ')}
        onPressIn={() => setDown(true)}
        onPressOut={() => setDown(false)}
        onPress={() => {
          haptics.tap();
          onPress();
        }}
      >
        {content}
      </Pressable>
    </Press>
  );
}

/**
 * La pieza destacada de una pantalla.
 *
 * Una lista en la que todo pesa lo mismo obliga a leerla entera para encontrar
 * lo que importa. Esto es lo contrario: **una sola cosa, grande y teñida**, y el
 * resto de la pantalla debajo en su tamaño normal. Se usa para el veterinario
 * de urgencias y para la quedada que viene primero, que son las dos únicas
 * cosas de sus pantallas que alguien puede necesitar con prisa.
 *
 * El tinte va al fondo y no al borde: un recuadro de color alrededor de texto
 * negro es un aviso de formulario; el bloque teñido entero es una tarjeta.
 */
export function Spotlight({
  icon,
  eyebrow,
  title,
  subtitle,
  action,
  tone = 'alert',
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: { label: string; icon?: LucideIcon; onPress?: () => void; hint?: string };
  tone?: 'alert' | 'live' | 'primary';
}) {
  const theme = useTheme();
  const relief = useRelief();

  const surface: Record<'alert' | 'live' | 'primary', { bg: string; ink: string; soft: string }> = {
    alert: {
      bg: theme.colors.destructive,
      ink: theme.colors.destructiveForeground,
      soft: theme.colors.destructiveForeground,
    },
    live: {
      bg: theme.colors.liveRing,
      ink: theme.colors.background,
      soft: theme.colors.background,
    },
    primary: {
      bg: theme.colors.primary,
      ink: theme.colors.primaryForeground,
      soft: theme.colors.primaryForeground,
    },
  };

  const { bg, ink, soft } = surface[tone];

  return (
    <View
      style={[
        {
          marginHorizontal: LIST_GUTTER,
          borderRadius: theme.radius['2xl'],
          backgroundColor: bg,
          padding: theme.space[4],
          gap: theme.space[3],
          /* Un halo del color del propio bloque. Con relieve se apaga: el halo
             de color y las dos luces del estilo son dos fuentes distintas a la
             vez, y la pantalla deja de tener un solo sol. */
          shadowColor: bg,
          shadowOpacity: relief.on || theme.isDark ? 0 : 0.28,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        },
        relief.raised('lg'),
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <Icon icon={icon} size="base" color={ink} strokeWidth={2.4} decorative />
        <Text
          style={{
            color: soft,
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize['2xs'],
            letterSpacing: 1,
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          {eyebrow}
        </Text>
      </View>

      <View style={{ gap: 2 }}>
        <Text
          numberOfLines={2}
          style={{
            color: ink,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.xl,
            lineHeight: theme.fontSize.xl * 1.15,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={2}
            style={{
              color: soft,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
              opacity: 0.9,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action ? (
        <View style={{ flexDirection: 'row' }}>
          {/* El botón de una pieza teñida va en el color de **la tinta**, no en
              el de acción: sobre un fondo rojo, un botón rojo no existe. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={action.hint}
            hitSlop={5}
            onPress={() => {
              haptics.tap();
              action.onPress?.();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[1.5],
              minHeight: 34,
              paddingHorizontal: theme.space[4],
              borderRadius: theme.radius.full,
              backgroundColor: ink,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {action.icon ? <Icon icon={action.icon} size="sm" color={bg} decorative /> : null}
            <Text style={{ color: bg, fontFamily: fonts.bodyBold, fontSize: theme.fontSize.sm }}>
              {action.label}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
