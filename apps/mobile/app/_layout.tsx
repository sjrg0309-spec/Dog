import { useFonts } from 'expo-font';

import { useWeatherBootstrap } from '@/lib/conditions';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FONT_MAP } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

/**
 * La pila de la aplicación.
 *
 * Encima de las pestañas hay tres pantallas que **no llevan barra de pestañas**,
 * y no es una preferencia estética: el visor de estados y el reproductor de
 * reels ocupan la pantalla entera y se cierran con un gesto, como en cualquier
 * aplicación que los tenga. Una barra de cinco iconos debajo de un vídeo
 * vertical se come el pie del vídeo y ofrece salidas donde lo que hace falta es
 * una: cerrar.
 *
 * La tercera es la **conversación**, y llega por el mismo razonamiento: ni
 * WhatsApp ni los directos de Instagram dejan la barra puesta al abrir un chat.
 * Un chat es una pantalla en la que se entra y de la que se sale, no un sitio en
 * el que se está, y esos sesenta y cuatro píxeles debajo del compositor son del
 * teclado. Se distingue de las otras dos en cómo entra: empuja desde la derecha
 * y se vuelve con el gesto de siempre, en vez de aparecer por encima.
 *
 * Por eso las pestañas viven en un grupo `(tabs)`: el grupo no aparece en la
 * ruta —`/perfil` sigue siendo `/perfil`— y deja sitio para que estas tres se
 * presenten por encima.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootStack />
    </SafeAreaProvider>
  );
}

function RootStack() {
  const theme = useTheme();
  const [fontsLoaded] = useFonts(FONT_MAP);
  /* La consulta del tiempo arranca aquí, una vez, y no en cada pantalla que la
     necesita: son seis, y seis consultas al abrir la aplicación es exactamente
     lo que la caché existe para evitar. */
  useWeatherBootstrap();

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
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="(tabs)" />
        {/* A pantalla completa y por encima de todo. `fullScreenModal` en iOS
            quita el gesto de arrastrar hacia abajo, que en un visor de estados
            choca con el de mantener pulsado para pausar. */}
        <Stack.Screen name="estados" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="reels" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        {/* La conversación empuja desde la derecha, como una pantalla de detalle
            cualquiera: el gesto de volver hacia atrás tiene que seguir ahí. */}
        <Stack.Screen name="chat" options={{ animation: 'slide_from_right' }} />
        {/* El resumen de un paseo y el historial. Empujan desde la derecha por
            lo mismo que el chat: son pantallas de detalle en las que se entra y
            de las que se sale, y la barra de cinco pestañas debajo ofrecería
            cuatro salidas donde solo hace falta una. */}
        <Stack.Screen name="paseo" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="historial" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}
