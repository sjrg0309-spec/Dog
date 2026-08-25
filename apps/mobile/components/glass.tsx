/**
 * Superficies de cristal: desenfoque de lo que hay debajo.
 *
 * ## Dónde sí y dónde no
 *
 * El cristal solo tiene sentido **encima de contenido**: una capa que desenfoca
 * el vacío es una capa gris cara. Por eso está en las tres superficies que
 * flotan —el aviso corto, el fondo del menú y la cabecera del visor— y no en
 * las barras de las pantallas, que están en el mismo plano que su contenido y
 * ahí el desenfoque no desenfocaría nada.
 *
 * ## El tinte no es decoración, es el contraste
 *
 * Un desenfoque puro deja el texto a merced de lo que pase por debajo: encima
 * de una foto clara, el mismo rótulo que se leía deja de leerse, y no hay
 * ningún token que lo salve porque el fondo ya no es un color, es una foto.
 *
 * Así que el cristal de esta aplicación es **desenfoque más un tinte opaco al
 * 88 %** del color de superficie que corresponda. Eso deja pasar la forma y el
 * color de lo de abajo —que es todo lo que aporta el efecto— y mantiene el
 * contraste del texto dentro de lo que miden los tests de la paleta, que es lo
 * que un `rgba` a ojo no puede prometer.
 *
 * La intensidad del desenfoque cambia con el tema: sobre fondo oscuro hace
 * falta más, porque las luces de debajo se cuelan más.
 */

import { BlurView } from 'expo-blur';
import { type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

import { useReduceTransparency } from '@/lib/a11y';
import { withAlpha } from '@/lib/color';
import { useTheme } from '@/lib/theme';

/** Con cuánta opacidad se tapa lo de debajo. Menos que esto y el texto sufre. */
const TINT_ALPHA = 0.88;

export function Glass({
  children,
  style,
  /**
   * `surface` para paneles, `ink` para píldoras oscuras sobre contenido, y
   * `scrim` para el fondo de una hoja.
   *
   * `scrim` no lleva tinte, y esa es toda su razón de ser: encima ya va el velo
   * oscuro del propio menú, así que sumarle el 88 % del cristal dejaba un
   * rectángulo casi opaco donde no se distinguía nada de lo de detrás — que es
   * exactamente lo contrario de para lo que se pone un desenfoque. Se vio en
   * una captura, no en el tipado.
   */
  tone = 'surface',
}: {
  children: ReactNode;
  style?: ViewStyle;
  tone?: 'surface' | 'ink' | 'scrim';
}) {
  const theme = useTheme();
  const base = tone === 'ink' ? theme.colors.foreground : theme.colors.surface;
  const tint = tone === 'scrim' ? 'transparent' : withAlpha(base, TINT_ALPHA);

  /*
   * Con «reducir transparencia» puesta, esto deja de ser cristal.
   *
   * No es un capricho de contraste: quien activa esa preferencia lo hace porque
   * el contenido moviéndose por debajo de un panel translúcido le dificulta
   * leer o le marea. Una barra de pestañas de cristal es exactamente el caso.
   * Se devuelve una superficie **opaca** —no un desenfoque más fuerte—, porque
   * lo que sobra es la transparencia, no la nitidez.
   *
   * El velo de una hoja se queda como está: ahí lo translúcido es el fondo
   * oscurecido, y taparlo del todo escondería la pantalla de debajo en vez de
   * aclararla.
   */
  const opaque = useReduceTransparency();
  if (opaque && tone !== 'scrim') {
    return (
      <View
        style={[
          { backgroundColor: tone === 'ink' ? theme.colors.foreground : theme.colors.surface },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  /*
   * En web el desenfoque lo hace el navegador con `backdrop-filter`, que Safari
   * y Chrome tienen desde hace años pero Firefox tuvo detrás de una bandera
   * hasta hace poco. Si no está, lo que queda es el tinte al 88 %, que sigue
   * siendo una superficie legible: **el efecto se degrada, la lectura no**. Ese
   * es el orden correcto de prioridades y por eso el tinte va siempre y el
   * desenfoque encima.
   */
  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          {
            backgroundColor: tint,
            /* `backdropFilter` no está en los tipos de React Native pero sí
               llega al DOM en react-native-web, que es donde vive esta rama. */
            backdropFilter: `blur(${theme.isDark ? 24 : 18}px) saturate(140%)`,
          } as ViewStyle,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={theme.isDark ? 60 : 40}
      tint={theme.isDark ? 'dark' : 'light'}
      style={[{ backgroundColor: tint }, style]}
    >
      {children}
    </BlurView>
  );
}
