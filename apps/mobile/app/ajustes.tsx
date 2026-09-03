/**
 * Configuración.
 *
 * Es la segunda capa de las dos que tiene Instagram en el perfil: el ☰ abre una
 * lista corta de atajos, y **Configuración** es una pantalla aparte con
 * buscador y secciones. Se toma prestada la anatomía porque resuelve bien un
 * problema real —una lista larga de cosas que se buscan por su nombre, no se
 * exploran— y porque es la forma que ya sabe usar cualquiera.
 *
 * Dos decisiones propias, y las dos son sobre honestidad:
 *
 * **El buscador busca más que ajustes.** Escribir «vacunas» lleva a la ficha
 * médica; «qr», al Modo Paseo; «rutina», al historial. La gente entra en
 * configuración a buscar lo que no encuentra, no solo a cambiar interruptores,
 * y una caja de búsqueda que solo mira los rótulos de los interruptores
 * defrauda justo cuando se usa.
 *
 * **Lo que no está construido se dice.** El último grupo lista cuenta,
 * notificaciones del teléfono, bloqueos y descarga de datos con el motivo de
 * por qué no están, en vez de enseñar cuatro interruptores apagados. Un
 * interruptor de privacidad que no hace nada es peor que su ausencia: alguien
 * lo apaga y se queda tranquilo. Es la misma postura que ya tenían el modo
 * fantasma y el hueco de los teléfonos de denuncia.
 *
 * Y por eso el índice de esta pantalla vive en `lib/settings` como dato: un
 * test comprueba que cada fila cambia algo, lleva a una ruta que existe o
 * declara por qué falta.
 */

import { useRouter, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { alertReachM, RESCUE_SCENARIOS } from '@petnav/core';

import { BackBar } from '@/components/chrome';
import { IconTile, LIST_GUTTER, ListGroup } from '@/components/list';
import { Appear } from '@/components/motion';
import { Icon } from '@/components/icon';
import { Caption, Screen, Segmented } from '@/components/ui';
import {
  DIRECTIONS,
  DIRECTION_IDS,
  setDirection,
  useDirection,
  type DirectionId,
} from '@/lib/direcciones';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Accessibility,
  Ban,
  Bell,
  BadgeCheck,
  Bookmark,
  ChevronRight,
  EyeOff,
  FileText,
  Footprints,
  HeartPulse,
  Check,
  Lock,
  MapPinned,
  Moon,
  Palette,
  QrCode,
  Search,
  Siren,
  X,
  type LucideIcon,
} from '@/lib/icons';
import {
  setMicrochipVerified,
  setShelterReviewed,
  useAccount,
  useCan,
  useWhyNot,
} from '@/lib/account';
import { setGhostMode, useGhostMode } from '@/lib/presence';
import { NEARBY_RADII_M, type NearbyRadius } from '@/lib/posts';
import { searchSettings, setSetting, useSettings, type SettingRow } from '@/lib/settings';
import { useRelief } from '@/lib/relieve';
import { useTheme } from '@/lib/theme';

/** El icono de cada fila. Vive aquí porque el índice es dato y no interfaz. */
/**
 * El tinte de cada ficha.
 *
 * No es decoración repartida al azar: el color dice de qué familia es el
 * ajuste antes de leerlo, que es lo que hace que un panel de treinta filas se
 * pueda recorrer con la vista. El rojo se reserva a lo que cierra o alarma
 * —bloqueados, rescate— y el naranja de «en vivo» a lo que te hace visible o
 * invisible, que es el mismo color que usa el radar.
 */
const TILE_TONES: Record<string, 'primary' | 'live' | 'alert' | 'ok' | 'info' | 'muted'> = {
  ghost: 'live',
  rescuer: 'alert',
  blocked: 'alert',
  chip: 'ok',
  shelter: 'alert',
  direccion: 'info',
  theme: 'info',
  motion: 'info',
  feedRadius: 'info',
  walks: 'primary',
  record: 'alert',
  saved: 'primary',
  walkmode: 'primary',
  activity: 'live',
  account: 'muted',
  push: 'muted',
  export: 'muted',
};

const ICONS: Record<string, LucideIcon> = {
  ghost: EyeOff,
  rescuer: Siren,
  direccion: Palette,
  feedRadius: MapPinned,
  theme: Moon,
  motion: Accessibility,
  walks: Footprints,
  record: HeartPulse,
  saved: Bookmark,
  walkmode: QrCode,
  activity: Bell,
  chip: BadgeCheck,
  shelter: Siren,
  account: Lock,
  push: Bell,
  blocked: Ban,
  export: FileText,
};

export default function SettingsScreen() {
  const theme = useTheme();
  const relief = useRelief();
  const [query, setQuery] = useState('');
  const { kind } = useAccount();
  const groups = searchSettings(query, kind);

  return (
    <Screen grouped>
      <BackBar title="Configuración" />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
      >
        <View style={{ padding: theme.space[4] }}>
          {/* El campo es la píldora, con el icono y el aspa encima: así el
              anillo de foco del navegador rodea lo que se ve y no el campo de
              dentro. */}
          <View>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar en configuración"
              placeholderTextColor={theme.colors.inputPlaceholder}
              accessibilityLabel="Buscar un ajuste"
              returnKeyType="search"
              style={[
                {
                  minHeight: theme.touchTarget.min,
                  paddingLeft: theme.space[12],
                  paddingRight: theme.space[12],
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.input,
                  color: theme.colors.inputForeground,
                  fontFamily: fonts.body,
                  fontSize: theme.fontSize.base,
                },
                /* La ranura: con relieve un campo es un hueco, no una caja encima. */
                relief.pressed('sm'),
              ]}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: theme.space[4],
                top: 0,
                bottom: 0,
                justifyContent: 'center',
              }}
            >
              <Icon icon={Search} size="base" color={theme.colors.inputPlaceholder} decorative />
            </View>
            {query !== '' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Borrar la búsqueda"
                onPress={() => {
                  haptics.tap();
                  setQuery('');
                }}
                style={({ pressed }) => ({
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: theme.touchTarget.min,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Icon icon={X} size="base" color={theme.colors.mutedForeground} decorative />
              </Pressable>
            ) : null}
          </View>
        </View>

        {groups.length === 0 ? (
          <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[2] }}>
            <Caption>Nada coincide con «{query}».</Caption>
            <Caption>Mira en «Todavía no disponible»: puede que esté ahí.</Caption>
          </View>
        ) : null}

        {groups.map((group, position) => (
          /* Cada grupo entra un poco después que el anterior. En una pantalla
             que son ocho tarjetas apiladas, el escalonado es lo que la hace
             parecer que se despliega en vez de aparecer de golpe. */
          <Appear key={group.id} index={position} style={{ paddingTop: theme.space[2] }}>
            <View
              style={{
                paddingHorizontal: LIST_GUTTER + 4,
                paddingBottom: theme.space[2],
                gap: theme.space[1],
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
                {group.title}
              </Text>
              {group.note ? <Caption>{group.note}</Caption> : null}
            </View>

            <ListGroup>
              {group.rows.map((row) => (
                <SettingItem key={row.id} row={row} />
              ))}
            </ListGroup>
          </Appear>
        ))}
      </ScrollView>
    </Screen>
  );
}

function SettingItem({ row }: { row: SettingRow }) {
  const icon = ICONS[row.id];

  if (row.kind === 'switch') return <SwitchRow row={row} icon={icon} />;
  if (row.kind === 'choice') return <ChoiceRow row={row} icon={icon} />;
  if (row.kind === 'link') return <LinkRow row={row} icon={icon} />;
  return <MissingRow row={row} icon={icon} />;
}

/** El armazón común: icono, rótulo, explicación y lo que vaya a la derecha. */
function Shell({
  row,
  icon,
  trailing,
  below,
  muted = false,
}: {
  row: SettingRow;
  icon: LucideIcon | undefined;
  trailing?: ReactNode;
  below?: ReactNode;
  muted?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.space[3],
        paddingHorizontal: theme.space[3] + 2,
        paddingVertical: theme.space[3],
      }}
    >
      {icon ? (
        /* La ficha teñida, que es de donde sale el color de un panel de
           ajustes: una columna de gris con una mancha de color por fila. El
           icono suelto de antes decía lo mismo y no se veía, porque un trazo
           gris de veinticuatro puntos entre dos líneas de texto gris no
           destaca de nada. */
        <View style={{ paddingTop: 2 }}>
          <IconTile icon={icon} tone={muted ? 'muted' : (TILE_TONES[row.id] ?? 'primary')} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: theme.space[1] }}>
        <Text
          style={{
            color: muted ? theme.colors.mutedForeground : theme.colors.foreground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
          }}
        >
          {row.label}
        </Text>
        <Caption>{row.hint}</Caption>
        {below}
      </View>
      {trailing}
    </View>
  );
}

/**
 * Un interruptor.
 *
 * El estado no se dice solo con la posición: lleva su aspa o su marca dentro,
 * igual que el del Modo Paseo. Es lo que sobrevive a una captura en gris y a
 * cualquier deficiencia de visión del color, y aquí importa más que en otros
 * sitios porque uno de los dos decide si el vecindario te ve.
 */
function SwitchRow({ row, icon }: { row: SettingRow; icon: LucideIcon | undefined }) {
  const theme = useTheme();
  const settings = useSettings();
  const ghost = useGhostMode();
  const account = useAccount();
  /* El papel de rescatista no es un interruptor cualquiera: amplía a kilómetros
     la lista de animales heridos, perdidos o sin dueño. Va detrás de la misma
     puerta que el mapa de gente, y aquí se ve cerrado en vez de esconderse. */
  const canRescue = useCan('rescue_alerts');
  const locked = useWhyNot('rescue_alerts');
  const allowed = row.id === 'rescuer' ? canRescue : true;

  const on =
    row.id === 'ghost'
      ? ghost
      : row.id === 'rescuer'
        ? settings.rescuer
        : row.id === 'chip'
          ? account.microchipVerified
          : account.shelterReviewed;

  const toggle = () => {
    haptics.commit();
    if (row.id === 'ghost') setGhostMode(!ghost);
    else if (row.id === 'rescuer') setSetting('rescuer', !settings.rescuer);
    else if (row.id === 'chip') setMicrochipVerified(!account.microchipVerified);
    else setShelterReviewed(!account.shelterReviewed);
  };

  if (!allowed) {
    return (
      <Shell
        row={row}
        icon={icon}
        muted
        below={
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: theme.colors.border,
              paddingLeft: theme.space[3],
              marginTop: theme.space[1],
            }}
          >
            <Caption>{locked}</Caption>
          </View>
        }
        trailing={
          <View style={{ paddingTop: 2 }}>
            <Icon icon={Lock} size="base" color={theme.colors.mutedForeground} decorative />
          </View>
        }
      />
    );
  }

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={row.label}
      accessibilityHint={row.hint}
      onPress={toggle}
      /* `accessibilityState` no llega a la web: react-native-web no lo traduce a
         `aria-checked` en un `Pressable` con papel de interruptor, así que un
         lector de pantalla anunciaba «interruptor» sin decir si estaba puesto.
         Se vio en la auditoría del empaquetado, que buscaba ese atributo para
         comprobar otra cosa y lo encontró vacío. En nativo manda el de arriba;
         en web, este. */
      aria-checked={on}

      style={({ pressed }) => ({
        minHeight: theme.touchTarget.comfortable,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Shell
        row={row}
        icon={icon}
        below={
          row.id === 'rescuer' && on ? (
            <RescuerReach />
          ) : row.id === 'chip' || row.id === 'shelter' ? (
            <Caption>
              Atajo de demostración. La verificación real pide la cartilla del veterinario.
            </Caption>
          ) : null
        }
        trailing={
          <View
            style={{
              width: 52,
              height: 32,
              borderRadius: theme.radius.full,
              padding: 3,
              justifyContent: 'center',
              alignItems: on ? 'flex-end' : 'flex-start',
              backgroundColor: on ? theme.colors.primary : theme.colors.muted,
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                icon={on ? Check : X}
                size="sm"
                color={on ? theme.colors.primary : theme.colors.mutedForeground}
                decorative
              />
            </View>
          </View>
        }
      />
    </Pressable>
  );
}

/**
 * Lo que cambia al decir que eres rescatista, en metros.
 *
 * Aparece **debajo del interruptor y solo encendido**, porque es la respuesta a
 * la pregunta que deja un interruptor así: vale, ¿y ahora qué me llega? Los
 * números no están escritos aquí: salen del catálogo de rescate, que es quien
 * los decide y quien los tiene probados.
 */
function RescuerReach() {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[1], paddingTop: theme.space[1] }}>
      {RESCUE_SCENARIOS.map((scenario) => {
        const rescuer = alertReachM(scenario, 'rescuer');
        const tutor = alertReachM(scenario, 'tutor');
        const km = (meters: number) => `${(meters / 1000).toFixed(1).replace('.', ',')} km`;

        return (
          <Text
            key={scenario.id}
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.xs,
              lineHeight: theme.fontSize.xs * 1.4,
            }}
          >
            {scenario.label}: {km(rescuer)}
            {tutor === 0 ? ' · a un tutor no le llega' : ` en vez de ${km(tutor)}`}
          </Text>
        );
      })}
    </View>
  );
}

function ChoiceRow({ row, icon }: { row: SettingRow; icon: LucideIcon | undefined }) {
  const theme = useTheme();
  const settings = useSettings();

  return (
    <Shell
      row={row}
      icon={icon}
      below={
        <View style={{ paddingTop: theme.space[2] }}>
          {row.id === 'direccion' ? <DirectionPicker /> : null}

          {row.id === 'feedRadius' ? (
            <Segmented
              options={NEARBY_RADII_M.map((meters) => ({
                id: String(meters),
                label: `${meters / 1000} km`,
              }))}
              value={String(settings.feedRadiusM)}
              onChange={(id) => setSetting('feedRadiusM', Number(id) as NearbyRadius)}
            />
          ) : null}

          {row.id === 'theme' ? (
            <Segmented
              options={[
                { id: 'system' as const, label: 'Teléfono' },
                { id: 'light' as const, label: 'Claro' },
                { id: 'dark' as const, label: 'Oscuro' },
              ]}
              value={settings.theme}
              onChange={(id) => setSetting('theme', id)}
            />
          ) : null}

          {row.id === 'motion' ? (
            <View style={{ gap: theme.space[2] }}>
              <Segmented
                options={[
                  { id: 'system' as const, label: 'El del teléfono' },
                  { id: 'reduced' as const, label: 'Reducido' },
                ]}
                value={settings.motion}
                onChange={(id) => setSetting('motion', id)}
              />
              <Caption>Si ya lo tienes activado en el teléfono, esto no lo desactiva.</Caption>
            </View>
          ) : null}
        </View>
      }
    />
  );
}

/**
 * Las direcciones, para elegirlas mirándolas.
 *
 * Un `Segmented` con cuatro palabras habría sido la mitad de código y no habría
 * servido: «Nocturno», «Papel», «Señal» y «Relieve» no significan nada hasta que
 * se ven. Cada miniatura está pintada **con los colores, la forma, la letra y la
 * luz de su dirección**, no con los del tema activo —por eso cada nombre sale en
 * su tipografía—, así que la elección se hace comparando en vez de leyendo.
 *
 * La miniatura enseña las cuatro cosas que cambian de una dirección a otra:
 *
 *  1. **El color:** el fondo, el texto y la marca, tal cual quedarán.
 *  2. **La forma:** el radio sale de la propia dirección, así que «Papel» se ve
 *     de esquina recta y «Señal» blanda sin que nadie lo explique.
 *  3. **La foto:** a sangre en Nocturno y Papel, con marco en Señal y Relieve.
 *     Es la diferencia más visible y no se deduce de un radio.
 *  4. **La luz:** en «Relieve» la pastilla de acción sobresale del fondo y la
 *     franja de la foto se hunde en él. Sin enseñarlo, la única dirección que se
 *     dibuja con sombras se vería aquí como un gris plano.
 */
function DirectionPicker() {
  const theme = useTheme();
  const active = useDirection();

  return (
    <View style={{ gap: theme.space[2] }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Dirección visual"
        /* Dos por fila desde que son cuatro: repartidas en una sola, cada
           miniatura se queda en noventa puntos y la foto de dentro deja de
           leerse como una foto. */
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}
      >
        {DIRECTION_IDS.map((id) => (
          <DirectionCard key={id} id={id} selected={id === active} />
        ))}
      </View>
      <Caption>
        {DIRECTIONS[active].tagline}. Cambia el color, la letra y la forma a la vez.
      </Caption>
    </View>
  );
}

function DirectionCard({ id, selected }: { id: DirectionId; selected: boolean }) {
  const theme = useTheme();
  const direction = DIRECTIONS[id];
  /* La miniatura se pinta con el fondo que el usuario tiene puesto, no siempre
     con el oscuro: si alguien va en claro, enseñárselas todas en negro le hace
     elegir una pantalla que no va a ver. */
  const preview = direction[theme.isDark ? 'dark' : 'light'];
  const inset = direction.media === 'inset' ? 5 : 0;

  /* La luz de **esta** dirección, no la de la que esté puesta: la miniatura es
     un retrato de la opción, igual que ya lo era con su color y su letra. Por
     eso se arma a mano aquí en vez de con `useRelief`, que devuelve siempre la
     de la dirección activa. Es la excepción que la regla de sombras de
     `lib/interface-rules.test.ts` tiene anotada por su nombre. */
  const lights = direction.relief?.[theme.isDark ? 'dark' : 'light'] ?? null;
  const raised = lights
    ? { boxShadow: `-2px -2px 4px ${lights.light}, 2px 2px 4px ${lights.dark}` }
    : null;
  const carved = lights
    ? { boxShadow: `inset 1px 1px 2px ${lights.dark}, inset -1px -1px 2px ${lights.light}` }
    : null;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      /* Igual que en los interruptores: react-native-web no traduce
         `accessibilityState` en un `Pressable`, y sin esto un lector de
         pantalla anuncia tres opciones sin decir cuál está puesta. */
      aria-checked={selected}
      accessibilityLabel={`${direction.name}. ${direction.tagline}`}
      onPress={() => {
        haptics.commit();
        setDirection(id);
      }}
      style={({ pressed }) => ({
        flexBasis: '47%',
        flexGrow: 1,
        gap: theme.space[1],
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          height: 96,
          borderRadius: direction.radius.md,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: preview.background,
          overflow: 'hidden',
          paddingVertical: 6,
          gap: 5,
        }}
      >
        {/* La cabecera: la marca y dos puntos. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6 }}>
          <View
            style={{
              width: 22,
              height: 5,
              borderRadius: direction.radius.xs,
              backgroundColor: preview.foreground,
            }}
          />
          <View style={{ flex: 1 }} />
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: 2,
              backgroundColor: preview.mutedForeground,
            }}
          />
        </View>

        {/* La foto: a sangre o con marco. Es lo que más se nota. */}
        <View
          style={[
            {
              height: 34,
              marginHorizontal: inset,
              borderRadius: inset > 0 ? direction.radius.sm : 0,
              backgroundColor: preview.surfaceElevated,
              borderTopWidth: inset > 0 || lights ? 0 : 1,
              borderBottomWidth: inset > 0 || lights ? 0 : 1,
              borderColor: preview.border,
            },
            carved,
          ]}
        />

        {/* Y la acción, del color de la marca. */}
        <View style={{ paddingHorizontal: 6, gap: 4 }}>
          <View
            style={{
              height: 5,
              width: '62%',
              borderRadius: direction.radius.xs,
              backgroundColor: preview.mutedForeground,
            }}
          />
          <View
            style={[
              {
                height: 16,
                width: '78%',
                borderRadius: direction.radius.full,
                backgroundColor: preview.primary,
              },
              raised,
            ]}
          />
        </View>
      </View>

      <Text
        numberOfLines={1}
        style={{
          /* Cada nombre en su propia tipografía: es la mitad de la decisión y
             no se puede enseñar con un rótulo del tema activo. */
          fontFamily: direction.fonts.displayBold,
          fontSize: theme.fontSize.sm,
          color: selected ? theme.colors.primary : theme.colors.foreground,
          textAlign: 'center',
        }}
      >
        {direction.name}
      </Text>
    </Pressable>
  );
}

function LinkRow({ row, icon }: { row: SettingRow; icon: LucideIcon | undefined }) {
  const theme = useTheme();
  const router = useRouter();
  const go = useCallback(() => {
    haptics.tap();
    /* El índice guarda la ruta como cadena porque es dato y lo lee un test;
       las rutas tipadas se generan aparte. La conversión es el único punto
       donde se cruzan, y el test comprueba que cada una existe de verdad. */
    if (row.href) router.push(row.href as Href);
  }, [router, row.href]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.label}
      accessibilityHint={row.hint}
      onPress={go}
      style={({ pressed }) => ({
        minHeight: theme.touchTarget.comfortable,
        backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
      })}
    >
      <Shell
        row={row}
        icon={icon}
        trailing={
          <View style={{ paddingTop: 2 }}>
            <Icon icon={ChevronRight} size="base" color={theme.colors.mutedForeground} decorative />
          </View>
        }
      />
    </Pressable>
  );
}

/**
 * Algo que no está construido.
 *
 * No es un `Pressable`: no se puede tocar, porque no hay nada al otro lado. Un
 * interruptor apagado prometería que existe y que está desactivado, que son dos
 * mentiras distintas.
 */
function MissingRow({ row, icon }: { row: SettingRow; icon: LucideIcon | undefined }) {
  const theme = useTheme();

  return (
    <Shell
      row={row}
      icon={icon}
      muted
      below={
        row.why ? (
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: theme.colors.border,
              paddingLeft: theme.space[3],
              marginTop: theme.space[1],
            }}
          >
            <Caption>{row.why}</Caption>
          </View>
        ) : null
      }
    />
  );
}
