import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { LargeTitle, NavBar, Separator, useScrolled } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { Badge, Body, Caption, Notice, Row, Screen, Segmented } from '@/components/ui';
import { useActivePet } from '@/lib/active-pet';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
  Siren,
  Users,
  type LucideIcon,
} from '@/lib/icons';
import { markRead, send, useThread, useThreads, type Thread } from '@/lib/messages';
import { timeAgo } from '@/lib/posts';
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
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor:
            thread.kind === 'alert' ? theme.colors.destructive : theme.colors.surfaceSunken,
        }}
      >
        <Icon
          icon={meta.icon}
          size="lg"
          color={
            thread.kind === 'alert' ? theme.colors.destructiveForeground : theme.colors.foreground
          }
          decorative
        />
      </View>

      <View style={{ flex: 1, gap: theme.space[0.5] }}>
        <Row gap={2}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.base,
            }}
          >
            {thread.title}
          </Text>
          {thread.unread > 0 ? <Badge tone="live">{thread.unread}</Badge> : null}
        </Row>
        {/* El motivo va antes que el último mensaje. Es lo que decide si
            contestas, y en un hilo de alerta es lo único que importa. */}
        <Text
          numberOfLines={2}
          style={{
            color: theme.colors.mutedForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
            lineHeight: theme.fontSize.sm * 1.4,
          }}
        >
          {thread.reason}
        </Text>
        {last ? (
          <Text
            numberOfLines={1}
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.sm,
            }}
          >
            {last.mine ? 'Tú: ' : `${last.authorName.split(' ')[0]}: `}
            {last.body}
          </Text>
        ) : null}
      </View>

      <Icon icon={ChevronRight} size="base" color={theme.colors.mutedForeground} decorative />
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

  return (
    <Screen>
      <NavBar
        title={thread.title}
        scrolled
        trailing={
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
            <Icon icon={ChevronLeft} size="lg" decorative />
          </Pressable>
        }
      />

      {/* El motivo se queda fijo arriba, no solo en la lista. Es el contexto que
          hace legítima la conversación, y desaparece justo cuando hace falta si
          se va con el scroll. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          paddingHorizontal: theme.space[4],
          paddingVertical: theme.space[3],
          backgroundColor:
            thread.kind === 'alert' ? theme.colors.destructive : theme.colors.surfaceSunken,
        }}
      >
        <Icon
          icon={meta.icon}
          size="base"
          color={
            thread.kind === 'alert' ? theme.colors.destructiveForeground : theme.colors.foreground
          }
          decorative
        />
        <Text
          style={{
            flex: 1,
            color:
              thread.kind === 'alert'
                ? theme.colors.destructiveForeground
                : theme.colors.foreground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.sm,
            lineHeight: theme.fontSize.sm * 1.4,
          }}
        >
          {thread.reason}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.space[4], gap: theme.space[3] }}
      >
        {thread.messages.map((message) => (
          <View
            key={message.id}
            style={{
              alignSelf: message.mine ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              backgroundColor: message.mine ? theme.colors.primary : theme.colors.surface,
              borderWidth: message.mine ? 0 : 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              padding: theme.space[3],
              gap: theme.space[1],
            }}
          >
            {!message.mine ? (
              <Text
                style={{
                  color: theme.colors.mutedForeground,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize.xs,
                }}
              >
                {message.authorName}
              </Text>
            ) : null}
            <Text
              style={{
                color: message.mine ? theme.colors.primaryForeground : theme.colors.foreground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.base,
                lineHeight: theme.fontSize.base * 1.45,
              }}
            >
              {message.body}
            </Text>
            <Text
              style={{
                color: message.mine
                  ? theme.colors.primaryForeground
                  : theme.colors.mutedForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.xs,
                opacity: message.mine ? 0.85 : 1,
              }}
            >
              {timeAgo(message.at)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: theme.space[2],
          padding: theme.space[3],
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Escribe un mensaje"
          placeholderTextColor={theme.colors.inputPlaceholder}
          accessibilityLabel={`Escribir en ${thread.title}`}
          style={{
            flex: 1,
            minHeight: theme.touchTarget.min,
            maxHeight: 120,
            paddingHorizontal: theme.space[3],
            paddingVertical: theme.space[2],
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.input,
            color: theme.colors.inputForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: draft.trim().length === 0 }}
          disabled={draft.trim().length === 0}
          onPress={() => {
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
            backgroundColor:
              draft.trim().length === 0 ? theme.colors.muted : theme.colors.primary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon
            icon={Send}
            size="base"
            color={
              draft.trim().length === 0
                ? theme.colors.mutedForeground
                : theme.colors.primaryForeground
            }
            decorative
          />
        </Pressable>
      </View>
    </Screen>
  );
}
