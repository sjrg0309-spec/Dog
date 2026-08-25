/**
 * El vocabulario de movimiento de la aplicación.
 *
 * El proyecto tenía una regla desde el primer día: **el anillo del radar es el
 * único elemento con movimiento continuo**, y por eso significa «en vivo». Esa
 * regla sigue. Lo que hay aquí no la rompe, la ordena:
 *
 *  - `Appear` es movimiento **de entrada**: ocurre una vez, al aparecer algo, y
 *    se acaba. Sin él una lista se materializa de golpe y no se sabe si ha
 *    cargado o si siempre estuvo así.
 *  - `Press` es movimiento **bajo el dedo**: la superficie cede mientras se
 *    toca y vuelve al soltar. Es lo que hace que una tarjeta se sienta un
 *    objeto y no un rectángulo pintado.
 *  - `Pop` es movimiento **de respuesta**: ocurre porque el toque ya entró. Es
 *    la confirmación, antes de que cambie el número.
 *  - `Presence` es movimiento **de salida**: lo que se va se va yendo. Sin él,
 *    algo que desaparece de golpe parece un fallo.
 *  - `Pulse` es el único **continuo**, y solo lo lleva lo que está pasando
 *    ahora mismo.
 *
 * ## Por qué muelles y no curvas de tiempo
 *
 * Todo lo que responde a un dedo va con muelle. Una curva de tiempo dura lo que
 * dura pase lo que pase; un muelle tiene masa, así que si algo se interrumpe a
 * mitad —y en una pantalla táctil se interrumpe todo el rato— continúa desde
 * donde estaba con la velocidad que llevaba, en vez de saltar al principio.
 * Esa es toda la diferencia entre «animado» y «físico», y es la razón de que
 * los tres muelles de abajo estén **nombrados**: un número suelto en cada
 * componente acaba siendo doce movimientos distintos que no se parecen entre
 * sí.
 *
 * Los cinco respetan movimiento reducido, y ninguno esconde información: quitar
 * la animación deja el mismo estado final, no un estado peor.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib/motion';

/**
 * Tres muelles con nombre, y ninguno más.
 *
 * Se distinguen por **para qué son**, no por cómo suenan:
 *
 *  - `snappy` va debajo del dedo. Casi sin rebote: un botón que oscila al
 *    soltarlo se siente flojo, no vivo.
 *  - `settle` entra y coloca. Un punto de rebote, el justo para que la pieza
 *    parezca que ha llegado y no que se ha teletransportado.
 *  - `gentle` mueve superficies grandes —hojas, paneles—, donde la masa
 *    aparente tiene que ser mayor: una hoja de media pantalla que llega tan
 *    rápido como un botón se siente de papel.
 */
export const springs = {
  snappy: { damping: 22, stiffness: 320, mass: 0.7 },
  settle: { damping: 20, stiffness: 190, mass: 0.9 },
  gentle: { damping: 26, stiffness: 120, mass: 1 },
} satisfies Record<string, WithSpringConfig>;

/**
 * Entrada: sube y aparece, con muelle.
 *
 * `index` escalona la entrada de una lista. Se limita a los primeros: escalonar
 * el elemento número treinta lo haría entrar segundo y medio después de abrir
 * la pantalla, que ya no es una entrada sino una espera.
 */
export function Appear({
  children,
  index = 0,
  distance = 14,
  style,
}: {
  children: ReactNode;
  index?: number;
  distance?: number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(Math.min(index, 6) * 55, withSpring(1, springs.settle));
    return () => cancelAnimation(progress);
  }, [index, progress, reduced]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  /*
   * Y además se recoloca.
   *
   * `Appear` envuelve a casi todo lo que vive en una lista —publicaciones,
   * avisos, quedadas, mensajes—, así que es el sitio donde una transición de
   * disposición llega más lejos con menos: al filtrar, al guardar o al
   * apuntarse, lo que queda **se desliza** a su posición nueva en vez de
   * aparecer ya colocado. Con movimiento reducido no se pone, porque un
   * elemento deslizándose es exactamente lo que esa preferencia pide evitar.
   */
  return (
    <Animated.View layout={reduced ? undefined : reflow} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}

/**
 * La superficie cede bajo el dedo.
 *
 * Envuelve al pulsable y le pasa `onPressIn`/`onPressOut` **al hijo**: la
 * animación no puede vivir dentro del `Pressable` porque lo que se quiere
 * escalar es todo, incluido su fondo. El hijo sigue recibiendo el toque; esto
 * solo mira.
 *
 * El 0,97 no es un número a ojo: por debajo de 0,95 la tarjeta parece que se
 * aleja, y por encima de 0,98 no se percibe en una pantalla de 390 puntos. Se
 * comprobó en captura con las tres.
 */
export function Press({
  children,
  pressed,
  scale = 0.97,
  style,
}: {
  children: ReactNode;
  /** Lo dice el `Pressable` de dentro, que es quien sabe si hay un dedo encima. */
  pressed: boolean;
  scale?: number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const value = useSharedValue(1);

  useEffect(() => {
    value.value = withSpring(pressed && !reduced ? scale : 1, springs.snappy);
  }, [pressed, reduced, scale, value]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: value.value }] }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Respuesta al toque: se encoge y vuelve con un rebote corto.
 *
 * `trigger` es el valor que cambia cuando hay que animar —normalmente el estado
 * de la reacción—. No se anima en el primer render: una tarjeta que llega con
 * el corazón ya puesto no debería rebotar al aparecer.
 */
export function Pop({
  children,
  trigger,
  style,
}: {
  children: ReactNode;
  trigger: unknown;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!seen) {
      setSeen(true);
      return;
    }
    if (reduced) return;
    scale.value = withSequence(withTiming(0.7, { duration: 90 }), withSpring(1, springs.settle));
    return () => cancelAnimation(scale);
    // `seen` queda fuera a propósito: si entrara, el primer cambio de estado
    // dispararía el rebote dos veces —una por el disparador y otra por haberlo
    // marcado como visto—, y se vería doble.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, scale, trigger]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Lo que se va, se va yendo.
 *
 * React desmonta de golpe, así que sin esto un aviso, una hoja o una fila
 * borrada desaparecen en un fotograma y la pantalla parece haber parpadeado.
 * `Presence` mantiene al hijo montado el tiempo que dura la salida y lo suelta
 * después, que es lo único que hace falta para que se entienda que **eso estaba
 * ahí y ya no está**.
 *
 * La salida es más corta que la entrada —180 ms contra un muelle— por la misma
 * razón por la que una puerta se cierra más rápido de lo que se abre: lo que
 * entra hay que verlo, lo que sale ya se ha visto.
 */
export function Presence({
  visible,
  children,
  distance = 8,
  style,
}: {
  visible: boolean;
  children: ReactNode;
  distance?: number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = reduced ? 1 : withSpring(1, springs.settle);
      return;
    }
    if (reduced) {
      progress.value = 0;
      setMounted(false);
      return;
    }
    progress.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) });
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [progress, reduced, visible]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -distance }],
  }));

  if (!mounted) return null;

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * El pulso del radar: el único movimiento continuo de la aplicación.
 *
 * Con movimiento reducido no desaparece — desaparecería la información — sino
 * que se queda en el estado grande y estático, que comunica lo mismo sin el
 * trayecto.
 */
export function Pulse({
  children,
  active,
  style,
}: {
  children: ReactNode;
  active: boolean;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const value = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(value);
      value.value = 0;
      return;
    }
    /* Curva de tiempo y no muelle, y es la excepción que confirma la regla: un
       latido tiene que ser **igual cada vez**, y un muelle interrumpido no lo
       sería. Lo continuo se mide en tiempo; lo que responde al dedo, en masa. */
    value.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(value);
  }, [active, reduced, value]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + value.value * 0.06 }],
  }));

  if (!active) return <Animated.View style={style}>{children}</Animated.View>;

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/* ------------------------------------------------------- lo que se recoloca */

/**
 * Cuando una lista cambia, se recoloca; no salta.
 *
 * Es la diferencia de calidad más barata que existe y la que le faltaba a esta
 * aplicación entera: **cero** transiciones de disposición en cuarenta y tres
 * pantallas. Al guardar un aviso, al apuntarse a una búsqueda, al filtrar el
 * feed por distancia, las tarjetas de debajo se teletransportaban a su sitio
 * nuevo. Nadie sabe decir qué pasó porque no pasó nada visible: el contenido
 * simplemente **es otro** de un fotograma al siguiente, y el ojo lo lee como un
 * fallo de dibujo, no como una consecuencia de lo que acaba de tocar.
 *
 * Con esto, lo que se mueve se ve moverse, así que se entiende de dónde viene.
 *
 * Se usa como propiedad —`layout={reflow}`— y no como envoltorio, porque la
 * transición la tiene que declarar **el elemento que se mueve**; un `View` de
 * más alrededor no se recoloca, se recoloca su hijo.
 */
export const reflow = LinearTransition.springify().damping(24).stiffness(220).mass(0.8);

/** Entrar cayendo un poco, con muelle. Para lo que aparece en una lista. */
export const enter = FadeInDown.springify().damping(22).stiffness(240).mass(0.7);

/** Y salir hacia arriba, más rápido: lo que se va no merece que se le espere. */
export const exit = FadeOutUp.duration(180);

/* ------------------------------------------------------ números que ruedan */

/**
 * Un número que cambia rodando, no parpadeando.
 *
 * Los contadores de esta aplicación —reacciones, comentarios, cuánta gente
 * busca— cambiaban por sustitución: donde ponía 6 ponía 7 en el mismo
 * fotograma. Y eso, en la única parte de la interfaz que responde a lo que
 * acabas de tocar, es exactamente donde se nota que una aplicación es barata:
 * no hay forma de saber si el número subió porque lo tocaste tú o porque se
 * recargó la lista.
 *
 * Rodando sí: el dígito viejo se va por donde el nuevo entra, y **la dirección
 * dice el signo**. Sube si sumaste, baja si quitaste.
 *
 * Lo que no hace: contar de uno en uno hasta el valor nuevo. Eso es una
 * animación de tablero de aeropuerto y en un contador de siete reacciones
 * tarda más que el gesto que lo provocó.
 */
export function Counter({
  value,
  size,
  style,
}: {
  value: number;
  /** Tamaño de letra, para poder recortar a la altura de una línea. */
  size: number;
  style?: TextStyle;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const [leaving, setLeaving] = useState<number | null>(null);
  const direction = useRef(1);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (value === shown) return;
    if (reduced) {
      setShown(value);
      setLeaving(null);
      return;
    }
    direction.current = value > shown ? 1 : -1;
    setLeaving(shown);
    setShown(value);
    progress.value = 0;
    progress.value = withSpring(1, springs.snappy);
    return () => cancelAnimation(progress);
  }, [value, shown, reduced, progress]);

  /* Alto de una línea. Se calcula del tamaño de letra en vez de medirse porque
     medir obliga a un fotograma con el hueco a cero, y ese fotograma se ve
     como un parpadeo justo en el elemento que no debe parpadear. */
  const line = Math.round(size * 1.35);
  const travel = direction.current * line;

  const arriving = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [travel, 0]) }],
    opacity: progress.value,
  }));

  const departing = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -travel]) }],
    opacity: 1 - progress.value,
  }));

  const text: TextStyle = { fontSize: size, fontVariant: ['tabular-nums'], ...style };

  return (
    <Animated.View style={{ height: line, overflow: 'hidden', justifyContent: 'center' }}>
      {leaving !== null ? (
        <Animated.Text
          /* El que se va no lo lee nadie: para un lector de pantalla el valor
             es uno solo, y anunciar los dos diría «6 7» en voz alta. */
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[text, { position: 'absolute', width: '100%' }, departing]}
        >
          {leaving}
        </Animated.Text>
      ) : null}
      <Animated.Text style={[text, arriving]}>{shown}</Animated.Text>
    </Animated.View>
  );
}
