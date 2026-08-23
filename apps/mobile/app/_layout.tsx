import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FONT_MAP, fonts } from '@/lib/fonts';
import { CalendarDays, Compass, Fence, Radar, Users, type LucideIcon } from '@/lib/icons';
import { useTheme } from '@/lib/theme';

/**
 * Navegación principal.
 *
 * Cinco pestañas y ninguna más. La primera es el descubrimiento, que es lo que
 * hace que la aplicación sirva de algo cuando el radar está vacío —es decir, la
 * mayor parte del tiempo al empezar en un barrio.
 *
 * La quinta, comunidad, es la que da sentido a la aplicación para la mitad del
 * catálogo de especies: un gato, un gecko o un betta no van a conocer a nadie,
 * pero sus tutores sí se buscan entre ellos y todos necesitan saber qué
 * veterinario está de guardia el domingo.
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
            title: 'Descubrir',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={Compass} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="radar"
          options={{
            title: 'Radar',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={Radar} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="quedadas"
          options={{
            title: 'Quedadas',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={CalendarDays} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="espacios"
          options={{
            title: 'Espacios',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={Fence} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="comunidad"
          options={{
            title: 'Comunidad',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon icon={Users} color={color} focused={focused} />
            ),
          }}
        />
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
function TabIcon({
  icon,
  color,
  focused,
}: {
  icon: LucideIcon;
  color: string;
  focused: boolean;
}) {
  // La pestaña activa no se distingue solo por el color: también engorda el
  // trazo. Quien no separe el verde del gris tiene que poder verlo igualmente,
  // y el rótulo de texto sigue debajo de todas formas.
  return <Icon icon={icon} size="lg" color={color} strokeWidth={focused ? 2.5 : 1.75} decorative />;
}
