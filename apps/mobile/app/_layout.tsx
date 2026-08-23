import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { useDeclaredConditions } from '@/lib/conditions';
import { FONT_MAP, fonts } from '@/lib/fonts';
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
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootTabs />
    </SafeAreaProvider>
  );
}

function RootTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts(FONT_MAP);
  const { location } = useDeclaredConditions();
  const criticalNearby = useCriticalCount(location);

  // Se espera a las fuentes antes de pintar. Sin esto, la primera pasada sale
  // con la fuente del sistema y salta a la definitiva, y el salto de métricas se
  // ve como un fallo.
  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
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
                focused={focused || criticalNearby > 0}
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
      </Tabs>
    </>
  );
}

/**
 * Iconos de pestaña.
 *
 * Van marcados como decorativos porque la etiqueta de texto de la pestaña ya
 * aporta el nombre: anunciarlos duplicaría la lectura del lector de pantalla.
 */
function TabIcon({ icon, color, focused }: { icon: LucideIcon; color: string; focused: boolean }) {
  // La pestaña activa no se distingue solo por el color: también engorda el
  // trazo. Quien no separe la salvia del gris tiene que poder verlo igualmente,
  // y el rótulo de texto sigue debajo de todas formas.
  return <Icon icon={icon} size="lg" color={color} strokeWidth={focused ? 2.5 : 1.75} decorative />;
}
