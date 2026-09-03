import { useFonts } from 'expo-font';
import { useEffect, useMemo, type ReactNode } from 'react';

import { useWeatherBootstrap } from '@/lib/conditions';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';

import { Registro } from '@/components/registro';
import { useBoldText } from '@/lib/a11y';
import { useAccount } from '@/lib/account';
import { FONT_MAP, setBoldText } from '@/lib/fonts';
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
  /*
   * La raíz de los gestos envuelve a todo.
   *
   * Sin ella, un gesto de Gesture Handler no llega a ninguna parte —y no falla:
   * simplemente no pasa nada, que es la clase de error que cuesta media hora
   * encontrar—. Va por fuera del área segura porque los gestos empiezan en el
   * borde de la pantalla, que es justo lo que el área segura recorta.
   */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ZonaSeguraSimulada>
          <RootStack />
        </ZonaSeguraSimulada>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const theme = useTheme();
  const [fontsLoaded] = useFonts(FONT_MAP);
  /* La consulta del tiempo arranca aquí, una vez, y no en cada pantalla que la
     necesita: son seis, y seis consultas al abrir la aplicación es exactamente
     lo que la caché existe para evitar. */
  useWeatherBootstrap();
  const { registered } = useAccount();
  usePageGround(theme.colors.background);
  useSystemBoldText();

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

  /*
   * La puerta, y por qué está aquí y no en una ruta.
   *
   * Sin animal dado de alta no se dibuja la aplicación: se dibuja el alta **en
   * su lugar**. Una pantalla de registro que fuera una ruta más se saltaría
   * escribiendo cualquier otra dirección, y entonces no sería una puerta sino
   * un cartel. Aquí no hay nada detrás que alcanzar.
   */
  if (!registered) {
    return (
      <>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <Registro />
      </>
    );
  }

  return (
    <>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* A pantalla completa y por encima de todo. `fullScreenModal` en iOS
            quita el gesto de arrastrar hacia abajo, que en un visor de estados
            choca con el de mantener pulsado para pausar. */}
        <Stack.Screen
          name="estados"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        <Stack.Screen
          name="reels"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
        {/* La conversación empuja desde la derecha, como una pantalla de detalle
            cualquiera: el gesto de volver hacia atrás tiene que seguir ahí. */}
        <Stack.Screen name="chat" options={{ animation: 'slide_from_right' }} />
        {/* El resumen de un paseo y el historial. Empujan desde la derecha por
            lo mismo que el chat: son pantallas de detalle en las que se entra y
            de las que se sale, y la barra de cinco pestañas debajo ofrecería
            cuatro salidas donde solo hace falta una. */}
        <Stack.Screen name="paseo" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="historial" options={{ animation: 'slide_from_right' }} />
        {/* El panel del refugio, por lo mismo: es la lista de trabajo de una
            protectora, se entra desde su tablero y se sale por donde se vino. */}
        <Stack.Screen name="refugio" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

/**
 * El fondo de la **página**, no el de la aplicación.
 *
 * En web hay un color por debajo de todo lo que pinta React Native: el del
 * documento. Asoma por las zonas seguras, por el rebote del scroll y —lo que
 * más se nota— durante el instante en que la aplicación arranca. Estaba escrito
 * a mano en el empaquetado y se quedó con la paleta antigua, así que al cambiar
 * de dirección visual seguía viéndose el crema de antes por los bordes: la
 * aplicación entera repintada y un marco delatando la versión anterior.
 *
 * Aquí se ata al token, así que cambia con la dirección como todo lo demás. En
 * nativo no existe el documento y el efecto no hace nada; se comprueba con
 * `Platform.OS` y no con un `try`, porque un fallo silencioso escondería
 * cualquier otro error de dentro.
 */
function usePageGround(color: string): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const root = document.documentElement;
    const { body } = document;
    root.style.backgroundColor = color;
    body.style.backgroundColor = color;
  }, [color]);
}

/**
 * «Texto en negrita» del sistema, aplicado a una tipografía que no lo trae.
 *
 * Las tipografías del sistema engordan solas con ese ajuste. Las que se cargan
 * por fichero —las tres direcciones de esta aplicación— se quedan en el peso
 * que pidió el programador, y la preferencia no hace absolutamente nada. La
 * guía pide que una tipografía propia implemente los mismos comportamientos,
 * así que aquí el cuerpo pasa a su variante negrita.
 *
 * El valor se deja en una variable de módulo de `lib/fonts` en vez de en el
 * tema porque `fonts.body` lo lee cualquier hoja de estilos de la aplicación,
 * no solo un componente. El repintado lo provoca este mismo `useState`: cuando
 * cambia, todo se vuelve a renderizar y para entonces `fonts.body` ya devuelve
 * la negrita.
 */
function useSystemBoldText(): void {
  const bold = useBoldText();
  setBoldText(bold);
}

/**
 * Una muesca de mentira, para poder mirar lo que en un navegador no existe.
 *
 * Las zonas seguras son la parte de la adaptación al teléfono que **no se puede
 * comprobar desde aquí**: un navegador de escritorio no tiene isla dinámica ni
 * indicador de inicio, así que `env(safe-area-inset-*)` vale cero y la
 * aplicación se ve igual con el marco bien puesto que con el marco olvidado.
 * Que se vea igual es justamente lo que hizo que el fallo durara semanas.
 *
 * Con `?zonasegura=59` en la dirección, esto fuerza los márgenes de un iPhone
 * con isla dinámica —59 arriba, 34 abajo— y entonces sí se ve, y se puede
 * medir: la auditoría abre la página dos veces y compara dónde empieza la
 * cabecera.
 *
 * Sale de en medio en cuanto no se pide, y **solo existe en web**. En el
 * teléfono los márgenes de verdad los da el sistema y esto no se monta.
 */
function ZonaSeguraSimulada({ children }: { children: ReactNode }) {
  const forced = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    const raw = new URLSearchParams(window.location.search).get('zonasegura');
    if (raw === null) return null;
    const top = Number(raw);
    if (!Number.isFinite(top) || top < 0) return null;
    /* Los de un iPhone con isla dinámica, que es el caso peor y el más común:
       arriba lo que se pida, abajo el indicador de inicio. */
    return { top, bottom: 34, left: 0, right: 0 };
  }, []);

  if (!forced) return <>{children}</>;
  return <SafeAreaInsetsContext.Provider value={forced}>{children}</SafeAreaInsetsContext.Provider>;
}
