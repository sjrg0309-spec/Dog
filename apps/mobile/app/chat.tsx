/**
 * Una conversación, a pantalla completa.
 *
 * Vive **fuera del grupo de pestañas** y esa es la decisión que más cambia de
 * esta pantalla. Antes el hilo se abría dentro de la pestaña de mensajes, así
 * que debajo del compositor seguían los cinco iconos de la barra: sesenta y
 * cuatro píxeles robados al chat, y cuatro salidas ofrecidas donde solo hace
 * falta una, que es volver. Ni WhatsApp ni los directos de Instagram dejan la
 * barra puesta al abrir una conversación, y no es estilo: un chat es una
 * pantalla en la que se entra y de la que se sale, no un sitio en el que se
 * está.
 *
 * Lo demás es el idioma de WhatsApp, y cada pieza hace un trabajo:
 *
 *  - **La cabecera dice de dónde sale el hilo.** Ahí WhatsApp pone «en línea»;
 *    aquí va el motivo —«coincidís 5 días de 7:00 a 7:45»—, que es lo que de
 *    verdad hace falta saber antes de escribirle a alguien del parque.
 *  - **El pico de la burbuja**, del lado de quien habla, para saber de quién es
 *    un mensaje sin leer el nombre.
 *  - **La hora dentro de la burbuja.** Fuera ocuparía una línea por mensaje y
 *    triplicaría el alto de la conversación.
 *  - **El nombre solo en el primero de cada tanda, y con su color.** El color
 *    por persona es lo que hace legible un grupo de cuatro sin leer: el ojo los
 *    separa antes de procesar las letras.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { FacePile } from '@/components/face-pile';
import { Screen } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { ArrowLeft, Check, CheckCheck, Mic, Paperclip, Send } from '@/lib/icons';
import {
  authorTint,
  clockTime,
  groupByDay,
  markRead,
  send,
  useThread,
  type Message,
  type Thread,
} from '@/lib/messages';
import { useTheme, type Theme } from '@/lib/theme';

/**
 * Los tres colores de nombre en un grupo. El índice lo decide `authorTint`.
 *
 * Marca, informativo y aviso: los tres pasan AA **sobre la burbuja** y se
 * separan entre sí en OKLab, y hay un test que lo comprueba en los dos temas.
 * El primer intento usaba el terracota del estado en vivo y el test lo tiró:
 * da 3,79 sobre superficie clara, que basta para un anillo y no para texto.
 * Queda fuera el rojo de extraviados, que en esta aplicación significa una
 * cosa y no puede significar además «este es Diego».
 */
const tintColor = (theme: Theme, tint: 0 | 1 | 2): string =>
  tint === 0 ? theme.colors.primary : tint === 1 ? theme.colors.warning : theme.colors.information;

export default function ChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pet = useActivePet();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const thread = useThread(id ?? null);

  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollView>(null);

  // Se marca leído al abrir, no al salir: un hilo que sigue en negrita después
  // de haberlo leído convierte el globo de no leídos en ruido.
  useEffect(() => {
    if (id) markRead(id);
  }, [id]);

  if (!thread) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space[3] }}>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.base,
            }}
          >
            Esta conversación ya no existe.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a la lista de mensajes"
            onPress={() => router.back()}
            style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
          >
            <Text
              style={{
                color: theme.colors.primary,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.base,
              }}
            >
              Volver
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const alert = thread.kind === 'alert';
  const days = groupByDay(thread.messages);
  const empty = draft.trim().length === 0;
  const face = thread.faces[0];

  return (
    <Screen>
      <ChatHeader thread={thread} onBack={() => router.back()} topInset={insets.top} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* El fondo de la conversación: una superficie hundida y lisa. WhatsApp
            pone papel pintado; aquí basta con separar el chat del resto de la
            aplicación sin meter una textura que compita con el texto. */}
        <ScrollView
          ref={scroller}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
          style={{ flex: 1, backgroundColor: theme.colors.surfaceSunken }}
          contentContainerStyle={{
            // Pegada abajo, no arriba. Es lo primero que se nota mal en un chat
            // corto: dos mensajes colgando del techo con seiscientos píxeles de
            // hueco hasta el compositor. Una conversación crece hacia arriba, y
            // lo último dicho tiene que quedar junto a donde se escribe.
            flexGrow: 1,
            justifyContent: 'flex-end',
            paddingHorizontal: theme.space[3],
            paddingVertical: theme.space[2],
            gap: 2,
          }}
        >
          {alert && face ? (
            /* En un hilo de alerta lo primero es de quién se está hablando. La
               ficha va arriba del todo y no en la cabecera porque se desplaza
               con la conversación: quien lleva media hora leyendo avistamientos
               no necesita el retrato pegado en la barra. */
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[3],
                marginBottom: theme.space[2],
                padding: theme.space[3],
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.surface,
              }}
            >
              <Avatar id={face.id} name={face.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: theme.colors.destructive,
                    fontFamily: fonts.displayBold,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {face.name} sigue sin aparecer
                </Text>
                <Text
                  style={{
                    color: theme.colors.mutedForeground,
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize.xs,
                  }}
                >
                  {thread.reason}
                </Text>
              </View>
            </View>
          ) : null}

          {days.map((group) => (
            <View key={group.day} style={{ gap: 2 }}>
              {/* La pastilla de fecha, centrada y flotando. Marca un corte en la
                  conversación, no una sección, y por eso no es una cabecera. */}
              <View style={{ alignItems: 'center', paddingVertical: theme.space[2] }}>
                <View
                  style={{
                    paddingHorizontal: theme.space[3],
                    paddingVertical: 3,
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.mutedForeground,
                      fontFamily: fonts.bodyBold,
                      fontSize: theme.fontSize['2xs'],
                    }}
                  >
                    {group.day}
                  </Text>
                </View>
              </View>

              {group.items.map((message, index) => {
                const previous = group.items[index - 1];
                const next = group.items[index + 1];
                const run = previous?.authorName === message.authorName;
                return (
                  <Bubble
                    key={message.id}
                    message={message}
                    showAuthor={!message.mine && thread.memberCount > 1 && !run}
                    // El pico solo en el último de cada tanda: una columna de
                    // burbujas todas con pico parece una lista de mensajes
                    // sueltos en lugar de alguien hablando seguido.
                    tail={next?.authorName !== message.authorName}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* El compositor: una píldora con el clip dentro, y a la derecha un
            botón redondo que cambia de micrófono a avión según haya texto. Ese
            cambio es lo que evita un botón de enviar apagado ocupando sitio la
            mayor parte del tiempo. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: theme.space[2],
            paddingHorizontal: theme.space[2],
            paddingTop: theme.space[2],
            paddingBottom: theme.space[2] + insets.bottom,
            backgroundColor: theme.colors.surfaceSunken,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'flex-end',
              backgroundColor: theme.colors.input,
              borderRadius: theme.radius.xl,
              paddingLeft: theme.space[4],
              paddingRight: theme.space[1],
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder="Mensaje"
              placeholderTextColor={theme.colors.inputPlaceholder}
              accessibilityLabel={`Escribir en ${thread.title}`}
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 120,
                paddingVertical: theme.space[2],
                color: theme.colors.inputForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.base,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Adjuntar una foto"
              // Cuarenta de dibujo para que quepa dentro de la píldora del
              // compositor, cuarenta y ocho de dedo.
              hitSlop={4}
              onPress={() => haptics.tap()}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Icon icon={Paperclip} size="base" color={theme.colors.mutedForeground} decorative />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={empty ? 'Grabar una nota de voz' : 'Enviar'}
            onPress={() => {
              if (empty) {
                haptics.tap();
                return;
              }
              send(thread.id, draft, pet.ownerName);
              haptics.commit();
              setDraft('');
            }}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon
              icon={empty ? Mic : Send}
              size="base"
              color={theme.colors.primaryForeground}
              decorative
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * La barra de la conversación.
 *
 * Volver, retrato, nombre y debajo la línea de estado. Sin el retrato esto era
 * una barra con un icono de categoría dentro de un círculo gris, que es la
 * cabecera de un panel de administración y no la de un chat.
 */
function ChatHeader({
  thread,
  onBack,
  topInset,
}: {
  thread: Thread;
  onBack: () => void;
  topInset: number;
}) {
  const theme = useTheme();
  const alert = thread.kind === 'alert';
  const ink = alert ? theme.colors.destructiveForeground : theme.colors.foreground;
  const face = thread.faces[0];
  const second = thread.faces[1];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        paddingLeft: theme.space[1],
        paddingRight: theme.space[3],
        paddingTop: topInset,
        height: 56 + topInset,
        backgroundColor: alert ? theme.colors.destructive : theme.colors.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: alert ? 'transparent' : theme.colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver a la lista de mensajes"
        onPress={onBack}
        style={({ pressed }) => ({
          width: theme.touchTarget.min,
          height: theme.touchTarget.min,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Icon icon={ArrowLeft} size="lg" color={ink} decorative />
      </Pressable>

      <FacePile faces={face ? (second ? [face, second] : [face]) : []} size={36} alert={alert} />

      <View style={{ flex: 1 }}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{ color: ink, fontFamily: fonts.displayBold, fontSize: theme.fontSize.sm }}
        >
          {thread.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color: alert ? theme.colors.destructiveForeground : theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize['2xs'],
            opacity: alert ? 0.85 : 1,
          }}
        >
          {thread.memberCount === 1 ? thread.reason : `${thread.memberCount} · ${thread.reason}`}
        </Text>
      </View>
    </View>
  );
}

function Bubble({
  message,
  showAuthor,
  tail,
}: {
  message: Message;
  showAuthor: boolean;
  tail: boolean;
}) {
  const theme = useTheme();
  const mine = message.mine;
  const round = 18;

  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        backgroundColor: mine ? theme.colors.accent : theme.colors.surface,
        borderRadius: round,
        // El pico: la esquina de abajo del lado propio se queda casi recta, y
        // solo en el último mensaje de cada tanda.
        borderBottomRightRadius: mine && tail ? 5 : round,
        borderBottomLeftRadius: !mine && tail ? 5 : round,
        paddingHorizontal: theme.space[3],
        paddingTop: theme.space[2],
        paddingBottom: 5,
      }}
    >
      {showAuthor ? (
        <Text
          style={{
            color: tintColor(theme, authorTint(message.authorId)),
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.xs,
            marginBottom: 1,
          }}
        >
          {message.authorName}
        </Text>
      ) : null}

      <Text
        style={{
          color: mine ? theme.colors.accentForeground : theme.colors.foreground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
          lineHeight: theme.fontSize.sm * 1.38,
        }}
      >
        {message.body}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-end',
          gap: 3,
          marginTop: 1,
        }}
      >
        <Text
          style={{
            color: mine ? theme.colors.accentForeground : theme.colors.mutedForeground,
            fontFamily: fonts.body,
            // La hora de un mensaje es el sitio clásico donde se cuela un
            // cuerpo de nueve o diez. Once es el mínimo de las dos guías.
            fontSize: theme.fontSize['2xs'],
            opacity: mine ? 0.7 : 1,
          }}
        >
          {clockTime(message.at)}
        </Text>
        {mine ? (
          <Icon
            icon={message.delivery === 'sent' ? Check : CheckCheck}
            size="sm"
            // Azul solo cuando está leído. Los dos checks grises significan
            // «llegó»; el azul, «lo ha visto». Confundirlos vacía de sentido el
            // único icono que la gente mira de verdad en un chat.
            color={
              message.delivery === 'read'
                ? theme.colors.information
                : theme.colors.accentForeground
            }
            decorative
          />
        ) : null}
      </View>
    </View>
  );
}
