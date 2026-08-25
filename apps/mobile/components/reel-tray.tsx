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
import { SceneView } from './scene';
import { buildScene } from '@/lib/artwork';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { ChevronRight, TriangleAlert, Video } from '@/lib/icons';
import { reelWarning, useReels } from '@/lib/reels';
import { useTheme } from '@/lib/theme';

/** La misma escena que abre el reproductor: una sola fuente por reel. */
const sceneFor = (id: string, petId: string, at: Date) =>
  buildScene({ seed: id, petId, at, width: 360, height: 640, pose: 'run' });

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
                justifyContent: 'space-between',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              {/* La miniatura es la misma escena del reproductor, no un dibujo
                  aparte: si fueran dos, el vídeo que abres no sería el que has
                  elegido. */}
              <View style={{ position: 'absolute', left: 0, top: 0 }}>
                <SceneView
                  scene={sceneFor(reel.id, reel.petId, reel.createdAt)}
                  width={132}
                  height={(132 * 16) / 9}
                />
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  padding: theme.space[2],
                }}
              >
                <View
                  style={{
                    paddingHorizontal: theme.space[1.5],
                    borderRadius: theme.radius.xs,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                  }}
                >
                  <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: theme.fontSize['2xs'] }}>
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

              {/* Un velo oscuro solo debajo del texto: sobre una ilustración
                  clara, el nombre en blanco desaparecería. */}
              <View
                style={{
                  gap: 2,
                  padding: theme.space[2],
                  backgroundColor: 'rgba(0,0,0,0.5)',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ color: '#fff', fontFamily: fonts.displayBold, fontSize: theme.fontSize.sm }}
                >
                  {reel.petName}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize['2xs'],
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
