/**
 * La ficha de un espacio privado.
 *
 * Antes era un párrafo: «media hectárea vallada con arbolado, para perros que
 * no pueden ir sueltos al parque». Es una frase bonita que hay que leer entera
 * para saber si sirve, y que no se puede comparar con la de al lado.
 *
 * Ahora la ficha tiene la forma que tienen las de las plataformas de alquiler
 * de patios, y no por parecerse a ellas: por lo que resuelven.
 *
 *  1. **Galería, no una foto.** La propia ayuda de Sniffspot dice que los
 *     sitios con diez o más fotos ganan bastante más que los que tienen pocas.
 *     Un patio se alquila por lo que se ve.
 *  2. **Datos duros, no adjetivos.** Superficie, altura del vallado, agua,
 *     sombra y qué se pisa, en fichas que se comparan de un vistazo. «Grande»
 *     no se compara; 200 m² sí.
 *  3. **La dirección al final del todo.** Antes de reservar, la zona. Después,
 *     la calle y cómo se entra. Aquí eso no es una promesa en un aviso: la
 *     dirección **no existe en la pantalla** hasta que hay reserva confirmada.
 *
 * Lo que **no** se ha copiado son las estrellas y el número de reseñas. Aquí no
 * hay sistema de reseñas: inventarse una nota de 4,9 sobre 217 opiniones para
 * que la ficha parezca completa sería exactamente la clase de dato que hace que
 * alguien coja el coche.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { formGroup, formatCents, splitCost } from '@petnav/core';

import { Icon } from './icon';
import { Press } from './motion';
import { SceneView } from './scene';
import { Badge, Body, Button, Caption, Card, Heading, Row } from '@/components/ui';
import { buildScene } from '@/lib/artwork';
import { ADDRESS_NOTE, confirmBooking, proposeBooking, useBooking } from '@/lib/bookings';
import { OTHER_PETS, type DemoPet, type DemoSpot } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Droplets, Fence, MapPin, Ruler, Sparkles, TreePine } from '@/lib/icons';
import { speciesName } from '@/lib/labels';
import { useTheme } from '@/lib/theme';

/** Cuántas vistas del sitio lleva la galería. */
const VIEWS = 4;

export function SpotCard({ pet, spot }: { pet: DemoPet; spot: DemoSpot }) {
  const theme = useTheme();
  const booking = useBooking(spot.id);

  /* El grupo se forma solo entre animales de la misma especie: el algoritmo
     veta el resto, pero filtrar antes evita proponer un grupo vacío y tener
     que explicarlo después. */
  const pool = OTHER_PETS.filter((other) => other.speciesId === pet.speciesId);
  const group = formGroup(pet, pool, { maxPets: spot.maxPets, minAffinity: 60 });
  const shares = splitCost(spot.pricePerSlotCents, group.pets.length);
  const perPet = shares[0] ?? 0;

  return (
    <Card>
      <SpotGallery spot={spot} />

      <Row>
        <Heading>{spot.title}</Heading>
        {spot.isFenced ? <Badge tone="accent">Cerrado</Badge> : null}
      </Row>

      <Caption>
        {spot.zone} · hasta {spot.maxPets} animales · {formatCents(spot.pricePerSlotCents)} por{' '}
        {spot.slotMinutes >= 60 ? `${spot.slotMinutes / 60} h` : `${spot.slotMinutes} min`}
      </Caption>

      <SpotSpecs spot={spot} />

      <Body muted>{spot.description}</Body>
      <Caption>Admite: {spot.speciesIds.map(speciesName).join(', ')}</Caption>

      <View
        style={{
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radius.md,
          padding: theme.space[3],
          gap: theme.space[2],
        }}
      >
        <Body>Grupo propuesto</Body>
        <Row>
          {group.pets.map((member) => (
            <Badge key={member.id} tone={member.id === pet.id ? 'accent' : 'neutral'}>
              {'name' in member ? (member as { name: string }).name : member.id}
            </Badge>
          ))}
        </Row>
        <Caption>
          Afinidad del grupo {group.affinity.min} % · {formatCents(perPet)} cada uno
        </Caption>
        {group.rejected.length > 0 ? (
          <Caption>
            {group.rejected.length === 1
              ? '1 quedó fuera del grupo'
              : `${group.rejected.length} quedaron fuera del grupo`}
            : {group.rejected[0]?.reason.toLowerCase()}
          </Caption>
        ) : null}
      </View>

      {booking?.status === 'confirmed' ? (
        <SpotAddress spot={spot} />
      ) : booking?.status === 'proposed' ? (
        <View style={{ gap: theme.space[2] }}>
          <Row gap={2}>
            <Icon icon={MapPin} size="base" color={theme.colors.warning} decorative />
            <Body>Propuesta enviada al anfitrión</Body>
          </Row>
          <Caption>
            La dirección llega cuando acepte. Proponer no es entrar: hasta entonces solo se sabe la
            zona, igual que antes de reservar.
          </Caption>
          {/* El atajo de demostración, dicho como lo que es. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Simular que el anfitrión acepta"
            onPress={() => {
              haptics.commit();
              confirmBooking(spot.id);
            }}
            style={({ pressed }) => ({
              minHeight: theme.touchTarget.min,
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Caption>
              En esta demo no hay anfitrión al otro lado: toca aquí para simular que acepta y ver
              qué se abre.
            </Caption>
          </Pressable>
        </View>
      ) : (
        <Button
          label={`Proponer reserva · ${formatCents(perPet)} cada uno`}
          accessibilityHint="Envía la propuesta al grupo y al anfitrión"
          onPress={() => {
            haptics.commit();
            proposeBooking({ spotId: spot.id, pets: group.pets.length, perPetCents: perPet });
          }}
        />
      )}
    </Card>
  );
}

/**
 * La galería: cuatro vistas del sitio, con enganche y paginador.
 *
 * Son escenas generadas del **lugar**, sin ningún animal dentro: enseñar un
 * patio con un perro que no es el tuyo sería vender la foto de otro como si
 * fuera parte del sitio. Cuando está vallado, el dibujo lleva la valla — el
 * dato más mirado de la ficha, dicho también en la imagen.
 */
function SpotGallery({ spot }: { spot: DemoSpot }) {
  const theme = useTheme();
  const { width: screen } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  /* El ancho es el de la tarjeta, no el de la pantalla: la ficha vive dentro de
     una `Card` con su relleno, y usar el ancho entero dejaba la última vista
     cortada por la derecha. */
  const width = Math.min(screen, 520) - theme.space[5] * 2 - theme.space[4] * 2;
  const height = Math.round(width * 0.62);

  const scenes = useMemo(
    () =>
      Array.from({ length: VIEWS }, (_value, position) =>
        buildScene({
          seed: `${spot.id}-vista-${position}`,
          petId: spot.id,
          at: new Date(2024, 5, 15, 9 + position * 3),
          width,
          height,
          subject: 'place',
          fenced: spot.isFenced,
        }),
      ),
    [spot.id, spot.isFenced, width, height],
  );

  return (
    <View style={{ borderRadius: theme.radius.md, overflow: 'hidden' }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          if (next !== index) setIndex(next);
        }}
        scrollEventThrottle={16}
      >
        {scenes.map((scene, position) => (
          <View
            key={`${spot.id}-${position}`}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${spot.title}, vista ${position + 1} de ${VIEWS}`}
          >
            <SceneView scene={scene} width={width} height={height} />
          </View>
        ))}
      </ScrollView>

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: theme.space[2],
          right: theme.space[2],
          paddingHorizontal: theme.space[2],
          paddingVertical: 2,
          borderRadius: theme.radius.full,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      >
        <Text
          style={{ color: '#fff', fontFamily: fonts.bodyBold, fontSize: theme.fontSize['2xs'] }}
        >
          {index + 1}/{VIEWS}
        </Text>
      </View>

      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          bottom: theme.space[2],
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {scenes.map((_scene, position) => (
          <View
            key={`punto-${position}`}
            style={{
              width: 6,
              height: 6,
              borderRadius: theme.radius.full,
              backgroundColor: position === index ? '#fff' : 'rgba(255,255,255,0.5)',
            }}
          />
        ))}
      </View>

      {/* La misma etiqueta que en el feed: lo que se ve está dibujado. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: theme.space[2],
          bottom: theme.space[2],
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: theme.space[2],
          paddingVertical: 2,
          borderRadius: theme.radius.xs,
          backgroundColor: 'rgba(0,0,0,0.55)',
        }}
      >
        <Icon icon={Sparkles} size="sm" color="#fff" decorative />
        <Text style={{ color: '#fff', fontFamily: fonts.body, fontSize: theme.fontSize['2xs'] }}>
          Ilustración generada
        </Text>
      </View>
    </View>
  );
}

/**
 * Los datos duros, en fichas que se comparan de un vistazo.
 *
 * Cada una es un número o un sí/no, nunca un adjetivo: «grande» no se compara
 * con nada y 200 m² sí. Lo que no tiene el sitio **también sale**, apagado: una
 * lista que solo enseña lo bueno obliga a deducir lo que falta, y en un patio
 * al que vas a soltar a un perro en agosto, «sin sombra» es lo que hay que
 * saber.
 */
function SpotSpecs({ spot }: { spot: DemoSpot }) {
  const theme = useTheme();

  const specs = [
    { icon: Ruler, label: `${spot.sizeM2.toLocaleString('es-ES')} m²`, on: true },
    {
      icon: Fence,
      label: spot.fenceHeightCm ? `Valla de ${spot.fenceHeightCm / 100} m` : 'Sin vallar',
      on: spot.fenceHeightCm !== null,
    },
    { icon: Droplets, label: spot.hasWater ? 'Con agua' : 'Sin agua', on: spot.hasWater },
    { icon: TreePine, label: spot.hasShade ? 'Con sombra' : 'Sin sombra', on: spot.hasShade },
    { icon: MapPin, label: `Suelo de ${spot.surface}`, on: true },
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
      {specs.map((spec) => (
        <View
          key={spec.label}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: theme.space[3],
            paddingVertical: 6,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: spec.on ? theme.colors.border : theme.colors.borderStrong,
            backgroundColor: spec.on ? theme.colors.surfaceSunken : 'transparent',
          }}
        >
          <Icon
            icon={spec.icon}
            size="sm"
            color={spec.on ? theme.colors.foreground : theme.colors.mutedForeground}
            decorative
          />
          <Text
            style={{
              color: spec.on ? theme.colors.foreground : theme.colors.mutedForeground,
              fontFamily: spec.on ? fonts.bodyBold : fonts.body,
              fontSize: theme.fontSize.xs,
            }}
          >
            {spec.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** La dirección, que solo existe en pantalla con la reserva confirmada. */
function SpotAddress({ spot }: { spot: DemoSpot }) {
  const theme = useTheme();

  return (
    <Press pressed={false}>
      <View
        style={{
          gap: theme.space[2],
          padding: theme.space[4],
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.accent,
        }}
      >
        <Row gap={2}>
          <Icon icon={MapPin} size="base" color={theme.colors.primary} decorative />
          <Body>Reserva confirmada</Body>
        </Row>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.base,
            lineHeight: theme.fontSize.base * 1.4,
          }}
        >
          {spot.address}
        </Text>
        <Body muted>{spot.accessNotes}</Body>
        <Caption>{ADDRESS_NOTE}</Caption>
      </View>
    </Press>
  );
}
