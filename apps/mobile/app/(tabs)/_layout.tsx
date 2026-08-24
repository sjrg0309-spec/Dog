import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { useWeatherState } from '@/lib/conditions';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  Map,
  Megaphone,
  MessageCircleMore,
  PawPrint,
  type LucideIcon,
  Siren,
} from '@/lib/icons';
import { useCriticalCount } from '@/lib/safety';
import { Avatar } from '@/components/avatar';
import { useActivePet } from '@/lib/active-pet';
import { useAccount } from '@/lib/account';
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
  const rescuer = useAccount().kind === 'rescuer';
  const { location } = useWeatherState();
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
          /* 72 y no 64. Antes fue 64 y no 58, por lo mismo: la barra reserva
             un alto fijo para el icono, así que cada píxel que el retrato del
             centro sobresale sale del sitio del rótulo. Encogerlo hasta que
             cupiera fue el primer intento y el círculo dejaba de destacar,
             que era justo lo que se pedía; darle sitio a la barra deja las dos
             cosas. Tres pasadas de captura para llegar aquí. */
          height: 72 + insets.bottom,
          paddingTop: theme.space[1],
          paddingBottom: insets.bottom > 0 ? insets.bottom : theme.space[2],
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: theme.fontSize['2xs'] },
      }}
    >
      {/*
        La primera pestaña cambia de nombre y de icono con el tipo de cuenta.

        No es cosmética: detrás hay otra pantalla. Una protectora no tiene feed
        social —entra a ver qué animal necesita ayuda— y llamarlo «Feed» sería
        prometerle fotos del perro de alguien.
      */}
      <Tabs.Screen
        name="index"
        options={{
          title: rescuer ? 'Rescate' : 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon icon={rescuer ? Siren : PawPrint} color={color} focused={focused} />
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
      {/*
       * El perfil, en el centro y destacado.
       *
       * Es la posición que mejor alcanza el pulgar de las cinco, y aquí lleva
       * **la cara del animal** en vez de la silueta genérica de una persona:
       * esta aplicación va de un perro concreto, y el conmutador de mascota
       * vive dentro. Un icono de usuario decía «ajustes de cuenta»; el retrato
       * dice de quién es la pantalla, y encima cambia al cambiar de mascota.
       *
       * **Lo que esto cuesta, dicho una vez:** SOS deja el centro y se va al
       * extremo. Sigue con su rojo y su contador —y sigue habiendo un botón de
       * peligro en el mapa y la franja de alerta en el feed—, pero la posición
       * más fácil de acertar andando ya no es la de la emergencia.
       */}
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <ProfileTab focused={focused} />,
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
            fontSize: theme.fontSize['2xs'],
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

      {/* Pantallas enteras a las que se entra desde donde tienen sentido, no
            desde una barra con nueve pestañas. */}
      <Tabs.Screen name="radar" options={{ href: null }} />
      <Tabs.Screen name="encuentros" options={{ href: null }} />
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
/**
 * La pestaña del centro: el retrato, levantado sobre la barra.
 *
 * Sobresale del cromo a propósito —es lo que lo convierte en el ancla de la
 * barra y no en una quinta pestaña más—, y lleva el anillo del acento del
 * animal activo, así que la pieza más visible de la aplicación es también la
 * que dice de quién va.
 *
 * El desplazamiento hacia arriba se hace con `marginTop` negativo y no con
 * `transform`: la barra recorta lo que se sale por arriba en Android, y con la
 * transformación el círculo aparecía cortado por la mitad en un teléfono y
 * entero en el otro.
 */
function ProfileTab({ focused }: { focused: boolean }) {
  const theme = useTheme();
  const pet = useActivePet();
  const rescuer = useAccount().kind === 'rescuer';
  const size = 48;

  /*
   * El círculo **sobresale sin ocupar sitio**, y llegar aquí costó tres
   * pasadas de captura.
   *
   * Los dos intentos anteriores movían el propio icono —un contenedor grande,
   * o un margen negativo— y los dos rompían lo mismo: la barra reparte una
   * altura fija entre icono y rótulo, así que cada píxel que el retrato crecía
   * se lo quitaba a la palabra «Perfil», que acababa cortada por su propio
   * botón. Subir el alto de la barra tampoco valía: el hueco del icono crece
   * con ella y el círculo baja otra vez.
   *
   * Lo que funciona es dejar el hueco **del tamaño de un icono normal** y
   * colocar el círculo encima en posición absoluta. El texto se coloca donde
   * se coloca en las otras cuatro pestañas, y el retrato flota por encima de
   * la barra, que es exactamente lo que se pedía.
   */
  return (
    <View style={{ width: size, height: 26, alignItems: 'center' }}>
      <View
        style={{
          position: 'absolute',
          /* −22 y no un número a ojo: el hueco mide 26 y el círculo 48, así que
             para que su borde de abajo caiga exactamente en el borde del hueco
             el desplazamiento es 26 − 48. Con −16 sobraban seis píxeles que
             caían encima de la primera línea del rótulo, y ese es el aspecto
             que tiene un botón tapando su propio nombre. */
          top: -22,
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
          borderWidth: focused ? 2.5 : 1,
          borderColor: focused ? theme.colors.primary : theme.colors.border,
        }}
      >
        {/*
          Una cuenta de rescate no tiene animal, así que no lleva su cara.

          Llevaba la de un perro de la semilla, que en la demostración es el
          contenido que hay, y el resultado era que el elemento más visible de
          la aplicación decía que esa cuenta tiene un perro que no es suyo. La
          sirena dice lo que esa cuenta es.
        */}
        {rescuer ? (
          <Icon icon={Siren} size="lg" color={theme.colors.primary} decorative />
        ) : (
          <Avatar id={pet.id} name={pet.name} size={size - 10} />
        )}
      </View>
    </View>
  );
}

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
