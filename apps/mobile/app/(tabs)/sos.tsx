import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { LargeTitle, NavBar, useScrolled } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { Badge, Body, Button, Caption, Card, Notice, Row, Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { useWeatherState } from '@/lib/conditions';
import { MY_PETS, PLACES } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Eye,
  Locate,
  Phone,
  ChevronRight,
  Siren,
  TriangleAlert,
  X,
} from '@/lib/icons';
import {
  formatOpenFor,
  openAlert,
  reportSighting,
  resolveAlert,
  useAllAlerts,
  type LiveAlert,
} from '@/lib/safety';
import { useHazardZones } from '@/lib/rescue';
import { useSettings } from '@/lib/settings';
import { useTheme } from '@/lib/theme';
import {
  EVIDENCE_CHECKLIST,
  alertReachM,
  REPORTING_CHANNELS_NOTE,
  RESCUE_DISCLAIMER,
  RESCUE_SCENARIOS,
  SAFETY_DISCLAIMER,
  SAFETY_SCENARIOS,
  describeZone,
  type RescueScenario,
  type SafetyScenario,
} from '@petnav/core';

/**
 * SOS.
 *
 * Esta pantalla existe porque el radar social se apaga fuera de las zonas
 * pet-friendly, y **una emergencia no ocurre en una zona pet-friendly**. Un
 * perro se suelta en una obra, huye de los petardos y cruza tres calles, salta
 * la valla de una finca que no conoce. Los sitios donde el radar está apagado
 * son justo donde importa.
 *
 * La respuesta no fue relajar la regla del radar —eso lo devolvería a ser una
 * baliza personal— sino tener dos objetos con reglas distintas. Aquí la
 * privacidad cede: se publica el punto exacto y lo ve todo tutor del radio.
 * Cede solo aquí, y solo sobre el propio animal.
 *
 * Tres cosas que esta pantalla hace y una lista de tipos de alerta no haría:
 *
 *  1. **Cada escenario trae su radio y su crecimiento.** Un cebo envenenado no
 *     se mueve; un perro en pánico recorre kilómetros en una hora. Un radio
 *     único fallaría en los dos casos, corto para uno y diluido para el otro.
 *  2. **Los pasos van antes que el formulario.** Quien abre esto está nervioso.
 *     Lo primero es qué hacer —quédate donde se soltó, no corras detrás—, no
 *     rellenar campos.
 *  3. **El último avistamiento manda sobre el punto de origen.** Seguir midiendo
 *     desde donde se perdió manda a la gente al sitio equivocado.
 */
export default function SosScreen() {
  const theme = useTheme();
  const { location } = useWeatherState();
  const { scrolled, onScroll } = useScrolled();
  const activePet = useActivePet();
  const alerts = useAllAlerts(location);

  const [composing, setComposing] = useState(false);

  const open = alerts.filter((live) => !live.alert.resolvedAt && live.reachesMe);
  const closed = alerts.filter((live) => live.alert.resolvedAt);

  return (
    <Screen>
      <NavBar title="SOS" scrolled={scrolled} showTitle={scrolled} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
      >
        <LargeTitle
          subtitle={
            open.length === 0
              ? 'No hay ninguna alerta abierta cerca de ti ahora mismo.'
              : open.length === 1
                ? 'Hay 1 alerta abierta que te alcanza.'
                : `Hay ${open.length} alertas abiertas que te alcanzan.`
          }
        >
          SOS
        </LargeTitle>

        {/* El botón de pánico. Es lo primero y es enorme a propósito: se pulsa
            con una mano, andando, y a veces corriendo. */}
        <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[5] }}>
          <PanicButton expanded={composing} onPress={() => setComposing((value) => !value)} />
        </View>

        {composing ? (
          <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[6] }}>
            <ScenarioPicker
              defaultPetName={activePet.name}
              onDone={(scenario, petName) => {
                const pet = MY_PETS.find((candidate) => candidate.name === petName);
                openAlert({
                  scenarioId: scenario.id,
                  petName: scenario.kind === 'lost_pet' ? petName : null,
                  petBreed: pet?.breeds[0] ?? null,
                  microchipCode: pet?.isMicrochipVerified ? '941000011122233' : null,
                  contactPhone: '+34 600 000 000',
                  ownerName: activePet.ownerName,
                  point: location,
                  areaName: 'Tu ubicación actual',
                });
                haptics.alarm();
                setComposing(false);
              }}
              onCancel={() => setComposing(false)}
            />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[4] }}>
          {open.length === 0 && !composing ? (
            <Notice>
              <Body>Ninguna alerta abierta en tu radio.</Body>
              <Caption>
                Es la buena noticia y por eso no se disfraza de pantalla rota. Si te pasa algo, el
                botón de arriba avisa a todo tutor dentro del radio del escenario que elijas —no
                solo a quien te sigue, y no solo a quien esté en un parque.
              </Caption>
            </Notice>
          ) : null}

          {open.map((live) => (
            <AlertCard key={live.alert.id} live={live} myLocation={location} />
          ))}

          {closed.length > 0 ? (
            <View style={{ paddingTop: theme.space[4], gap: theme.space[3] }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.displayBold,
                  fontSize: theme.fontSize.lg,
                }}
              >
                Ya resueltas
              </Text>
              <Caption>
                No se borran. Un aviso que desaparece deja a quien lo vio sin saber cómo acabó, y la
                próxima vez ya no lo mira.
              </Caption>
              {closed.map((live) => (
                <ResolvedRow key={live.alert.id} live={live} />
              ))}
            </View>
          ) : null}

          <RescueSection />

          <Notice>
            <Caption>{SAFETY_DISCLAIMER}</Caption>
          </Notice>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * El botón de pánico.
 *
 * Ochenta y ocho de alto, ancho completo, rojo de extraviados y con el texto
 * escrito. No es un icono: alguien que lo usa por primera vez está en la peor
 * situación posible para descifrar un pictograma.
 */
function PanicButton({ expanded, onPress }: { expanded: boolean; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={expanded ? 'Cerrar el aviso' : 'Dar la alarma'}
      accessibilityHint={
        expanded ? undefined : 'Avisa a todos los tutores dentro del radio del escenario'
      }
      onPress={() => {
        haptics.warn();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 88,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[4],
        paddingHorizontal: theme.space[5],
        borderRadius: theme.radius.xl,
        backgroundColor: expanded ? theme.colors.surface : theme.colors.destructive,
        borderWidth: expanded ? 2 : 0,
        borderColor: theme.colors.destructive,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Icon
        icon={expanded ? X : Siren}
        size="xl"
        color={expanded ? theme.colors.destructive : theme.colors.destructiveForeground}
        strokeWidth={2.5}
        decorative
      />
      <View style={{ flex: 1 }}>
        <Text
          maxFontSizeMultiplier={1.5}
          style={{
            color: expanded ? theme.colors.destructive : theme.colors.destructiveForeground,
            fontFamily: fonts.displayExtrabold,
            fontSize: theme.fontSize.xl,
            letterSpacing: -0.3,
          }}
        >
          {expanded ? 'Cancelar' : 'Dar la alarma'}
        </Text>
        {!expanded ? (
          <Text
            style={{
              color: theme.colors.destructiveForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            Perro perdido, cebos, brote o peligro en la zona
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Elegir el escenario.
 *
 * Es lo único que se pide antes de publicar, y no es burocracia: el escenario
 * decide el radio, si crece y a qué velocidad. Preguntar «¿qué ha pasado?»
 * cuesta un toque y es la diferencia entre avisar a 500 metros y avisar a tres
 * kilómetros que crecen a dos y medio por hora.
 */
function ScenarioPicker({
  defaultPetName,
  onDone,
  onCancel,
}: {
  defaultPetName: string;
  onDone: (scenario: SafetyScenario, petName: string) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [chosen, setChosen] = useState<SafetyScenario | null>(null);
  const [petName, setPetName] = useState(defaultPetName);

  const lost = SAFETY_SCENARIOS.filter((scenario) => scenario.kind === 'lost_pet');
  const other = SAFETY_SCENARIOS.filter((scenario) => scenario.kind !== 'lost_pet');

  if (chosen) {
    return (
      <Card>
        <Row gap={2}>
          <Badge tone={chosen.severity === 'critical' ? 'warning' : 'neutral'} icon={TriangleAlert}>
            {chosen.severity === 'critical' ? 'Crítico' : 'Aviso'}
          </Badge>
          <Badge tone="live">
            {chosen.initialRadiusM >= 1000
              ? `${chosen.initialRadiusM / 1000} km`
              : `${chosen.initialRadiusM} m`}
            {chosen.growthPerHourM > 0 ? ` · +${chosen.growthPerHourM} m/h` : ' · fijo'}
          </Badge>
        </Row>

        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.lg,
          }}
        >
          {chosen.label}
        </Text>
        <Body muted>{chosen.description}</Body>

        {/* Los pasos van antes del formulario. Quien está aquí está nervioso, y
            lo primero que necesita es qué hacer. */}
        <Steps steps={chosen.steps} />

        {chosen.kind === 'lost_pet' ? (
          <View style={{ gap: theme.space[2] }}>
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.sm,
              }}
            >
              ¿Cuál?
            </Text>
            <Row gap={2}>
              {MY_PETS.map((pet) => (
                <Pressable
                  key={pet.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: petName === pet.name }}
                  onPress={() => setPetName(pet.name)}
                  style={{
                    minHeight: theme.touchTarget.min,
                    justifyContent: 'center',
                    paddingHorizontal: theme.space[4],
                    borderRadius: theme.radius.full,
                    borderWidth: 1,
                    borderColor:
                      petName === pet.name ? theme.colors.destructive : theme.colors.border,
                    backgroundColor:
                      petName === pet.name ? theme.colors.destructive : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color:
                        petName === pet.name
                          ? theme.colors.destructiveForeground
                          : theme.colors.foreground,
                      fontFamily: petName === pet.name ? fonts.bodyBold : fonts.body,
                      fontSize: theme.fontSize.sm,
                    }}
                  >
                    {pet.name}
                  </Text>
                </Pressable>
              ))}
            </Row>
          </View>
        ) : null}

        <Button
          label="Publicar la alerta"
          icon={Siren}
          accessibilityHint={`Avisa a todo tutor en ${
            chosen.initialRadiusM >= 1000
              ? `${chosen.initialRadiusM / 1000} kilómetros`
              : `${chosen.initialRadiusM} metros`
          }`}
          onPress={() => onDone(chosen, petName)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Elegir otro escenario"
          onPress={() => setChosen(null)}
          style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
        >
          <Caption>Elegir otro</Caption>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.displayBold,
          fontSize: theme.fontSize.lg,
        }}
      >
        ¿Qué ha pasado?
      </Text>
      <Caption>
        Cada caso tiene su radio. No es un trámite: un cebo envenenado no se mueve y basta con 500
        metros, y un perro que ha huido por petardos puede estar a cinco kilómetros dentro de una
        hora.
      </Caption>

      <ScenarioGroup title="Se ha perdido" scenarios={lost} onPick={setChosen} />
      <ScenarioGroup title="Peligro o brote en la zona" scenarios={other} onPick={setChosen} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancelar"
        onPress={onCancel}
        style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
      >
        <Caption>Cancelar</Caption>
      </Pressable>
    </Card>
  );
}

function ScenarioGroup({
  title,
  scenarios,
  onPick,
}: {
  title: string;
  scenarios: readonly SafetyScenario[];
  onPick: (scenario: SafetyScenario) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[1] }}>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize.xs,
          letterSpacing: 1,
          textTransform: 'uppercase',
          paddingTop: theme.space[2],
        }}
      >
        {title}
      </Text>
      {scenarios.map((scenario) => (
        <Pressable
          key={scenario.id}
          accessibilityRole="button"
          accessibilityLabel={scenario.label}
          accessibilityHint={scenario.description}
          onPress={() => {
            haptics.tap();
            onPick(scenario);
          }}
          style={({ pressed }) => ({
            minHeight: theme.touchTarget.comfortable,
            justifyContent: 'center',
            paddingVertical: theme.space[2],
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.base,
            }}
          >
            {scenario.label}
          </Text>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.xs,
            }}
          >
            {scenario.initialRadiusM >= 1000
              ? `${scenario.initialRadiusM / 1000} km`
              : `${scenario.initialRadiusM} m`}
            {scenario.growthPerHourM > 0
              ? ` y creciendo · hasta ${scenario.maxRadiusM / 1000} km`
              : ' · no crece'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Qué hacer, en orden. Numerado porque el orden importa de verdad. */
function Steps({ steps }: { steps: readonly string[] }) {
  const theme = useTheme();

  return (
    <View
      style={{
        gap: theme.space[2],
        backgroundColor: theme.colors.surfaceSunken,
        borderRadius: theme.radius.md,
        padding: theme.space[4],
      }}
    >
      {steps.map((step, index) => (
        <View key={step} style={{ flexDirection: 'row', gap: theme.space[3] }}>
          <Text
            style={{
              color: theme.colors.liveForeground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.sm,
              fontVariant: ['tabular-nums'],
              minWidth: 16,
            }}
          >
            {index + 1}
          </Text>
          <Text
            style={{
              flex: 1,
              color: theme.colors.foreground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
              lineHeight: theme.fontSize.sm * 1.5,
            }}
          >
            {step}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Una alerta abierta.
 *
 * Enseña el radio **ahora** y por qué es ese: «abierta hace 1 h 35 min, 3 km al
 * empezar, 6,9 km ahora». Un radio sin explicación parece arbitrario; con el
 * tiempo delante se entiende solo, y lo que se entiende se respeta.
 */
function AlertCard({
  live,
  myLocation,
}: {
  live: LiveAlert;
  myLocation: { lat: number; lng: number };
}) {
  const theme = useTheme();
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');

  const { alert, scenario } = live;
  const grew = live.radiusM > scenario.initialRadiusM;

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 2,
        borderColor:
          scenario.severity === 'critical' ? theme.colors.destructive : theme.colors.warning,
        backgroundColor: theme.colors.surface,
        padding: theme.space[5],
        gap: theme.space[3],
      }}
    >
      <Row gap={2}>
        <Icon
          icon={scenario.severity === 'critical' ? Siren : TriangleAlert}
          size="base"
          color={
            scenario.severity === 'critical' ? theme.colors.destructive : theme.colors.warning
          }
          decorative
        />
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.lg,
            flexShrink: 1,
          }}
        >
          {alert.petName ? `${alert.petName}: ${scenario.label.toLowerCase()}` : scenario.label}
        </Text>
      </Row>

      <Body muted>{scenario.description}</Body>

      <View style={{ gap: theme.space[1] }}>
        <Row gap={2}>
          <Badge tone="live">A {live.distanceLabel} de ti</Badge>
          <Badge tone={grew ? 'warning' : 'neutral'}>Radio {km(live.radiusM)}</Badge>
        </Row>
        <Caption>
          Abierta hace {formatOpenFor(live.openForHours)}.{' '}
          {grew
            ? `Empezó en ${km(scenario.initialRadiusM)} y crece ${scenario.growthPerHourM} m cada hora, porque en este caso el animal se aleja mientras nadie lo encuentra.`
            : 'Este radio no crece: lo que avisa no se mueve de sitio, y ampliarlo solo diluiría el aviso.'}
        </Caption>
      </View>

      {alert.sightings.length > 0 ? (
        <View
          style={{
            gap: theme.space[2],
            backgroundColor: theme.colors.liveSurface,
            borderRadius: theme.radius.md,
            padding: theme.space[4],
          }}
        >
          <Row gap={2}>
            <Icon icon={Eye} size="base" color={theme.colors.liveForeground} decorative />
            <Text
              style={{
                color: theme.colors.liveForeground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.sm,
              }}
            >
              {alert.sightings.length === 1
                ? 'Último avistamiento'
                : `${alert.sightings.length} avistamientos`}
            </Text>
          </Row>
          {alert.sightings.slice(0, 2).map((sighting) => (
            <Text
              key={sighting.id}
              style={{
                color: theme.colors.liveForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
                lineHeight: theme.fontSize.sm * 1.5,
              }}
            >
              {sighting.note}
            </Text>
          ))}
          <Caption>
            La distancia de arriba se mide desde aquí, no desde donde se perdió: buscar en el punto
            de origen manda a la gente al sitio equivocado.
          </Caption>
        </View>
      ) : null}

      <Steps steps={scenario.steps} />

      {alert.microchipCode ? (
        <Caption>Chip {alert.microchipCode}. Cualquier veterinario puede leerlo gratis.</Caption>
      ) : null}

      {reporting ? (
        <View style={{ gap: theme.space[3] }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Qué has visto y dónde exactamente"
            placeholderTextColor={theme.colors.inputPlaceholder}
            accessibilityLabel="Descripción del avistamiento"
            style={{
              minHeight: 80,
              padding: theme.space[3],
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.input,
              color: theme.colors.inputForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.base,
            }}
          />
          <Row gap={2}>
            <Icon icon={Locate} size="sm" color={theme.colors.mutedForeground} decorative />
            <Caption>
              Se manda con tus coordenadas: «lo he visto por el centro» no sirve para buscar.
            </Caption>
          </Row>
          <Button
            label="Mandar el avistamiento"
            disabled={note.trim().length < 4}
            accessibilityHint="Actualiza el punto desde el que hay que buscar"
            onPress={() => {
              reportSighting(alert.id, {
                point: myLocation,
                note: note.trim(),
                reporterName: null,
              });
              haptics.commit();
              setNote('');
              setReporting(false);
            }}
          />
        </View>
      ) : (
        <Row gap={2}>
          <View style={{ flex: 1 }}>
            <Button
              label="Lo he visto"
              icon={Eye}
              variant="outline"
              accessibilityHint="Reportar dónde y cuándo, con tus coordenadas"
              onPress={() => setReporting(true)}
            />
          </View>
          {alert.contactPhone ? (
            <View style={{ flex: 1 }}>
              <Button
                label="Llamar"
                icon={Phone}
                variant="outline"
                accessibilityHint={`Llama a ${alert.ownerName}`}
                onPress={() => haptics.tap()}
              />
            </View>
          ) : null}
        </Row>
      )}

      {alert.ownerName !== 'Sin cuenta' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Marcar esta alerta como resuelta"
          onPress={() => {
            resolveAlert(alert.id);
            haptics.commit();
          }}
          style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
        >
          <Row gap={1}>
            <Icon icon={Check} size="sm" color={theme.colors.mutedForeground} decorative />
            <Caption>Ya apareció: cerrar la alerta</Caption>
          </Row>
        </Pressable>
      ) : null}
    </View>
  );
}

function ResolvedRow({ live }: { live: LiveAlert }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: theme.touchTarget.min,
      }}
    >
      <Icon icon={CircleCheck} size="base" color={theme.colors.success} decorative />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
          }}
        >
          {live.scenario.label}
        </Text>
        <Caption>
          {live.alert.areaName} · a {live.distanceLabel}
        </Caption>
      </View>
    </View>
  );
}

/**
 * Rescate: cuando el que necesita ayuda es un animal que no es tuyo.
 *
 * El resto de esta pantalla protege al perro de su tutor. Esto es lo otro, y en
 * Latinoamérica es la mitad del problema: quien se encuentra un animal
 * envenenado en un parque casi nunca es su dueño, y quien sale a buscarlo suele
 * ser una rescatista sin refugio, sin presupuesto y coordinándose por WhatsApp.
 * Lo que le falta no es voluntad, es enterarse a tiempo y saber qué hacer en
 * los primeros minutos.
 *
 * Tres bloques, y el orden es el de la urgencia:
 *
 *  1. **Los sitios marcados**, que es lo único que cuenta el patrón. Envenenar
 *     un parque no es un suceso: quien lo hace vuelve. Una alerta que caduca en
 *     horas cuenta cada visita por separado y pierde justo lo que había que ver.
 *  2. **Qué hacer**, por situación. En un envenenamiento el margen se cuenta en
 *     minutos y el paso que casi nadie sabe —no provocar el vómito— es el que
 *     más daño evita.
 *  3. **Qué reunir para denunciar**, porque un post no abre un expediente.
 *
 * Y lo que **no** hay: ningún sitio donde escribir de quién se sospecha. Ni
 * nombre, ni matrícula, ni texto libre. No es un campo pendiente de añadir —es
 * la garantía: acusaciones de maltrato animal publicadas en el teléfono de todo
 * un barrio han terminado en agresiones a personas que después no tenían nada
 * que ver, y confiar en moderar textos es confiar en llegar a tiempo. Si el
 * campo no existe, la acusación no se puede escribir.
 */
function RescueSection() {
  const theme = useTheme();
  const zones = useHazardZones();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={{ gap: theme.space[4] }}>
      <View style={{ gap: theme.space[1] }}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.xl,
          }}
        >
          Rescate
        </Text>
        <Caption>
          Cuando el animal que necesita ayuda no es el tuyo. Los avisos son sobre sitios, nunca
          sobre personas.
        </Caption>
      </View>

      {zones.length > 0 ? (
        <Card>
          <Row>
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.base,
              }}
            >
              Sitios marcados
            </Text>
            <Badge tone="warning">{String(zones.length)}</Badge>
          </Row>
          {zones.map((zone) => (
            <View key={`${zone.placeId}-${zone.scenarioId}`} style={{ gap: 2 }}>
              <Body>{placeNameOf(zone.placeId)}</Body>
              <Caption>{describeZone(zone)}</Caption>
            </View>
          ))}
          <Caption>
            Un sitio se marca con tres personas distintas, no con tres avisos: contando avisos,
            cualquiera vaciaría de gente el parque que quisiera repitiendo el formulario. Y la
            marca caduca sola al mes — un cebo en marzo no hace peligroso el parque en septiembre.
          </Caption>
        </Card>
      ) : null}

      <RoleRow />

      <View style={{ gap: theme.space[2] }}>
        {RESCUE_SCENARIOS.map((scenario) => (
          <RescueCard
            key={scenario.id}
            scenario={scenario}
            open={open === scenario.id}
            onToggle={() => setOpen(open === scenario.id ? null : scenario.id)}
          />
        ))}
      </View>

      <Card>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.base,
          }}
        >
          Para que una denuncia se sostenga
        </Text>
        {EVIDENCE_CHECKLIST.map((item) => (
          <Row key={item} gap={2}>
            <Icon icon={Check} size="sm" color={theme.colors.mutedForeground} decorative />
            <Caption>{item}</Caption>
          </Row>
        ))}
        {/* El hueco, marcado como hueco. Un teléfono sacado de memoria sería lo
            peor que puede hacer esta pantalla: alguien con un animal
            envenenado delante llamando a un número que no contesta. */}
        <Caption>{REPORTING_CHANNELS_NOTE}</Caption>
      </Card>

      <Notice>
        <Caption>{RESCUE_DISCLAIMER}</Caption>
      </Notice>
    </View>
  );
}

/** «1,5 km» o «800 m». Se decide por el número, no por quien llame. */
function km(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${meters} m`;
}

/**
 * Con qué alcance te llegan los avisos, y cómo cambiarlo.
 *
 * Va aquí y no solo en configuración porque esta es la pantalla donde alguien
 * se da cuenta de que le interesa: se lee «a una rescatista le llega desde
 * cinco kilómetros» justo cuando está mirando qué hacer con un animal
 * envenenado. Un ajuste enterrado que nadie sabe que existe es un ajuste que no
 * existe.
 */
function RoleRow() {
  const theme = useTheme();
  const router = useRouter();
  const rescuer = useSettings().rescuer;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rescuer ? 'Recibes avisos como rescatista' : 'Recibes avisos como tutor'}
      accessibilityHint="Abre configuración para cambiarlo"
      onPress={() => {
        haptics.tap();
        router.push('/ajustes');
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: theme.touchTarget.comfortable,
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[3],
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
      })}
    >
      <Icon icon={Siren} size="lg" color={theme.colors.mutedForeground} decorative />
      <View style={{ flex: 1 }}>
        <Body>{rescuer ? 'Te llegan como rescatista' : 'Te llegan como tutor'}</Body>
        <Caption>
          {rescuer
            ? 'Recibes avisos de varios kilómetros.'
            : 'Recibes solo lo que afecta a vuestro paseo.'}
        </Caption>
      </View>
      <Icon icon={ChevronRight} size="base" color={theme.colors.mutedForeground} decorative />
    </Pressable>
  );
}

function placeNameOf(placeId: string): string {
  return Object.values(PLACES).find((place) => place.id === placeId)?.name ?? 'Tu zona';
}

function RescueCard({
  scenario,
  open,
  onToggle,
}: {
  scenario: RescueScenario;
  open: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const critical = scenario.severity === 'critical';
  /* Lo que cambia el papel elegido, dicho en cada situación y no en general.
     «Un animal atado sin agua» no le llega a un tutor y sí a una rescatista, y
     eso no es un ajuste fino de notificaciones: es la diferencia entre decidir
     por dónde paseas y coger el coche. */
  const rescuer = useSettings().rescuer;
  const reach = alertReachM(scenario, rescuer ? 'rescuer' : 'tutor');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={scenario.label}
      accessibilityHint={open ? 'Cerrar los pasos' : 'Ver qué hacer'}
      onPress={() => {
        haptics.tap();
        onToggle();
      }}
      style={({ pressed }) => ({
        gap: theme.space[2],
        minHeight: theme.touchTarget.min,
        padding: theme.space[4],
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: critical ? theme.colors.destructive : theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
      })}
    >
      <Row>
        <Text
          style={{
            flex: 1,
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.sm,
          }}
        >
          {scenario.label}
        </Text>
        <Icon
          icon={open ? ChevronUp : ChevronDown}
          size="base"
          color={theme.colors.mutedForeground}
          decorative
        />
      </Row>
      <Caption>{scenario.description}</Caption>
      <Caption>
        {reach === 0
          ? 'No te avisamos: no afecta a tu paseo. A una rescatista sí.'
          : `Te avisamos si pasa a menos de ${km(reach)}.`}
      </Caption>

      {open ? (
        <View style={{ gap: theme.space[2], paddingTop: theme.space[1] }}>
          {scenario.steps.map((step, index) => (
            <View key={step} style={{ flexDirection: 'row', gap: theme.space[2] }}>
              {/* Numerados porque **el orden es el contenido**: en un
                  envenenamiento, ir al veterinario va antes que buscar la
                  muestra, y hacerlo al revés cuesta minutos que no hay. */}
              <Text
                style={{
                  color: theme.colors.mutedForeground,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize['2xs'],
                  fontVariant: ['tabular-nums'],
                  minWidth: 14,
                }}
              >
                {index + 1}
              </Text>
              <Caption>{step}</Caption>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
