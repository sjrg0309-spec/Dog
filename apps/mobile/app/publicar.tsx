import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { NavBar, useScrolled } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { Body, Button, Caption, Notice, Row, Screen } from '@/components/ui';
import { LargeTitle } from '@/components/chrome';
import { useActivePet } from '@/lib/active-pet';
import { fonts } from '@/lib/fonts';
import { ImagePlus, MapPin } from '@/lib/icons';
import { PLACES } from '@/lib/demo-data';
import { UPLOAD_NOTE, publish } from '@/lib/posts';
import { useTheme } from '@/lib/theme';

/**
 * Publicar.
 *
 * Tres campos y ninguno de adorno:
 *
 *  - **La foto**, que se elige del carrete con el selector del sistema. No hay
 *    pantalla de cámara propia: la del sistema ya resuelve permisos, recortes y
 *    galería, y hacerla de nuevo sería peor en todos los aspectos.
 *  - **La descripción de la foto**, obligatoria. Es el único campo que la
 *    mayoría de aplicaciones esconde detrás de «opciones avanzadas» o no tiene.
 *    Aquí está arriba y bloquea el botón, porque una aplicación que eligió una
 *    tipografía por accesibilidad no puede dejar las imágenes sin describir.
 *  - **El texto**, que es lo que hace que alguien conteste.
 *
 * Y el lugar, que solo admite zonas pet-friendly: es la misma regla que el
 * radar, y por el mismo motivo.
 */
export default function ComposeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const pet = useActivePet();
  const { scrolled, onScroll } = useScrolled();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageAlt, setImageAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const ready = imageUri !== null && imageAlt.trim().length >= 3;

  async function pickImage() {
    setPicking(true);
    setPickError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch {
      // El permiso denegado no es un fallo del que haya que disculparse: se
      // dice qué pasó y cómo salir, que es lo único accionable.
      setPickError(
        'No hemos podido abrir tus fotos. Revisa el permiso de galería en los ajustes del sistema.',
      );
    } finally {
      setPicking(false);
    }
  }

  return (
    <Screen>
      <NavBar title="Publicar" scrolled={scrolled} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
        keyboardShouldPersistTaps="handled"
      >
        <LargeTitle subtitle={`Se publicará como ${pet.name}.`}>Nueva publicación</LargeTitle>

        <View style={{ paddingHorizontal: theme.space[4], gap: theme.space[5] }}>
          {/* La foto */}
          {imageUri ? (
            <View style={{ gap: theme.space[2] }}>
              <Image
                source={{ uri: imageUri }}
                accessibilityLabel={imageAlt || 'Foto elegida, todavía sin describir'}
                accessible
                style={{
                  width: '100%',
                  aspectRatio: 1,
                  borderRadius: theme.radius.lg,
                  backgroundColor: theme.colors.muted,
                }}
                resizeMode="cover"
              />
              <Button label="Elegir otra foto" variant="outline" onPress={pickImage} />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Elegir una foto"
              accessibilityHint="Abre la galería del sistema"
              onPress={pickImage}
              style={({ pressed }) => ({
                width: '100%',
                aspectRatio: 1,
                borderRadius: theme.radius.lg,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: theme.colors.borderStrong,
                backgroundColor: theme.colors.surfaceSunken,
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.space[3],
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon icon={ImagePlus} size="xl" color={theme.colors.mutedForeground} decorative />
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize.base,
                }}
              >
                {picking ? 'Abriendo tus fotos…' : 'Elegir una foto'}
              </Text>
            </Pressable>
          )}

          {pickError ? (
            <Notice>
              <Body>{pickError}</Body>
            </Notice>
          ) : null}

          {/* La descripción, arriba y obligatoria. */}
          <Field
            label="Describe la foto"
            hint="Qué se ve, para quien no puede verla. Es obligatorio."
            value={imageAlt}
            onChange={setImageAlt}
            placeholder="Nina con una pelota en la boca sobre la hierba"
            maxLength={300}
          />

          <Field
            label="Escribe algo"
            hint="Opcional. Es lo que hace que alguien conteste."
            value={caption}
            onChange={setCaption}
            placeholder="Cuarenta minutos y no ha soltado la pelota ni una vez."
            maxLength={2200}
            tall
          />

          {/* El lugar: solo zonas pet-friendly, igual que el radar. */}
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
              {[null, PLACES.central.name, PLACES.retiro.name, PLACES.berlin.name].map((name) => (
                <Pressable
                  key={name ?? 'ninguno'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: placeName === name }}
                  onPress={() => setPlaceName(name)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space[2],
                    minHeight: theme.touchTarget.min,
                    paddingHorizontal: theme.space[4],
                    borderRadius: theme.radius.full,
                    borderWidth: 1,
                    borderColor: placeName === name ? theme.colors.primary : theme.colors.border,
                    backgroundColor: placeName === name ? theme.colors.primary : 'transparent',
                  }}
                >
                  {name ? (
                    <Icon
                      icon={MapPin}
                      size="sm"
                      color={
                        placeName === name
                          ? theme.colors.primaryForeground
                          : theme.colors.mutedForeground
                      }
                      decorative
                    />
                  ) : null}
                  <Text
                    style={{
                      color:
                        placeName === name
                          ? theme.colors.primaryForeground
                          : theme.colors.mutedForeground,
                      fontFamily: placeName === name ? fonts.bodyBold : fonts.body,
                      fontSize: theme.fontSize.sm,
                    }}
                  >
                    {name ?? 'Sin lugar'}
                  </Text>
                </Pressable>
              ))}
            </Row>
            <Caption>
              Solo zonas pet-friendly. Es la misma lista desde la que se puede encender el radar, y
              por el mismo motivo: un sitio donde nadie puede ir no le sirve a nadie.
            </Caption>
          </View>

          <Button
            label="Publicar"
            disabled={!ready}
            accessibilityHint={
              ready
                ? 'Añade la publicación al feed'
                : 'Hace falta una foto y su descripción antes de publicar'
            }
            onPress={() => {
              if (!imageUri) return;
              publish({
                petId: pet.id,
                petName: pet.name,
                authorName: pet.ownerName,
                imageUri,
                imageAlt,
                caption,
                placeName,
              });
              router.replace('/');
            }}
          />

          {!ready ? (
            <Caption>
              {imageUri === null
                ? 'Falta la foto.'
                : 'Falta describir la foto: son tres palabras y hacen que la vea todo el mundo.'}
            </Caption>
          ) : null}

          <Notice>
            <Body>La foto no sale de este dispositivo.</Body>
            <Caption>{UPLOAD_NOTE}</Caption>
          </Notice>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  maxLength,
  tall = false,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  tall?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

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
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inputPlaceholder}
        accessibilityLabel={label}
        accessibilityHint={hint}
        multiline
        maxLength={maxLength}
        style={{
          minHeight: tall ? 120 : theme.touchTarget.comfortable,
          padding: theme.space[3],
          borderRadius: theme.radius.md,
          borderWidth: focused ? 2 : 1,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          backgroundColor: theme.colors.input,
          color: theme.colors.inputForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.base,
          lineHeight: theme.fontSize.base * 1.4,
          textAlignVertical: 'top',
        }}
      />
      <Caption>{hint}</Caption>
    </View>
  );
}
