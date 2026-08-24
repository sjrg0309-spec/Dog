/**
 * Reportar algo desde el mapa.
 *
 * Lo que faltaba no era el dominio: `packages/core/src/safety.ts` ya tenía
 * catalogados el perro suelto, el asfalto que quema, los cristales, el cebo y la
 * procesionaria, cada uno con su radio de aviso y su crecimiento por hora. Lo
 * que faltaba era **la puerta**: desde el mapa no había forma de decir «esto
 * está pasando aquí», y un catálogo de peligros al que no se llega es un
 * catálogo que no existe.
 *
 * Va sobre el mapa y no dentro de un formulario porque el momento de usarlo es
 * andando: se ve el vidrio en el suelo, se saca el teléfono, dos toques. Un
 * flujo de tres pantallas para avisar de un cristal es un aviso que nadie da.
 *
 * **El sitio es donde estás.** No se pide, no se escribe, no se elige en un
 * mapa: un peligro se reporta donde se ve, y preguntar «¿dónde?» a alguien que
 * está delante del peligro es la pregunta más fácil de contestar mal.
 *
 * **Y se confirma antes de publicar.** La primera versión avisaba con un solo
 * toque, y eso incumple la regla de las tres plataformas sobre acciones
 * difíciles de deshacer: esto sale a cientos de vecinos, llega como
 * notificación y ya no se puede recoger —resolverlo después no borra el aviso
 * que la gente ya recibió—. El botón está sobre el mapa, al alcance del pulgar
 * y en rojo: la probabilidad de dispararlo sin querer no es teórica. Un toque
 * más, y a cambio se enseña **qué se va a publicar y hasta dónde llega**.
 *
 * Dos de las cinco casillas del diseño no son peligros y por eso no salen de
 * aquí: «bebedero sin agua» es un dato del sitio y no una alerta con radio, y
 * «amigos en el parque» es presencia, que es lo que hace el radar. Meterlas en
 * el mismo menú convertiría un aviso de seguridad en una lista de recados, y lo
 * que se pierde con eso es la seriedad del rojo.
 */

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SAFETY_SCENARIOS, type SafetyScenario } from '@petnav/core';

import { Icon } from './icon';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Footprints,
  Siren,
  Thermometer,
  Trees,
  TriangleAlert,
  X,
  type LucideIcon,
} from '@/lib/icons';
import { useTheme } from '@/lib/theme';

/**
 * Qué se puede reportar sobre la marcha, y con qué icono.
 *
 * Es un subconjunto del catálogo y no el catálogo entero: aquí sólo caben los
 * peligros que se ven **paseando**. Perder un perro también es una alerta y no
 * está en esta lista, porque ese flujo pide chip, teléfono y foto y vive en su
 * pantalla; meterlo detrás de un botón de dos toques sería abrir la alerta más
 * seria de la aplicación por accidente.
 */
const REPORTABLE: ReadonlyArray<{ id: string; icon: LucideIcon }> = [
  { id: 'loose_aggressive', icon: Footprints },
  { id: 'debris', icon: TriangleAlert },
  { id: 'hot_asphalt', icon: Thermometer },
  { id: 'poison_bait', icon: Siren },
  { id: 'processionary', icon: Trees },
];

export const REPORT_SCENARIOS: ReadonlyArray<{ scenario: SafetyScenario; icon: LucideIcon }> =
  REPORTABLE.map((entry) => {
    const scenario = SAFETY_SCENARIOS.find((candidate) => candidate.id === entry.id);
    /* Si el catálogo cambia un identificador, esto revienta al arrancar en vez
       de dibujar un menú con un hueco. Un botón que falta se descubre tarde y
       por casualidad; una excepción, la primera vez. */
    if (!scenario) throw new Error(`El escenario «${entry.id}» ya no está en el catálogo`);
    return { scenario, icon: entry.icon };
  });

const radiusLabel = (metres: number): string =>
  metres >= 1000 ? `${(metres / 1000).toFixed(1).replace('.', ',')} km` : `${metres} m`;

export function ReportSheet({
  areaName,
  onReport,
  onClose,
}: {
  /** Dónde se está, en palabras. Sale en la ficha de la alerta. */
  areaName: string;
  onReport: (scenario: SafetyScenario) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [pending, setPending] = useState<SafetyScenario | null>(null);

  if (pending) {
    return (
      <Confirm
        scenario={pending}
        areaName={areaName}
        onBack={() => setPending(null)}
        onConfirm={() => onReport(pending)}
      />
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        gap: theme.space[3],
        paddingHorizontal: theme.space[4],
        paddingTop: theme.space[4],
        paddingBottom: theme.space[6],
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[3] }}>
        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.lg,
            }}
          >
            Avisar de algo aquí
          </Text>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            Se publica en {areaName}, donde estás ahora. Cada aviso trae escrito a cuánta distancia
            avisa y cuánto dura.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          onPress={() => {
            haptics.tap();
            onClose();
          }}
          style={({ pressed }) => ({
            width: theme.touchTarget.min,
            height: theme.touchTarget.min,
            marginTop: -theme.space[2],
            marginRight: -theme.space[2],
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon icon={X} size="lg" decorative />
        </Pressable>
      </View>

      {/* Rejilla de dos, como en el diseño: con una columna la lista se va por
          debajo del pliegue y hay que desplazar para ver el quinto. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
        {REPORT_SCENARIOS.map(({ scenario, icon }) => (
          <Pressable
            key={scenario.id}
            accessibilityRole="button"
            accessibilityLabel={scenario.label}
            accessibilityHint={`${scenario.description} Avisa a ${radiusLabel(scenario.initialRadiusM)} a la redonda.`}
            onPress={() => {
              haptics.tap();
              setPending(scenario);
            }}
            style={({ pressed }) => ({
              // Dos por fila, contando el hueco de ocho entre ellas.
              width: '48%',
              flexGrow: 1,
              gap: theme.space[1],
              minHeight: 92,
              padding: theme.space[3],
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
            })}
          >
            <Icon
              icon={icon}
              size="lg"
              color={
                scenario.severity === 'critical' ? theme.colors.destructive : theme.colors.warning
              }
              decorative
            />
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.xs,
              }}
            >
              {scenario.label}
            </Text>
            {/* El radio, escrito en la casilla y no escondido en una confirmación.
                Es la diferencia entre avisar a la manzana y avisar al distrito,
                y quien pulsa tiene derecho a saberlo **antes**. */}
            <Text
              style={{ color: theme.colors.mutedForeground, fontFamily: fonts.body, fontSize: theme.fontSize['2xs'] }}
            >
              Avisa a {radiusLabel(scenario.initialRadiusM)}
              {scenario.growthPerHourM > 0 ? ', y crece' : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text
        style={{ color: theme.colors.mutedForeground, fontFamily: fonts.body, fontSize: theme.fontSize['2xs'] }}
      >
        ¿Se ha perdido un perro? Eso no se avisa desde aquí: va en SOS, que pide chip y teléfono y
        avisa mucho más lejos.
      </Text>
    </View>
  );
}

/**
 * Lo que se va a publicar, antes de publicarlo.
 *
 * No es un «¿estás seguro?» —esa pregunta no informa de nada—: es la ficha del
 * aviso. Qué se dice, dónde, a cuánta distancia llega, y qué pasa después. Con
 * eso, quien confirma sabe lo que hace; sin eso, la confirmación es un peaje.
 */
function Confirm({
  scenario,
  areaName,
  onBack,
  onConfirm,
}: {
  scenario: SafetyScenario;
  areaName: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        gap: theme.space[3],
        paddingHorizontal: theme.space[4],
        paddingTop: theme.space[4],
        paddingBottom: theme.space[6],
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        backgroundColor: theme.colors.background,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.displayBold,
          fontSize: theme.fontSize.lg,
        }}
      >
        {scenario.label}
      </Text>

      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
          lineHeight: theme.fontSize.sm * 1.4,
        }}
      >
        {scenario.description}
      </Text>

      <View style={{ gap: theme.space[1] }}>
        <Row label="Dónde" value={areaName} />
        <Row
          label="A quién llega"
          value={`A todo el que esté a ${radiusLabel(scenario.initialRadiusM)}${
            scenario.growthPerHourM > 0
              ? `, y más lejos según pasan las horas hasta ${radiusLabel(scenario.maxRadiusM)}`
              : ''
          }`}
        />
      </View>

      <Text
        style={{
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.xs,
        }}
      >
        Sale como notificación. Se puede marcar como resuelto después, pero eso no borra el aviso
        que la gente ya ha recibido.
      </Text>

      <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a la lista de avisos"
          onPress={() => {
            haptics.tap();
            onBack();
          }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: theme.touchTarget.comfortable,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.base,
            }}
          >
            Volver
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Publicar el aviso de ${scenario.label}`}
          accessibilityHint={`Llega a todo el que esté a ${radiusLabel(scenario.initialRadiusM)}`}
          onPress={() => {
            haptics.commit();
            onConfirm();
          }}
          style={({ pressed }) => ({
            flex: 2,
            minHeight: theme.touchTarget.comfortable,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.destructive,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.destructiveForeground,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.base,
            }}
          >
            Publicar el aviso
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
      <Text
        style={{
          width: 96,
          color: theme.colors.mutedForeground,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flex: 1,
          color: theme.colors.foreground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
