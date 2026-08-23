/**
 * La fila de historias — los «snacks».
 *
 * Es la mecánica de las historias de Instagram, y no por parecerse: el radar de
 * Coincide ya era exactamente esto —presencia en vivo, circular, que caduca
 * sola—. Ponerlo arriba y en horizontal es reconocer que el patrón ya estaba
 * inventado y que la gente sabe leerlo sin que nadie se lo explique.
 *
 * Del idioma de Instagram se toman tres cosas concretas:
 *
 *  1. **La primera posición es la propia, y es la acción.** Con la insignia de
 *     «+» encima cuando no estás fuera.
 *  2. **Anillo en degradado para lo que no has visto, aro apagado para lo
 *     visto.** Sin esa diferencia una fila de historias es decoración.
 *  3. **Rótulo corto debajo de cada burbuja**, no dentro.
 *
 * Lo que **no** se toma es el degradado de nadie: son dos paradas de esta
 * paleta. Y lo que se enseña de los demás sigue siendo el lugar, nunca la
 * persona.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar } from './avatar';
import { Icon } from './icon';
import { StoryRing } from './story-ring';
import { fonts } from '@/lib/fonts';
import { Plus } from '@/lib/icons';
import { useTheme } from '@/lib/theme';
import type { DemoPet } from '@/lib/data';

export function StoryRail({
  me,
  others,
  checkedIn,
  onCheckIn,
  disabled = false,
  disabledReason,
}: {
  me: DemoPet;
  others: DemoPet[];
  checkedIn: boolean;
  onCheckIn: () => void;
  /** Hoy no le conviene salir: el atajo no se ofrece. */
  disabled?: boolean;
  disabledReason?: string;
}) {
  const theme = useTheme();

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
        {/* La acción propia. Cuando el bienestar dice que no, no está: un botón
            en gris invita a buscar cómo activarlo. */}
        {disabled ? null : (
          <Bubble
            id={me.id}
            name={me.name}
            live={checkedIn}
            label={checkedIn ? 'Estás fuera' : 'Salir ahora'}
            hint={
              checkedIn
                ? 'Dejar de estar visible'
                : `Hacer visible a ${me.name} durante un rato; se apaga solo`
            }
            onPress={onCheckIn}
            showAdd={!checkedIn}
            ring={checkedIn ? 'unseen' : 'none'}
          />
        )}

        {others.map((pet, index) => (
          <Bubble
            key={pet.id}
            id={pet.id}
            name={pet.name}
            live
            label={pet.name}
            hint={`${pet.name} está en ${pet.placeName ?? 'la calle'}, le quedan ${pet.walkingUntilMinutes} minutos`}
            // El primero se marca como ya visto para que la fila enseñe los dos
            // estados. En la aplicación real sale de qué historias ha abierto
            // el tutor; aquí no hay ese registro todavía y fingirlo con todo en
            // «sin ver» escondería la mitad del patrón.
            ring={index === 0 ? 'seen' : 'unseen'}
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
          Ahora mismo no hay nadie de su especie fuera. Es lo normal fuera de las horas punta.
        </Text>
      ) : null}
    </View>
  );
}

function Bubble({
  id,
  name,
  live,
  label,
  hint,
  onPress,
  showAdd,
  ring = 'unseen',
}: {
  id: string;
  name: string;
  live: boolean;
  label: string;
  hint: string;
  onPress?: () => void;
  /** Insignia de «añadir»: solo en la burbuja propia y cuando no está fuera. */
  showAdd?: boolean;
  ring?: 'unseen' | 'seen' | 'none';
}) {
  const theme = useTheme();
  const content = (
    <View style={{ alignItems: 'center', gap: theme.space[1], width: 76 }}>
      <View>
        <StoryRing size={62} state={ring}>
          <Avatar id={id} name={name} size={62} />
        </StoryRing>
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
      </View>
      <Text
        numberOfLines={1}
        style={{
          color: live ? theme.colors.foreground : theme.colors.mutedForeground,
          fontFamily: live ? fonts.bodyBold : fonts.body,
          fontSize: theme.fontSize.xs,
        }}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) {
    // Sin acción no es un botón: se anuncia como un dato, con su texto completo.
    return (
      <View accessible accessibilityLabel={hint}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      // El área táctil real es la burbuja entera más su rótulo: 76 × 92, por
      // encima del mínimo de 44 que pide la guía.
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}
