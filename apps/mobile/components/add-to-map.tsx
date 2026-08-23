/**
 * Añadir algo al mapa.
 *
 * Hasta ahora el mapa era **de solo lectura**: enseñaba parques, fuentes y
 * veterinarios que venían dados, y lo único que se podía aportar era un aviso
 * de peligro. Eso deja fuera lo que de verdad sabe quien pasea por ahí todos
 * los días: que la fuente de la esquina tiene bebedero bajo, que en el paseo
 * hay una zona de sombra a media tarde, que el pipicán del plano municipal
 * lleva dos años cerrado.
 *
 * Cuatro caminos y ninguno es un formulario:
 *
 *  1. **Un peligro** — el catálogo de seguridad que ya existía.
 *  2. **Un animal que necesita ayuda** — envenenamiento, herido, camada,
 *     malas condiciones. Con sus pasos de primera reacción.
 *  3. **Un sitio que falta** — lo nuevo, y lo que convierte el mapa en algo
 *     que mejora solo.
 *  4. **Estáis fuera ahora** — el check-in, que vivía únicamente en el radar.
 *
 * ## Lo que se puede añadir, y por qué la lista es corta
 *
 * Solo cosas que **cualquiera puede confirmar estando delante** y que no
 * necesitan nombre: una fuente, un bebedero, una zona de sombra, una papelera
 * con bolsas, un pipicán. Nadie tiene que teclear nada.
 *
 * Un veterinario **no** está en la lista, y no por descuido: es un negocio con
 * nombre, dirección y horario, y un mapa lleno de clínicas metidas de memoria
 * por vecinos es un mapa que manda a alguien con una urgencia a un sitio que
 * cerró. Eso son datos verificados, no una contribución.
 *
 * Y no hay texto libre en ningún sitio, por lo mismo que en los avisos de
 * rescate: un campo donde escribir lo que sea acaba siendo un campo donde
 * escribir sobre alguien. Lo que se aporta es **qué** y **dónde**, y las dos
 * cosas se eligen tocando.
 */

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { RESCUE_SCENARIOS, type RescueScenario } from '@coincide/core';

import { Icon } from './icon';
import { Body, Caption, Screen } from '@/components/ui';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Droplets,
  Fence,
  Footprints,
  Radar,
  Siren,
  Trash2,
  TreePine,
  TriangleAlert,
  X,
  type LucideIcon,
} from '@/lib/icons';
import { useTheme } from '@/lib/theme';

/**
 * Los sitios que puede aportar cualquiera.
 *
 * El criterio de la lista: se confirma mirando, no hay que saber nada y no hay
 * que escribir nada. Si para añadir algo hiciera falta un nombre o un horario,
 * no es una contribución de barrio — son datos que alguien tiene que verificar.
 */
export const CONTRIBUTABLE_PLACES: ReadonlyArray<{
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  {
    id: 'water',
    label: 'Una fuente',
    hint: 'Se ve y se comprueba abriendo el grifo',
    icon: Droplets,
  },
  {
    id: 'bowl',
    label: 'Un bebedero bajo',
    hint: 'La diferencia entre que beba él o solo tú',
    icon: Droplets,
  },
  {
    id: 'shade',
    label: 'Zona de sombra',
    hint: 'En agosto es la información que decide la ruta',
    icon: TreePine,
  },
  {
    id: 'bags',
    label: 'Papelera con bolsas',
    hint: 'Saber dónde hay evita el paseo con la bolsa en la mano',
    icon: Trash2,
  },
  {
    id: 'off_leash',
    label: 'Zona canina',
    hint: 'Vallada y con la puerta cerrando bien, o no cuenta',
    icon: Fence,
  },
];

type Step = 'menu' | 'place' | 'rescue';

export function AddToMapSheet({
  areaName,
  onClose,
  onReportHazard,
  onCheckIn,
  onAddPlace,
  onReportRescue,
}: {
  /** Dónde se está, para que la hoja diga qué va a publicar y no «aquí». */
  areaName: string;
  onClose: () => void;
  onReportHazard: () => void;
  onCheckIn: () => void;
  onAddPlace: (kind: string) => void;
  onReportRescue: (scenario: RescueScenario) => void;
}) {
  const theme = useTheme();
  const [step, setStep] = useState<Step>('menu');

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.background,
      }}
    >
      <Screen>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space[2],
            paddingHorizontal: theme.space[4],
            paddingTop: theme.space[3],
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.xl,
              }}
            >
              {step === 'menu'
                ? 'Añadir al mapa'
                : step === 'place'
                  ? 'Qué hay aquí'
                  : 'Un animal necesita ayuda'}
            </Text>
            <Caption>{areaName}</Caption>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={step === 'menu' ? 'Cerrar' : 'Volver'}
            onPress={() => {
              haptics.tap();
              if (step === 'menu') onClose();
              else setStep('menu');
            }}
            style={({ pressed }) => ({
              width: theme.touchTarget.min,
              height: theme.touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon icon={X} size="lg" decorative />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: theme.space[4], gap: theme.space[3] }}
        >
          {step === 'menu' ? (
            <>
              <Option
                icon={TriangleAlert}
                tone="danger"
                label="Un peligro"
                hint="Cristales, cebos, un perro suelto, asfalto que quema"
                onPress={() => {
                  onClose();
                  onReportHazard();
                }}
              />
              <Option
                icon={Siren}
                tone="danger"
                label="Un animal que necesita ayuda"
                hint="Envenenado, herido, una camada abandonada"
                onPress={() => setStep('rescue')}
              />
              <Option
                icon={Droplets}
                label="Un sitio que falta"
                hint="Una fuente, sombra, una papelera con bolsas"
                onPress={() => setStep('place')}
              />
              <Option
                icon={Radar}
                label="Estáis fuera ahora"
                hint="Os hace visibles un rato y se apaga solo"
                onPress={() => {
                  onClose();
                  onCheckIn();
                }}
              />

              <Caption>
                Lo que se añade es un sitio o una situación, nunca una persona. No hay dónde
                escribir un nombre ni una matrícula, y no es un campo pendiente: es la garantía.
              </Caption>
            </>
          ) : null}

          {step === 'place' ? (
            <>
              {CONTRIBUTABLE_PLACES.map((place) => (
                <Option
                  key={place.id}
                  icon={place.icon}
                  label={place.label}
                  hint={place.hint}
                  onPress={() => {
                    onClose();
                    onAddPlace(place.id);
                  }}
                />
              ))}
              <Caption>
                Solo cosas que se confirman estando delante y que no hacen falta escribir. Un
                veterinario no está en la lista a propósito: es un negocio con horario y
                dirección, y un mapa de clínicas puestas de memoria manda a alguien con una
                urgencia a un sitio que cerró.
              </Caption>
            </>
          ) : null}

          {step === 'rescue' ? (
            <>
              {RESCUE_SCENARIOS.map((scenario) => (
                <Option
                  key={scenario.id}
                  icon={Footprints}
                  tone={scenario.severity === 'critical' ? 'danger' : 'default'}
                  label={scenario.label}
                  hint={scenario.description}
                  onPress={() => {
                    onClose();
                    onReportRescue(scenario);
                  }}
                />
              ))}
              <Caption>
                Al elegir uno verás qué hacer en los primeros minutos antes de publicar nada. En un
                envenenamiento el margen se cuenta en minutos, así que los pasos van antes que el
                aviso.
              </Caption>
            </>
          ) : null}
        </ScrollView>
      </Screen>
    </View>
  );
}

function Option({
  icon,
  label,
  hint,
  tone = 'default',
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
}) {
  const theme = useTheme();
  const danger = tone === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: theme.touchTarget.comfortable,
        padding: theme.space[4],
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: danger ? theme.colors.destructive : theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: danger ? theme.colors.destructive : theme.colors.primary,
        }}
      >
        <Icon
          icon={icon}
          size="base"
          color={danger ? theme.colors.destructiveForeground : theme.colors.primaryForeground}
          decorative
        />
      </View>
      <View style={{ flex: 1 }}>
        <Body>{label}</Body>
        <Caption>{hint}</Caption>
      </View>
    </Pressable>
  );
}
