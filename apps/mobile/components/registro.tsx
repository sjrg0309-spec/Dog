/**
 * El alta. La puerta de la aplicación.
 *
 * Aquí no se entra a mirar: para registrarse hay que dar de alta a tu animal.
 * No es una pantalla que se pueda saltar navegando a otra ruta —no es una ruta:
 * es lo que se dibuja **en lugar de** la aplicación mientras no haya animal—,
 * porque una puerta que se esquiva escribiendo una dirección no es una puerta.
 *
 * ## Por qué se pide todo esto
 *
 * Cada campo hace algo, y la pantalla lo dice al lado:
 *
 *  - **Nombre, edad y talla** son con quién se junta y con quién no. La
 *    diferencia de talla de tres escalones es un veto duro del algoritmo, no
 *    una preferencia.
 *  - **Carácter** —energía y cómo juega— es el 65 % de la puntuación de
 *    afinidad. Sin esto no hay matching, solo una lista de perros cerca.
 *  - **Horario** es la mitad del producto: cruzar horarios es lo que hace que
 *    esto sirva a las once de la noche, con la aplicación vacía.
 *  - **El chip es opcional**, y es la decisión que más se puede discutir. Hay
 *    animales adoptados hace años o de países donde no era obligatorio, y dejar
 *    fuera a sus tutores no protege a nadie. Lo que hace el chip es **abrir**
 *    lo que enseña gente en vez de sitios.
 *
 * ## Y lo que no se pide
 *
 * Dónde vives. No se pregunta y no se guarda. El mapa se sitúa en el barrio de
 * la demostración, y la posición de casa de las mascotas de la semilla no sale
 * nunca de los cálculos de dónde quedar.
 */

import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import {
  GATE_NOTE,
  CHIP_NOTE,
  HONESTY_NOTE,
  SHELTER_ACTIVITIES,
  SHELTER_GATE_NOTE,
  SHELTER_REVIEW_NOTE,
  SHELTER_SCOPE_NOTE,
  STEP_LABEL,
  missingShelterFields,
  missingSteps,
  validateShelterProfile,
  type PetDraft,
} from '@coincide/core';
import { formatMicrochip, validateMicrochip } from '@coincide/trackers';

import { Icon } from './icon';
import { Body, Caption, Screen } from '@/components/ui';
import { registerPet, registerShelter } from '@/lib/account';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { BadgeCheck, Check, CircleAlert, Lock, PawPrint, Siren } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

const SIZES = [
  { id: 'mini', label: 'Mini', hint: 'Hasta 5 kg' },
  { id: 'small', label: 'Pequeño', hint: '5–12 kg' },
  { id: 'medium', label: 'Mediano', hint: '12–25 kg' },
  { id: 'large', label: 'Grande', hint: '25–40 kg' },
  { id: 'giant', label: 'Gigante', hint: 'Más de 40 kg' },
] as const;

const ENERGY = [
  { id: 'low', label: 'De sofá', hint: 'Paseo corto y a casa' },
  { id: 'medium', label: 'Explorador', hint: 'Anda, olfatea, vuelve' },
  { id: 'high', label: 'Velocista', hint: 'No para' },
] as const;

const PLAY = [
  { id: 'chase', label: 'Persecución', hint: 'Correr detrás y delante' },
  { id: 'wrestle', label: 'Lucha libre', hint: 'Cuerpo a cuerpo' },
  { id: 'toys', label: 'Juguetes', hint: 'Pelota, cuerda, disco' },
  { id: 'calm_walk', label: 'Paseo tranquilo', hint: 'Andar acompañado' },
] as const;

/** Lunes primero, y X para miércoles: es como se leen los calendarios aquí. */
const DAYS = [
  { id: 1, label: 'L' },
  { id: 2, label: 'M' },
  { id: 3, label: 'X' },
  { id: 4, label: 'J' },
  { id: 5, label: 'V' },
  { id: 6, label: 'S' },
  { id: 0, label: 'D' },
] as const;

const SLOTS = [
  { id: 'morning', label: 'Mañana', start: '07:00', end: '08:00' },
  { id: 'midday', label: 'Mediodía', start: '13:00', end: '14:00' },
  { id: 'evening', label: 'Tarde', start: '18:00', end: '19:00' },
  { id: 'night', label: 'Noche', start: '22:00', end: '23:00' },
] as const;

/**
 * Las dos puertas.
 *
 * Se eligen arriba del todo y no se esconde ninguna: quien rescata y no tiene
 * animal propio tiene que ver que hay sitio para ella antes de rellenar nada, y
 * quien tiene perro tiene que ver que la otra existe para entender por qué se
 * le pide lo que se le pide.
 */
export function Registro() {
  const [door, setDoor] = useState<'tutor' | 'rescuer'>('tutor');
  const theme = useTheme();

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          gap: theme.space[2],
          paddingHorizontal: theme.space[5],
          paddingTop: theme.space[4],
        }}
      >
        <Door
          icon={PawPrint}
          label="Tengo perro"
          on={door === 'tutor'}
          onPress={() => setDoor('tutor')}
        />
        <Door
          icon={Siren}
          label="Rescato, sin perro propio"
          on={door === 'rescuer'}
          onPress={() => setDoor('rescuer')}
        />
      </View>
      {door === 'tutor' ? <AltaTutor /> : <AltaProtectora />}
    </Screen>
  );
}

function Door({
  icon,
  label,
  on,
  onPress,
}: {
  icon: typeof PawPrint;
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: theme.space[1],
        minHeight: theme.touchTarget.comfortable,
        paddingVertical: theme.space[3],
        paddingHorizontal: theme.space[2],
        borderRadius: theme.radius.lg,
        borderWidth: on ? 2 : 1,
        borderColor: on ? theme.colors.primary : theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
      })}
    >
      <Icon
        icon={icon}
        size="lg"
        color={on ? theme.colors.primary : theme.colors.mutedForeground}
        decorative
      />
      <Text
        style={{
          textAlign: 'center',
          color: on ? theme.colors.foreground : theme.colors.mutedForeground,
          fontFamily: on ? fonts.displayBold : fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * La puerta de quien rescata y no tiene animal propio.
 *
 * Protectoras, albergues, casas de acogida, quien alimenta colonias. Se pide el
 * perfil público del colectivo —la cuenta que ya tienen— y la cuenta queda
 * pendiente de que una persona lo mire.
 *
 * Lo que **no** abre esta puerta, ni siquiera aprobada, está escrito en la
 * pantalla: quién pasea ahora y los horarios de nadie. Rescatar no necesita
 * saber a qué hora sale cada vecino, y si esa lista se abriera enseñando un
 * enlace, enseñar un enlace sería la forma más barata de conseguirla.
 */
function AltaProtectora() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [profile, setProfile] = useState('');
  const [activities, setActivities] = useState<string[]>([]);

  const link = validateShelterProfile(profile);
  const missing = missingShelterFields({ name, profile, activities });

  return (
    <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[6] }}>
      <View style={{ gap: theme.space[2] }}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayExtrabold,
            fontSize: theme.fontSize['3xl'],
            letterSpacing: -0.5,
          }}
        >
          Entrar como protectora
        </Text>
        <Body muted>{SHELTER_GATE_NOTE}</Body>
      </View>

      <Field label="Cómo os llamáis" why="El nombre con el que os conocen, el mismo del perfil.">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Patitas del Sur"
          placeholderTextColor={theme.colors.inputPlaceholder}
          accessibilityLabel="Nombre del colectivo"
          style={{
            minHeight: theme.touchTarget.comfortable,
            paddingHorizontal: theme.space[4],
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.input,
            color: theme.colors.inputForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
          }}
        />
      </Field>

      <Field
        label="El perfil público"
        why="Instagram, Facebook, TikTok, X o vuestra web. Tiene que ser el perfil entero, no una publicación: lo que se puede mirar es la cuenta."
      >
        <TextInput
          value={profile}
          onChangeText={setProfile}
          placeholder="instagram.com/patitasdelsur"
          placeholderTextColor={theme.colors.inputPlaceholder}
          autoCapitalize="none"
          keyboardType="url"
          accessibilityLabel="Enlace al perfil del colectivo"
          style={{
            minHeight: theme.touchTarget.comfortable,
            paddingHorizontal: theme.space[4],
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.input,
            color: theme.colors.inputForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
          }}
        />
        {profile.trim() !== '' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <Icon
              icon={link.ok ? BadgeCheck : CircleAlert}
              size="base"
              color={link.ok ? theme.colors.success : theme.colors.warning}
              decorative
            />
            <Caption>
              {link.ok
                ? `${link.platform}${link.handle ? ` · @${link.handle}` : ''}. La forma está bien; que la cuenta sea vuestra lo mira una persona.`
                : link.reason}
            </Caption>
          </View>
        ) : null}
      </Field>

      <Field label="Qué hacéis" why="Decide qué avisos os llegan cuando la cuenta esté aprobada.">
        <Chips
          options={SHELTER_ACTIVITIES.map((activity) => ({ id: activity.id, label: activity.label }))}
          selected={activities}
          onPress={(id) =>
            setActivities((current) =>
              current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
            )
          }
        />
      </Field>

      <View
        style={{
          gap: theme.space[2],
          padding: theme.space[4],
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <Icon icon={Lock} size="base" color={theme.colors.mutedForeground} decorative />
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
            }}
          >
            Distinta puerta, distinta habitación
          </Text>
        </View>
        <Caption>{SHELTER_SCOPE_NOTE}</Caption>
        <Caption>{SHELTER_REVIEW_NOTE}</Caption>
      </View>

      {missing.length > 0 ? (
        <View style={{ gap: theme.space[1] }}>
          <Caption>Falta:</Caption>
          {missing.map((item) => (
            <Caption key={item}>· {item}</Caption>
          ))}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: missing.length > 0 }}
        accessibilityLabel="Enviar a revisión"
        disabled={missing.length > 0}
        onPress={() => {
          if (!link.ok) return;
          haptics.commit();
          registerShelter({ name, profile, activities, normalizedProfile: link.normalized });
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space[2],
          minHeight: theme.touchTarget.floating,
          borderRadius: theme.radius.full,
          backgroundColor: missing.length > 0 ? theme.colors.muted : theme.colors.primary,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Icon
          icon={Check}
          size="lg"
          color={missing.length > 0 ? theme.colors.mutedForeground : theme.colors.primaryForeground}
          decorative
        />
        <Text
          style={{
            color:
              missing.length > 0 ? theme.colors.mutedForeground : theme.colors.primaryForeground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.lg,
          }}
        >
          Enviar a revisión
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function AltaTutor() {
  const theme = useTheme();

  const [name, setName] = useState('');
  const [years, setYears] = useState('');
  const [months, setMonths] = useState('');
  const [size, setSize] = useState<string | null>(null);
  const [energy, setEnergy] = useState<string | null>(null);
  const [play, setPlay] = useState<string[]>([]);
  const [sex, setSex] = useState<'male' | 'female'>('female');
  const [days, setDays] = useState<number[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [chip, setChip] = useState('');

  const ageMonths =
    years.trim() === '' && months.trim() === ''
      ? null
      : Number(years || 0) * 12 + Number(months || 0);

  const draft: PetDraft = {
    name,
    speciesId: 'dog',
    ageMonths: Number.isFinite(ageMonths) ? ageMonths : null,
    size,
    energy,
    playStyles: play,
    availability: days.length > 0 && slot !== null ? days.length : 0,
  };

  const missing = missingSteps(draft);
  const chosenSlot = SLOTS.find((candidate) => candidate.id === slot);
  const chipCheck = chip.trim() === '' ? null : validateMicrochip(chip);

  return (
    <ScrollView contentContainerStyle={{ padding: theme.space[5], gap: theme.space[6] }}>
      <View style={{ gap: theme.space[2] }}>
          <Icon icon={PawPrint} size="xl" color={theme.colors.primary} decorative />
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayExtrabold,
              fontSize: theme.fontSize['3xl'],
              letterSpacing: -0.5,
            }}
          >
            Da de alta a tu perro
          </Text>
          <Body muted>{GATE_NOTE}</Body>
        </View>

        <Field label="Cómo se llama" why="Es como te van a llamar a ti en el parque.">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nina"
            placeholderTextColor={theme.colors.inputPlaceholder}
            accessibilityLabel="Nombre de tu perro"
            style={{
              minHeight: theme.touchTarget.comfortable,
              paddingHorizontal: theme.space[4],
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.input,
              color: theme.colors.inputForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.base,
            }}
          />
        </Field>

        <Field
          label="Qué edad tiene"
          why="Por debajo del año es un cachorro, y hay tutores que piden no cruzarse con cachorros muy revoltosos. El algoritmo lo respeta."
        >
          <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
            <NumberBox value={years} onChange={setYears} label="Años" />
            <NumberBox value={months} onChange={setMonths} label="Meses" />
          </View>
        </Field>

        <Field
          label="Cuánto ocupa"
          why="Tres escalones de diferencia es un veto duro: no es cuestión de carácter, es riesgo de lesión."
        >
          <Chips
            options={SIZES}
            selected={size ? [size] : []}
            onPress={(id) => setSize(id)}
          />
        </Field>

        <Field
          label="Cómo es"
          why="Energía y forma de jugar son el 65 % de la afinidad. Sin esto no hay emparejamiento, solo una lista de perros cerca."
        >
          <Chips options={ENERGY} selected={energy ? [energy] : []} onPress={(id) => setEnergy(id)} />
          <View style={{ height: theme.space[3] }} />
          <Caption>Cómo juega. Puedes marcar varias.</Caption>
          <Chips
            options={PLAY}
            selected={play}
            onPress={(id) =>
              setPlay((current) =>
                current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
              )
            }
          />
        </Field>

        <Field label="Es" why="Hay tutores que prefieren un sexo u otro para los encuentros, y el algoritmo lo tiene en cuenta.">
          <Chips
            options={[
              { id: 'female', label: 'Hembra' },
              { id: 'male', label: 'Macho' },
            ]}
            selected={[sex]}
            onPress={(id) => setSex(id as 'male' | 'female')}
          />
        </Field>

        <Field
          label="Cuándo salís"
          why="Es la mitad de la aplicación: cruzar horarios es lo que hace que sirva a las once de la noche, cuando no hay nadie conectado. Tu horario exacto no se publica; solo se dice con quién coincides."
        >
          <Chips
            options={DAYS.map((day) => ({ id: String(day.id), label: day.label }))}
            selected={days.map(String)}
            onPress={(id) =>
              setDays((current) =>
                current.includes(Number(id))
                  ? current.filter((value) => value !== Number(id))
                  : [...current, Number(id)],
              )
            }
          />
          <View style={{ height: theme.space[3] }} />
          <Chips
            options={SLOTS.map((option) => ({
              id: option.id,
              label: option.label,
              hint: `${option.start}–${option.end}`,
            }))}
            selected={slot ? [slot] : []}
            onPress={(id) => setSlot(id)}
          />
        </Field>

        <Field
          label="El chip, si lo tiene"
          why={CHIP_NOTE}
          optional
        >
          <TextInput
            value={chip}
            onChangeText={setChip}
            placeholder="941 000 012 345 678"
            placeholderTextColor={theme.colors.inputPlaceholder}
            keyboardType="number-pad"
            accessibilityLabel="Código del microchip"
            style={{
              minHeight: theme.touchTarget.comfortable,
              paddingHorizontal: theme.space[4],
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.input,
              color: theme.colors.inputForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.base,
            }}
          />
          {chipCheck ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
              <Icon
                icon={chipCheck.valid ? BadgeCheck : CircleAlert}
                size="base"
                color={chipCheck.valid ? theme.colors.success : theme.colors.warning}
                decorative
              />
              <Caption>
                {chipCheck.valid
                  ? `${formatMicrochip(chipCheck.normalized)} · formato correcto. Queda como declarado: verificarlo de verdad pide la cartilla del veterinario.`
                  : chipCheck.reason}
              </Caption>
            </View>
          ) : null}
        </Field>

        {/* Lo que se abre y lo que no. Se dice **antes** de entrar, no al chocar
            con la primera puerta cerrada: una traba que se explica cuando ya
            estás dentro se lee como un cobro. */}
        <View
          style={{
            gap: theme.space[2],
            padding: theme.space[4],
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <Icon icon={Lock} size="base" color={theme.colors.mutedForeground} decorative />
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.base,
              }}
            >
              Los sitios se ven; las personas no
            </Text>
          </View>
          <Caption>
            Al entrar verás el mapa de parques, fuentes, sombra y veterinarios, y el feed del
            vecindario. Quién está paseando ahora y a qué hora sale cada uno se abre al verificar el
            chip con la cartilla, porque la cara, el sitio y la hora son justo lo que buscaría quien
            anda mirando qué animal llevarse.
          </Caption>
          <Caption>{HONESTY_NOTE}</Caption>
        </View>

        {missing.length > 0 ? (
          <View style={{ gap: theme.space[1] }}>
            <Caption>Falta por rellenar:</Caption>
            {missing.map((step) => (
              <Caption key={step}>· {STEP_LABEL[step]}</Caption>
            ))}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: missing.length > 0 }}
          accessibilityLabel="Entrar"
          accessibilityHint={
            missing.length > 0 ? 'Faltan datos del alta' : 'Da de alta a tu perro y abre la aplicación'
          }
          disabled={missing.length > 0}
          onPress={() => {
            if (!chosenSlot) return;
            haptics.commit();
            registerPet({
              ...draft,
              sex,
              days,
              startTime: chosenSlot.start,
              endTime: chosenSlot.end,
              microchipCode: chipCheck?.valid ? chipCheck.normalized : null,
            });
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space[2],
            minHeight: theme.touchTarget.floating,
            borderRadius: theme.radius.full,
            backgroundColor:
              missing.length > 0 ? theme.colors.muted : theme.colors.primary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon
            icon={Check}
            size="lg"
            color={
              missing.length > 0 ? theme.colors.mutedForeground : theme.colors.primaryForeground
            }
            decorative
          />
          <Text
            style={{
              color:
                missing.length > 0 ? theme.colors.mutedForeground : theme.colors.primaryForeground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.lg,
            }}
          >
            Entrar
          </Text>
        </Pressable>
    </ScrollView>
  );
}

/** Un campo con su motivo al lado. El motivo no es relleno: es lo que hace que se rellene. */
function Field({
  label,
  why,
  optional = false,
  children,
}: {
  label: string;
  why: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.space[2] }}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.lg,
          }}
        >
          {label}
        </Text>
        {optional ? <Caption>opcional</Caption> : null}
      </View>
      <Caption>{why}</Caption>
      {children}
    </View>
  );
}

function NumberBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, gap: theme.space[1] }}>
      <Caption>{label}</Caption>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={theme.colors.inputPlaceholder}
        accessibilityLabel={label}
        style={{
          minHeight: theme.touchTarget.comfortable,
          paddingHorizontal: theme.space[4],
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.input,
          color: theme.colors.inputForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.base,
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
  );
}

/**
 * Fichas que se tocan.
 *
 * Lo elegido lleva **marca además de color**: un relleno distinto se pierde en
 * una captura en gris y en cualquier deficiencia de visión del color, y aquí lo
 * elegido decide con quién se junta un animal.
 */
function Chips({
  options,
  selected,
  onPress,
}: {
  options: ReadonlyArray<{ id: string; label: string; hint?: string }>;
  selected: readonly string[];
  onPress: (id: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            onPress={() => {
              haptics.tap();
              onPress(option.id);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[1],
              minHeight: theme.touchTarget.min,
              paddingHorizontal: theme.space[4],
              borderRadius: theme.radius.full,
              borderWidth: on ? 2 : 1,
              borderColor: on ? theme.colors.primary : theme.colors.border,
              backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
            })}
          >
            {on ? (
              <Icon icon={Check} size="sm" color={theme.colors.primary} decorative />
            ) : null}
            <Text
              style={{
                color: on ? theme.colors.foreground : theme.colors.mutedForeground,
                fontFamily: on ? fonts.bodyBold : fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              {option.label}
            </Text>
            {option.hint ? (
              <Text
                style={{
                  color: theme.colors.mutedForeground,
                  fontFamily: fonts.body,
                  fontSize: theme.fontSize['2xs'],
                }}
              >
                {option.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
