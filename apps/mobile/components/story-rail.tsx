/**
 * La fila de estados.
 *
 * Es el carrete de historias de Instagram, y aquí carga dos cosas que en otras
 * aplicaciones van separadas:
 *
 *  1. **Los estados**, que caducan a las 24 horas. El anillo en degradado es lo
 *     que no has visto; el aro apagado, lo visto. Sin esa diferencia una fila de
 *     historias es decoración.
 *  2. **Quién está fuera ahora**, con una etiqueta EN VIVO bajo el retrato. Es
 *     la mecánica del radar, que existía en este proyecto antes que los
 *     estados, y va como insignia y no como otro anillo: dos anillos distintos
 *     en el mismo círculo no se distinguen, y uno de los dos deja de leerse.
 *
 * La primera posición es la propia y es la acción. Lo que se enseña de los
 * demás sigue siendo el lugar, nunca la persona.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { Pulse } from './motion';
import { StoryRing } from './story-ring';
import type { DemoPet } from '@/lib/data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Plus } from '@/lib/icons';
import type { StoryGroup } from '@/lib/stories';
import { useTheme } from '@/lib/theme';

export function StoryRail({
  me,
  groups,
  /** Quién está paseando ahora mismo, por identificador. */
  liveIds,
  myStoryCount,
  onCreate,
  onOpen,
  checkedIn,
  onCheckIn,
  disabled = false,
  disabledReason,
}: {
  me: DemoPet;
  groups: StoryGroup[];
  liveIds: Set<string>;
  myStoryCount: number;
  onCreate: () => void;
  onOpen: (petId: string) => void;
  checkedIn: boolean;
  onCheckIn: () => void;
  /** Hoy no le conviene salir: el atajo de salir no se ofrece. */
  disabled?: boolean;
  disabledReason?: string;
}) {
  const theme = useTheme();
  const others = groups.filter((group) => group.petId !== me.id);

  return (
    <View style={{ gap: theme.space[2] }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.space[4],
          gap: theme.space[4],
          paddingVertical: theme.space[1],
        }}
      >
        {/* Tu estado. Con el «+» cuando no hay ninguno, y con anillo cuando sí:
            es la única burbuja que hace dos cosas distintas según lo que haya. */}
        <Bubble
          id={me.id}
          name={me.name}
          label={myStoryCount > 0 ? 'Tu estado' : 'Añadir estado'}
          hint={
            myStoryCount > 0
              ? `Ver tus ${myStoryCount === 1 ? 'estado' : `${myStoryCount} estados`}, y quién los ha visto`
              : 'Publicar algo que caduca a las 24 horas'
          }
          ring={myStoryCount > 0 ? 'seen' : 'none'}
          live={checkedIn}
          showAdd={myStoryCount === 0}
          onPress={() => {
            haptics.tap();
            if (myStoryCount > 0) onOpen(me.id);
            else onCreate();
          }}
        />

        {/* El atajo de salir, cuando el bienestar lo permite. Va aparte del
            estado porque no es contenido: es presencia, y caduca sola. */}
        {disabled ? null : (
          <Bubble
            id={`${me.id}-radar`}
            name={me.name}
            label={checkedIn ? 'Estás fuera' : 'Salir ahora'}
            hint={
              checkedIn
                ? 'Dejar de estar visible'
                : `Hacer visible a ${me.name} durante un rato; se apaga solo`
            }
            ring={checkedIn ? 'unseen' : 'none'}
            live={checkedIn}
            onPress={() => {
              haptics.tap();
              onCheckIn();
            }}
          />
        )}

        {others.map((group) => (
          <Bubble
            key={group.petId}
            id={group.petId}
            name={group.petName}
            label={group.petName}
            hint={
              `${group.stories.length === 1 ? '1 estado' : `${group.stories.length} estados`} de ${group.petName}` +
              (liveIds.has(group.petId) ? ', y está fuera ahora' : '')
            }
            ring={group.hasUnseen ? 'unseen' : 'seen'}
            live={liveIds.has(group.petId)}
            onPress={() => {
              haptics.tap();
              onOpen(group.petId);
            }}
          />
        ))}
      </ScrollView>

      {disabled && disabledReason ? (
        <Text
          style={{
            paddingHorizontal: theme.space[4],
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
          }}
        >
          {disabledReason}
        </Text>
      ) : others.length === 0 ? (
        <Text
          style={{
            paddingHorizontal: theme.space[4],
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
          }}
        >
          Nadie de tu zona tiene un estado abierto. Caducan a las 24 horas, así que la fila se vacía
          sola.
        </Text>
      ) : null}
    </View>
  );
}

function Bubble({
  id,
  name,
  label,
  hint,
  onPress,
  showAdd,
  ring,
  live,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  onPress: () => void;
  /** Insignia de «añadir»: solo en la burbuja propia y cuando no hay estado. */
  showAdd?: boolean;
  ring: 'unseen' | 'seen' | 'none';
  /** Está fuera ahora mismo: lleva la etiqueta EN VIVO. */
  live?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      // El área táctil real es la burbuja entera más su rótulo: 76 × 92, por
      // encima del mínimo de 44 que pide la guía.
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ alignItems: 'center', gap: theme.space[1], width: 76 }}>
        <View>
          {/* El pulso es el único movimiento continuo de la aplicación y solo
              lo lleva quien está fuera **ahora**. Por eso significa algo. */}
          <Pulse active={live === true}>
            <StoryRing size={62} state={ring}>
              <Avatar id={id} name={name} size={62} />
            </StoryRing>
          </Pulse>

          {showAdd ? (
            <View
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme.colors.background,
              }}
            >
              <Icon icon={Plus} size="sm" color={theme.colors.primaryForeground} decorative />
            </View>
          ) : null}

          {/* EN VIVO va debajo y encima del retrato, como en Instagram. Lleva la
              palabra escrita: el color solo no dice nada a quien no lo separa. */}
          {live ? (
            <View
              style={{
                position: 'absolute',
                bottom: -6,
                alignSelf: 'center',
                paddingHorizontal: theme.space[2],
                paddingVertical: 1,
                borderRadius: theme.radius.xs,
                backgroundColor: theme.colors.liveRing,
                borderWidth: 2,
                borderColor: theme.colors.background,
              }}
            >
              <Text
                style={{
                  color: theme.colors.background,
                  fontFamily: fonts.bodyBold,
                  fontSize: 9,
                  letterSpacing: 0.4,
                }}
              >
                EN VIVO
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          numberOfLines={1}
          style={{
            marginTop: live ? theme.space[1] : 0,
            color: ring === 'unseen' ? theme.colors.foreground : theme.colors.mutedForeground,
            fontFamily: ring === 'unseen' ? fonts.bodyBold : fonts.body,
            fontSize: theme.fontSize.xs,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
