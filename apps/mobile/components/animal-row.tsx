/**
 * La fila de un animal del refugio.
 *
 * Es una `ListRow` con lo que una protectora mira en una lista de cuarenta:
 * quién es, en qué situación está y **qué falta para poder publicarlo**. Ese
 * tercer dato es el que convierte una lista en una lista de trabajo; sin él,
 * saber por qué Trufa no está en adopción exige abrir su ficha una por una.
 *
 * Lo que la fila **no** lleva, y no es olvido: nada clínico. La medicación, el
 * peso o el tratamiento son una ficha veterinaria, y una ficha veterinaria
 * abierta en una lista que se enseña de reojo en un móvil es un dato de salud
 * a la vista de quien pase por detrás.
 */

import { Avatar } from './avatar';
import { IconTile, ListRow } from './list';
import { Badge } from './ui';
import { CircleCheck, HeartPulse, Home, Syringe } from '@/lib/icons';
import { ageLabel, sinceLabel, STATUS_LABEL, type ShelterAnimal } from '@/lib/refugio';

/**
 * El tono de cada situación.
 *
 * No es decorativo: el ámbar es lo que está a mitad de camino —tratamiento,
 * acogida—, el verde lo que ya se puede adoptar y el neutro lo que ya no pide
 * nada. Quien recorre la lista con el pulgar distingue los tres antes de leer.
 */
const TONE = {
  treatment: 'warning',
  foster: 'accent',
  adoptable: 'verified',
  adopted: 'neutral',
} as const;

const ICON = {
  treatment: HeartPulse,
  foster: Home,
  adoptable: CircleCheck,
  adopted: CircleCheck,
} as const;

export function AnimalRow({
  animal,
  onPress,
}: {
  animal: ShelterAnimal;
  onPress: (animal: ShelterAnimal) => void;
}) {
  const pending = animal.pending.length;

  /* La segunda línea cambia con la situación, porque lo que hace falta saber
     cambia con ella: de quién es la casa de acogida, o desde cuándo espera. */
  const subtitle =
    animal.status === 'foster' && animal.fosterName
      ? `${animal.breed} · en casa de ${animal.fosterName}`
      : `${animal.breed} · ${ageLabel(animal.ageMonths)}`;

  return (
    <ListRow
      /* El retrato se dibuja del identificador, igual que el de cualquier
         animal de la aplicación: en una protectora casi nunca hay foto el
         primer día, y una silueta gris repetida cuarenta veces convierte la
         lista en una hoja de cálculo. */
      leading={<Avatar id={animal.id} name={animal.name} size={44} />}
      title={animal.name}
      titleBadge={<Badge tone={TONE[animal.status]}>{STATUS_LABEL[animal.status]}</Badge>}
      subtitle={subtitle}
      detail={
        pending > 0 ? `Falta: ${animal.pending.join(', ').toLowerCase()}` : sinceLabel(animal.since)
      }
      trailing={pending > 0 ? <IconTile icon={Syringe} tone="alert" /> : undefined}
      accessibilityLabel={`${animal.name}, ${STATUS_LABEL[animal.status].toLowerCase()}. ${subtitle}${
        pending > 0 ? `. Falta ${animal.pending.join(', ').toLowerCase()}` : ''
      }`}
      accessibilityHint="Abre las acciones de este animal"
      onPress={() => onPress(animal)}
    />
  );
}

/** El icono de una situación, para donde no cabe la palabra entera. */
export const statusIcon = ICON;
