import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { LargeTitle, NavBar, Separator, useScrolled } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { Body, Caption, Notice, Screen, Segmented } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Mic,
  Paperclip,
  Send,
  Siren,
  Users,
  type LucideIcon,
} from '@/lib/icons';
import {
  clockTime,
  groupByDay,
  markRead,
  send,
  useThread,
  useThreads,
  type Message,
  type Thread,
} from '@/lib/messages';
import { useTheme } from '@/lib/theme';

/**
 * Mensajes y grupos.
 *
 * Una decisión que no es de interfaz y que se ve en toda la pantalla: **cada
 * hilo lleva escrito por qué existe**. «Coincidís 5 días a la semana de 7:00 a
 * 7:45.» «Estáis los cuatro apuntados.» «Hay una alerta abierta a 900 metros.»
 *
 * No es un adorno. En una aplicación donde quedas en un parque con desconocidos
 * y sueltas a tu perro con los suyos, un chat que se puede abrir contra
 * cualquiera desde cualquier perfil es sobre todo un canal de acoso. Aquí una
 * conversación nace de algo que ya ha pasado, y quien la abre puede ver de qué
 * se trata antes de contestar.
 *
 * Los grupos son las comunidades del barrio, no una lista aparte con los mismos
 * nombres.
 */
const KIND_META: Record<
  Thread['kind'],
  { icon: LucideIcon; label: string; tone: 'neutral' | 'accent' | 'live' | 'warning' }
> = {
  alert: { icon: Siren, label: 'Alerta', tone: 'warning' },
  schedule_match: { icon: Clock, label: 'Coincidís', tone: 'accent' },
  playdate: { icon: CalendarDays, label: 'Quedada', tone: 'live' },
  group: { icon: Users, label: 'Grupo', tone: 'neutral' },
};

type Filter = 'all' | 'groups';

export default function MessagesScreen() {
  const theme = useTheme();
  const { scrolled, onScroll } = useScrolled();
  const threads = useThreads();
  const pet = useActivePet();

  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const open = useThread(openId);

  if (open) {
    return <ThreadView thread={open} viewerName={pet.ownerName} onBack={() => setOpenId(null)} />;
  }

  const visible =
    filter === 'groups' ? threads.filter((thread) => thread.memberCount > 1) : threads;

  return (
    <Screen>
      <NavBar title="Mensajes" scrolled={scrolled} showTitle={scrolled} />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[16] }}
      >
        <LargeTitle subtitle="Cada conversación dice de dónde sale. Aquí no se escribe a desconocidos por escribir.">
          Mensajes
        </LargeTitle>

        <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[4] }}>
          <Segmented
            options={[
              { id: 'all' as Filter, label: 'Todo', hint: 'Conversaciones y grupos' },
              { id: 'groups' as Filter, label: 'Grupos', hint: 'Solo lo que es de más de uno' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </View>

        <Separator />
        {visible.map((thread) => (
          <View key={thread.id}>
            <ThreadRow
              thread={thread}
              onPress={() => {
                haptics.tap();
                markRead(thread.id);
                setOpenId(thread.id);
              }}
            />
            <Separator inset={theme.space[4]} />
          </View>
        ))}

        <View style={{ padding: theme.space[4] }}>
          <Notice>
            <Body>¿Falta alguien con quien te gustaría hablar?</Body>
            <Caption>
              Las conversaciones nacen de coincidir: mismo horario, misma quedada, misma alerta. Si
              alguien te interesa y todavía no hay hilo, la vía es apuntarse a lo mismo, no un
              botón de mensaje sobre su perfil.
            </Caption>
            <Link href="/descubrir" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Ver con quién coincides"
                style={{ minHeight: theme.touchTarget.min, justifyContent: 'center' }}
              >
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontFamily: fonts.bodyBold,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  Ver con quién coincides
                </Text>
              </Pressable>
            </Link>
          </Notice>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ThreadRow({ thread, onPress }: { thread: Thread; onPress: () => void }) {
  const theme = useTheme();
  const meta = KIND_META[thread.kind];
  const last = thread.messages[thread.messages.length - 1];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        thread.unread > 0
          ? `${thread.title}. ${thread.unread} sin leer. ${thread.reason}`
          : `${thread.title}. ${thread.reason}`
      }
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[3],
        minHeight: theme.touchTarget.comfortable + 24,
        backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
      })}
    >
      {/* Avatar redondo y grande, como en WhatsApp. El cuadrado de antes hacía
          que la lista pareciera un panel de administración. */}
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            thread.kind === 'alert' ? theme.colors.destructive : theme.colors.surfaceSunken,
        }}
      >
        <Icon
          icon={meta.icon}
          size="xl"
          color={
            thread.kind === 'alert' ? theme.colors.destructiveForeground : theme.colors.foreground
          }
          decorative
        />
      </View>

      <View style={{ flex: 1, gap: theme.space[0.5] }}>
        {/* Nombre a la izquierda y hora arriba a la derecha, en la misma línea.
            Es la fila de WhatsApp, y el sitio de la hora no es capricho: se lee
            en diagonal para saber qué está vivo sin leer nada más. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
            }}
          >
            {thread.title}
          </Text>
          {last ? (
            <Text
              style={{
                color: thread.unread > 0 ? theme.colors.primary : theme.colors.mutedForeground,
                fontFamily: thread.unread > 0 ? fonts.bodyBold : fonts.body,
                fontSize: theme.fontSize.xs,
              }}
            >
              {clockTime(last.at)}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <View style={{ flex: 1, gap: theme.space[0.5] }}>
            {last ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1] }}>
                {/* El doble check delante del propio mensaje, como en WhatsApp:
                    dice si llegó sin tener que abrir el hilo. */}
                {last.mine ? (
                  <Icon
                    icon={last.delivery === 'sent' ? Check : CheckCheck}
                    size="sm"
                    color={
                      last.delivery === 'read'
                        ? theme.colors.information
                        : theme.colors.mutedForeground
                    }
                    decorative
                  />
                ) : null}
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    color:
                      thread.unread > 0 ? theme.colors.foreground : theme.colors.mutedForeground,
                    fontFamily: thread.unread > 0 ? fonts.bodyBold : fonts.body,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {!last.mine && thread.memberCount > 1
                    ? `${last.authorName.split(' ')[0]}: ${last.body}`
                    : last.body}
                </Text>
              </View>
            ) : null}

            {/* El motivo se queda, en pequeño y en tercera línea. Es lo que
                separa esta lista de un chat cualquiera: dice de dónde sale la
                conversación antes de que la abras. */}
            <Text
              numberOfLines={1}
              style={{
                color: theme.colors.mutedForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.xs,
              }}
            >
              {thread.reason}
            </Text>
          </View>

          {thread.unread > 0 ? (
            <View
              style={{
                minWidth: 22,
                height: 22,
                paddingHorizontal: 6,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary,
              }}
            >
              <Text
                style={{
                  color: theme.colors.primaryForeground,
                  fontFamily: fonts.bodyBold,
                  fontSize: 11,
                }}
              >
                {thread.unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function ThreadView({
  thread,
  viewerName,
  onBack,
}: {
  thread: Thread;
  viewerName: string;
  onBack: () => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const meta = KIND_META[thread.kind];
  const days = groupByDay(thread.messages);
  const empty = draft.trim().length === 0;

  return (
    <Screen>
      {/* Cabecera de conversación de WhatsApp: volver, avatar, nombre y debajo
          la línea de estado. Ahí WhatsApp pone «en línea»; aquí va el motivo
          del hilo, que es lo que de verdad hace falta saber antes de escribir. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          paddingHorizontal: theme.space[2],
          paddingVertical: theme.space[2],
          backgroundColor:
            thread.kind === 'alert' ? theme.colors.destructive : theme.colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
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
          <Icon
            icon={ArrowLeft}
            size="lg"
            color={
              thread.kind === 'alert'
                ? theme.colors.destructiveForeground
                : theme.colors.foreground
            }
            decorative
          />
        </Pressable>

        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              thread.kind === 'alert'
                ? theme.colors.destructiveForeground
                : theme.colors.surfaceSunken,
          }}
        >
          <Icon
            icon={meta.icon}
            size="base"
            color={
              thread.kind === 'alert' ? theme.colors.destructive : theme.colors.foreground
            }
            decorative
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{
              color:
                thread.kind === 'alert'
                  ? theme.colors.destructiveForeground
                  : theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
            }}
          >
            {thread.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color:
                thread.kind === 'alert'
                  ? theme.colors.destructiveForeground
                  : theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.xs,
            }}
          >
            {thread.memberCount === 1 ? thread.reason : `${thread.memberCount} · ${thread.reason}`}
          </Text>
        </View>
      </View>

      {/* El fondo de la conversación. WhatsApp pone un papel pintado; aquí una
          superficie hundida y lisa, que hace el mismo trabajo —separar el chat
          del resto de la aplicación— sin meter una textura que compita con el
          texto. */}
      <ScrollView
        style={{ backgroundColor: theme.colors.surfaceSunken }}
        contentContainerStyle={{ padding: theme.space[3], gap: theme.space[1] }}
      >
        {days.map((group) => (
          <View key={group.day} style={{ gap: theme.space[1] }}>
            {/* La pastilla de fecha, centrada y flotando. Marca un corte en la
                conversación, no una sección, y por eso no es una cabecera. */}
            <View style={{ alignItems: 'center', paddingVertical: theme.space[2] }}>
              <View
                style={{
                  paddingHorizontal: theme.space[3],
                  paddingVertical: theme.space[1],
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.mutedForeground,
                    fontFamily: fonts.bodyBold,
                    fontSize: theme.fontSize.xs,
                  }}
                >
                  {group.day}
                </Text>
              </View>
            </View>

            {group.items.map((message, index) => (
              <Bubble
                key={message.id}
                message={message}
                showAuthor={
                  !message.mine &&
                  thread.memberCount > 1 &&
                  group.items[index - 1]?.authorName !== message.authorName
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {/* El compositor de WhatsApp: una píldora con el clip dentro, y a la
          derecha un botón redondo que cambia de micrófono a avión según haya
          texto. Ese cambio es lo que hace que no haya un botón de enviar
          apagado ocupando sitio la mayor parte del tiempo. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: theme.space[2],
          padding: theme.space[2],
          backgroundColor: theme.colors.surfaceSunken,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: theme.space[1],
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
              minHeight: theme.touchTarget.min,
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
            onPress={() => haptics.tap()}
            style={({ pressed }) => ({
              width: theme.touchTarget.min,
              height: theme.touchTarget.min,
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
            send(thread.id, draft, viewerName);
            haptics.commit();
            setDraft('');
          }}
          style={({ pressed }) => ({
            width: theme.touchTarget.comfortable,
            height: theme.touchTarget.comfortable,
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
    </Screen>
  );
}

/**
 * Una burbuja.
 *
 * Tres detalles de WhatsApp que parecen decorativos y no lo son:
 *
 *  1. **El pico.** Una esquina sin redondear del lado de quien habla. Es lo que
 *     permite saber de quién es un mensaje sin leer el nombre, y por eso solo
 *     lo lleva el primero de cada tanda.
 *  2. **La hora dentro de la burbuja**, abajo a la derecha y en pequeño. Fuera
 *     ocuparía una línea por mensaje y triplicaría el alto de la conversación.
 *  3. **El nombre solo en el primer mensaje seguido de cada persona**, y solo en
 *     grupo. Repetirlo en cada burbuja es ruido; quitarlo del todo hace
 *     ilegible un grupo de cuatro.
 */
function Bubble({ message, showAuthor }: { message: Message; showAuthor: boolean }) {
  const theme = useTheme();
  const mine = message.mine;

  return (
    <View
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        backgroundColor: mine ? theme.colors.accent : theme.colors.surface,
        borderRadius: theme.radius.lg,
        // El pico: la esquina de abajo del lado propio se queda casi recta.
        borderBottomRightRadius: mine ? theme.radius.xs : theme.radius.lg,
        borderBottomLeftRadius: mine ? theme.radius.lg : theme.radius.xs,
        paddingHorizontal: theme.space[3],
        paddingTop: theme.space[2],
        paddingBottom: theme.space[1],
        gap: 2,
      }}
    >
      {showAuthor ? (
        <Text
          style={{
            color: theme.colors.primary,
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.xs,
          }}
        >
          {message.authorName}
        </Text>
      ) : null}

      <Text
        style={{
          color: mine ? theme.colors.accentForeground : theme.colors.foreground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.base,
          lineHeight: theme.fontSize.base * 1.4,
        }}
      >
        {message.body}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-end',
          gap: theme.space[1],
        }}
      >
        <Text
          style={{
            color: mine ? theme.colors.accentForeground : theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: 11,
            opacity: mine ? 0.75 : 1,
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
