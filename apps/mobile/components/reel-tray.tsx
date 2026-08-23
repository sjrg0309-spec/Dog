/**
 * La bandeja de reels del feed.
 *
 * Es la fila horizontal que Instagram metió dentro del feed cuando los reels
 * dejaron de tener pestaña propia, y aquí resuelve un problema real de
 * estructura: la barra de abajo tiene cinco destinos y uno de ellos es SOS, que
 * no se toca. Los reels entran por donde se piensa en ellos —pasando el feed— y
 * por la cuadrícula de Explorar, no ocupando el sitio del botón de emergencia.
 *
 * Cada tarjeta enseña la duración antes de entrar. Nadie quiere descubrir
 * dentro que el vídeo dura minuto y medio.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from './icon';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { ChevronRight, TriangleAlert, Video } from '@/lib/icons';
import { reelWarning, useReels } from '@/lib/reels';
import { useTheme } from '@/lib/theme';

export function ReelTray({ onOpen }: { onOpen: (id: string) => void }) {
  const theme = useTheme();
  const reels = useReels();

  if (reels.length === 0) return null;

  return (
    <View style={{ gap: theme.space[2], paddingTop: theme.space[5] }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          paddingHorizontal: theme.space[4],
        }}
      >
        <Icon icon={Video} size="base" color={theme.colors.foreground} decorative />
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.lg,
          }}
        >
          Reels
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todos los reels"
          onPress={() => {
            haptics.tap();
            onOpen(reels[0]?.id ?? '');
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: theme.touchTarget.min,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.primary,
              fontFamily: fonts.bodyBold,
              fontSize: theme.fontSize.sm,
            }}
          >
            Ver todos
          </Text>
          <Icon icon={ChevronRight} size="sm" color={theme.colors.primary} decorative />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.space[4], gap: theme.space[3] }}
      >
        {reels.map((reel) => {
          const warning = reelWarning(reel);
          return (
            <Pressable
              key={reel.id}
              accessibilityRole="button"
              accessibilityLabel={`Reel de ${reel.petName}, ${reel.durationS} segundos`}
              accessibilityHint={
                warning ? `${warning.headline}. ${reel.alt}` : reel.alt
              }
              onPress={() => {
                haptics.tap();
                onOpen(reel.id);
              }}
              style={({ pressed }) => ({
                width: 132,
                // Nueve dieciseisavos: la proporción del vídeo vertical. Una
                // miniatura cuadrada de un vídeo vertical miente sobre lo que
                // vas a ver.
                aspectRatio: 9 / 16,
                borderRadius: theme.radius.md,
                overflow: 'hidden',
                backgroundColor: theme.colors.surfaceSunken,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.space[2],
                justifyContent: 'space-between',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View
                  style={{
                    paddingHorizontal: theme.space[1.5],
                    borderRadius: theme.radius.xs,
                    backgroundColor: theme.colors.foreground,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.background,
                      fontFamily: fonts.bodyBold,
                      fontSize: 10,
                    }}
                  >
                    {reel.durationS}s
                  </Text>
                </View>
                {warning ? (
                  <Icon
                    icon={TriangleAlert}
                    size="sm"
                    color={
                      warning.level === 'stop' ? theme.colors.destructive : theme.colors.warning
                    }
                    decorative
                  />
                ) : null}
              </View>

              <View style={{ gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fonts.displayBold,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {reel.petName}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    color: theme.colors.mutedForeground,
                    fontFamily: fonts.body,
                    fontSize: 11,
                    lineHeight: 14,
                  }}
                >
                  {reel.caption}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
