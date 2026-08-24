/**
 * Puente entre los tokens y React Native.
 *
 * Los componentes de interfaz no se comparten entre la web y el móvil —Tailwind
 * y shadcn/ui no corren en React Native, y prometer lo contrario sería falso—,
 * pero los **valores** sí. Este módulo traduce los mismos tokens a lo que
 * entiende React Native: hexadecimales en lugar de OKLCH y números en lugar de
 * cadenas con `px`.
 */

import { useColorScheme } from 'react-native';

import { type SemanticTokens } from '@petnav/tokens';

import { DIRECTIONS, useDirection, type Direction, type RadiusScale } from './direcciones';
import { useSettings } from './settings';

/**
 * Espaciado en números.
 *
 * React Native no acepta `'16px'`, solo `16`. Se replican los mismos pasos que
 * el token en lugar de inventar otra escala.
 */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

/*
 * Los radios ya no viven aquí: los pone la dirección visual.
 *
 * Era una escala sola porque había una sola forma. Con tres direcciones la
 * forma es parte de la identidad —«Papel» es de imprenta y su filete es recto;
 * «Señal» es blanda porque se pulsa con guante— y una escala compartida las
 * habría aplanado a las tres. Ver `lib/direcciones`.
 */

/**
 * Tamaños de texto.
 *
 * Aquí no hay `clamp()`: en móvil el ancho no varía lo suficiente como para que
 * un tamaño fluido aporte algo, así que se fija el extremo inferior de la escala
 * de la web. Nada baja de 16 px en el cuerpo.
 *
 * `base` es 17 y no 16 porque es el tamaño de cuerpo por defecto que pide la
 * guía de interfaz de la plataforma para móvil, y el mínimo legible que fija son
 * 11. Un punto de más no se nota al mirarlo y sí al leer una ficha de pie en la
 * calle, que es donde se usa esto.
 */
export const fontSize = {
  /**
   * El suelo, y el escalón que faltaba.
   *
   * Apple lo llama Caption 2 y Material `labelSmall`: las dos plataformas lo
   * ponen en once y las dos dicen que por debajo no se baja. Faltaba en esta
   * escala, así que cada vez que hacía falta un rótulo diminuto —la hora de un
   * mensaje, un contador, la atribución del mapa— alguien escribía el número a
   * mano. Veintitrés sitios, cada uno decidido por su cuenta. Un escalón que no
   * existe en la escala no se salta: se improvisa.
   */
  '2xs': 11,
  xs: 12,
  sm: 15,
  base: 17,
  lg: 19,
  xl: 22,
  '2xl': 26,
  '3xl': 32,
  /** Título grande de cabecera, el que se encoge al desplazar. */
  '4xl': 38,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/**
 * Área táctil mínima. 44 es el suelo, no el objetivo.
 *
 * `floating` es el botón de acción flotante, y su tamaño tiene motivo: se pulsa
 * con una mano mientras la otra lleva la correa, a veces con guantes y a veces
 * andando.
 */
export const touchTarget = { min: 44, comfortable: 48, floating: 64 } as const;

export type Theme = {
  colors: SemanticTokens;
  isDark: boolean;
  /** La dirección activa entera, para lo que no es color ni radio. */
  direction: Direction;
  space: typeof space;
  radius: RadiusScale;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  /** Números y no literales: «Señal» los crece. */
  touchTarget: { min: number; comfortable: number; floating: number };
};

/**
 * El tema: la dirección visual, con el fondo que toque.
 *
 * Aquí se cruzan dos decisiones que antes eran una sola:
 *
 *  1. **Qué dirección** —Nocturno, Papel o Señal—. Es la identidad: color,
 *     tipografía y forma, de una pieza. Vive en `lib/direcciones`.
 *  2. **Qué fondo** —claro, oscuro o el del teléfono—. Sigue siendo un ajuste
 *     porque una aplicación que se usa a las siete de la mañana y a las once de
 *     la noche no puede tener un solo fondo.
 *
 * **Lo que se ha ido: el acento por mascota.** La aplicación se teñía del color
 * del perro que estuvieras mirando. Era bonito y era incompatible con lo que
 * pedía cada una de las tres direcciones: un solo acento. Con el tinte por
 * mascota, «un solo acento» era mentira en cuanto cambiabas de Nina a Kira. El
 * color del animal no ha desaparecido —sigue en su ilustración y en su anillo,
 * que es donde identifica a alguien—, pero ya no repinta la interfaz entera.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  /* La preferencia de la aplicación manda sobre la del sistema, y solo aquí:
     es lo que hace que «Oscuro» en ajustes sea un ajuste y no una etiqueta.
     Con «El del teléfono» —lo de fábrica— esto no existe y decide el sistema,
     que es lo que espera quien nunca abre esta pantalla. */
  const choice = useSettings().theme;
  const isDark = choice === 'system' ? scheme === 'dark' : choice === 'dark';
  const direction = DIRECTIONS[useDirection()];

  return {
    colors: direction[isDark ? 'dark' : 'light'],
    isDark,
    direction,
    space,
    radius: direction.radius,
    fontSize,
    fontWeight,
    touchTarget: {
      min: touchTarget.min + direction.touchBoost,
      comfortable: touchTarget.comfortable + direction.touchBoost,
      floating: touchTarget.floating + direction.touchBoost,
    },
  };
}
