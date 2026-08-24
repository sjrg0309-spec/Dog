/**
 * Lo que va apareciendo mientras se rellena el alta.
 *
 * Un registro es la parte de una aplicación en la que más gente se cae, y se
 * cae por un motivo concreto: **das y no recibes**. Ocho pantallas contestando
 * preguntas sobre tu perro y lo único que pasa es que la barra de arriba se
 * mueve un poco.
 *
 * Aquí cada respuesta devuelve algo, y lo que devuelve no es un adorno: es la
 * aplicación funcionando con lo que llevas puesto.
 *
 *  1. **El retrato se dibuja con lo que has elegido.** No es una foto de
 *     archivo: el dibujo sale del identificador del animal, y durante el alta
 *     ese identificador es lo que llevas contestado. Cambiar la raza cambia el
 *     perro que estás mirando. Y el que sale al terminar es exactamente este,
 *     porque el identificador definitivo se construye con la misma semilla.
 *  2. **Con quién encajaría, calculado de verdad.** Es `calculateAffinity`, el
 *     mismo algoritmo que usa el descubrimiento, corriendo contra los perros
 *     del barrio con la ficha a medias. Al marcar «velocista» el número se
 *     mueve delante de ti.
 *  3. **Con quién coincidirías de horario**, con `scheduleOverlap`. Es la mitad
 *     del producto y la que más cuesta explicar en una pantalla de marketing:
 *     enseñarla mientras eliges los días la explica sola.
 *
 * Todo lo que se enseña aquí sale de módulos del núcleo con sus tests. Si el
 * emparejamiento cambiara mañana, esta pantalla cambiaría con él, que es la
 * diferencia entre una vista previa y una promesa dibujada.
 */

import { useMemo } from 'react';
import { Text, View } from 'react-native';

import {
  bandFor,
  calculateAffinity,
  describeOverlap,
  scheduleOverlap,
  type Availability,
  type MatchablePet,
} from '@coincide/core';

import { Avatar } from './avatar';
import { Pop } from './motion';
import { Caption } from '@/components/ui';
import { OTHER_PETS } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

/**
 * La semilla del retrato.
 *
 * Es lo que hace que el dibujo cambie al cambiar de raza y que **el perro que
 * sale al final sea el que estabas mirando**: el identificador definitivo se
 * construye con esta misma cadena, así que el retrato no da un salto al entrar.
 */
export function portraitSeed(input: { name: string; breeds: readonly string[]; size: string | null }): string {
  return `mine-${input.name.trim().toLowerCase()}-${[...input.breeds].sort().join('+')}-${input.size ?? ''}`;
}

/**
 * La ficha, tomando forma.
 *
 * Va arriba y se queda fija mientras se contesta: el retrato y los datos que ya
 * hay. Los datos entran de uno en uno y con un rebote corto —el mismo `Pop` que
 * usan las reacciones del feed— porque lo que cuenta es notar que **algo ha
 * pasado** al contestar.
 */
export function LiveCard({
  name,
  breeds,
  size,
  facts,
}: {
  name: string;
  breeds: readonly string[];
  size: string | null;
  /** Lo contestado hasta ahora, ya escrito para leerse. */
  facts: readonly string[];
}) {
  const theme = useTheme();
  const seed = portraitSeed({ name, breeds, size });

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        padding: theme.space[3],
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {/* El retrato rebota cuando cambia la semilla, que es cuando cambia el
          perro dibujado. Con movimiento reducido no rebota y sigue cambiando. */}
      <Pop trigger={seed}>
        <Avatar id={seed} name={name || 'Tu perro'} size={56} />
      </Pop>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: name ? theme.colors.foreground : theme.colors.mutedForeground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.base,
          }}
        >
          {name || 'Tu perro'}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.xs,
            lineHeight: theme.fontSize.xs * 1.4,
          }}
        >
          {facts.length > 0 ? facts.join(' · ') : 'Se va dibujando con lo que contestes'}
        </Text>
      </View>
    </View>
  );
}

/** Lo que hace falta para poder calcular una afinidad con sentido. */
export type DraftPet = {
  size: string | null;
  energy: string | null;
  playStyles: readonly string[];
  ageMonths: number | null;
  sex: 'male' | 'female' | null;
  trust: readonly string[];
};

function toMatchable(draft: DraftPet): MatchablePet | null {
  if (draft.size === null || draft.energy === null || draft.playStyles.length === 0) return null;
  return {
    id: 'alta-en-curso',
    speciesId: 'dog',
    size: draft.size as MatchablePet['size'],
    energyLevel: draft.energy as MatchablePet['energyLevel'],
    playStyles: draft.playStyles as MatchablePet['playStyles'],
    trustCircle: (draft.trust.length > 0 ? draft.trust : ['loves_everyone']) as MatchablePet['trustCircle'],
    sex: draft.sex ?? 'female',
    ageMonths: draft.ageMonths ?? 24,
  };
}

/**
 * Con quién encajaría, ahora mismo y con la ficha a medias.
 *
 * Es el algoritmo de verdad, no un número inventado para la pantalla: la misma
 * función que ordena el descubrimiento. Por eso puede salir **bajo**, y sale, y
 * es lo que hay que enseñar: un alta que promete «93 % con todo el barrio» a
 * cambio de tres toques está vendiendo algo que no va a pasar.
 */
export function LiveMatches({ draft }: { draft: DraftPet }) {
  const theme = useTheme();

  const matches = useMemo(() => {
    const me = toMatchable(draft);
    if (!me) return [];
    return OTHER_PETS.map((other) => ({ other, result: calculateAffinity(me, other) }))
      .filter((entry) => entry.result.score > 0)
      .sort((a, b) => b.result.score - a.result.score)
      .slice(0, 3);
  }, [draft]);

  if (matches.length === 0) return null;

  return (
    <View style={{ gap: theme.space[2] }}>
      <Caption>Con lo que llevas contestado, en tu barrio</Caption>
      {matches.map(({ other, result }) => (
        <Pop key={other.id} trigger={result.score}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[3],
              paddingVertical: theme.space[1],
            }}
          >
            <Avatar id={other.id} name={other.name} size={32} />
            <Text
              style={{
                flex: 1,
                color: theme.colors.foreground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              {other.name}
            </Text>
            {/* La barra dice lo mismo que el número, y las dos hacen falta: el
                número se compara y la barra se lee de un vistazo. */}
            <View
              style={{
                width: 72,
                height: 6,
                borderRadius: theme.radius.full,
                backgroundColor: theme.colors.muted,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${result.score}%`,
                  height: 6,
                  borderRadius: theme.radius.full,
                  backgroundColor:
                    bandFor(result.score) === 'great' ? theme.colors.success : theme.colors.primary,
                }}
              />
            </View>
            <Text
              numberOfLines={1}
              style={{
                width: 54,
                textAlign: 'right',
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.sm,
                fontVariant: ['tabular-nums'],
              }}
            >
              {result.score} %
            </Text>
          </View>
        </Pop>
      ))}
    </View>
  );
}

/**
 * Con quién coincidirías de horario, mientras eliges los días.
 *
 * Es la parte del producto que en una pantalla de marketing no se entiende
 * —«cruzamos horarios de paseo»— y que eligiendo los días se explica sola: al
 * marcar el miércoles aparece alguien nuevo debajo.
 *
 * Y sirve para lo que de verdad decide si esto funciona: si tu horario no
 * coincide con nadie, es mejor enterarse **aquí**, donde todavía se puede
 * apuntar la otra franja en la que también sacas al perro.
 */
export function LiveSchedule({
  days,
  startTime,
  endTime,
}: {
  days: readonly number[];
  startTime: string | null;
  endTime: string | null;
}) {
  const theme = useTheme();

  const matches = useMemo(() => {
    if (days.length === 0 || startTime === null || endTime === null) return [];
    const mine: Availability[] = days.map((weekday) => ({ weekday, startTime, endTime }));
    return OTHER_PETS.map((other) => ({
      other,
      overlap: scheduleOverlap(mine, other.availability),
    }))
      .filter((entry) => entry.overlap.totalMinutes > 0)
      .sort((a, b) => b.overlap.totalMinutes - a.overlap.totalMinutes)
      .slice(0, 3);
  }, [days, startTime, endTime]);

  if (days.length === 0 || startTime === null) return null;

  if (matches.length === 0) {
    return (
      <Caption>
        Con ese horario no coincides con nadie del barrio todavía. No es un problema: la
        aplicación existe justo para las horas en las que se pasea solo, y puedes añadir más
        franjas después desde tu perfil.
      </Caption>
    );
  }

  return (
    <View style={{ gap: theme.space[2] }}>
      <Caption>
        {matches.length === 1
          ? 'Con ese horario coincides con 1 perro del barrio'
          : `Con ese horario coincides con ${matches.length} perros del barrio`}
      </Caption>
      {matches.map(({ other, overlap }) => (
        <Pop key={other.id} trigger={overlap.totalMinutes}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}>
            <Avatar id={other.id} name={other.name} size={32} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize.sm,
                }}
              >
                {other.name}
              </Text>
              <Caption>{describeOverlap(overlap) ?? 'Coincidís algún rato'}</Caption>
            </View>
          </View>
        </Pop>
      ))}
    </View>
  );
}
