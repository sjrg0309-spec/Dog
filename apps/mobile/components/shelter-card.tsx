/**
 * El perfil de una cuenta de protectora.
 *
 * Una cuenta que entró por la segunda puerta no tiene animal propio, así que el
 * perfil de perro —fotos, ficha médica, Modo Paseo— no le corresponde. Lo que
 * le corresponde es saber **en qué estado está su cuenta y qué le abre**, que
 * es la única pregunta que tiene mientras espera.
 *
 * Se dice entero, lo que abre y lo que no, porque lo que no abre es la parte
 * que puede sentar mal: una protectora aprobada no ve quién pasea ahora ni los
 * horarios de nadie. Explicarlo aquí, y no cuando se choque con la puerta,
 * es la diferencia entre una regla y un desaire.
 */

import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { SHELTER_ACTIVITIES, SHELTER_REVIEW_NOTE, SHELTER_SCOPE_NOTE } from '@petnav/core';

import { Icon } from './icon';
import { Badge, Body, Caption, Card, Notice, Row, Screen } from '@/components/ui';
import { LargeTitle, NavBar, useScrolled } from '@/components/chrome';
import { useAccount } from '@/lib/account';
import { useWeatherState } from '@/lib/conditions';
import { useAllAlerts, useSavedAlerts } from '@/lib/safety';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { ProfileMenu } from './profile-menu';
import { BadgeCheck, Bookmark, Clock, Footprints, Lock, Menu, Siren } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

export function ShelterCard() {
  const theme = useTheme();
  const { scrolled, onScroll } = useScrolled();
  const account = useAccount();
  const [menu, setMenu] = useState(false);
  const approved = account.shelterReviewed;
  const { location } = useWeatherState();
  const saved = useSavedAlerts(location);
  /* En cuántas búsquedas está metida esta cuenta ahora mismo. Sale de la misma
     lista que ve el otro lado del aviso: si aquí dijera un número y en la
     alerta otro, uno de los dos estaría inventado. */
  const searching = useAllAlerts(location).filter((live) => live.alert.searchers.includes('me'));

  const activities = SHELTER_ACTIVITIES.filter((activity) =>
    account.shelterActivities.includes(activity.id),
  );

  return (
    <Screen>
      <NavBar
        title={account.shelterName ?? 'Protectora'}
        scrolled={scrolled}
        showTitle={scrolled}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Menú del perfil"
            accessibilityHint="Configuración y actividad"
            onPress={() => {
              haptics.tap();
              setMenu(true);
            }}
            style={({ pressed }) => ({
              width: theme.touchTarget.min,
              height: theme.touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon icon={Menu} size="lg" decorative />
          </Pressable>
        }
      />

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ padding: theme.space[5], gap: theme.space[5] }}
      >
        <LargeTitle subtitle="Cuenta de rescate">{account.shelterName ?? 'Protectora'}</LargeTitle>

        <Card>
          <Row>
            <Icon
              icon={approved ? BadgeCheck : Clock}
              size="lg"
              color={approved ? theme.colors.success : theme.colors.warning}
              decorative
            />
            <View style={{ flex: 1 }}>
              <Body>{approved ? 'Cuenta aprobada' : 'Pendiente de revisión'}</Body>
              <Caption>
                {approved
                  ? 'Ya hemos revisado vuestro perfil.'
                  : 'Estamos revisando vuestro perfil.'}
              </Caption>
            </View>
            <Badge tone={approved ? 'verified' : 'warning'}>
              {approved ? 'Aprobada' : 'En revisión'}
            </Badge>
          </Row>

          {account.shelterProfile ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Abrir ${account.shelterProfile}`}
              onPress={() => {
                haptics.tap();
                void Linking.openURL(account.shelterProfile!);
              }}
              style={({ pressed }) => ({
                minHeight: theme.touchTarget.min,
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: theme.colors.primary,
                  fontFamily: fonts.body,
                  fontSize: theme.fontSize.sm,
                }}
              >
                {account.shelterProfile}
              </Text>
            </Pressable>
          ) : null}

          <Caption>{SHELTER_REVIEW_NOTE}</Caption>
        </Card>

        {activities.length > 0 ? (
          <Card>
            <Row gap={2}>
              <Icon icon={Siren} size="base" color={theme.colors.foreground} decorative />
              <Body>Qué hacéis</Body>
            </Row>
            {activities.map((activity) => (
              <Caption key={activity.id}>· {activity.label}</Caption>
            ))}
          </Card>
        ) : null}

        {/*
          Lo que esta cuenta está haciendo, y no lo que es.

          Un perfil de protectora sin esto era una tarjeta de estado: aprobada o
          en revisión, y ya. Lo que de verdad se pregunta quien abre su propio
          perfil a las tres de la mañana es «¿a qué me he apuntado?», y eso son
          las búsquedas en las que está y los avisos que apartó para volver.
        */}
        <Card>
          <Row gap={2}>
            <Icon icon={Footprints} size="base" color={theme.colors.primary} decorative />
            <Body>
              {searching.length === 0
                ? 'No estáis en ninguna búsqueda'
                : searching.length === 1
                  ? 'Estáis en 1 búsqueda'
                  : `Estáis en ${searching.length} búsquedas`}
            </Body>
          </Row>
          {searching.map((live) => (
            <Caption key={live.alert.id}>
              · {live.alert.petName ?? live.scenario.label} — {live.alert.areaName}
            </Caption>
          ))}
          <Row gap={2}>
            <Icon icon={Bookmark} size="base" color={theme.colors.mutedForeground} decorative />
            <Caption>
              {saved.length === 0
                ? 'Sin avisos guardados'
                : saved.length === 1
                  ? '1 aviso guardado'
                  : `${saved.length} avisos guardados`}
            </Caption>
          </Row>
        </Card>

        <Notice>
          <Row gap={2}>
            <Icon icon={Lock} size="base" color={theme.colors.mutedForeground} decorative />
            <Body>Qué podéis ver</Body>
          </Row>
          <Caption>{SHELTER_SCOPE_NOTE}</Caption>
        </Notice>

        {/* El límite de esta versión, dicho donde se nota. Sin esto, la
            demostración parecería decir que una cuenta de protectora tiene
            perros propios, que es justo lo contrario de lo que define esta
            puerta. */}
        <Caption>
          En esta demo la cuenta conserva las mascotas de la semilla para que el mapa y las
          quedadas tengan contenido, pero ya no las lleva puestas: ni la cara de la barra ni el
          color de la aplicación salen de un perro que no es vuestro. Una cuenta de protectora real
          no tiene mascotas propias.
        </Caption>
      </ScrollView>

      {menu ? <ProfileMenu onClose={() => setMenu(false)} /> : null}
    </Screen>
  );
}
