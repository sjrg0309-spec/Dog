import { ScrollView, View } from 'react-native';

import { groupAffinity, groupWelfare } from '@petnav/core';

import { NavBar, useScrolled } from '@/components/chrome';
import { ConditionsControl } from '@/components/conditions-control';
import { PetSwitcher } from '@/components/pet-switcher';
import { WelfareNotice } from '@/components/welfare-notice';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Eyebrow,
  Heading,
  Notice,
  Row,
  Screen,
  Title,
} from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { useConditionsBuilder } from '@/lib/conditions';
import { allPlaydates, petById, petHasMeetups, playdatesFor, speciesOf } from '@/lib/data';
import { SIZE_LABEL, energyLabel, speciesName } from '@/lib/labels';
import { useTheme } from '@/lib/theme';

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormatter = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

/**
 * Quedadas.
 *
 * Dos cosas gobiernan esta pantalla:
 *
 *  1. Una quedada es **de una sola especie**. No es una restricción de la
 *     interfaz que se pueda relajar: un hurón fue criado para cazar conejos, y
 *     ninguna puntuación de carácter debería poder ponerlos en el mismo sitio.
 *     La base de datos lo impide con un disparador; aquí solo se refleja.
 *  2. La **afinidad del grupo antes de unirse**, calculada por el mínimo par a
 *     par y no por el promedio. Un grupo vale lo que vale su peor pareja: un
 *     promedio del 85 % puede esconder un par al 30 % que arruina el encuentro.
 */
export default function PlaydatesScreen() {
  const theme = useTheme();
  const { scrolled, onScroll } = useScrolled();
  const pet = useActivePet();
  const species = speciesOf(pet);
  const social = petHasMeetups(pet);
  const mine = playdatesFor(pet.speciesId);
  const otherSpecies = allPlaydates().length - mine.length;
  const build = useConditionsBuilder();

  if (!social) {
    return (
      <Screen>
        <NavBar title="Quedadas" scrolled={scrolled} />
        <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
          <PetSwitcher />
          <View style={{ gap: theme.space[2] }}>
            <Eyebrow>Organizar</Eyebrow>
            <Title>No hay quedadas para {pet.name}</Title>
          </View>
          <Notice>
            <Body>{species?.socialNote}</Body>
            <Caption>
              No es una limitación de la aplicación, es de la especie. Ofrecer un encuentro que
              termina en estrés o en una pelea sería peor producto que decir esto.
            </Caption>
          </Notice>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar title="Quedadas" scrolled={scrolled} />
      <ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}>
        <PetSwitcher />

        <View style={{ gap: theme.space[2] }}>
          <Eyebrow>Organizar</Eyebrow>
          <Title>Quedadas de {speciesName(pet.speciesId).toLowerCase()}</Title>
          <Body muted>
            Antes de apuntarte ves cómo encaja {pet.name} con el grupo entero, no solo con quien lo
            organiza.
          </Body>
        </View>

        <ConditionsControl />

        <Button
          label="Crear una quedada"
          accessibilityHint="Proponer un encuentro con fecha y lugar"
        />

        {mine.length === 0 ? (
          <Notice>
            <Body>Todavía no hay ninguna quedada de esta especie cerca.</Body>
            <Caption>
              Es el estado normal al empezar en un barrio: la primera la organiza alguien, y a
              partir de ahí el horario hace el resto.
            </Caption>
          </Notice>
        ) : null}

        {mine.map((playdate) => {
          const attendees = playdate.attendeeIds
            .map((id) => petById(id))
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

          // Se simula apuntarse: la afinidad que se muestra es la que tendría el
          // grupo CON la mascota del usuario dentro, que es la pregunta real.
          const withMine = attendees.some((entry) => entry.id === pet.id)
            ? attendees
            : [...attendees, pet];
          const affinity = groupAffinity(withMine);
          const weakest = affinity.weakestPair;
          const weakestNames =
            weakest && weakest.score < 70
              ? [petById(weakest.a)?.name, petById(weakest.b)?.name].filter(Boolean).join(' y ')
              : null;

          const alreadyIn = attendees.some((entry) => entry.id === pet.id);

          // El bienestar es del grupo entero, incluido el animal del tutor: si a
          // uno de los seis le está prohibiendo el calor, el encuentro no se
          // hace porque a los otros cinco les venga bien.
          // Sin tiempo no se juzga al grupo: la tarjeta se enseña sin
          // veredicto en vez de con uno inventado.
          const welfare = build ? groupWelfare(withMine, build(playdate.sessionMinutes)) : null;

          return (
            <Card key={playdate.id}>
              <Row>
                <Heading>{playdate.title}</Heading>
                <Badge tone="accent">{speciesName(playdate.speciesId)}</Badge>
                {playdate.leashed ? <Badge>Con correa</Badge> : null}
                {alreadyIn ? <Badge tone="accent">Ya vais</Badge> : null}
              </Row>

              <Caption>
                {dateFormatter.format(playdate.startsAt)} ·{' '}
                {timeFormatter.format(playdate.startsAt)}–{timeFormatter.format(playdate.endsAt)}
              </Caption>
              <Caption>
                {playdate.placeName} · {attendees.length} de {playdate.maxPets} animales
              </Caption>
              <Caption>
                {playdate.sessionMinutes} min de contacto seguidos, y luego descanso. No es la
                duración del evento: es lo que aguanta la especie de una vez.
              </Caption>

              <Body muted>{playdate.description}</Body>

              {/* Afinidad grupal: el mínimo, no el promedio. */}
              <View
                style={{
                  backgroundColor: theme.colors.surfaceSunken,
                  borderRadius: theme.radius.md,
                  padding: theme.space[3],
                  gap: theme.space[1],
                }}
              >
                <Body>Afinidad del grupo con {pet.name}: {affinity.min} %</Body>
                <Caption>
                  {weakestNames
                    ? `Eslabón más débil: ${weakestNames} (${weakest?.score} %)`
                    : 'Ninguna pareja del grupo se queda corta'}
                </Caption>
                <Caption>
                  Se mide por la pareja peor emparejada, no por el promedio: un grupo vale lo que
                  vale su peor pareja.
                </Caption>
              </View>

              <Row>
                {playdate.admitsSizes.map((size) => (
                  <Badge key={size} tone="accent">
                    {SIZE_LABEL[size] ?? size}
                  </Badge>
                ))}
                {playdate.admitsEnergy.map((energy) => (
                  <Badge key={energy}>{energyLabel(energy, playdate.speciesId)}</Badge>
                ))}
              </Row>

              {/* Va antes que el botón, y cuando dice que no, el botón no está. */}
              <WelfareNotice verdict={welfare} petName={pet.name} showDisclaimer={false} />

              {welfare?.level === 'stop' ? null : affinity.hasVeto ? (
                <Notice>
                  <Body>{pet.name} no puede unirse a este grupo.</Body>
                  <Caption>
                    Hay una pareja incompatible por seguridad. No es una puntuación baja: es un
                    límite que no se compensa.
                  </Caption>
                </Notice>
              ) : (
                <Button
                  label={alreadyIn ? 'Ver asistentes' : `Apuntar a ${pet.name}`}
                  variant={alreadyIn ? 'outline' : 'primary'}
                />
              )}
            </Card>
          );
        })}

        {otherSpecies > 0 ? (
          <Caption>
            Hay {otherSpecies}{' '}
            {otherSpecies === 1 ? 'quedada más' : 'quedadas más'} cerca, de otras especies. No
            aparecen porque no se puede apuntar a un animal a la quedada de otra especie, y eso lo
            impide la base de datos, no esta pantalla.
          </Caption>
        ) : null}

        <Notice>
          <Body>Las tallas son relativas dentro de cada especie.</Body>
          <Caption>
            Un conejo "grande" y un perro "grande" no tienen nada que ver, y da igual: como los
            encuentros son siempre entre la misma especie, la comparación nunca cruza ese límite.
          </Caption>
        </Notice>
      </ScrollView>
    </Screen>
  );
}
