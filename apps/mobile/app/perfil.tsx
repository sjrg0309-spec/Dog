import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Avatar } from '@/components/avatar';
import { LargeTitle, NavBar, Separator, useScrolled } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { PetSwitcher } from '@/components/pet-switcher';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  DataRow,
  Notice,
  Row,
  Screen,
} from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  BadgeCheck,
  Cake,
  Check,
  HeartPulse,
  Lock,
  Phone,
  Pill,
  QrCode,
  Stethoscope,
  Syringe,
  TriangleAlert,
  X,
} from '@/lib/icons';
import { speciesName } from '@/lib/labels';
import {
  dueLabel,
  isOverdue,
  markDone,
  RECORD_LABEL,
  useMedicalRecord,
  WALK_MODE_NOTE,
  walkModeCard,
  type MedicalEntry,
} from '@/lib/medical';
import { useTheme } from '@/lib/theme';
import { HEALTH_FLAG_LABEL, type HealthFlag } from '@coincide/core';

/**
 * El perfil del animal.
 *
 * Tres bloques, y la línea entre el segundo y el tercero es la decisión que
 * importa de esta pantalla:
 *
 *  1. **Quién es.** Lo público: nombre, raza, edad, temperamento, chip
 *     verificado. Es lo que ve quien se plantea quedar contigo.
 *  2. **Ficha médica.** Privada del todo. Vacunas, desparasitación,
 *     tratamientos, con lo vencido arriba porque es lo único sobre lo que hay
 *     que hacer algo hoy.
 *  3. **Modo Paseo.** Un código que enseña **a quién llamar**, no el historial.
 *     Es para el momento en que alguien encuentra al perro solo en la calle, y
 *     en ese momento lo que sirve es un teléfono. Que un desconocido del parque
 *     pueda leer qué medicación toma no ayuda a devolvértelo.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const { scrolled, onScroll } = useScrolled();
  const pet = useActivePet();
  const record = useMedicalRecord(pet.id);
  const [walkMode, setWalkMode] = useState(false);

  const overdue = record.filter((entry) => isOverdue(entry));
  const years = Math.floor(pet.ageMonths / 12);
  const months = pet.ageMonths % 12;

  return (
    <Screen>
      <NavBar title={pet.name} scrolled={scrolled} showTitle={scrolled} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
      >
        <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[3] }}>
          <PetSwitcher />
        </View>

        {/* Quién es */}
        <View
          style={{
            alignItems: 'center',
            gap: theme.space[2],
            paddingHorizontal: theme.space[4],
            paddingTop: theme.space[6],
            paddingBottom: theme.space[5],
          }}
        >
          <Avatar id={pet.id} name={pet.name} size={96} />
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayExtrabold,
              fontSize: theme.fontSize['3xl'],
              letterSpacing: -0.5,
            }}
          >
            {pet.name}
          </Text>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.base,
              textAlign: 'center',
            }}
          >
            {pet.breeds.join(' · ')} · {years} {years === 1 ? 'año' : 'años'}
            {months > 0 ? ` y ${months} ${months === 1 ? 'mes' : 'meses'}` : ''}
          </Text>
          <Row gap={2}>
            {pet.isMicrochipVerified ? (
              <Badge tone="verified" icon={BadgeCheck}>
                Tutor verificado
              </Badge>
            ) : (
              <Badge tone="neutral">Chip sin verificar</Badge>
            )}
            <Badge tone="neutral">{speciesName(pet.speciesId)}</Badge>
          </Row>
          {pet.bio ? (
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.base,
                textAlign: 'center',
                lineHeight: theme.fontSize.base * 1.45,
                paddingTop: theme.space[2],
              }}
            >
              {pet.bio}
            </Text>
          ) : null}
        </View>

        {/* Modo Paseo */}
        <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[6] }}>
          <WalkMode pet={pet} on={walkMode} onToggle={() => setWalkMode((value) => !value)} />
        </View>

        <Separator />

        {/* Ficha médica */}
        <View
          style={{
            paddingHorizontal: theme.space[4],
            paddingTop: theme.space[6],
            gap: theme.space[3],
          }}
        >
          <Row gap={2}>
            <Icon icon={Lock} size="base" color={theme.colors.mutedForeground} decorative />
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.xl,
              }}
            >
              Ficha médica
            </Text>
          </Row>
          <Caption>
            Privada. No la ve nadie con quien quedes, ni sale en el código del Modo Paseo. Solo está
            aquí para que no tengas que buscar la cartilla cuando te preguntan.
          </Caption>

          {overdue.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[3],
                backgroundColor: theme.colors.warningSurface,
                borderRadius: theme.radius.md,
                padding: theme.space[4],
              }}
            >
              <Icon icon={TriangleAlert} size="lg" color={theme.colors.warning} decorative />
              <Text
                style={{
                  flex: 1,
                  color: theme.colors.warning,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize.sm,
                  lineHeight: theme.fontSize.sm * 1.4,
                }}
              >
                {overdue.length === 1
                  ? '1 cosa vencida.'
                  : `${overdue.length} cosas vencidas.`}{' '}
                Con la pauta sin terminar, un parque abierto con desconocidos no es su sitio: la
                aplicación lo tiene en cuenta al proponer encuentros.
              </Text>
            </View>
          ) : null}

          {record.map((entry) => (
            <MedicalCard key={entry.id} entry={entry} />
          ))}

          {pet.healthFlags && pet.healthFlags.length > 0 ? (
            <Card>
              <Row gap={2}>
                <Icon icon={HeartPulse} size="base" color={theme.colors.foreground} decorative />
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fonts.displayBold,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  Lo que la aplicación tiene en cuenta
                </Text>
              </Row>
              {pet.healthFlags.map((flag) => (
                <DataRow
                  key={flag}
                  label={HEALTH_FLAG_LABEL[flag as HealthFlag] ?? flag}
                  value="Activo"
                  icon={Pill}
                />
              ))}
              <Caption>
                Esto no es decorativo: baja el techo de temperatura a partir del cual no se propone
                salir, y acorta la sesión que se sugiere. El animal manda sobre el plan de su tutor.
              </Caption>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Modo Paseo.
 *
 * Es un interruptor y no una pantalla aparte porque se enciende **al salir de
 * casa**, con el perro tirando de la correa. Cualquier cosa que cueste más de un
 * toque no se va a usar el día que sirve.
 */
function WalkMode({
  pet,
  on,
  onToggle,
}: {
  pet: Parameters<typeof walkModeCard>[0] & { name: string };
  on: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const card = walkModeCard(pet);

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: 2,
        borderColor: on ? theme.colors.liveRing : theme.colors.border,
        backgroundColor: on ? theme.colors.liveSurface : theme.colors.surface,
        padding: theme.space[5],
        gap: theme.space[4],
      }}
    >
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel="Modo Paseo"
        accessibilityHint={
          on
            ? 'Apagar el código de contacto de emergencia'
            : 'Genera un código con tu teléfono para quien encuentre a tu perro'
        }
        onPress={() => {
          haptics.commit();
          onToggle();
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          minHeight: theme.touchTarget.comfortable,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Icon
          icon={on ? QrCode : QrCode}
          size="xl"
          color={on ? theme.colors.liveForeground : theme.colors.foreground}
          strokeWidth={2.25}
          decorative
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: on ? theme.colors.liveForeground : theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.lg,
            }}
          >
            Modo Paseo
          </Text>
          <Text
            style={{
              color: on ? theme.colors.liveForeground : theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            {on ? 'Encendido. El código funciona ahora.' : 'Código de contacto para emergencias'}
          </Text>
        </View>
        <View
          style={{
            width: 52,
            height: 32,
            borderRadius: 16,
            padding: 3,
            justifyContent: 'center',
            alignItems: on ? 'flex-end' : 'flex-start',
            backgroundColor: on ? theme.colors.liveRing : theme.colors.muted,
          }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: theme.colors.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* El estado no se comunica solo con la posición del interruptor:
                lleva su icono, que es lo que sobrevive a una captura en gris. */}
            <Icon
              icon={on ? Check : X}
              size="sm"
              color={on ? theme.colors.liveRing : theme.colors.mutedForeground}
              decorative
            />
          </View>
        </View>
      </Pressable>

      {on ? (
        <>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Código de contacto de ${card.petName}. Enlaza a ${card.url}`}
            style={{
              alignSelf: 'center',
              padding: theme.space[4],
              // Fondo blanco siempre, también en tema oscuro: un código sobre
              // fondo oscuro no lo lee ningún escáner.
              backgroundColor: '#ffffff',
              borderRadius: theme.radius.md,
            }}
          >
            <QRCode value={card.url} size={168} backgroundColor="#ffffff" color="#000000" />
          </View>

          <View style={{ gap: theme.space[1] }}>
            <DataRow label="Llamar a" value={card.contactPhone} icon={Phone} />
            <DataRow label="Su veterinario" value={card.vetPhone} icon={Stethoscope} />
            {card.microchip ? (
              <DataRow label="Chip" value={card.microchip} icon={BadgeCheck} />
            ) : (
              <DataRow label="Chip" value="Sin verificar" icon={BadgeCheck} tone="alert" />
            )}
          </View>

          <View style={{ gap: theme.space[2] }}>
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.sm,
              }}
            >
              Lo que verá quien lo encuentre
            </Text>
            {card.handlingNotes.map((note) => (
              <Text
                key={note}
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.body,
                  fontSize: theme.fontSize.sm,
                  lineHeight: theme.fontSize.sm * 1.5,
                }}
              >
                · {note}
              </Text>
            ))}
          </View>

          <Caption>{WALK_MODE_NOTE}</Caption>
        </>
      ) : null}
    </View>
  );
}

function MedicalCard({ entry }: { entry: MedicalEntry }) {
  const theme = useTheme();
  const late = isOverdue(entry);

  return (
    <View
      style={{
        borderRadius: theme.radius.lg,
        borderWidth: late ? 2 : 1,
        borderColor: late ? theme.colors.warning : theme.colors.border,
        backgroundColor: theme.colors.surface,
        padding: theme.space[4],
        gap: theme.space[2],
      }}
    >
      <Row gap={2}>
        <Icon
          icon={entry.kind === 'deworming' ? Pill : entry.kind === 'checkup' ? Stethoscope : Syringe}
          size="base"
          color={late ? theme.colors.warning : theme.colors.mutedForeground}
          decorative
        />
        <Text
          style={{
            flex: 1,
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.base,
          }}
        >
          {entry.label}
        </Text>
        <Badge tone={late ? 'warning' : 'neutral'}>{dueLabel(entry)}</Badge>
      </Row>

      <Caption>
        {RECORD_LABEL[entry.kind]}
        {entry.vetName ? ` · ${entry.vetName}` : ''}
      </Caption>

      {late ? (
        <Button
          label="Ya está puesta"
          icon={Check}
          variant="outline"
          accessibilityHint="Marca la fecha de hoy y programa la siguiente"
          onPress={() => {
            markDone(entry.id, entry.kind === 'deworming' ? 90 : 365);
            haptics.commit();
          }}
        />
      ) : null}
    </View>
  );
}
