/**
 * Quién está bloqueado.
 *
 * Existe porque un bloqueo sin lista es una decisión que no se puede deshacer:
 * la persona desaparece de todas partes —esa es la gracia— y con ella
 * desaparece el sitio desde el que la desbloquearías.
 */

import { ScrollView, Text, View } from 'react-native';
import { Pressable } from 'react-native';

import { BLOCK_NOTE } from '@petnav/core';

import { BackBar } from '@/components/chrome';
import { Caption, Notice, Screen } from '@/components/ui';
import { petById } from '@/lib/data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { unblock, useBlocks } from '@/lib/moderation';
import { useTheme } from '@/lib/theme';
import { OTHER_PETS } from '@/lib/demo-data';

export default function BlockedScreen() {
  const theme = useTheme();
  const blocks = useBlocks();

  return (
    <Screen>
      <BackBar title="Bloqueados" />

      <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[4] }}>
        {blocks.length === 0 ? (
          <Notice>
            <Caption>No has bloqueado a nadie.</Caption>
            <Caption>{BLOCK_NOTE}</Caption>
          </Notice>
        ) : null}

        {blocks.map((block) => {
          const name =
            OTHER_PETS.find((pet) => pet.ownerId === block.targetId)?.ownerName ?? block.targetId;
          return (
            <View
              key={block.targetId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[3],
                minHeight: theme.touchTarget.comfortable,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  {name}
                </Text>
                <Caption>Bloqueado</Caption>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Desbloquear a ${name}`}
                onPress={() => {
                  haptics.tap();
                  unblock(block.targetId);
                }}
                style={({ pressed }) => ({
                  minHeight: theme.touchTarget.min,
                  justifyContent: 'center',
                  paddingHorizontal: theme.space[4],
                  borderRadius: theme.radius.full,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fonts.bodyBold,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  Desbloquear
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
