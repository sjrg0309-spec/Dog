/**
 * Quién está bloqueado.
 *
 * Existe porque un bloqueo sin lista es una decisión que no se puede deshacer:
 * la persona desaparece de todas partes —esa es la gracia— y con ella
 * desaparece el sitio desde el que la desbloquearías.
 *
 * Se ve como la lista de bloqueados de cualquier red social, que es lo mismo
 * que decir: como el resto de listas de esta aplicación. Retrato, nombre y la
 * pastilla de deshacer a la derecha.
 */

import { ScrollView, View } from 'react-native';

import { BLOCK_NOTE } from '@petnav/core';

import { Avatar } from '@/components/avatar';
import { BackBar } from '@/components/chrome';
import { EmptyState, FootNote, ListGroup, ListRow, PillButton } from '@/components/list';
import { Screen } from '@/components/ui';
import { Ban } from '@/lib/icons';
import { useTheme } from '@/lib/theme';
import { unblock, useBlocks } from '@/lib/moderation';
import { OTHER_PETS } from '@/lib/demo-data';

export default function BlockedScreen() {
  const theme = useTheme();
  const blocks = useBlocks();

  return (
    <Screen grouped>
      <BackBar title="Bloqueados" />

      <ScrollView contentContainerStyle={{ paddingBottom: theme.space[16] }}>
        {blocks.length === 0 ? (
          <EmptyState icon={Ban} title="No has bloqueado a nadie" body={BLOCK_NOTE} />
        ) : (
          <>
            <ListGroup leading="avatar">
              {blocks.map((block) => {
                /* El retrato es el del animal de esa persona y no el suyo: en esta
                 aplicación se reconoce a los vecinos por el perro, que es con
                 quien se ha coincidido en la calle. */
                const other = OTHER_PETS.find((pet) => pet.ownerId === block.targetId);
                const name = other?.ownerName ?? block.targetId;

                return (
                  <ListRow
                    key={block.targetId}
                    leading={
                      other ? <Avatar id={other.id} name={other.name} size={44} /> : undefined
                    }
                    title={name}
                    subtitle={other ? `Tutor de ${other.name}` : 'Bloqueado'}
                    trailing={
                      <PillButton
                        label="Desbloquear"
                        variant="neutral"
                        accessibilityHint={`Vuelve a ver a ${name} en el feed, el radar y las quedadas`}
                        onPress={() => unblock(block.targetId)}
                      />
                    }
                  />
                );
              })}
            </ListGroup>
            <FootNote>{BLOCK_NOTE}</FootNote>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
