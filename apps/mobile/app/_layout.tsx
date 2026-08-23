import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FONT_MAP } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

/**
 * La pila de la aplicación.
 *
 * Encima de las pestañas hay dos pantallas que **no llevan barra de pestañas**,
 * y no es una preferencia estética: el visor de estados y el reproductor de
 * reels ocupan la pantalla entera y se cierran con un gesto, como en cualquier
 * aplicación que los tenga. Una barra de cinco iconos debajo de un vídeo
 * vertical se come el pie del vídeo y ofrece salidas donde lo que hace falta es
 * una: cerrar.
 *
 * Por eso las pestañas viven en un grupo `(tabs)`: el grupo no aparece en la
 * ruta —`/perfil` sigue siendo `/perfil`— y deja sitio para que estas dos se
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
      </Stack>
    </>
  );
}
