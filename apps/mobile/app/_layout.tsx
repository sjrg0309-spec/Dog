import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FONT_MAP, fonts } from '@/lib/fonts';
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
  const theme = useTheme();
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
    <SafeAreaProvider>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTitleStyle: {
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
          },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.mutedForeground,
          tabBarLabelStyle: { fontFamily: fonts.body },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Descubrir',
            tabBarIcon: ({ color }) => <TabIcon glyph="◎" color={color} />,
          }}
        />
        <Tabs.Screen
          name="radar"
          options={{
            title: 'Radar',
            tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} />,
          }}
        />
        <Tabs.Screen
          name="quedadas"
          options={{
            title: 'Quedadas',
            tabBarIcon: ({ color }) => <TabIcon glyph="◇" color={color} />,
          }}
        />
        <Tabs.Screen
          name="espacios"
          options={{
            title: 'Espacios',
            tabBarIcon: ({ color }) => <TabIcon glyph="⬡" color={color} />,
          }}
        />
        <Tabs.Screen
          name="comunidad"
          options={{
            title: 'Comunidad',
            tabBarIcon: ({ color }) => <TabIcon glyph="◈" color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaProvider>
  );
}

/**
 * Iconos de pestaña.
 *
 * Van marcados como decorativos porque la etiqueta de texto de la pestaña ya
 * aporta el nombre: anunciarlos duplicaría la lectura del lector de pantalla.
 */
function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return (
    <Text accessibilityElementsHidden importantForAccessibility="no" style={{ color, fontSize: 20 }}>
      {glyph}
    </Text>
  );
}
