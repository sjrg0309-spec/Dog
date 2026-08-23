import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NavBar, useScrolled } from '@/components/chrome';
import { Icon } from '@/components/icon';
import { FacePile } from '@/components/face-pile';
import { Body, Caption, Notice, Screen } from '@/components/ui';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  CalendarDays,
  Check,
  CheckCheck,
  Clock,
  Search,
  Siren,
  SquarePen,
  Users,
  type LucideIcon,
} from '@/lib/icons';
import { clockTime, useThreads, type Thread } from '@/lib/messages';
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
 * **Dónde va ese motivo, que es lo que ha cambiado.** Antes ocupaba una tercera
 * línea gris en cada fila, y con tres líneas por fila la lista dejaba de
 * parecer una lista de conversaciones: WhatsApp y los directos de Instagram
 * tienen dos, y la segunda es siempre el último mensaje. Ahora el motivo va
 * como una **etiqueta de una palabra** junto al nombre —Coincidís, Quedada,
 * Alerta, Grupo— y entero en la cabecera de la conversación, donde de verdad
 * hace falta: justo antes de escribir. La garantía no se ha tocado, solo el
 * sitio donde se lee.
 *
 * Los grupos son las comunidades del barrio, no una lista aparte con los mismos
 * nombres.
 */
const KIND_META: Record<Thread['kind'], { icon: LucideIcon; label: string }> = {
  alert: { icon: Siren, label: 'Alerta' },
  schedule_match: { icon: Clock, label: 'Coincidís' },
  playdate: { icon: CalendarDays, label: 'Quedada' },
  group: { icon: Users, label: 'Grupo' },
};

const FILTERS = [
  { id: 'all', label: 'Todo' },
  { id: 'unread', label: 'No leídos' },
  { id: 'groups', label: 'Grupos' },
] as const;

type Filter = (typeof FILTERS)[number]['id'];

export default function MessagesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { scrolled, onScroll } = useScrolled();
  const threads = useThreads();

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return threads.filter((thread) => {
      if (filter === 'groups' && thread.memberCount <= 1) return false;
      if (filter === 'unread' && thread.unread === 0) return false;
      if (needle.length === 0) return true;
      // Se busca también dentro de los mensajes, no solo en el título: quien
      // busca «cristales» se acuerda de lo que le dijeron, no de quién.
      return (
        thread.title.toLowerCase().includes(needle) ||
        thread.reason.toLowerCase().includes(needle) ||
        thread.messages.some((message) => message.body.toLowerCase().includes(needle))
      );
    });
  }, [threads, filter, query]);

  const open = (thread: Thread) => {
    haptics.tap();
    router.push(`/chat?id=${thread.id}`);
  };

  return (
    <Screen>
      <NavBar
        title="Mensajes"
        scrolled={scrolled}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escribir a alguien con quien coincides"
            onPress={() => {
              haptics.tap();
              router.push('/descubrir');
            }}
            style={({ pressed }) => ({
              width: theme.touchTarget.min,
              height: theme.touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Icon icon={SquarePen} size="lg" decorative />
          </Pressable>
        }
      />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: theme.space[10] }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Buscador y filtros: la cabecera de WhatsApp. Sustituyen al título
            grande con su párrafo debajo y al segmentado de dos píldoras, que
            entre los tres se comían cuatrocientos píxeles antes de la primera
            conversación. Y el buscador **busca de verdad**, incluido dentro de
            los mensajes: una lupa que no filtra nada es peor que no tenerla. */}
        <View style={{ paddingHorizontal: theme.space[4], paddingBottom: theme.space[2] }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space[2],
              height: 38,
              paddingHorizontal: theme.space[3],
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.surfaceSunken,
            }}
          >
            <Icon icon={Search} size="base" color={theme.colors.mutedForeground} decorative />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar"
              placeholderTextColor={theme.colors.inputPlaceholder}
              accessibilityLabel="Buscar en los mensajes"
              returnKeyType="search"
              style={{
                flex: 1,
                color: theme.colors.inputForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.space[4],
            gap: theme.space[2],
            paddingBottom: theme.space[3],
          }}
        >
          {FILTERS.map((option) => {
            const active = option.id === filter;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                /* El chip mide treinta de alto porque así se ven los chips —en
                   Material son treinta y dos—, y aun así hay que poder tocarlo
                   en cuarenta y cuatro. `hitSlop` amplía el área sin tocar el
                   dibujo, que es justo la salida que da la guía para un control
                   que tiene que verse pequeño. */
                hitSlop={8}
                onPress={() => {
                  haptics.tap();
                  setFilter(option.id);
                }}
                style={({ pressed }) => ({
                  height: 30,
                  justifyContent: 'center',
                  paddingHorizontal: theme.space[3],
                  borderRadius: theme.radius.full,
                  backgroundColor: active ? theme.colors.accent : theme.colors.surfaceSunken,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: active ? theme.colors.accentForeground : theme.colors.mutedForeground,
                    fontFamily: active ? fonts.bodyBold : fonts.body,
                    fontSize: theme.fontSize.xs,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visible.length === 0 ? (
          <View style={{ paddingHorizontal: theme.space[4], paddingTop: theme.space[4] }}>
            <Notice>
              <Body>
                {query.trim().length > 0
                  ? `Nada que contenga «${query.trim()}».`
                  : filter === 'unread'
                    ? 'No tienes nada sin leer.'
                    : 'Todavía no hay ningún grupo.'}
              </Body>
            </Notice>
          </View>
        ) : (
          visible.map((thread) => (
            <ThreadRow key={thread.id} thread={thread} onPress={() => open(thread)} />
          ))
        )}

        <View style={{ padding: theme.space[4], paddingTop: theme.space[6] }}>
          <Notice>
            <Body>¿Falta alguien con quien te gustaría hablar?</Body>
            <Caption>
              Las conversaciones nacen de coincidir: mismo horario, misma quedada, misma alerta. Si
              alguien te interesa y todavía no hay hilo, la vía es apuntarse a lo mismo, no un
              botón de mensaje sobre su perfil.
            </Caption>
            {/* Sin `Link asChild`: en web el envoltorio se queda con el estilo
                del `Pressable` que envuelve y el `<a>` sale en columna. */}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Ver con quién coincides"
              onPress={() => {
                haptics.tap();
                router.push('/descubrir');
              }}
              style={({ pressed }) => ({
                minHeight: theme.touchTarget.min,
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
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
          </Notice>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Una fila de la lista.
 *
 * Dos líneas, no tres: retrato, nombre y hora arriba; último mensaje y globo de
 * no leídos abajo. Y el retrato es **la cara del animal del hilo**, no un icono
 * de categoría dentro de un círculo gris — con iconos, cuatro conversaciones
 * distintas se veían idénticas y la lista se leía como una bandeja de
 * notificaciones del sistema.
 */
function ThreadRow({ thread, onPress }: { thread: Thread; onPress: () => void }) {
  const theme = useTheme();
  const meta = KIND_META[thread.kind];
  const last = thread.messages[thread.messages.length - 1];
  const unread = thread.unread > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unread
          ? `${thread.title}. ${meta.label}. ${thread.unread} sin leer. ${thread.reason}`
          : `${thread.title}. ${meta.label}. ${thread.reason}`
      }
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        paddingHorizontal: theme.space[4],
        paddingVertical: theme.space[2],
        minHeight: 68,
        backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
      })}
    >
      <FacePile faces={thread.faces} size={50} alert={thread.kind === 'alert'} />

      <View
        style={{
          flex: 1,
          gap: 2,
          // El pelo separador arranca en el texto y no en el borde, para que la
          // columna de retratos se lea como una columna.
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.border,
          paddingBottom: theme.space[2],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize.sm,
            }}
          >
            {thread.title}
          </Text>
          {last ? (
            <Text
              style={{
                color: unread ? theme.colors.primary : theme.colors.mutedForeground,
                fontFamily: unread ? fonts.bodyBold : fonts.body,
                fontSize: theme.fontSize['2xs'],
              }}
            >
              {clockTime(last.at)}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[1] }}>
          {/* De dónde sale el hilo, en un icono y sin la palabra. Con la
              palabra escrita —«Coincidís», «Quedada»— se comía setenta píxeles
              de la línea y el último mensaje se cortaba a media frase, que es
              justo lo que uno viene a leer. El icono cabe, y la palabra entera
              sigue en la etiqueta accesible y en la cabecera del hilo. */}
          <Icon icon={meta.icon} size="sm" color={theme.colors.mutedForeground} decorative />

          {last ? (
            <>
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
                  color: unread ? theme.colors.foreground : theme.colors.mutedForeground,
                  fontFamily: unread ? fonts.bodyBold : fonts.body,
                  fontSize: theme.fontSize.sm,
                }}
              >
                {!last.mine && thread.memberCount > 1
                  ? `${last.authorName.split(' ')[0]}: ${last.body}`
                  : last.body}
              </Text>
            </>
          ) : (
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: theme.colors.mutedForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              {thread.reason}
            </Text>
          )}

          {unread ? (
            <View
              style={{
                minWidth: 20,
                height: 20,
                paddingHorizontal: 6,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary,
              }}
            >
              <Text
                style={{
                  color: theme.colors.primaryForeground,
                  fontFamily: fonts.bodyBold,
                  fontSize: theme.fontSize['2xs'],
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
