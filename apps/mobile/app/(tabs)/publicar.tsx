import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { LargeTitle, NavBar, useScrolled } from '@/components/chrome';
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
  const { scrolled, onScroll } = useScrolled();
  const params = useLocalSearchParams<{ modo?: string }>();

  const [mode, setMode] = useState<Mode>(
    params.modo === 'estado' ? 'story' : params.modo === 'reel' ? 'reel' : 'post',
  );
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [alt, setAlt] = useState('');
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
  const ready =
    !needsWeather && (textOnlyStory || (mediaUri !== null && alt.trim().length >= 3));

  async function pickMedia() {
    setPicking(true);
    setPickError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: wantsVideo
          ? ImagePicker.MediaTypeOptions.Videos
          : ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // Vertical para reels y estados, cuadrado para el feed: recortar un
        // vídeo vertical a cuadrado es tirar media pantalla del que lo mira.
        aspect: mode === 'post' ? [1, 1] : [9, 16],
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets[0]) {
        setMediaUri(result.assets[0].uri);
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
        alt,
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
        alt,
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

    if (!mediaUri) return;
    publish({
      petId: pet.id,
      petName: pet.name,
      authorName: pet.ownerName,
      imageUri: mediaUri,
      imageAlt: alt,
      caption,
      placeName: place?.name ?? null,
      point: place ? { lat: place.lat, lng: place.lng } : null,
    });
    haptics.commit();
    router.replace('/');
  }

  return (
    <Screen>
      <NavBar title="Publicar" scrolled={scrolled} showTitle={scrolled} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
      >
        <LargeTitle
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
            wantsVideo={wantsVideo}
            optional={mode === 'story'}
            picking={picking}
            onPick={pickMedia}
            onClear={() => setMediaUri(null)}
          />

          {pickError ? (
            <Notice>
              <Body>{pickError}</Body>
            </Notice>
          ) : null}

          {mediaUri ? (
            <Field
              label={wantsVideo ? 'Qué se ve en el vídeo' : 'Qué se ve en la foto'}
              required
              value={alt}
              onChange={setAlt}
              placeholder={
                wantsVideo
                  ? `${pet.name} corriendo por la hierba y frenando para coger la pelota`
                  : `${pet.name} con una pelota en la boca sobre la hierba`
              }
              help="Obligatorio. Sin esto, la publicación no la ve todo el mundo."
            />
          ) : null}

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
              mode === 'story' ? 'Publicar el estado' : mode === 'reel' ? 'Publicar el reel' : 'Publicar'
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
                : mediaUri === null
                  ? wantsVideo
                    ? 'Elige un vídeo del carrete.'
                    : 'Elige una foto del carrete.'
                  : 'Falta describir lo que se ve. Son dos líneas y es lo que hace que la vea todo el mundo.'}
            </Caption>
          ) : null}

          <Notice>
            <Caption>{UPLOAD_NOTE}</Caption>
          </Notice>
        </View>
      </ScrollView>

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
            setMediaUri(null);
            setMode(next);
          }}
        />
      </View>
    </Screen>
  );
}

function MediaPicker({
  uri,
  wantsVideo,
  optional,
  picking,
  onPick,
  onClear,
}: {
  uri: string | null;
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
        <Image
          source={{ uri }}
          accessibilityLabel="La foto elegida"
          accessible
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.muted,
          }}
          resizeMode="cover"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Elegir otra"
          onPress={onClear}
          style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
        >
          <Caption>Elegir otra</Caption>
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
