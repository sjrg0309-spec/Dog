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

import { alertReachM, RESCUE_SCENARIOS } from '@coincide/core';

import { BackBar } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { Caption, Screen, Segmented } from '@/components/ui';
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
import {
  searchSettings,
  setSetting,
  useSettings,
  type SettingRow,
} from '@/lib/settings';
import { useTheme } from '@/lib/theme';

/** El icono de cada fila. Vive aquí porque el índice es dato y no interfaz. */
const ICONS: Record<string, LucideIcon> = {
  ghost: EyeOff,
  rescuer: Siren,
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
  blocks: Ban,
  export: FileText,
};

export default function SettingsScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const { kind } = useAccount();
  const groups = searchSettings(query, kind);

  return (
    <Screen>
      <BackBar title="Configuración" subtitle="Solo lo que hace algo" />

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
              style={{
                minHeight: theme.touchTarget.min,
                paddingLeft: theme.space[12],
                paddingRight: theme.space[12],
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.input,
                color: theme.colors.inputForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.base,
              }}
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
            <Caption>
              Puede que lo que buscas esté en el último grupo: hay cosas que todavía no existen y
              están escritas ahí con el motivo, en vez de aparecer como un interruptor apagado.
            </Caption>
          </View>
        ) : null}

        {groups.map((group) => (
          <View key={group.id} style={{ paddingTop: theme.space[2] }}>
            <View
              style={{
                paddingHorizontal: theme.space[4],
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

            {group.rows.map((row) => (
              <SettingItem key={row.id} row={row} />
            ))}
          </View>
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
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[3],
      }}
    >
      {icon ? (
        <View style={{ paddingTop: 2 }}>
          <Icon
            icon={icon}
            size="lg"
            color={muted ? theme.colors.mutedForeground : theme.colors.foreground}
            decorative
          />
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
              En esta versión es un atajo de demostración, para poder ver funcionando los dos lados
              de la regla. La verificación de verdad pide la cartilla del veterinario; la revisión
              de una protectora la hace una persona mirando el perfil.
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
            {tutor === 0 ? ' (a un tutor no le llega)' : ` en vez de ${km(tutor)}`}
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
              <Caption>
                Esto solo puede reducir. Con la preferencia puesta en el teléfono, nada de aquí la
                cancela: quien la activó no lo hizo por gusto.
              </Caption>
            </View>
          ) : null}
        </View>
      }
    />
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
