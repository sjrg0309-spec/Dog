/**
 * Los acomodos: lo que necesita la persona para que esto le sirva.
 *
 * Pantalla propia y no una sección de configuración por dos motivos. El
 * primero es que cada interruptor necesita su explicación entera —qué cambia,
 * no cómo se llama— y en una lista de ajustes eso no cabe. El segundo importa
 * más: aquí se puede decir, arriba y una sola vez, **lo que la gente necesita
 * saber antes de contestar**, que es que nada de esto se publica.
 *
 * ## Por qué el diagnóstico no es el mecanismo
 *
 * Se puede decir «soy autista», y no pone ninguna insignia: marca unos
 * acomodos, que son lo que la aplicación hace distinto. Los acomodos existen
 * por su cuenta y los enciende quien quiera sin decir por qué —hay gente con
 * ansiedad, con TDAH, con hipersensibilidad al ruido, o que simplemente odia
 * los planes improvisados—.
 *
 * Y tiene una consecuencia práctica que no es menor: **el diagnóstico no hace
 * falta guardarlo para que la aplicación funcione distinto**, y lo que no hace
 * falta guardar no se puede filtrar.
 *
 * ## Ninguno es decorativo
 *
 * Cada uno dice debajo qué cambia, y lo que dice es verdad: «sitios tranquilos»
 * reordena la lista del mapa por cuánta gente hay ahora, y «menos movimiento»
 * enciende el ajuste que apaga el pulso del radar. Los que todavía no cambian
 * nada no están en la lista.
 */

import { ScrollView, Text, View } from 'react-native';

import { AUTISTIC_DEFAULT_NEEDS, HANDLER_NEEDS, type HandlerNeed } from '@petnav/core';

import { BackBar } from '@/components/chrome';
import { FootNote, LIST_GUTTER, ListGroup } from '@/components/list';
import { Icon } from '@/components/icon';
import { Caption, Screen } from '@/components/ui';
import { setHandler, useAccount } from '@/lib/account';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Check, X } from '@/lib/icons';
import { useTheme } from '@/lib/theme';
import { Pressable } from 'react-native';

export default function AcomodosScreen() {
  const theme = useTheme();
  const { handler } = useAccount();

  const toggleNeed = (need: HandlerNeed) => {
    haptics.tap();
    const has = handler.needs.includes(need);
    setHandler({
      ...handler,
      needs: has ? handler.needs.filter((value) => value !== need) : [...handler.needs, need],
    });
  };

  const toggleAutistic = () => {
    haptics.tap();
    const next = !handler.autistic;
    setHandler({
      autistic: next || undefined,
      /* Preselecciona, no impone: no hay dos personas autistas iguales, y dar
         por hecho lo contrario es la mitad del problema. Al apagarlo no se
         quitan los acomodos, porque a lo mejor los quiere igual. */
      needs: next
        ? [
            ...handler.needs,
            ...AUTISTIC_DEFAULT_NEEDS.filter((need) => !handler.needs.includes(need)),
          ]
        : handler.needs,
    });
  };

  return (
    <Screen grouped>
      <BackBar title="Sobre ti" subtitle="Privado" />

      {/* Los interruptores, como los de los ajustes de cualquier red social:
          filas del ancho de la pantalla, separadas por un pelo, y la letra
          pequeña debajo del grupo en vez de un recuadro de aviso encima. El
          recuadro de «solo lo ves tú» decía lo mismo que ahora dice el rótulo
          «Privado» de la barra y la nota del final, y ocupaba el sitio del
          primer interruptor. */}
      <ScrollView contentContainerStyle={{ paddingBottom: theme.space[16] }}>
        <FootNote>
          Nada de esto aparece en tu perfil ni lo ve nadie. Solo cambia cómo funciona la aplicación
          para ti.
        </FootNote>

        {/* Dos grupos y no uno: «soy autista» preselecciona los de abajo, así
            que decirlo con la forma —una tarjeta aparte— es más claro que
            decirlo con una frase debajo de una lista de cuatro interruptores
            iguales. */}
        <ListGroup leading="none">
          <Row
            label="Soy autista"
            hint="Marca las opciones de abajo. Puedes cambiarlas una a una."
            on={handler.autistic === true}
            onToggle={toggleAutistic}
          />
        </ListGroup>

        <View style={{ height: theme.space[5] }} />

        <ListGroup leading="none">
          {HANDLER_NEEDS.map((need) => (
            <Row
              key={need.id}
              label={need.label}
              hint={need.effect}
              on={handler.needs.includes(need.id)}
              onToggle={() => toggleNeed(need.id)}
            />
          ))}
        </ListGroup>

        <FootNote>
          Contamos cuánta gente hay en cada sitio, no quién. Por eso «sitios tranquilos» funciona
          aunque todavía no hayas verificado el chip.
        </FootNote>
      </ScrollView>
    </Screen>
  );
}

function Row({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onToggle}
      /* `accessibilityState` no llega a la web: react-native-web no lo traduce a
         `aria-checked` en un `Pressable` con papel de interruptor, así que un
         lector de pantalla anunciaba «interruptor» sin decir si estaba puesto.
         Se vio en la auditoría del empaquetado, que buscaba ese atributo para
         comprobar otra cosa y lo encontró vacío. En nativo manda el de arriba;
         en web, este. */
      aria-checked={on}

      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: theme.touchTarget.comfortable + 8,
        paddingHorizontal: LIST_GUTTER - 2,
        paddingVertical: theme.space[2],
        backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: on ? fonts.bodyBold : fonts.body,
            fontSize: theme.fontSize.base,
          }}
        >
          {label}
        </Text>
        <Caption>{hint}</Caption>
      </View>
      <View
        style={{
          width: 52,
          height: 32,
          borderRadius: theme.radius.full,
          padding: 3,
          justifyContent: 'center',
          alignItems: on ? 'flex-end' : 'flex-start',
          backgroundColor: on ? theme.colors.primary : theme.colors.muted,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            icon={on ? Check : X}
            size="sm"
            color={on ? theme.colors.primary : theme.colors.mutedForeground}
            decorative
          />
        </View>
      </View>
    </Pressable>
  );
}
