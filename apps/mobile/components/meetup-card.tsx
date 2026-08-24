/**
 * Un punto de encuentro propuesto.
 *
 * La tarjeta contesta las cuatro preguntas en el orden en que se hacen: qué
 * plan, cuándo, dónde y con quién. El «cuándo» va grande porque una rutina se
 * decide por la hora —a las seis o a las ocho es otra vida—, y el «dónde» lleva
 * al lado **tu** caminata, que es el número que decide si esto se sostiene o se
 * abandona a la tercera semana.
 *
 * Lo que no lleva: a qué distancia vive nadie más. Ese dato existe en el
 * cálculo y no sale de él.
 */

import { Pressable, Text, View } from 'react-native';

import { PACE_LABEL } from '@petnav/core';
import { formatDistance } from '@petnav/core';

import { Avatar } from './avatar';
import type { MeetupSuggestion } from '@/lib/data';
import { fonts } from '@/lib/fonts';
import { MapPin, Users } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

const DAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const clock = (minuteOfDay: number): string =>
  `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;

/** Andar un kilómetro son unos doce minutos. Sirve para decirlo en tiempo. */
const walkMinutes = (metres: number): number => Math.max(1, Math.round(metres / 80));

export function MeetupCard({
  meetup,
  onPress,
}: {
  meetup: MeetupSuggestion;
  onPress?: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${PACE_LABEL[meetup.pace]} a las ${clock(meetup.startMinute)} en ${meetup.placeName}, con ${meetup.others.length + 1} personas`}
      onPress={onPress}
      style={{
        gap: theme.space[3],
        padding: theme.space[4],
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.xs,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            {PACE_LABEL[meetup.pace]}
          </Text>
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize['3xl'],
            }}
          >
            {clock(meetup.startMinute)}
          </Text>
        </View>

        {/* Los días, como una semana en miniatura: se lee de un vistazo si esto
            es todos los días o solo los martes. */}
        <View style={{ flexDirection: 'row', gap: 3, paddingTop: theme.space[2] }}>
          {DAY_SHORT.map((label, day) => {
            const active = meetup.weekdays.includes(day);
            return (
              <View
                key={day}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? theme.colors.primary : 'transparent',
                  borderWidth: active ? 0 : 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text
                  style={{
                    color: active ? theme.colors.primaryForeground : theme.colors.mutedForeground,
                    fontFamily: active ? fonts.bodyBold : fonts.body,
                    fontSize: theme.fontSize['2xs'],
                  }}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[2] }}>
        <MapPin size={16} color={theme.colors.mutedForeground} />
        <Text
          style={{
            flex: 1,
            color: theme.colors.foreground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
          }}
        >
          {meetup.placeName} · a {formatDistance(meetup.myWalkMeters)} de tu casa, unos{' '}
          {walkMinutes(meetup.myWalkMeters)} min andando
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        <View style={{ flexDirection: 'row' }}>
          {meetup.others.slice(0, 4).map((companion, index) => (
            <View
              key={companion.id}
              style={{
                marginLeft: index === 0 ? 0 : -10,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: theme.colors.surface,
              }}
            >
              <Avatar id={companion.id} name={companion.name} size={30} />
            </View>
          ))}
        </View>
        <Users size={14} color={theme.colors.mutedForeground} />
        <Text
          style={{
            flex: 1,
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
          }}
        >
          {meetup.others.map((companion) => companion.name).join(', ')}
        </Text>
      </View>
    </Pressable>
  );
}
