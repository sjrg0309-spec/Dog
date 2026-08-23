/**
 * La cuadrícula de reels de Explorar.
 *
 * Dos columnas y proporción vertical, que es como se enseña vídeo vertical sin
 * mentir sobre lo que vas a ver: una miniatura cuadrada de un reel recorta
 * justo la parte donde está el animal.
 *
 * Cada tarjeta dice **la duración y las condiciones** antes de entrar. La
 * duración porque nadie quiere descubrir dentro que el vídeo dura minuto y
 * medio; las condiciones porque es el dato que esta aplicación pide antes de
 * proponer cualquier cosa, y esconderlo en el reproductor lo convertiría en
 * letra pequeña.
 */

import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from './icon';
import { SceneView } from './scene';
import { buildScene } from '@/lib/artwork';
import { Caption } from './ui';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Thermometer, TriangleAlert, Video } from '@/lib/icons';
import { REELS_NOTE, reelWarning, useReels } from '@/lib/reels';
import { useTheme } from '@/lib/theme';

export function ReelGrid({ onOpen }: { onOpen: (id: string) => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const reels = useReels();
  const cell = (width - theme.space[4] * 2 - theme.space[3]) / 2;

  return (
    <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[4] }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[3] }}>
        {reels.map((reel) => {
          const warning = reelWarning(reel);
          return (
            <Pressable
              key={reel.id}
              accessibilityRole="button"
              accessibilityLabel={`Reel de ${reel.petName}, ${reel.durationS} segundos`}
              accessibilityHint={warning ? `${warning.headline}. ${reel.alt}` : reel.alt}
              onPress={() => {
                haptics.tap();
                onOpen(reel.id);
              }}
              style={({ pressed }) => ({
                width: cell,
                aspectRatio: 9 / 16,
                borderRadius: theme.radius.md,
                overflow: 'hidden',
                backgroundColor: theme.colors.surfaceSunken,
                borderWidth: 2,
                borderColor: warning
                  ? warning.level === 'stop'
                    ? theme.colors.destructive
                    : theme.colors.warning
                  : 'transparent',
                justifyContent: 'space-between',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ position: 'absolute', left: 0, top: 0 }}>
                <SceneView
                  scene={buildScene({
                    seed: reel.id,
                    petId: reel.petId,
                    at: reel.createdAt,
                    width: 360,
                    height: 640,
                    pose: 'run',
                  })}
                  width={cell}
                  height={(cell * 16) / 9}
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
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space[1],
                    paddingHorizontal: theme.space[1.5],
                    borderRadius: theme.radius.xs,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                  }}
                >
                  <Icon icon={Video} size="sm" color="#fff" decorative />
                  <Text style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: 11 }}>
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

              <View style={{ gap: 2, padding: theme.space[2], backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <Text
                  numberOfLines={1}
                  style={{ color: '#fff', fontFamily: fonts.displayBold, fontSize: theme.fontSize.sm }}
                >
                  {reel.petName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1] }}>
                  <Icon icon={Thermometer} size="sm" color="#fff" decorative />
                  <Text
                    style={{ color: 'rgba(255,255,255,0.9)', fontFamily: fonts.body, fontSize: 11 }}
                  >
                    {reel.recordedIn.temperatureC} °C
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Caption>{REELS_NOTE}</Caption>
    </View>
  );
}
