/**
 * Los paneles de la hoja del mapa: un sitio, una persona, y la tira de quién
 * está fuera.
 *
 * Son lo que un mapa de verdad enseña al tocar algo: no una fila más de la
 * lista con un botón de «Lista» al lado, sino una ficha con **una acción
 * principal** y las secundarias debajo. En Google Maps esa acción es «Cómo
 * llegar»; aquí es **salir a ese sitio ahora**, porque lo que esta aplicación
 * hace es que el paseo ocurra, y la ruta la sabe cualquiera que viva en el
 * barrio.
 *
 * Tres reglas del producto viven aquí y no en la pantalla que los usa:
 *
 * - **«Salir aquí» solo se ofrece cuando conviene.** Si el veredicto de
 *   bienestar dice que hoy no, el botón no está —no está en gris—, y en su
 *   sitio va la frase que lo explica. Un control desactivado invita a buscar
 *   cómo activarlo.
 * - **La ficha de una persona no lleva botón de mensaje.** Las conversaciones
 *   nacen de coincidir —mismo horario, misma quedada, misma alerta—, y una
 *   ficha en el mapa con «Enviar mensaje» sería el botón de acoso que el
 *   producto lleva evitando desde el primer día. Lo que sí lleva es por qué
 *   coincidís, en tres ejes separados y nunca fundidos en un porcentaje.
 * - **Cómo llegar sale de la aplicación.** No hay ruta propia ni la va a
 *   haber: se abre el mapa del sistema con el sitio ya puesto. Se usa
 *   OpenStreetMap en web por lo mismo que las teselas: no hace falta cuenta ni
 *   clave, y es de quien lo ha dibujado.
 */

import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { formatDistance } from '@petnav/core';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { PillButton } from '@/components/list';
import type { MapMarker } from '@/components/mini-map';
import { Button, Caption } from '@/components/ui';
import { useCan } from '@/lib/account';
import type { DemoPet, DiscoveryEntry } from '@/lib/data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  Footprints,
  Navigation,
  Siren,
  X,
  type LucideIcon,
} from '@/lib/icons';
import { useTheme } from '@/lib/theme';

/** Cómo se dice una distancia muy corta: «0 m» se lee como un dato roto. */
function nearLabel(meters: number): string {
  return meters < 30 ? 'estás aquí' : `a ${formatDistance(meters)}`;
}

/**
 * Abrir el sitio en el mapa del sistema.
 *
 * `geo:` en Android y `maps:` en iOS son los esquemas que cada sistema reparte
 * entre las aplicaciones de mapas que tenga instaladas la persona; en web no
 * hay esquema y se va a OpenStreetMap con el marcador puesto. Ninguno de los
 * tres publica nada: la coordenada que sale es la del **sitio**, que ya es
 * pública, y no la de quien pregunta.
 */
export function openDirections(point: { lat: number; lng: number }, label: string): void {
  const query = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps:0,0?q=${query}&ll=${point.lat},${point.lng}`,
    android: `geo:${point.lat},${point.lng}?q=${point.lat},${point.lng}(${query})`,
    default: `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`,
  });
  void Linking.openURL(url).catch(() => undefined);
}

/** La cabecera común: icono o retrato, nombre, subtítulo y el aspa de cerrar. */
function PanelHeader({
  leading,
  title,
  subtitle,
  tone,
  onClose,
}: {
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  tone: 'default' | 'alert';
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
      {leading}
      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={{
            color: tone === 'alert' ? theme.colors.destructive : theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.lg,
          }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar y volver a la lista"
        onPress={() => {
          haptics.tap();
          onClose();
        }}
        style={({ pressed }) => ({
          width: theme.touchTarget.min,
          height: theme.touchTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.touchTarget.min / 2,
          backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
        })}
      >
        <Icon icon={X} size="base" color={theme.colors.mutedForeground} decorative />
      </Pressable>
    </View>
  );
}

/** Un icono en un disco teñido, como el de las filas de la lista pero mayor. */
function TileIcon({ icon, tint }: { icon: LucideIcon; tint: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tint,
      }}
    >
      <Icon icon={icon} size="base" color={theme.colors.background} decorative />
    </View>
  );
}

/**
 * La ficha de un sitio.
 *
 * Arriba qué es y a cuánto está; debajo quién está ahí ahora —caras con
 * nombre, porque saber que hay alguien sin saber quién no es medio dato, es
 * ninguno—; y la acción principal en grande. Las secundarias van en píldoras:
 * cómo llegar, y quedar aquí.
 */
export function PlacePanel({
  marker,
  distance,
  here,
  checkInNote,
  alertsInRange,
  onClose,
  onCheckIn,
  onPerson,
  onAlerts,
}: {
  marker: MapMarker;
  distance: number;
  /** Quién está fuera en este sitio ahora. Vacío cuando la puerta lo cierra. */
  here: DemoPet[];
  /**
   * Por qué no se ofrece salir, o `null` cuando sí se ofrece. La frase viene
   * de quien sabe —el veredicto de bienestar, la puerta de acceso, el modo
   * fantasma— y aquí solo se enseña.
   */
  checkInNote: string | null;
  /** Cuántas alertas abiertas alcanzan este sitio. */
  alertsInRange: number;
  onClose: () => void;
  onCheckIn: () => void;
  onPerson: (petId: string) => void;
  onAlerts: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const alert = marker.tone === 'alert';
  const tint = alert
    ? theme.colors.destructive
    : marker.tone === 'water'
      ? theme.colors.information
      : marker.tone === 'vet'
        ? theme.colors.warning
        : theme.colors.primary;
  /* Solo en un sitio se puede salir: en un bebedero o en una clínica no hay
     radar que encender, y una alerta no es un sitio al que ir. */
  const isPlace = marker.tone === 'place';

  return (
    <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[3] }}>
      <PanelHeader
        leading={<TileIcon icon={marker.icon} tint={tint} />}
        title={marker.label}
        subtitle={`${marker.kind} · ${nearLabel(distance)}`}
        tone={alert ? 'alert' : 'default'}
        onClose={onClose}
      />

      {here.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: theme.space[3], paddingVertical: theme.space[1] }}
        >
          {here.map((other) => (
            <Pressable
              key={other.id}
              accessibilityRole="button"
              accessibilityLabel={`${other.name}, de ${other.ownerName}, está aquí ahora`}
              accessibilityHint="Abre su ficha"
              onPress={() => {
                haptics.tap();
                onPerson(other.id);
              }}
              style={({ pressed }) => ({
                alignItems: 'center',
                gap: theme.space[1],
                width: 60,
                minHeight: theme.touchTarget.min,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Avatar id={other.id} name={other.name} size={44} live />
              <Text
                numberOfLines={1}
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize['2xs'],
                }}
              >
                {other.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : isPlace ? (
        <Caption>Ahora mismo no hay nadie fuera aquí que puedas ver.</Caption>
      ) : null}

      {marker.detail ? <Caption>{marker.detail}</Caption> : null}

      {alertsInRange > 0 && !alert ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${alertsInRange === 1 ? 'Una alerta abierta alcanza' : `${alertsInRange} alertas abiertas alcanzan`} este sitio. Ver en SOS`}
          onPress={() => {
            haptics.tap();
            onAlerts();
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[2],
            minHeight: theme.touchTarget.min,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon icon={Siren} size="sm" color={theme.colors.destructive} decorative />
          <Text
            style={{
              flex: 1,
              color: theme.colors.destructive,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.sm,
            }}
          >
            {alertsInRange === 1
              ? 'Una alerta abierta alcanza este sitio'
              : `${alertsInRange} alertas abiertas alcanzan este sitio`}
          </Text>
        </Pressable>
      ) : null}

      {alert ? (
        <Button
          label="Ver los pasos y reportar avistamiento"
          variant="primary"
          icon={Siren}
          onPress={onAlerts}
        />
      ) : isPlace ? (
        checkInNote === null ? (
          <Button
            label="Salir aquí ahora"
            variant="live"
            icon={Footprints}
            accessibilityHint="Enciende el radar en este sitio durante un rato"
            onPress={onCheckIn}
          />
        ) : (
          <Caption>{checkInNote}</Caption>
        )
      ) : null}

      {!alert ? (
        <View style={{ flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' }}>
          <PillButton
            label="Cómo llegar"
            icon={Navigation}
            variant="neutral"
            accessibilityHint="Abre el sitio en el mapa del teléfono"
            onPress={() => {
              haptics.tap();
              openDirections(marker, marker.label);
            }}
          />
          {isPlace ? (
            <PillButton
              label="Quedar aquí"
              icon={CalendarDays}
              variant="neutral"
              accessibilityHint="Abre las quedadas"
              onPress={() => {
                haptics.tap();
                router.push('/quedadas');
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Una fila de «por qué coincidís»: un eje, su dato y nada que los sume. */
function AxisRow({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[2] }}>
      <View style={{ paddingTop: 2 }}>
        <Icon icon={icon} size="sm" color={theme.colors.mutedForeground} decorative />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize['2xs'],
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.sm,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const BAND_LABEL: Record<string, string> = {
  great: 'Gran match',
  good: 'Buen match',
  supervised: 'Con supervisión',
  incompatible: 'No compatible',
};

/**
 * La ficha de un perro que está fuera ahora.
 *
 * Lo que enseña es lo que su tutor ha publicado y lo que el algoritmo sabe del
 * **par**: los tres ejes por separado. Lo que no enseña, a propósito: un botón
 * de mensaje, la posición exacta de la persona, ni su horario entero —solo la
 * coincidencia, que es lo que `schedule_matches` devuelve—.
 */
export function PersonPanel({
  pet,
  entry,
  placeName,
  hasUnseenStory,
  onClose,
  onStory,
  onPlace,
}: {
  pet: DemoPet;
  /** Lo que el descubrimiento dice de este par, o null si hoy no lo calcula. */
  entry: DiscoveryEntry | null;
  placeName: string;
  hasUnseenStory: boolean;
  onClose: () => void;
  onStory: () => void;
  onPlace: () => void;
}) {
  const theme = useTheme();
  const canMessage = useCan('message_first');
  const match = entry?.match ?? null;

  return (
    <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[3] }}>
      <PanelHeader
        leading={<Avatar id={pet.id} name={pet.name} size={44} live />}
        title={pet.name}
        subtitle={`${pet.breeds.join(' · ')} · de ${pet.ownerName}`}
        tone="default"
        onClose={onClose}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Está paseando en ${placeName}`}
        accessibilityHint="Abre la ficha del sitio"
        onPress={() => {
          haptics.tap();
          onPlace();
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          minHeight: theme.touchTarget.min,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon icon={Footprints} size="sm" color={theme.colors.liveRing} decorative />
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.sm,
          }}
        >
          Fuera ahora en {placeName}
        </Text>
        {pet.isMicrochipVerified ? (
          <Icon icon={BadgeCheck} size="sm" color={theme.colors.primary} label="Tutor verificado" />
        ) : null}
      </Pressable>

      {match ? (
        <View style={{ gap: theme.space[2] }}>
          <AxisRow
            icon={BadgeCheck}
            label="Temperamento"
            value={`${match.affinity.score} % · ${BAND_LABEL[match.affinity.band] ?? match.affinity.band}`}
          />
          <AxisRow
            icon={Clock}
            label="Horarios"
            value={match.scheduleSummary ?? 'Vuestros horarios de salida no coinciden'}
          />
          <AxisRow
            icon={Navigation}
            label="Cercanía"
            value={entry?.distanceLabel ?? 'Sin distancia'}
          />
          <Caption>
            Tres datos y no una cifra: mezclarlos convertiría a un perro mediocre pero cercano en un
            «95 % compatible».
          </Caption>
        </View>
      ) : (
        <Caption>
          Hoy no se calcula la afinidad: sin saber qué tiempo hace no se propone nada.
        </Caption>
      )}

      <View style={{ flexDirection: 'row', gap: theme.space[2], flexWrap: 'wrap' }}>
        {hasUnseenStory ? (
          <PillButton
            label="Ver su estado"
            variant="primary"
            accessibilityHint="Abre el estado de hoy"
            onPress={() => {
              haptics.tap();
              onStory();
            }}
          />
        ) : null}
      </View>

      <Caption>
        {canMessage
          ? 'Aquí no hay botón de mensaje: las conversaciones nacen de coincidir. Si salís a la misma hora, el hilo aparece solo en Mensajes.'
          : 'Sin chip verificado no se abren conversaciones. Las que hay nacen de coincidir, nunca de una ficha.'}
      </Caption>
    </View>
  );
}

/**
 * Quién está fuera ahora, en una tira horizontal para la posición baja de la
 * hoja. Es lo que se ve con el mapa entero delante: caras con nombre y anillo
 * de en vivo, y un toque abre la ficha. Sin nadie, la tira no se dibuja: una
 * fila vacía con un título es peor que ninguna.
 */
export function PresenceStrip({
  pets,
  onOpen,
}: {
  pets: DemoPet[];
  onOpen: (petId: string) => void;
}) {
  const theme = useTheme();
  if (pets.length === 0) return null;

  return (
    <View style={{ gap: theme.space[1] }}>
      <Text
        style={{
          paddingHorizontal: theme.space[4],
          color: theme.colors.mutedForeground,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize['2xs'],
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        Fuera ahora
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: theme.space[4], gap: theme.space[3] }}
      >
        {pets.map((other) => (
          <Pressable
            key={other.id}
            accessibilityRole="button"
            accessibilityLabel={`${other.name} está fuera${other.placeName ? ` en ${other.placeName}` : ''}`}
            accessibilityHint="Abre su ficha"
            onPress={() => {
              haptics.tap();
              onOpen(other.id);
            }}
            style={({ pressed }) => ({
              alignItems: 'center',
              gap: theme.space[1],
              width: 56,
              minHeight: theme.touchTarget.min,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Avatar id={other.id} name={other.name} size={40} live />
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize['2xs'],
              }}
            >
              {other.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Las capas como chips, encima de la lista.
 *
 * Es el mismo conjunto que el panel de capas del botón, dicho de otra forma:
 * cuando la hoja está a media altura lo que se quiere es filtrar sin soltar
 * la lista, y un panel flotante sobre el mapa queda tapado por la propia hoja.
 * Son interruptores y no pestañas: se pueden encender varios a la vez.
 */
export function LayerChips<T extends string>({
  options,
  active,
  onToggle,
}: {
  options: ReadonlyArray<{ id: T; label: string; icon: LucideIcon }>;
  active: ReadonlySet<T>;
  onToggle: (id: T) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{
        paddingHorizontal: theme.space[4],
        gap: theme.space[2],
        paddingVertical: theme.space[1],
      }}
    >
      {options.map((option) => {
        const on = active.has(option.id);
        return (
          <Pressable
            key={option.id}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            accessibilityLabel={option.label}
            hitSlop={6}
            onPress={() => {
              haptics.tap();
              onToggle(option.id);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[1.5],
              height: 32,
              paddingHorizontal: theme.space[3],
              borderRadius: 16,
              borderWidth: on ? 0 : 1,
              borderColor: theme.colors.borderStrong,
              backgroundColor: on ? theme.colors.foreground : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon
              icon={option.icon}
              size="sm"
              color={on ? theme.colors.background : theme.colors.foreground}
              decorative
            />
            <Text
              style={{
                color: on ? theme.colors.background : theme.colors.foreground,
                fontFamily: fonts.bodyBold,
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
