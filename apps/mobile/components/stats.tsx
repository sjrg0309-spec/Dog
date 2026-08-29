/**
 * Una tira de cifras.
 *
 * Existe porque el historial de paseos ya tenía una y el panel del refugio
 * necesitaba otra igual, y dos tiras de cifras escritas por separado se
 * desincronizan en la segunda pasada: una alinea a la izquierda y la otra
 * centra, una pone el rótulo debajo y la otra al lado.
 *
 * Dos decisiones que vienen de la que ya existía y se conservan:
 *
 *  - **Un reparto fijo, no anchos libres.** Con anchos libres, «7 h 40 min»
 *    empuja la cuarta cifra a una segunda fila ella sola, y una cifra huérfana
 *    debajo de tres se lee como si fuera de otra cosa. Se vio en una captura.
 *    En un teléfono el reparto es de dos; con sitio de sobra quien llama puede
 *    pedir tres o cuatro, siempre que las cifras llenen las filas.
 *  - **Cifras tabulares.** Los números de una columna tienen que caer unos
 *    debajo de otros; con las cifras proporcionales de la fuente, un 1 estrecha
 *    su columna y la lista parece torcida.
 *
 * `tone` es para la cifra que pide trabajo —lo que falta, lo que está
 * vencido—: se pinta en el color de aviso y **además** lleva su rótulo, porque
 * un número naranja sin palabra no dice qué le pasa.
 */

import { Text, View } from 'react-native';

import { fonts } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';

export type Stat = {
  value: string;
  label: string;
  tone?: 'default' | 'alert';
};

export function StatStrip({
  stats,
  columns = 2,
}: {
  stats: readonly Stat[];
  /* Hasta cuatro, y quien llama es responsable de que el reparto no deje una
     cifra sola en la última fila: una cifra huérfana debajo de tres se lee como
     si fuera de otra cosa. Cuatro columnas solo tienen sentido con sitio de
     sobra —una tableta, la web—, nunca en un teléfono. */
  columns?: 2 | 3 | 4;
}) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.space[4] }}>
      {stats.map((stat) => (
        <View key={stat.label} style={{ width: `${100 / columns}%` }}>
          <Text
            style={{
              color: stat.tone === 'alert' ? theme.colors.warning : theme.colors.foreground,
              fontFamily: fonts.displayBold,
              fontSize: theme.fontSize['2xl'],
              fontVariant: ['tabular-nums'],
            }}
          >
            {stat.value}
          </Text>
          <Text
            style={{
              color: theme.colors.mutedForeground,
              fontFamily: fonts.body,
              fontSize: theme.fontSize['2xs'],
            }}
          >
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
