/**
 * Selector de mascota.
 *
 * Aparece en todas las pantallas porque la respuesta a «qué te ofrece Coincide
 * hoy» cambia según cuál esté seleccionada, y no por la especie —hoy todas son
 * perros— sino por el animal: a 26 grados Nina sale y Kira no.
 *
 * Debajo del nombre va la raza y no la especie. Con dos perros, poner «Perro» y
 * «Perro» era repetir lo que no distingue y callar lo que sí.
 *
 * Se oculta solo si el tutor tiene una única mascota: un selector de un elemento
 * es ruido.
 */

import { Pressable, Text, View } from 'react-native';

import { myPets, setActivePetId, useActivePet } from '@/lib/active-pet';
import { speciesName } from '@/lib/labels';
import { fonts } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

export function PetSwitcher() {
  const theme = useTheme();
  const active = useActivePet();
  const pets = myPets();

  if (pets.length < 2) return null;

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        gap: theme.space[2],
        backgroundColor: theme.colors.surfaceSunken,
        borderRadius: theme.radius.full,
        padding: theme.space[1],
      }}
    >
      {pets.map((pet) => {
        const isActive = pet.id === active.id;
        return (
          <Pressable
            key={pet.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityHint={`Ver la aplicación para ${pet.name}${
              pet.breeds.length > 0 ? `, ${pet.breeds[0]}` : ''
            }`}
            onPress={() => setActivePetId(pet.id)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: theme.space[2],
              paddingHorizontal: theme.space[3],
              borderRadius: theme.radius.full,
              backgroundColor: isActive ? theme.colors.primary : 'transparent',
            }}
          >
            <Text
              style={{
                color: isActive ? theme.colors.primaryForeground : theme.colors.mutedForeground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.sm,
              }}
            >
              {pet.name}
            </Text>
            <Text
              style={{
                color: isActive ? theme.colors.primaryForeground : theme.colors.mutedForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.xs,
              }}
            >
              {pet.breeds[0] ?? speciesName(pet.speciesId)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
