import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { LargeTitle, NAV_BAR_HEIGHT, NavBar } from '@/components/chrome';
import { ConditionsControl } from '@/components/conditions-control';
import { Icon } from '@/components/icon';
import { WelfareNotice } from '@/components/welfare-notice';
import { Body, Button, Caption, Notice, Row, Screen, Segmented } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { useConditions, useWeatherState } from '@/lib/conditions';
import { discover } from '@/lib/data';
import { PLACES, type DemoPlace } from '@/lib/demo-data';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { ImagePlus, MapPin, Video } from '@/lib/icons';
import { UPLOAD_NOTE, publish } from '@/lib/posts';
import { publishReel } from '@/lib/reels';
import { publishStory } from '@/lib/stories';
import { useScrollDriver } from '@/lib/scroll';
import { useTheme } from '@/lib/theme';

/**
 * Publicar, con tres modos.
 *
 * El selector va abajo, junto al pulgar, como el carrusel de la cámara de
 * Instagram. Arriba estaría más «ordenado» y quedaría al otro extremo de la
 * mano que sujeta el teléfono.
 *
 * | modo | qué es | cuánto dura |
 * |---|---|---|
 * | **Publicación** | foto con texto, en el feed | se queda |
 * | **Estado** | foto, vídeo o solo texto | 24 horas |
 * | **Reel** | vídeo vertical corto | se queda |
 *
 * Tres cosas que no son de interfaz:
 *
 *  - **La descripción del medio es obligatoria en los tres.** Es el campo que
 *    la mayoría de aplicaciones esconde detrás de «opciones avanzadas». Aquí
 *    bloquea el botón, porque una aplicación que eligió su tipografía por
 *    accesibilidad no puede dejar las imágenes sin describir. En un estado
 *    importa todavía más: dura un día, así que quien no puede verlo no tiene
 *    una segunda oportunidad.
 *  - **El lugar solo admite zonas pet-friendly**, misma regla que el radar y
 *    por el mismo motivo: lo que se comparte es el sitio, y tu portal no es un
 *    sitio al que nadie pueda ir.
 *  - **Un reel declara sus condiciones**, y si el bienestar dice que hoy no,
 *    la pantalla lo dice **antes** de grabar. No lo bloquea: quien graba decide
 *    sobre su animal, y una aplicación que impide publicar acaba en otra
 *    aplicación. Pero no se calla, que es lo que hace el resto.
 */
type Mode = 'post' | 'story' | 'reel';

const MODES = [
  { id: 'post' as Mode, label: 'Publicación', hint: 'Foto con texto, se queda en el feed' },
  { id: 'story' as Mode, label: 'Estado', hint: 'Caduca a las 24 horas' },
  { id: 'reel' as Mode, label: 'Reel', hint: 'Vídeo vertical corto' },
];

export default function ComposeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const pet = useActivePet();
  /* El mismo desplazamiento que conduce el resto: la línea de la barra, el
     título grande al encogerse y la barra de pestañas al condensarse. */
  const { scrollY, onScroll } = useScrollDriver();
  const params = useLocalSearchParams<{ modo?: string }>();

  const [mode, setMode] = useState<Mode>(
    params.modo === 'estado' ? 'story' : params.modo === 'reel' ? 'reel' : 'post',
  );
  /*
   * Los medios elegidos, en orden, cada uno con su descripción.
   *
   * Es una lista y no un campo suelto porque una publicación de feed puede
   * llevar varias fotos. Un estado y un reel siguen siendo uno: se quedan con
   * el primero, y el selector no deja elegir más en esos modos.
   *
   * **La descripción es por foto y no del conjunto**, que es lo que cuesta
   * defender y lo que hace que sirva: un lector de pantalla las recorre de una
   * en una, así que una descripción compartida convertiría las otras dos en
   * imágenes sin texto alternativo.
   */
  const [shots, setShots] = useState<{ uri: string; alt: string }[]>([]);
  const mediaUri = shots[0]?.uri ?? null;
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState<DemoPlace | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const declared = useWeatherState();
  const conditions = useConditions(30);
  const { welfare } = discover(pet, conditions);

  const wantsVideo = mode === 'reel';
  // Un estado puede ser solo texto; los otros dos necesitan medio.
  const textOnlyStory = mode === 'story' && mediaUri === null && caption.trim().length >= 3;
  /* Un reel además necesita las condiciones: la etiqueta de temperatura y
     superficie es lo único que impide que el formato premie el paseo de
     mediodía en agosto, y sin dato no hay etiqueta honesta que poner. Los otros
     dos modos no la llevan, así que no se bloquean por esto. */
  const needsWeather = mode === 'reel' && conditions === null;
  const described = shots.length > 0 && shots.every((shot) => shot.alt.trim().length >= 3);
  const ready = !needsWeather && (textOnlyStory || described);

  async function pickMedia() {
    setPicking(true);
    setPickError(null);
    try {
      /* Varias fotos solo en el feed. Un estado es una pantalla y un reel es un
         vídeo: ahí «varias» no significa nada. Y con selección múltiple no se
         puede recortar —la galería del sistema no ofrece las dos cosas a la
         vez—, así que el recorte cuadrado se mantiene cuando se elige una sola,
         que es el caso de siempre. */
      const many = mode === 'post';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: wantsVideo
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: many,
        selectionLimit: many ? 5 : 1,
        allowsEditing: !many,
        // Vertical para reels y estados, cuadrado para el feed: recortar un
        // vídeo vertical a cuadrado es tirar media pantalla del que lo mira.
        aspect: mode === 'post' ? [1, 1] : [9, 16],
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets.length > 0) {
        setShots(result.assets.map((asset) => ({ uri: asset.uri, alt: '' })));
      }
    } catch {
      setPickError(
        wantsVideo
          ? 'No se ha podido abrir la galería de vídeos. Comprueba el permiso de fotos.'
          : 'No se ha podido abrir la galería. Comprueba el permiso de fotos.',
      );
    } finally {
      setPicking(false);
    }
  }

  function submit() {
    if (mode === 'story') {
      publishStory({
        petId: pet.id,
        petName: pet.name,
        authorName: pet.ownerName,
        kind: mediaUri === null ? 'text' : 'photo',
        uri: mediaUri,
        alt: shots[0]?.alt ?? '',
        text: caption,
        placeName: place?.name ?? null,
      });
      haptics.commit();
      router.replace('/');
      return;
    }

    if (mode === 'reel') {
      if (!mediaUri) return;
      /* Un reel lleva escritas las condiciones en las que se grabó, y esa
         etiqueta es lo único que impide que el formato premie el paseo de
         mediodía en agosto. Sin temperatura no hay etiqueta que valga, así que
         no se publica: poner un número por defecto sería etiquetarlo de
         mentira, que es peor que no etiquetarlo. */
      if (!conditions) return;
      publishReel({
        petId: pet.id,
        petName: pet.name,
        authorName: pet.ownerName,
        videoUri: mediaUri,
        alt: shots[0]?.alt ?? '',
        caption,
        placeName: place?.name ?? null,
        durationS: 15,
        // Las condiciones no las escribe nadie a mano: salen del mismo control
        // que la aplicación ya usa para decidir si conviene salir.
        // Sin temperatura no se publica un reel: la etiqueta de condiciones
        // es lo que impide que el formato premie el paseo de mediodía en
        // agosto, y una etiqueta con un número por defecto no impide nada.
        recordedIn: { temperatureC: conditions.temperatureC, surface: conditions.surface },
      });
      haptics.commit();
      router.replace('/reels');
      return;
    }

    if (shots.length === 0) return;
    publish({
      petId: pet.id,
      petName: pet.name,
      authorName: pet.ownerName,
      photos: shots,
      caption,
      placeName: place?.name ?? null,
      point: place ? { lat: place.lat, lng: place.lng } : null,
    });
    haptics.commit();
    router.replace('/');
  }

  return (
    <Screen grouped>
      <NavBar title="Publicar" scrolled={false} scrollY={scrollY} revealAt={52} floating />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: NAV_BAR_HEIGHT, paddingBottom: theme.space[16] }}
      >
        <LargeTitle
          scrollY={scrollY}
          subtitle={
            mode === 'story'
              ? 'Caduca a las 24 horas y no se guarda. Es lo que hace que sirva para avisar de algo que pasa hoy.'
              : mode === 'reel'
                ? 'Vídeo vertical corto. Declara la temperatura y la superficie de cuando se grabó, igual que una quedada declara sus minutos.'
                : `Una foto de ${pet.name}, con su descripción.`
          }
        >
          Publicar
        </LargeTitle>

        <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[5] }}>
          {/* El bienestar, antes de grabar y no después. */}
          {mode === 'reel' && welfare?.level !== 'ok' ? (
            <WelfareNotice verdict={welfare} petName={pet.name} />
          ) : null}

          <MediaPicker
            uri={mediaUri}
            count={shots.length}
            wantsVideo={wantsVideo}
            optional={mode === 'story'}
            picking={picking}
            onPick={pickMedia}
            onClear={() => setShots([])}
          />

          {pickError ? (
            <Notice>
              <Body>{pickError}</Body>
            </Notice>
          ) : null}

          {/* Una descripción por foto. Con una sola es el campo de siempre;
              con varias, uno por foto y numerado, porque quien las oye las oye
              en ese orden. */}
          {shots.map((shot, index) => (
            <Field
              key={shot.uri}
              label={
                shots.length > 1
                  ? `Qué se ve en la foto ${index + 1}`
                  : wantsVideo
                    ? 'Qué se ve en el vídeo'
                    : 'Qué se ve en la foto'
              }
              required
              value={shot.alt}
              onChange={(value) =>
                setShots((current) =>
                  current.map((item, position) =>
                    position === index ? { ...item, alt: value } : item,
                  ),
                )
              }
              placeholder={
                wantsVideo
                  ? `${pet.name} corriendo por la hierba y frenando para coger la pelota`
                  : `${pet.name} con una pelota en la boca sobre la hierba`
              }
              help={
                index === 0
                  ? shots.length > 1
                    ? 'Una por foto: quien no ve la pantalla las oye de una en una.'
                    : 'Obligatorio. Sin esto, la publicación no la ve todo el mundo.'
                  : undefined
              }
            />
          ))}

          <Field
            label={mode === 'story' && !mediaUri ? 'Qué quieres decir' : 'Texto'}
            required={mode === 'story' && !mediaUri}
            value={caption}
            onChange={setCaption}
            multiline
            placeholder={
              mode === 'story'
                ? 'Hay obras en la entrada sur. Id por la puerta del este.'
                : 'Cuarenta minutos y no ha soltado la pelota ni una vez.'
            }
          />

          <PlacePicker place={place} onChange={setPlace} />

          {mode === 'reel' ? (
            <View style={{ gap: theme.space[2] }}>
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize.sm,
                }}
              >
                En qué condiciones se ha grabado
              </Text>
              <ConditionsControl />
              <Caption>
                Va escrito en el reel, siempre y no solo cuando son malas. Un dato que solo aparece
                cuando algo va mal se lee como una acusación; siempre presente, se lee como lo que
                es.
              </Caption>
            </View>
          ) : null}

          <Button
            label={
              mode === 'story'
                ? 'Publicar el estado'
                : mode === 'reel'
                  ? 'Publicar el reel'
                  : 'Publicar'
            }
            disabled={!ready}
            accessibilityHint={
              ready
                ? mode === 'story'
                  ? 'Lo verán quienes te siguen, durante 24 horas'
                  : 'Añade la publicación al feed'
                : 'Falta el medio o su descripción'
            }
            onPress={submit}
          />

          {!ready ? (
            <Caption>
              {needsWeather
                ? 'Un reel se publica con la temperatura y la superficie en las que se grabó, y ahora mismo no sabemos qué tiempo hace. Ponla arriba y sigue.'
                : mode === 'story' && !mediaUri
                  ? 'Escribe algo, o elige una foto o un vídeo.'
                  : shots.length === 0
                    ? wantsVideo
                      ? 'Elige un vídeo del carrete.'
                      : 'Elige una foto del carrete. Puedes elegir hasta cinco.'
                    : 'Falta describir lo que se ve. Son dos líneas y es lo que hace que la vea todo el mundo.'}
            </Caption>
          ) : null}

          <Notice>
            <Caption>{UPLOAD_NOTE}</Caption>
          </Notice>
        </View>
      </Animated.ScrollView>

      {/* El selector de modo, abajo y junto al pulgar. Es donde lo pone la
          cámara de Instagram, y por el mismo motivo: arriba quedaría al otro
          extremo de la mano que sujeta el teléfono. */}
      <View
        style={{
          paddingHorizontal: theme.space[4],
          paddingTop: theme.space[3],
          paddingBottom: theme.space[3],
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        }}
      >
        <Segmented
          options={MODES}
          value={mode}
          onChange={(next) => {
            // El medio no sobrevive al cambio: un vídeo no vale para una
            // publicación de foto y una foto cuadrada no vale para un reel.
            // Arrastrarlo daría un error al publicar y no al elegir.
            setShots([]);
            setMode(next);
          }}
        />
      </View>
    </Screen>
  );
}

function MediaPicker({
  uri,
  count = 0,
  wantsVideo,
  optional,
  picking,
  onPick,
  onClear,
}: {
  uri: string | null;
  /** Cuántas se han elegido. Con más de una, la vista previa lo dice. */
  count?: number;
  wantsVideo: boolean;
  optional: boolean;
  picking: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const theme = useTheme();

  if (uri && !wantsVideo) {
    return (
      <View style={{ gap: theme.space[2] }}>
        <View>
          <Image
            source={{ uri }}
            accessibilityLabel={count > 1 ? `La primera de ${count} fotos` : 'La foto elegida'}
            accessible
            style={{
              width: '100%',
              aspectRatio: 1,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.muted,
            }}
            resizeMode="cover"
          />
          {count > 1 ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: theme.space[3],
                right: theme.space[3],
                paddingHorizontal: theme.space[2],
                paddingVertical: 2,
                borderRadius: theme.radius.full,
                backgroundColor: 'rgba(0,0,0,0.55)',
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize['2xs'],
                }}
              >
                {count} fotos
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={count > 1 ? 'Elegir otras' : 'Elegir otra'}
          onPress={onClear}
          style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
        >
          <Caption>{count > 1 ? 'Elegir otras' : 'Elegir otra'}</Caption>
        </Pressable>
      </View>
    );
  }

  if (uri && wantsVideo) {
    return (
      <View
        style={{
          gap: theme.space[2],
          padding: theme.space[5],
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
        }}
      >
        <Icon icon={Video} size="xl" color={theme.colors.primary} decorative />
        <Body>Vídeo elegido</Body>
        <Caption>Se sube al publicar. Máximo un minuto.</Caption>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Elegir otro vídeo"
          onPress={onClear}
          style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
        >
          <Caption>Elegir otro</Caption>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.space[2] }}>
      <Button
        label={wantsVideo ? 'Elegir un vídeo' : 'Elegir una foto'}
        icon={wantsVideo ? Video : ImagePlus}
        variant="outline"
        loading={picking}
        onPress={onPick}
        accessibilityHint="Abre la galería del sistema"
      />
      {optional ? <Caption>Opcional: un estado puede ser solo texto.</Caption> : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  help,
  required = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  help?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[2] }}>
      <Text
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inputPlaceholder}
        accessibilityLabel={label}
        style={{
          minHeight: multiline ? 88 : theme.touchTarget.min,
          paddingHorizontal: theme.space[3],
          paddingVertical: theme.space[2],
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.input,
          color: theme.colors.inputForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.base,
        }}
      />
      {help ? <Caption>{help}</Caption> : null}
    </View>
  );
}

function PlacePicker({
  place,
  onChange,
}: {
  place: DemoPlace | null;
  onChange: (place: DemoPlace | null) => void;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.space[2] }}>
      <Text
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize.sm,
        }}
      >
        Dónde
      </Text>
      <Row gap={2}>
        {[null, PLACES.central, PLACES.retiro, PLACES.berlin].map((option) => {
          const selected = place?.id === option?.id;
          return (
            <Pressable
              key={option?.id ?? 'ninguno'}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option?.name ?? 'Sin lugar'}
              onPress={() => onChange(option)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[2],
                minHeight: theme.touchTarget.min,
                paddingHorizontal: theme.space[4],
                borderRadius: theme.radius.full,
                borderWidth: 1,
                borderColor: selected ? theme.colors.primary : theme.colors.border,
                backgroundColor: selected ? theme.colors.primary : 'transparent',
              }}
            >
              {option ? (
                <Icon
                  icon={MapPin}
                  size="sm"
                  color={selected ? theme.colors.primaryForeground : theme.colors.mutedForeground}
                  decorative
                />
              ) : null}
              <Text
                style={{
                  color: selected ? theme.colors.primaryForeground : theme.colors.mutedForeground,
                  fontFamily: selected ? fonts.bodyBold : fonts.body,
                  fontSize: theme.fontSize.sm,
                }}
              >
                {option?.name ?? 'Sin lugar'}
              </Text>
            </Pressable>
          );
        })}
      </Row>
      <Caption>
        Solo zonas pet-friendly. Es la misma lista desde la que se enciende el radar, y por el mismo
        motivo: un sitio donde nadie puede ir no le sirve a nadie.
      </Caption>
    </View>
  );
}
