import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LargeTitle, NavBar, Separator, useScrolled } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { MiniMap, type MapMarker } from '@/components/mini-map';
import { Badge, Body, Caption, Card, Notice, Row, Screen } from '@/components/ui';
import { useDeclaredConditions } from '@/lib/conditions';
import { PLACES, SERVICES, WATER_POINTS } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  CalendarDays,
  ChevronRight,
  Droplets,
  Fence,
  Radar,
  Siren,
  Stethoscope,
  Trees,
  Users,
  type LucideIcon,
} from '@/lib/icons';
import { useLiveAlerts } from '@/lib/safety';
import { useTheme } from '@/lib/theme';

/**
 * Explorar: el mapa y lo que hay en él.
 *
 * Cuatro capas, y se encienden y apagan por separado porque no se usan a la vez:
 * el agua se busca a 35 grados, el veterinario de guardia a las tres de la
 * mañana, el pipicán cuando te mudas de barrio. Enseñarlas todas siempre
 * convierte el mapa en una alfombra de puntos donde no se distingue nada.
 *
 * Las alertas de seguridad **no se pueden apagar**. Es la única capa fija, y es
 * deliberado: un aviso de cebos envenenados que se puede esconder sin querer con
 * un filtro es un aviso que no sirve.
 *
 * Desde aquí se entra al radar, a las quedadas y a los espacios. Son pantallas
 * enteras, no pestañas: se llega a ellas desde el sitio donde se piensa en ellas,
 * que es mirando el mapa.
 */
type LayerId = 'places' | 'water' | 'vets';

const LAYERS: ReadonlyArray<{ id: LayerId; label: string; icon: LucideIcon; hint: string }> = [
  { id: 'places', label: 'Pipicanes', icon: Trees, hint: 'Áreas caninas y parques donde el radar se enciende' },
  { id: 'water', label: 'Agua', icon: Droplets, hint: 'Fuentes públicas y bebederos' },
  { id: 'vets', label: 'Veterinarios', icon: Stethoscope, hint: 'Clínicas, con las de 24 horas marcadas' },
];

/** Cuánto abarca el cuadro de lado a lado. Barrio, zona, distrito. */
const SPANS_M = [1500, 4000, 12000] as const;

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { location } = useDeclaredConditions();
  const { scrolled, onScroll } = useScrolled();
  const alerts = useLiveAlerts(location);

  const [active, setActive] = useState<Set<LayerId>>(new Set(['places']));
  const [spanIndex, setSpanIndex] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const spanM = SPANS_M[spanIndex] ?? SPANS_M[1];

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];

    if (active.has('places')) {
      for (const place of Object.values(PLACES)) {
        list.push({
          id: place.id,
          lat: place.lat,
          lng: place.lng,
          label: place.name,
          detail: `${place.kind}. El radar se enciende dentro de ${place.radiusM} metros.`,
          icon: place.kind === 'Área canina' ? Fence : Trees,
          tone: 'place',
          radiusM: place.radiusM,
        });
      }
    }

    if (active.has('water')) {
      for (const point of WATER_POINTS) {
        list.push({
          id: point.id,
          lat: point.lat,
          lng: point.lng,
          label: point.name,
          detail: point.hasDogBowl
            ? 'Tiene bebedero bajo, así que le sirve a él y no solo a ti.'
            : 'Fuente alta: hace falta llevar recipiente.',
          icon: Droplets,
          tone: 'water',
        });
      }
    }

    if (active.has('vets')) {
      for (const service of SERVICES) {
        if (service.kind !== 'vet' && service.kind !== 'emergency_vet') continue;
        list.push({
          id: service.id,
          lat: service.lat,
          lng: service.lng,
          label: service.name,
          detail: service.is24h ? 'Abierto 24 horas.' : 'Horario de clínica.',
          icon: Stethoscope,
          tone: 'vet',
        });
      }
    }

    // Las alertas al final y siempre, con su radio real dibujado a escala.
    for (const live of alerts) {
      list.push({
        id: live.alert.id,
        lat: live.searchPoint.lat,
        lng: live.searchPoint.lng,
        label: live.alert.petName
          ? `${live.alert.petName}: ${live.scenario.label.toLowerCase()}`
          : live.scenario.label,
        detail: `${live.alert.areaName}. Radio ${live.radiusM >= 1000 ? `${(live.radiusM / 1000).toFixed(1).replace('.', ',')} km` : `${live.radiusM} m`}.`,
        icon: Siren,
        tone: 'alert',
        radiusM: live.radiusM,
      });
    }

    return list;
  }, [active, alerts]);

  const selected = markers.find((marker) => marker.id === selectedId) ?? null;

  const toggle = (id: LayerId) => {
    haptics.tap();
    setActive((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Screen>
      <NavBar title="Explorar" scrolled={scrolled} showTitle={scrolled} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
      >
        <LargeTitle subtitle="Dónde está lo que hace falta, y dónde no conviene pasar hoy.">
          Explorar
        </LargeTitle>

        <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[3] }}>
          <MiniMap
            center={location}
            markers={markers}
            spanM={spanM}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <Row gap={2}>
            {SPANS_M.map((span, index) => (
              <Pressable
                key={span}
                accessibilityRole="radio"
                accessibilityState={{ selected: index === spanIndex }}
                accessibilityLabel={`Abarcar ${span >= 1000 ? `${span / 1000} kilómetros` : `${span} metros`}`}
                onPress={() => {
                  haptics.tap();
                  setSpanIndex(index);
                }}
                style={{
                  minHeight: theme.touchTarget.min,
                  justifyContent: 'center',
                  paddingHorizontal: theme.space[4],
                  borderRadius: theme.radius.full,
                  borderWidth: 1,
                  borderColor:
                    index === spanIndex ? theme.colors.primary : theme.colors.border,
                  backgroundColor: index === spanIndex ? theme.colors.primary : 'transparent',
                }}
              >
                <Text
                  style={{
                    color:
                      index === spanIndex
                        ? theme.colors.primaryForeground
                        : theme.colors.mutedForeground,
                    fontFamily: index === spanIndex ? fonts.bodyBold : fonts.body,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {span / 1000} km
                </Text>
              </Pressable>
            ))}
          </Row>

          <Caption>
            Es un esquema, no un mapa de calles: no hay proveedor de teselas conectado y dibujar
            calles inventadas sería peor que no dibujarlas. Las posiciones, las distancias y los
            radios sí son reales.
          </Caption>

          {/* Capas */}
          <View style={{ gap: theme.space[2], paddingTop: theme.space[2] }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.lg,
              }}
            >
              Capas
            </Text>
            <Row gap={2}>
              {LAYERS.map((layer) => {
                const on = active.has(layer.id);
                return (
                  <Pressable
                    key={layer.id}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={layer.label}
                    accessibilityHint={layer.hint}
                    onPress={() => toggle(layer.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.space[2],
                      minHeight: theme.touchTarget.min,
                      paddingHorizontal: theme.space[4],
                      borderRadius: theme.radius.full,
                      borderWidth: 1,
                      borderColor: on ? theme.colors.primary : theme.colors.border,
                      backgroundColor: on ? theme.colors.primary : 'transparent',
                    }}
                  >
                    <Icon
                      icon={layer.icon}
                      size="sm"
                      color={on ? theme.colors.primaryForeground : theme.colors.mutedForeground}
                      decorative
                    />
                    <Text
                      style={{
                        color: on ? theme.colors.primaryForeground : theme.colors.mutedForeground,
                        fontFamily: on ? fonts.bodyBold : fonts.body,
                        fontSize: theme.fontSize.sm,
                      }}
                    >
                      {layer.label}
                    </Text>
                  </Pressable>
                );
              })}
            </Row>
            <Caption>
              Las alertas de seguridad no se apagan. Es la única capa fija: un aviso de cebos que se
              puede esconder sin querer con un filtro no sirve de nada.
            </Caption>
          </View>

          {selected ? (
            <Card>
              <Row gap={2}>
                <Icon
                  icon={selected.icon}
                  size="base"
                  color={
                    selected.tone === 'alert' ? theme.colors.destructive : theme.colors.primary
                  }
                  decorative
                />
                <Text
                  accessibilityRole="header"
                  style={{
                    flexShrink: 1,
                    color: theme.colors.foreground,
                    fontFamily: fonts.displayBold,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  {selected.label}
                </Text>
              </Row>
              <Body muted>{selected.detail}</Body>
              {selected.tone === 'alert' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir la alerta en SOS"
                  onPress={() => router.push('/sos')}
                  style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
                >
                  <Text
                    style={{
                      color: theme.colors.destructive,
                      fontFamily: fonts.bodyBold,
                      fontSize: theme.fontSize.base,
                    }}
                  >
                    Ver los pasos y reportar avistamiento
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          ) : (
            <Notice>
              <Caption>
                Toca un marcador para ver qué es. Los círculos son alcance real: el de un lugar es
                la zona donde se puede encender el radar, y el de una alerta es a quién está
                avisando ahora mismo.
              </Caption>
            </Notice>
          )}
        </View>

        {/* Las tres pantallas que se piensan mirando el mapa. */}
        <View style={{ paddingTop: theme.space[8] }}>
          <Separator />
          <Destination
            href="/radar"
            icon={Radar}
            title="Radar"
            detail="Quién está paseando ahora, dentro de una zona pet-friendly"
          />
          <Separator inset={theme.space[16]} />
          <Destination
            href="/quedadas"
            icon={CalendarDays}
            title="Quedadas"
            detail="Espontáneas y programadas, con la afinidad del grupo delante"
          />
          <Separator inset={theme.space[16]} />
          <Destination
            href="/espacios"
            icon={Fence}
            title="Espacios privados"
            detail="Patios cerrados, con el coste ya repartido entre el grupo"
          />
          <Separator inset={theme.space[16]} />
          <Destination
            href="/comunidad"
            icon={Users}
            title="Comunidad y servicios"
            detail="Grupos de tu zona y quién sabe tratar a tu especie"
          />
          <Separator />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Destination({
  href,
  icon,
  title,
  detail,
}: {
  href: '/radar' | '/quedadas' | '/espacios' | '/comunidad';
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  const theme = useTheme();

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={title}
        accessibilityHint={detail}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[4],
          minHeight: theme.touchTarget.comfortable + 12,
          paddingHorizontal: theme.space[4],
          backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
        })}
      >
        <Icon icon={icon} size="lg" color={theme.colors.primary} decorative />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            {detail}
          </Text>
        </View>
        <Icon icon={ChevronRight} size="base" color={theme.colors.mutedForeground} decorative />
      </Pressable>
    </Link>
  );
}
