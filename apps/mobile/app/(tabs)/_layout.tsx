import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { useDeclaredConditions } from '@/lib/conditions';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Map,
  Megaphone,
  MessageCircleMore,
  PawPrint,
  UserRound,
  type LucideIcon,
} from '@/lib/icons';
import { useCriticalCount } from '@/lib/safety';
import { useTheme } from '@/lib/theme';

/**
 * Navegación principal.
 *
 * Cinco destinos, y la lista sale de la especificación visual: feed, explorar y
 * mapa, SOS, mensajes y grupos, perfil.
 *
 * Lo que **no** está en la barra dice tanto como lo que está. El radar, las
 * quedadas, los espacios y publicar siguen existiendo con sus pantallas
 * enteras, pero se entra a ellos desde donde tienen sentido: el radar y las
 * quedadas desde el mapa, publicar desde el feed. Son acciones y momentos, no
 * sitios a los que uno «va». Meterlos en la barra costaba nueve pestañas y
 * rótulos partidos.
 *
 * SOS va en el centro por la misma razón por la que un extintor va a la altura
 * de la mano: cuando hace falta, hace falta ya, y nadie va a buscarlo en un
 * menú.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { location } = useDeclaredConditions();
  const criticalNearby = useCriticalCount(location);

  return (
    <Tabs
      // Un toque seco al cambiar de pestaña. Es el gesto más repetido de la
      // aplicación y el único sitio donde la háptica es constante.
      screenListeners={{ tabPress: () => haptics.tap() }}
      screenOptions={{
        // Cada pantalla dibuja su propia barra de navegación, con título
        // grande y separación que solo aparece al desplazar. La cabecera del
        // navegador sobraba: eran dos barras encima de la misma pantalla.
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          // 64 y no 58: con el icono activo a 23 y el rótulo a 11, la altura
          // anterior recortaba la última línea de texto. Se vio en la captura,
          // no en el tipado.
          height: 64 + insets.bottom,
          paddingTop: theme.space[1],
          paddingBottom: insets.bottom > 0 ? insets.bottom : theme.space[2],
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={PawPrint} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explorar"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={Map} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="sos"
        options={{
          title: 'SOS',
          /**
           * La única pestaña que cambia de color sola.
           *
           * Con una alerta crítica abierta cerca se pinta en rojo esté o no
           * seleccionada, y lleva el número al lado. El color no va solo: la
           * cuenta se anuncia en la etiqueta accesible, porque quien no
           * distinga el rojo tiene que enterarse igual.
           */
          tabBarBadge: criticalNearby > 0 ? criticalNearby : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.colors.destructive,
            color: theme.colors.destructiveForeground,
            fontFamily: fonts.bodyBold,
            fontSize: 11,
          },
          tabBarAccessibilityLabel:
            criticalNearby > 0
              ? `SOS. ${criticalNearby} ${criticalNearby === 1 ? 'alerta crítica abierta cerca' : 'alertas críticas abiertas cerca'}`
              : 'SOS. Sin alertas abiertas cerca',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={Megaphone}
              color={criticalNearby > 0 ? theme.colors.destructive : color}
              // La pastilla significa «estás aquí» y solo eso. Con una alerta
              // abierta se pintaba también en SOS sin estar seleccionado, así
              // que dos pestañas parecían la actual a la vez. Lo que avisa de
              // la alerta es el color y el globo con el número, no la
              // pastilla.
              focused={focused}
              alert={criticalNearby > 0}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mensajes"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={MessageCircleMore} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={UserRound} color={color} focused={focused} />
          ),
        }}
      />

      {/* Pantallas enteras a las que se entra desde donde tienen sentido, no
            desde una barra con nueve pestañas. */}
      <Tabs.Screen name="radar" options={{ href: null }} />
      <Tabs.Screen name="quedadas" options={{ href: null }} />
      <Tabs.Screen name="espacios" options={{ href: null }} />
      <Tabs.Screen name="comunidad" options={{ href: null }} />
      <Tabs.Screen name="publicar" options={{ href: null }} />
      <Tabs.Screen name="citas" options={{ href: null }} />
      <Tabs.Screen name="descubrir" options={{ href: null }} />
      <Tabs.Screen name="actividad" options={{ href: null }} />
    </Tabs>
  );
}

/**
 * Iconos de pestaña.
 *
 * Van marcados como decorativos porque la etiqueta de texto de la pestaña ya
 * aporta el nombre: anunciarlos duplicaría la lectura del lector de pantalla.
 */
function TabIcon({
  icon,
  color,
  focused,
  alert = false,
}: {
  icon: LucideIcon;
  color: string;
  focused: boolean;
  /** Hay algo abierto que reclama atención, pero esta no es la pestaña actual. */
  alert?: boolean;
}) {
  const theme = useTheme();

  /**
   * La pestaña activa lleva una pastilla detrás, no el icono relleno.
   *
   * Instagram rellena el icono, y es lo primero que probé. No funciona con esta
   * librería: Lucide son trazos, no siluetas, así que rellenar el globo de
   * mensajes lo convertía en un borrón sin los puntos de dentro. Se veía en la
   * captura y no en el tipado.
   *
   * La pastilla hace el mismo trabajo y mejor: es una forma sólida, así que
   * sobrevive a una captura en blanco y negro y a cualquier deficiencia de
   * visión del color, que es lo que el cambio de tinte no hace. Y el rótulo de
   * texto sigue debajo de todas formas.
   */
  return (
    <View
      style={{
        minWidth: 52,
        height: 30,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? theme.colors.accent : 'transparent',
      }}
    >
      <Icon
        icon={icon}
        size="lg"
        color={color}
        strokeWidth={focused || alert ? 2.4 : 1.75}
        decorative
      />
    </View>
  );
}
