/**
 * El alta. La puerta de la aplicación, con la forma de un registro de Instagram.
 *
 * Aquí no se entra a mirar: para registrarse hay que dar de alta a tu animal.
 * No es una pantalla que se pueda saltar navegando a otra ruta —no es una ruta:
 * es lo que se dibuja **en lugar de** la aplicación mientras no haya animal—,
 * porque una puerta que se esquiva escribiendo una dirección no es una puerta.
 *
 * ## Por qué una pregunta por pantalla y no un formulario
 *
 * Es la forma que usa Instagram en su registro, y funciona por un motivo que se
 * puede medir: un formulario largo se ve entero antes de empezar, y lo que se
 * ve entero se abandona. Aquí cada pantalla pide **una cosa**, dice **por qué
 * se pide**, y el botón de abajo no se enciende hasta que esa cosa está. Lo que
 * antes era una lista de seis campos en gris —«falta por rellenar»— ahora es un
 * paso que se cierra y otro que se abre.
 *
 * Y hay una ganancia que no es de estilo: el motivo cabe. En una pantalla con
 * una sola pregunta, explicar que tres escalones de diferencia de talla son un
 * veto duro no compite con nada. En un formulario, ese texto era el que se
 * saltaba todo el mundo.
 *
 * La barra de arriba dice dónde estás sin números —como la de Instagram— y el
 * atrás de cada paso vuelve al anterior en vez de tirar el alta entera.
 *
 * ## Lo que se pide, y por qué
 *
 *  - **Nombre, edad y talla** deciden con quién se junta y con quién no. La
 *    diferencia de talla de tres escalones es un veto duro del algoritmo, no
 *    una preferencia.
 *  - **Carácter** —energía y cómo juega— es el 65 % de la puntuación de
 *    afinidad. Sin esto no hay emparejamiento, solo una lista de perros cerca.
 *  - **Horario** es la mitad del producto: cruzar horarios es lo que hace que
 *    esto sirva a las once de la noche, con la aplicación vacía.
 *  - **El chip es opcional**, y es la decisión que más se puede discutir. Hay
 *    animales adoptados hace años o de países donde no era obligatorio, y dejar
 *    fuera a sus tutores no protege a nadie. El chip **abre** lo que enseña
 *    gente en vez de sitios.
 *
 * ## Y lo que no se pide
 *
 * Dónde vives. No se pregunta y no se guarda. El mapa se sitúa en el barrio de
 * la demostración, y la posición de casa de las mascotas de la semilla no sale
 * nunca de los cálculos de dónde quedar.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ASSISTANCE_ACCESS_NOTE,
  accessLevel,
  can,
  describeOverlap,
  scheduleOverlap,
  whyNot,
  FORGOT_NOTE,
  NO_SERVER_NOTE,
  PASSWORD_ADVICE,
  credentialProblems,
  passwordStrength,
  signInProblems,
  validateEmail,
  ASSISTANCE_TYPES,
  AUTISTIC_DEFAULT_NEEDS,
  DOG_ROLES,
  GATE_NOTE,
  HANDLER_NEEDS,
  CHIP_NOTE,
  HEALTH_FLAG_LABEL,
  HONESTY_NOTE,
  MAX_BREEDS,
  MIXED_BREED_ID,
  SHELTER_ACTIVITIES,
  SHELTER_GATE_NOTE,
  SHELTER_REVIEW_NOTE,
  SHELTER_SCOPE_NOTE,
  UNKNOWN_BREED_ID,
  breedDefaults,
  describeBreeds,
  findBreed,
  missingShelterFields,
  missingSteps,
  searchBreeds,
  suggestedPlayStyles,
  validateShelterProfile,
  type AssistanceType,
  type DogRole,
  type HandlerNeed,
  type HealthFlag,
  type PetDraft,
} from '@petnav/core';
import { formatMicrochip, validateMicrochip } from '@petnav/trackers';

import { Icon } from './icon';
import { Appear, Press } from './motion';
import { SceneView } from './scene';
import { LiveCard, LiveMatches, LiveSchedule, portraitSeed } from './registro-live';
import { Body, Caption, Screen } from '@/components/ui';
import { registerPet, registerShelter, signIn } from '@/lib/account';
import { Avatar } from './avatar';
import { OTHER_PETS } from '@/lib/demo-data';
import { buildScene } from '@/lib/artwork';
import { withAlpha } from '@/lib/color';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Lock,
  PawPrint,
  Search,
  Siren,
  X,
} from '@/lib/icons';
import { useReducedMotion } from '@/lib/motion';
import { useTheme } from '@/lib/theme';

const SIZES = [
  { id: 'mini', label: 'Mini', hint: 'Hasta 5 kg' },
  { id: 'small', label: 'Pequeño', hint: '5–12 kg' },
  { id: 'medium', label: 'Mediano', hint: '12–25 kg' },
  { id: 'large', label: 'Grande', hint: '25–40 kg' },
  { id: 'giant', label: 'Gigante', hint: 'Más de 40 kg' },
] as const;

const ENERGY = [
  { id: 'low', label: 'De sofá', hint: 'Paseo corto y a casa' },
  { id: 'medium', label: 'Explorador', hint: 'Anda, olfatea, vuelve' },
  { id: 'high', label: 'Velocista', hint: 'No para' },
] as const;

const PLAY = [
  { id: 'chase', label: 'Persecución', hint: 'Correr detrás y delante' },
  { id: 'wrestle', label: 'Lucha libre', hint: 'Cuerpo a cuerpo' },
  { id: 'toys', label: 'Juguetes', hint: 'Pelota, cuerda, disco' },
  { id: 'calm_walk', label: 'Paseo tranquilo', hint: 'Andar acompañado' },
] as const;

/** Lunes primero, y X para miércoles: es como se leen los calendarios aquí. */
const DAYS = [
  { id: 1, label: 'L' },
  { id: 2, label: 'M' },
  { id: 3, label: 'X' },
  { id: 4, label: 'J' },
  { id: 5, label: 'V' },
  { id: 6, label: 'S' },
  { id: 0, label: 'D' },
] as const;

/**
 * Las franjas.
 *
 * Seis y no cuatro, y las dos que se han añadido son las que más falta hacían:
 * quien saca al perro a las seis de la mañana antes de trabajar y quien lo saca
 * a las doce de la noche. Son justo los horarios en los que se pasea solo —el
 * caso que esta aplicación existe para resolver— y no tenerlos obligaba a
 * mentir eligiendo la franja de al lado.
 */
const SLOTS = [
  { id: 'dawn', label: 'Al amanecer', start: '06:00', end: '07:00' },
  { id: 'morning', label: 'Mañana', start: '07:00', end: '08:00' },
  { id: 'midday', label: 'Mediodía', start: '13:00', end: '14:00' },
  { id: 'afternoon', label: 'Media tarde', start: '16:00', end: '17:00' },
  { id: 'evening', label: 'Tarde', start: '18:00', end: '19:00' },
  { id: 'night', label: 'Noche', start: '22:00', end: '23:00' },
] as const;

/**
 * La edad, en un toque.
 *
 * Escribir «3» en una caja y luego «0» en otra son dos gestos y un teclado que
 * tapa media pantalla. Casi todo el mundo sabe la edad de su perro en años, así
 * que se elige, y quien la sepa al mes exacto tiene el paso siguiente para
 * afinarla. Los cachorros van aparte porque **por debajo del año la aplicación
 * decide distinto**: un cachorro entra en el veto de «no cachorros revoltosos».
 */
const AGES = [
  { id: '6', label: 'Menos de 1 año', months: 6 },
  { id: '12', label: '1 año', months: 12 },
  { id: '24', label: '2 años', months: 24 },
  { id: '36', label: '3 años', months: 36 },
  { id: '60', label: '4 a 6', months: 60 },
  { id: '96', label: '7 a 9', months: 96 },
  { id: '132', label: '10 o más', months: 132 },
] as const;

/**
 * Con quién se lleva bien, que el algoritmo usa para **vetar**, no para ordenar.
 *
 * Hasta ahora el alta ponía «se lleva con todos» sin preguntarlo, y eso no era
 * un valor por defecto: era una respuesta inventada en nombre del tutor, justo
 * en el campo que impide que a un perro tímido le propongan un velocista bruto.
 * Es opcional —quien no lo sepa lo deja— pero preguntado.
 */
const TRUST = [
  { id: 'loves_everyone', label: 'Con todos', hint: 'Se acerca a cualquiera' },
  { id: 'same_size_only', label: 'De su tamaño', hint: 'Nada de perros dos tallas más grandes' },
  { id: 'shy_at_first', label: 'Tímido al principio', hint: 'Necesita un rato' },
  { id: 'no_hyper_juveniles', label: 'Cachorros no', hint: 'Los muy revoltosos le agobian' },
  { id: 'prefers_females', label: 'Mejor con hembras', hint: '' },
  { id: 'prefers_males', label: 'Mejor con machos', hint: '' },
] as const;

/** Un paso del alta: una pregunta, su motivo y cuándo se puede seguir. */
type Step = {
  id: string;
  title: string;
  why: string;
  content: ReactNode;
  ready: boolean;
  /** Los pasos opcionales enseñan «Omitir» en vez de obligar. */
  skippable?: boolean;
  /** Aviso pequeño encima del control: «puesto por la raza», y poco más. */
  hint?: string;
  /** Efecto al salir del paso, como rellenar lo que la raza ya dice. */
  onLeave?: () => void;
  /**
   * Lo que aparece **debajo** del control: la aplicación funcionando con lo
   * contestado hasta ahora.
   *
   * No es decoración y no es una maqueta: sale del núcleo —`calculateAffinity`,
   * `scheduleOverlap`— con los perros del barrio. Un registro se abandona
   * porque das y no recibes; esto es lo que devuelve cada respuesta.
   */
  live?: ReactNode;
  /** El último no dice «Siguiente». */
  cta?: string;
};

export function Registro() {
  const [screen, setScreen] = useState<'start' | 'signup' | 'login'>('start');
  const [door, setDoor] = useState<'tutor' | 'rescuer' | null>(null);

  if (screen === 'login') {
    return <Login onBack={() => setScreen('start')} onCreate={() => setScreen('signup')} />;
  }

  if (screen === 'signup') {
    if (door === null) return <Puertas onPick={setDoor} onBack={() => setScreen('start')} />;
    if (door === 'tutor') return <AltaTutor onBack={() => setDoor(null)} />;
    return <AltaProtectora onBack={() => setDoor(null)} />;
  }

  return <Bienvenida onSignup={() => setScreen('signup')} onLogin={() => setScreen('login')} />;
}

/**
 * La bienvenida.
 *
 * Es la primera pantalla y tiene un solo trabajo: decir qué es esto y ofrecer
 * las dos únicas cosas que alguien puede querer al abrirlo — **empezar** o
 * **entrar**, si ya tiene cuenta—. Nada de carrusel de tres pantallas
 * explicando lo bonita que es la aplicación, y nada de «continuar como
 * invitado», que aquí además no existe.
 *
 * La ilustración es la del propio generador de la aplicación, no una imagen de
 * archivo: la misma que dibuja las escenas del feed, con la hora de verdad
 * —a las seis de la tarde el cielo sale distinto que a las once de la noche—.
 * Sale de aquí y no de una carpeta de recursos por lo mismo que los retratos
 * del alta: lo que se enseña es la aplicación, no un montaje de ella.
 *
 * «Comenzar» es el botón lleno y «ya tengo cuenta» el de contorno, al revés que
 * en una aplicación con usuarios. Aquí no hay ninguno todavía, y el camino que
 * hay que ver primero es el que crea el primero.
 */
function Bienvenida({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [why, setWhy] = useState<string | null>(null);

  /*
   * La escena, a pantalla completa y a las seis de la tarde.
   *
   * La hora está fijada a propósito: «las seis de la tarde» es la dirección
   * visual del proyecto desde el primer día —luz cálida y baja, parque,
   * movimiento— y esta es la pantalla que la presenta. El resto de escenas usan
   * la hora de verdad, porque ahí lo que cuentan es cuándo pasó lo que
   * enseñan; aquí no ha pasado nada todavía.
   *
   * Se calcula una vez: es un dibujo, no un reloj, y recalcularla en cada
   * render cambiaría el perro al pulsar cualquier cosa.
   */
  /*
   * La escena ocupa el 70 % de arriba, no el alto entero.
   *
   * Generada a la proporción del teléfono —casi 9:19— el cielo se comía la
   * pantalla y el perro caía en el 60 %, justo debajo de donde el velo ya es
   * opaco: la primera versión a pantalla completa **no tenía perro**. El
   * generador coloca el horizonte al 58 % del alto que se le pida, así que
   * pidiéndole el 62 % de la pantalla el horizonte cae al 36 % y el animal
   * justo debajo, sobre el 45 %: por encima del titular, que es donde tiene
   * que estar.
   *
   * El 70 % fue el primer intento y todavía dejaba al perro **detrás de la
   * palabra «pasear»**. Un titular encima del sujeto de la foto es lo mismo que
   * no tener foto.
   */
  const art = Math.round(height * 0.62);
  const scene = useMemo(
    () => {
      const goldenHour = new Date();
      goldenHour.setHours(18, 0, 0, 0);
      return buildScene({
        seed: 'bienvenida',
        petId: 'coincide',
        at: goldenHour,
        width: Math.round(width),
        height: art,
        pose: 'run',
      });
    },
    [width, art],
  );

  return (
    /*
     * `full`: aquí la imagen **es** la pantalla.
     *
     * La versión anterior era una tarjeta de 320 × 200 flotando en medio de un
     * fondo liso, con un tercio de la pantalla vacío por encima. Eso es una
     * diapositiva, no una portada: ninguna aplicación de las que se toman como
     * referencia abre así, y por un motivo que no es de gusto — la primera
     * pantalla tiene que enseñar de qué va esto en el primer segundo, y una
     * miniatura no enseña nada.
     *
     * Ahora la escena ocupa el alto entero, por debajo de la barra de estado, y
     * todo lo demás va encima. Es el patrón de Instagram, de Snapchat y de
     * cualquier portada de los últimos diez años.
     */
    <Screen full>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Un perro corriendo por un parque al atardecer"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: art }}
      >
        <SceneView scene={scene} width={width} height={art} />
      </View>

      {/*
        El velo.
        Un degradado del propio fondo, transparente arriba y opaco abajo. No es
        decoración: es lo que hace legible un texto blanco sobre una imagen que
        no se controla —aquí el cielo es claro y la hierba oscura—. Sin él, el
        titular se lee sobre el césped y desaparece sobre el cielo.
        Las paradas están donde están para que el texto caiga siempre sobre la
        parte opaca y la imagen se vea entera por arriba.
      */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          withAlpha(theme.colors.background, 0),
          withAlpha(theme.colors.background, 0.55),
          withAlpha(theme.colors.background, 0.94),
          theme.colors.background,
        ]}
        locations={[0, 0.32, 0.5, 0.62]}
        style={{ ...StyleSheet.absoluteFillObject }}
      />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + theme.space[4],
          paddingBottom: Math.max(insets.bottom, theme.space[4]) + theme.space[2],
          paddingHorizontal: theme.space[5],
        }}
      >
        {/* La marca, arriba y pequeña. En una portada el logotipo no es el
            asunto: es la firma. El asunto es la foto y lo que dice el titular. */}
        <Appear>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <Icon icon={PawPrint} size="base" color={theme.colors.foreground} decorative />
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayExtrabold,
                fontSize: theme.fontSize.lg,
                letterSpacing: 1.5,
              }}
            >
              PETNAV
            </Text>
          </View>
        </Appear>

        <View style={{ flex: 1 }} />

        <Appear index={1} style={{ gap: theme.space[2] }}>
          {/* Alineado a la izquierda, no centrado. Un titular de dos líneas
              centrado obliga al ojo a buscar el principio de cada una; en una
              portada, donde solo hay una cosa que leer, eso es fricción
              gratuita. */}
          <Text
            style={{
              color: theme.colors.foreground,
              fontFamily: fonts.displayExtrabold,
              fontSize: theme.fontSize['3xl'],
              lineHeight: theme.fontSize['3xl'] * 1.08,
              letterSpacing: -0.8,
            }}
          >
            Encuentra con quién pasear
          </Text>
          <Text
            style={{
              color: theme.colors.foreground,
              opacity: 0.78,
              fontFamily: fonts.body,
              fontSize: theme.fontSize.base,
              lineHeight: theme.fontSize.base * 1.45,
            }}
          >
            Cruzamos horarios. Funciona a las siete de la mañana y a las once de la noche.
          </Text>
        </Appear>

        <Appear index={2} style={{ gap: theme.space[3], paddingTop: theme.space[5] }}>
          <BigButton label="Comenzar ahora" icon={PawPrint} onPress={onSignup} />

          {/*
            «Ya tengo cuenta» pasa de botón de contorno a enlace.
            Dos botones del mismo tamaño uno encima de otro obligan a decidir
            antes de leer. Quien ya tiene cuenta busca esa frase y la encuentra;
            quien no, ve un solo botón y sabe qué hacer.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ya tengo cuenta"
            onPress={() => {
              haptics.tap();
              onLogin();
            }}
            style={({ pressed }) => ({
              minHeight: theme.touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              ¿Ya tienes cuenta?{' '}
              <Text style={{ fontFamily: fonts.displayBold }}>Entra</Text>
            </Text>
          </Pressable>

          {/*
            Apple y Google, ahora en una línea y sin candado.
            Están porque es lo que espera cualquiera en esta pantalla, y **no
            fingen entrar**: al tocarlos dicen qué falta. Un botón que hace como
            que inicia sesión y no lo hace es la peor versión de los dos mundos;
            uno que explica por qué todavía no puede es información.
          */}
          <View style={{ flexDirection: 'row', gap: theme.space[2] }}>
            {[
              { id: 'apple', label: 'Apple' },
              { id: 'google', label: 'Google' },
            ].map((provider) => (
              <Pressable
                key={provider.id}
                accessibilityRole="button"
                accessibilityLabel={`Continuar con ${provider.label}`}
                accessibilityHint="Todavía no está disponible: explica qué falta"
                onPress={() => {
                  haptics.tap();
                  setWhy(why === provider.id ? null : provider.id);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: theme.touchTarget.min,
                  borderRadius: theme.radius.full,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
                })}
              >
                <Text
                  style={{
                    color: theme.colors.mutedForeground,
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {provider.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {why !== null ? (
            <Caption>
              {why === 'apple'
                ? 'Todavía no. Falta la cuenta de desarrollador de Apple y el servidor que valide la sesión.'
                : 'Todavía no. Faltan las claves de Google y el servidor que valide la sesión.'}
            </Caption>
          ) : null}

          <Caption>{GATE_NOTE}</Caption>
        </Appear>
      </View>
    </Screen>
  );
}

/**
 * Entrar.
 *
 * Dos campos y un botón. Lo que se comprueba es lo comprobable sin servidor
 * —que el correo tenga forma de correo y que la contraseña esté— y lo dice la
 * propia pantalla, en vez de fingir una comprobación que no existe.
 *
 * Cuando haya servidor, el mensaje de error seguirá siendo **uno solo**: «no
 * cuadran». Decir «ese correo no existe» le confirma a quien está probando
 * correos cuáles están registrados, y convierte la pantalla de entrar en un
 * comprobador de cuentas.
 */
function Login({ onBack, onCreate }: { onBack: () => void; onCreate: () => void }) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [forgot, setForgot] = useState(false);

  const problems = signInProblems({ email, password });
  const check = validateEmail(email);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: theme.space[5] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => {
            haptics.tap();
            onBack();
          }}
          style={({ pressed }) => ({
            width: theme.touchTarget.min,
            height: theme.touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon icon={ArrowLeft} size="lg" decorative />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.space[6], gap: theme.space[5] }}
      >
        <Appear>
          <View style={{ gap: theme.space[3] }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayExtrabold,
                fontSize: theme.fontSize['3xl'],
                letterSpacing: -0.6,
              }}
            >
¡Hola otra vez!
            </Text>

            <Input
              value={email}
              onChange={setEmail}
              placeholder="tucorreo@correo.com"
              label="Correo"
              autoFocus
              url
            />
            {tried && !check.ok ? <Caption>{check.reason}</Caption> : null}

            <Input
              value={password}
              onChange={setPassword}
              placeholder="Tu contraseña"
              label="Contraseña"
              secret
            />

            <TextLink label="¿Olvidaste la contraseña?" onPress={() => setForgot(true)} />
            {forgot ? <Caption>{FORGOT_NOTE}</Caption> : null}
          </View>
        </Appear>

        <Caption>{NO_SERVER_NOTE}</Caption>
      </ScrollView>

      <View style={{ gap: theme.space[2], padding: theme.space[6], paddingTop: theme.space[3] }}>
        <BigButton
          label="Entrar"
          disabled={problems.length > 0}
          onPress={() => {
            setTried(true);
            if (problems.length > 0 || !check.ok) return;
            haptics.commit();
            signIn(check.normalized);
          }}
        />
        <TextLink label="Crear una cuenta" onPress={onCreate} />
      </View>
    </Screen>
  );
}

/**
 * Por qué puerta se entra, ya dentro de crear cuenta.
 *
 * Las dos se ven a la vez y ninguna está escondida detrás de un «más opciones»:
 * quien rescata y no tiene animal propio tiene que ver que hay sitio para ella
 * antes de rellenar nada, y quien tiene perro tiene que ver que la otra existe
 * para entender por qué se le pide lo que se le pide.
 */
function Puertas({
  onPick,
  onBack,
}: {
  onPick: (door: 'tutor' | 'rescuer') => void;
  onBack: () => void;
}) {
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: theme.space[5] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => {
            haptics.tap();
            onBack();
          }}
          style={({ pressed }) => ({
            width: theme.touchTarget.min,
            height: theme.touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon icon={ArrowLeft} size="lg" decorative />
        </Pressable>
      </View>

      <View
        style={{ flex: 1, justifyContent: 'center', gap: theme.space[5], padding: theme.space[6] }}
      >
        <Appear>
          <View style={{ gap: theme.space[2] }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayExtrabold,
                fontSize: theme.fontSize['3xl'],
                letterSpacing: -0.6,
              }}
            >
              Elige tu tipo de cuenta
            </Text>
            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
                lineHeight: theme.fontSize.sm * 1.5,
              }}
            >
              Determina qué ves y qué puedes hacer dentro.
            </Text>
          </View>
        </Appear>

        {/*
          Dos fichas de opción, no dos botones.

          Aquí no se está confirmando una acción: se está eligiendo entre dos
          productos distintos —uno tiene feed, mapa y quedadas; el otro, un
          tablero de rescate— y esa diferencia no cabe en el rótulo de un botón.
          Una ficha con nombre, descripción y flecha es el patrón con el que se
          eligen planes y tipos de cuenta en cualquier producto serio, y además
          deja decir en la misma pantalla que una de las dos se verifica.

          El nombre accesible es el título; la descripción va como pista, que es
          para lo que existe: un lector de pantalla lee «Tutor, botón» y después
          la explicación, en vez de una frase de veinte palabras por opción.
        */}
        <Appear index={1} style={{ gap: theme.space[3] }}>
          <AccountChoice
            icon={PawPrint}
            title="Tutor"
            description="Registras a tu perro y ves quién pasea por tu zona y a qué hora."
            onPress={() => onPick('tutor')}
          />
          <AccountChoice
            icon={Siren}
            title="Rescate"
            description="Protectora, albergue o casa de acogida. Tablero de animales perdidos y en peligro."
            onPress={() => onPick('rescuer')}
          />
          <Caption>
            Las cuentas de rescate las revisa una persona con el perfil público del colectivo antes
            de activarlas.
          </Caption>
        </Appear>
      </View>
    </Screen>
  );
}

/**
 * El alta de un tutor, paso a paso y lo más corta que se puede.
 *
 * Tres cosas la hacen rápida, y ninguna es quitar preguntas:
 *
 *  1. **La raza contesta los dos pasos siguientes.** Al elegir «Bulldog
 *     francés» ya se sabe la talla, la energía probable y que tiene el hocico
 *     chato. Esos pasos aparecen rellenados y solo hay que confirmarlos.
 *  2. **Autoavance.** En los pasos de una sola respuesta —edad, sexo, talla,
 *     energía— tocar la respuesta pasa al siguiente. Tocar y luego buscar el
 *     botón de abajo son dos gestos para una decisión.
 *  3. **Lo opcional se puede omitir de verdad**, con un botón que lo dice.
 */
function AltaTutor({ onBack }: { onBack: () => void }) {
  const theme = useTheme();

  const [index, setIndex] = useState(0);
  /*
   * El último paso no entra en la aplicación: enseña el barrio.
   *
   * Es lo mejor del alta de Dogo —una pantalla que convierte las respuestas en
   * algo antes de soltarte dentro— y aquí puede ser verdad en vez de una
   * animación: los números salen del mismo cálculo de solapamiento que usa el
   * descubrimiento. El alta se ejecuta al pulsar «Entrar» en esa pantalla, no
   * antes, porque registrar abre la aplicación y se llevaría por delante el
   * momento.
   */
  const [showing, setShowing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [breeds, setBreeds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [ageMonths, setAgeMonths] = useState<number | null>(null);
  const [exactAge, setExactAge] = useState(false);
  const [years, setYears] = useState('');
  const [months, setMonths] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [sizeFromBreed, setSizeFromBreed] = useState(false);
  const [energy, setEnergy] = useState<string | null>(null);
  const [energyFromBreed, setEnergyFromBreed] = useState(false);
  const [play, setPlay] = useState<string[]>([]);
  const [trust, setTrust] = useState<string[]>([]);
  const [flags, setFlags] = useState<HealthFlag[]>([]);
  const [days, setDays] = useState<number[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [chip, setChip] = useState('');
  const [role, setRole] = useState<DogRole>('companion');
  const [assistanceType, setAssistanceType] = useState<AssistanceType | null>(null);
  const [showRole, setShowRole] = useState(true);
  const [autistic, setAutistic] = useState(false);
  const [needs, setNeeds] = useState<HandlerNeed[]>([]);

  /* Avanzar solo, un poco después de tocar. El retraso no es estético: sin él
     la ficha elegida no llega a verse marcada y el paso cambia como si se
     hubiera tocado otra cosa. */
  const bump = () => {
    setTimeout(() => setIndex((current) => current + 1), 220);
  };

  const exact =
    years.trim() === '' && months.trim() === ''
      ? null
      : Number(years || 0) * 12 + Number(months || 0);
  const finalAge = exactAge ? exact : ageMonths;

  const draft: PetDraft = {
    name,
    speciesId: 'dog',
    ageMonths: finalAge !== null && Number.isFinite(finalAge) ? finalAge : null,
    size,
    energy,
    playStyles: play,
    availability: days.length > 0 && slot !== null ? days.length : 0,
  };

  const chosenSlot = SLOTS.find((candidate) => candidate.id === slot);
  const chipCheck = chip.trim() === '' ? null : validateMicrochip(chip);
  const complete = missingSteps(draft).length === 0;

  /* Lo contestado, escrito para leerse. Va en la ficha de arriba y crece con
     cada paso: es lo que convierte ocho preguntas en algo que devuelve. */
  const facts = [
    breeds.length > 0 ? describeBreeds(breeds) : null,
    draft.ageMonths !== null ? ageLabel(draft.ageMonths) : null,
    SIZES.find((option) => option.id === size)?.label ?? null,
    ENERGY.find((option) => option.id === energy)?.label ?? null,
    play.length > 0 ? play.map((id) => PLAY.find((option) => option.id === id)?.label).join(', ') : null,
  ].filter((fact): fact is string => fact !== null);

  const livePet = {
    size,
    energy,
    playStyles: play,
    ageMonths: draft.ageMonths,
    sex,
    trust,
  };

  /**
   * Salir del paso de la raza: rellenar lo que ya se sabe.
   *
   * Se aplica **al salir** y no mientras se elige, para no reescribir debajo de
   * los dedos de quien vuelve atrás a cambiar la raza después de haber ajustado
   * la talla a mano.
   */
  const applyBreeds = () => {
    const defaults = breedDefaults(breeds);
    if (defaults.size !== null && (size === null || sizeFromBreed)) {
      setSize(defaults.size);
      setSizeFromBreed(true);
    }
    if (defaults.energy !== null && (energy === null || energyFromBreed)) {
      setEnergy(defaults.energy);
      setEnergyFromBreed(true);
    }
    setFlags(defaults.flags);
  };

  const steps: Step[] = [
    {
      id: 'account',
      title: 'Empezamos por ti',
      why: 'Con el correo entras la próxima vez. La contraseña no se guarda en ningún sitio: todavía no hay servidor donde guardarla.',
      ready: credentialProblems({ email, password }).length === 0,
      content: (
        <View style={{ gap: theme.space[3] }}>
          <Input
            value={email}
            onChange={setEmail}
            placeholder="tucorreo@correo.com"
            label="Correo"
            autoFocus
            url
          />
          {email.trim() !== '' && !validateEmail(email).ok ? (
            <Caption>{(validateEmail(email) as { reason: string }).reason}</Caption>
          ) : null}

          <Input
            value={password}
            onChange={setPassword}
            placeholder="Cuatro palabras que recuerdes"
            label="Contraseña"
            secret
          />
          <Strength password={password} email={email} />
          <Caption>{PASSWORD_ADVICE}</Caption>
        </View>
      ),
    },
    {
      id: 'breed',
      title: '¿De qué raza es?',
      why: 'Si es mestizo, también cuenta. Con la raza te rellenamos el tamaño y la energía y acabas antes.',
      ready: breeds.length > 0,
      onLeave: applyBreeds,
      content: <BreedPicker selected={breeds} onChange={setBreeds} />,
    },
    {
      id: 'name',
      title: '¿Y cómo se llama?',
      why: 'Es como lo verá la gente del barrio.',
      ready: name.trim().length >= 2,
      content: (
        <Input
          value={name}
          onChange={setName}
          placeholder="Nina"
          label="Nombre de tu perro"
          autoFocus
        />
      ),
    },
    {
      id: 'age',
      title: '¿Cuántos años tiene?',
      why: 'Si todavía no llega al año, lo tratamos como cachorro.',
      ready: draft.ageMonths !== null,
      content: (
        <View style={{ gap: theme.space[3] }}>
          {exactAge ? (
            <View style={{ flexDirection: 'row', gap: theme.space[3] }}>
              <NumberBox value={years} onChange={setYears} label="Años" />
              <NumberBox value={months} onChange={setMonths} label="Meses" />
            </View>
          ) : (
            <Chips
              options={AGES.map((age) => ({ id: age.id, label: age.label }))}
              selected={ageMonths === null ? [] : [String(ageMonths)]}
              onPress={(id) => {
                setAgeMonths(Number(id));
                bump();
              }}
            />
          )}
          <TextLink
            label={exactAge ? 'Elegir de la lista' : 'Sé la edad exacta'}
            onPress={() => setExactAge(!exactAge)}
          />
        </View>
      ),
    },
    {
      id: 'sex',
      title: '¿Macho o hembra?',
      why: 'Hay gente que lo tiene en cuenta antes de quedar, así que se lo decimos.',
      ready: sex !== null,
      content: (
        <Chips
          options={[
            { id: 'female', label: 'Hembra' },
            { id: 'male', label: 'Macho' },
          ]}
          selected={sex ? [sex] : []}
          onPress={(id) => {
            setSex(id as 'male' | 'female');
            bump();
          }}
        />
      ),
    },
    {
      id: 'size',
      title: '¿Es grande o pequeño?',
      why: 'No le proponemos perros que le saquen dos tallas. Es por que no acabe mal un juego.',
      ready: size !== null,
      hint: sizeFromBreed ? 'Puesto por la raza. Cámbialo si no encaja.' : undefined,
      content: (
        <Chips
          options={SIZES}
          selected={size ? [size] : []}
          onPress={(id) => {
            setSize(id);
            setSizeFromBreed(false);
            bump();
          }}
        />
      ),
    },
    {
      id: 'energy',
      title: '¿Es tranquilo o un terremoto?',
      why: 'Es lo que más miramos para buscarle compañía: un perro de sofá con un velocista no se lo pasa bien.',
      ready: energy !== null,
      hint: energyFromBreed ? 'Puesto por la raza. Cámbialo si no encaja.' : undefined,
      live: <LiveMatches draft={livePet} />,
      content: (
        <Chips
          options={ENERGY}
          selected={energy ? [energy] : []}
          onPress={(id) => {
            setEnergy(id);
            setEnergyFromBreed(false);
            bump();
          }}
        />
      ),
    },
    {
      id: 'play',
      title: '¿A qué juega?',
      why: 'Marca las que quieras. Con que compartan una, ya se entienden.',
      ready: play.length > 0,
      live: <LiveMatches draft={livePet} />,
      content: (
        <Chips
          options={PLAY}
          selected={play}
          onPress={(id) =>
            setPlay((current) =>
              current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
            )
          }
        />
      ),
    },
    {
      id: 'role',
      title: '¿Tu perro trabaja?',
      why: 'Casi todos son de compañía y no pasa nada por dejarlo así. A los que trabajan les proponemos otras cosas.',
      ready: true,
      content: (
        <View style={{ gap: theme.space[3] }}>
          <Chips
            options={DOG_ROLES.map((option) => ({
              id: option.id,
              label: option.label,
            }))}
            selected={[role]}
            onPress={(id) => {
              setRole(id as DogRole);
              if (id !== 'assistance') setAssistanceType(null);
              /* Lo que le encaja a un perro que trabaja es paseo tranquilo, no
                 lucha libre con cuatro desconocidos. Se propone —se puede
                 quitar— porque el mismo perro fuera de servicio juega como
                 cualquiera y su tutor sabe cuál de las dos cosas busca aquí. */
              const suggested = suggestedPlayStyles(id as DogRole);
              if (suggested.length > 0) setPlay([...suggested]);
            }}
          />
          <Caption>
            {DOG_ROLES.find((option) => option.id === role)?.hint}
          </Caption>

          {role === 'assistance' ? (
            <View style={{ gap: theme.space[3], paddingTop: theme.space[2] }}>
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.displayBold,
                  fontSize: theme.fontSize.base,
                }}
              >
                ¿Para qué te asiste?
              </Text>
              {/* Y lo que va con la pregunta, en la misma pantalla: esto no
                  sale de aquí. Decirlo donde se pregunta es lo que hace que se
                  pueda contestar; ponerlo en una política que nadie abre, no. */}
              <Caption>
                Esto no se publica nunca. Solo lo usamos para no proponerle lo que le estorba.
              </Caption>
              <Chips
                options={ASSISTANCE_TYPES.map((option) => ({
                  id: option.id,
                  label: option.label,
                }))}
                selected={assistanceType ? [assistanceType] : []}
                onPress={(id) => setAssistanceType(id as AssistanceType)}
              />
              <Separator />
              <Toggle
                label="Mostrar que es de asistencia"
                hint="Evita que lo distraigan mientras trabaja. Tú decides si se muestra."
                on={showRole}
                onToggle={() => setShowRole(!showRole)}
              />
              <Caption>{ASSISTANCE_ACCESS_NOTE}</Caption>
            </View>
          ) : null}
        </View>
      ),
    },
    {
      id: 'handler',
      title: 'Ahora un poco de ti',
      why: 'Puedes saltártelo. Esto solo lo ves tú: no sale en tu perfil ni se lo contamos a nadie.',
      ready: true,
      skippable: true,
      content: (
        <View style={{ gap: theme.space[4] }}>
          <Toggle
            label="Soy autista"
            hint="No aparece en tu perfil. Solo marca las opciones de abajo."
            on={autistic}
            onToggle={() => {
              const next = !autistic;
              setAutistic(next);
              if (next) {
                setNeeds((current) => [
                  ...current,
                  ...AUTISTIC_DEFAULT_NEEDS.filter((need) => !current.includes(need)),
                ]);
              }
            }}
          />

          <View style={{ gap: theme.space[2] }}>
            {HANDLER_NEEDS.map((need) => {
              const on = needs.includes(need.id);
              return (
                <Toggle
                  key={need.id}
                  label={need.label}
                  hint={need.effect}
                  on={on}
                  onToggle={() =>
                    setNeeds((current) =>
                      on ? current.filter((value) => value !== need.id) : [...current, need.id],
                    )
                  }
                />
              );
            })}
          </View>

          <Caption>Puedes cambiarlas cuando quieras en Configuración.</Caption>
        </View>
      ),
    },
    {
      id: 'trust',
      title: '¿Con quién se lleva bien?',
      why: 'Nos sirve para no proponerle a quien le agobia.',
      ready: trust.length > 0,
      skippable: true,
      /* Aquí la vista previa hace algo que no hace en los otros pasos: al
         marcar «de su tamaño» alguien **desaparece** de la lista. Un veto se
         entiende viendo a quién quita, no leyendo la palabra «veto». */
      live: <LiveMatches draft={livePet} />,
      content: (
        <Chips
          options={TRUST}
          selected={trust}
          onPress={(id) =>
            setTrust((current) =>
              current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
            )
          }
        />
      ),
    },
    {
      id: 'schedule',
      title: '¿A qué hora salís?',
      why: 'Tu horario no lo publicamos en ningún sitio. Solo te decimos con quién coincides.',
      ready: days.length > 0 && slot !== null,
      live: (
        <LiveSchedule
          days={days}
          startTime={chosenSlot?.start ?? null}
          endTime={chosenSlot?.end ?? null}
        />
      ),
      content: (
        <View style={{ gap: theme.space[4] }}>
          <Chips
            compact
            options={DAYS.map((day) => ({ id: String(day.id), label: day.label }))}
            selected={days.map(String)}
            onPress={(id) =>
              setDays((current) =>
                current.includes(Number(id))
                  ? current.filter((value) => value !== Number(id))
                  : [...current, Number(id)],
              )
            }
          />
          <Chips
            options={SLOTS.map((option) => ({
              id: option.id,
              label: option.label,
              hint: `${option.start}–${option.end}`,
            }))}
            selected={slot ? [slot] : []}
            onPress={setSlot}
          />
        </View>
      ),
    },
    {
      id: 'chip',
      title: '¿Lleva chip?',
      why: CHIP_NOTE,
      ready: chipCheck?.valid === true,
      skippable: true,
      content: (
        <View style={{ gap: theme.space[3] }}>
          <Input
            value={chip}
            onChange={setChip}
            placeholder="941 000 012 345 678"
            label="Código del microchip"
            numeric
          />
          {chipCheck ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
              <Icon
                icon={chipCheck.valid ? BadgeCheck : CircleAlert}
                size="base"
                color={chipCheck.valid ? theme.colors.success : theme.colors.warning}
                decorative
              />
              <Caption>
                {chipCheck.valid
                  ? `${formatMicrochip(chipCheck.normalized)} · el formato es correcto. Para verificarlo hace falta la cartilla.`
                  : chipCheck.reason}
              </Caption>
            </View>
          ) : null}
        </View>
      ),
    },
    {
      id: 'done',
      title: 'Ya estáis dentro',
      why: 'Todo esto lo puedes cambiar cuando quieras desde su perfil.',
      ready: complete,
      cta: 'Entrar',
      content: (
        <View style={{ gap: theme.space[4] }}>
          <View
            style={{
              gap: theme.space[1],
              padding: theme.space[4],
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Summary label="Nombre" value={name.trim()} />
            <Summary label="Raza" value={describeBreeds(breeds)} />
            <Summary label="Edad" value={ageLabel(draft.ageMonths)} />
            <Summary
              label="Tamaño"
              value={SIZES.find((option) => option.id === size)?.label ?? '—'}
            />
            <Summary
              label="Carácter"
              value={[
                ENERGY.find((option) => option.id === energy)?.label,
                ...play.map((id) => PLAY.find((option) => option.id === id)?.label),
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            <Summary
              label="Con quién"
              value={
                trust.length === 0
                  ? 'Lo dejas para luego'
                  : trust
                      .map((id) => TRUST.find((option) => option.id === id)?.label)
                      .filter(Boolean)
                      .join(' · ')
              }
            />
            <Summary
              label="Paseo"
              value={`${days
                .slice()
                .sort((a, b) => ((a === 0 ? 7 : a) > (b === 0 ? 7 : b) ? 1 : -1))
                .map((day) => DAYS.find((option) => option.id === day)?.label)
                .join(' ')} · ${chosenSlot ? `${chosenSlot.start}–${chosenSlot.end}` : '—'}`}
            />
            <Summary
              label="Chip"
              value={chipCheck?.valid ? 'Apuntado, falta verificarlo' : 'Todavía no'}
            />
            <Summary
              label="Qué hace"
              value={DOG_ROLES.find((option) => option.id === role)?.label ?? 'Compañía'}
            />
          </View>

          {/* Lo que la raza ha marcado, y se puede quitar aquí mismo.
              Sale marcado porque el hocico chato no depende del carácter del
              animal, y se puede quitar porque en un mestizo puede que no lo
              haya heredado. Equivocarse hacia el lado prudente cuesta un paseo
              más corto; al revés cuesta un golpe de calor. */}
          {flags.length > 0 ? (
            <View style={{ gap: theme.space[2] }}>
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.displayBold,
                  fontSize: theme.fontSize.base,
                }}
              >
Por su raza
              </Text>
              <Caption>Ajustamos la temperatura y el rato que le proponemos. Quítalo si no es su caso.</Caption>
              <Chips
                options={flags.map((flag) => ({
                  id: flag,
                  label: HEALTH_FLAG_LABEL[flag] ?? flag,
                }))}
                selected={flags}
                onPress={(id) =>
                  setFlags((current) => current.filter((flag) => flag !== (id as HealthFlag)))
                }
              />
            </View>
          ) : null}

          {needs.length > 0 || assistanceType !== null ? (
            <View
              style={{
                gap: theme.space[2],
                padding: theme.space[4],
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
                <Icon icon={Lock} size="base" color={theme.colors.mutedForeground} decorative />
                <Text
                  style={{
                    color: theme.colors.foreground,
                    fontFamily: fonts.displayBold,
                    fontSize: theme.fontSize.base,
                  }}
                >
                  Solo lo ves tú
                </Text>
              </View>
              <Caption>
                Nada de esto aparece en tu perfil ni lo ve nadie. Solo cambia cómo funciona la app
                para ti.
              </Caption>
            </View>
          ) : null}

          <View
            style={{
              gap: theme.space[2],
              padding: theme.space[4],
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surfaceSunken,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
              <Icon icon={Lock} size="base" color={theme.colors.mutedForeground} decorative />
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.displayBold,
                  fontSize: theme.fontSize.base,
                }}
              >
Qué verás al entrar
              </Text>
            </View>
            <Caption>
              Verás el mapa y el feed del vecindario desde el principio. Para ver quién pasea
              ahora, verifica el chip con la cartilla.
            </Caption>
            <Caption>{HONESTY_NOTE}</Caption>
          </View>
        </View>
      ),
    },
  ];

  const step = steps[index]!;
  const last = index === steps.length - 1;

  /**
   * Entrar de verdad: el alta se ejecuta aquí, al final del todo.
   *
   * Va después de la pantalla del barrio y no antes porque registrar abre la
   * aplicación —el estado de la cuenta es lo que decide qué se pinta— y se
   * llevaría por delante el único momento en que las respuestas se convierten
   * en algo delante de quien las ha dado.
   */
  const enter = () => {
    if (!chosenSlot || sex === null) return;
    haptics.commit();
    registerPet({
      ...draft,
      /* El mismo identificador con el que se dibujó el retrato durante el
         alta: así el perro que sale al entrar es el que estabas mirando y no
         otro que aparece de golpe. */
      seed: portraitSeed({ name, breeds, size }),
      email: validateEmail(email).ok
        ? (validateEmail(email) as { normalized: string }).normalized
        : undefined,
      sex,
      days,
      startTime: chosenSlot.start,
      endTime: chosenSlot.end,
      microchipCode: chipCheck?.valid ? chipCheck.normalized : null,
      breedLabel: describeBreeds(breeds),
      healthFlags: flags,
      trustCircle: trust,
      role,
      assistanceType: assistanceType ?? undefined,
      showRole,
      handler: { autistic: autistic || undefined, needs },
    });
  };

  if (showing && chosenSlot) {
    return (
      <TuBarrio
        name={name.trim()}
        days={days}
        startTime={chosenSlot.start}
        endTime={chosenSlot.end}
        chipVerified={false}
        onEnter={enter}
      />
    );
  }

  return (
    <Wizard
      steps={steps.length}
      index={index}
      step={step}
      card={
        index > 0 ? (
          <LiveCard name={name} breeds={breeds} size={size} facts={facts} />
        ) : undefined
      }
      onBack={() => (index === 0 ? onBack() : setIndex(index - 1))}
      onNext={() => {
        step.onLeave?.();
        if (!last) {
          setIndex(index + 1);
          return;
        }
        if (!chosenSlot || sex === null) return;
        haptics.commit();
        setShowing(true);
      }}
      onSkip={() => {
        step.onLeave?.();
        setIndex(index + 1);
      }}
    />
  );
}

/**
 * Tu barrio: lo que han producido las once respuestas.
 *
 * Es lo mejor del alta de Dogo —la pantalla de «construyendo tu plan», que
 * convierte un cuestionario largo en algo antes de soltarte dentro— con una
 * diferencia que importa: **aquí los números son de verdad**. Salen del mismo
 * cálculo de solapamiento horario que usa el descubrimiento, contra los perros
 * del barrio de la demostración. No hay barra de progreso falsa ni «analizando
 * tus respuestas» de dos segundos.
 *
 * Y hace la segunda cosa que ninguna pantalla de bienvenida hace: **decir qué
 * está cerrado y por qué**. La puerta del radar —quién pasea ahora, a qué hora
 * sale cada uno— se abre al verificar el chip, y este es el único momento en
 * que esa frase llega antes de chocarse con ella.
 */
function TuBarrio({
  name,
  days,
  startTime,
  endTime,
  chipVerified,
  onEnter,
}: {
  name: string;
  days: readonly number[];
  startTime: string;
  endTime: string;
  chipVerified: boolean;
  onEnter: () => void;
}) {
  const theme = useTheme();

  const matches = useMemo(() => {
    const mine = days.map((weekday) => ({ weekday, startTime, endTime }));
    return OTHER_PETS.map((other) => ({
      other,
      overlap: scheduleOverlap(mine, other.availability),
    })).filter((entry) => entry.overlap.totalMinutes > 0);
  }, [days, startTime, endTime]);

  const best = matches
    .slice()
    .sort((a, b) => b.overlap.totalMinutes - a.overlap.totalMinutes)[0];

  const level = accessLevel({
    kind: 'tutor',
    pets: 1,
    microchipVerified: chipVerified,
    walks: 0,
    meetupsAttended: 0,
    shelterProfile: null,
    shelterReviewed: false,
  });

  const doors = [
    { capability: 'places' as const, label: 'Los sitios del mapa' },
    { capability: 'feed' as const, label: 'El feed del barrio' },
    { capability: 'live_people' as const, label: 'Quién pasea ahora' },
    { capability: 'schedules' as const, label: 'Los horarios de los demás' },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space[6], gap: theme.space[6] }}>
        <Appear>
          <View style={{ gap: theme.space[2] }}>
            <Text
              style={{
                color: theme.colors.primary,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.sm,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Ya está
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayExtrabold,
                fontSize: theme.fontSize['3xl'],
                letterSpacing: -0.6,
                lineHeight: theme.fontSize['3xl'] * 1.1,
              }}
            >
              {matches.length === 0
                ? `Este es el barrio de ${name}`
                : matches.length === 1
                  ? `${name} ya coincide con 1 perro`
                  : `${name} ya coincide con ${matches.length} perros`}
            </Text>
            <Body muted>
              {best
                ? `Con ${best.other.name}, de ${best.other.ownerName}, sois quienes más coincidís: ${describeOverlap(best.overlap) ?? 'algún rato a la semana'}.`
                : 'Con ese horario todavía no coincides con nadie. En cuanto alguien más se dé de alta a tu hora, aparece aquí.'}
            </Body>
          </View>
        </Appear>

        {/* Los tres o cuatro nombres, con su cara. Es la diferencia entre un
            número y un barrio. */}
        {matches.length > 0 ? (
          <Appear index={1}>
            <View style={{ gap: theme.space[3] }}>
              {matches.slice(0, 3).map(({ other, overlap }) => (
                <View
                  key={other.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[3] }}
                >
                  <Avatar id={other.id} name={other.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: theme.colors.foreground,
                        fontFamily: fonts.bodyBold,
                        fontSize: theme.fontSize.base,
                      }}
                    >
                      {/* El nombre y de quién es. En un barrio hay tres Lunas y
                          dos Tobys, y sin el tutor la lista es un acertijo —más
                          aún si tu perro se llama igual que el del vecino. */}
                      {other.name} · de {other.ownerName}
                    </Text>
                    <Caption>{describeOverlap(overlap) ?? 'Coincidís algún rato'}</Caption>
                  </View>
                </View>
              ))}
            </View>
          </Appear>
        ) : null}

        {/* Qué se abre y qué no, dicho aquí y no cuando alguien se choque. */}
        <Appear index={2}>
          <View
            style={{
              gap: theme.space[3],
              padding: theme.space[4],
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.base,
              }}
            >
              Lo que se abre hoy
            </Text>
            {doors.map((door) => {
              const open = can(level, door.capability);
              return (
                <View
                  key={door.capability}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[3] }}
                >
                  <Icon
                    icon={open ? Check : Lock}
                    size="base"
                    color={open ? theme.colors.success : theme.colors.mutedForeground}
                    decorative
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: open ? theme.colors.foreground : theme.colors.mutedForeground,
                        fontFamily: open ? fonts.bodyBold : fonts.body,
                        fontSize: theme.fontSize.sm,
                      }}
                    >
                      {door.label}
                    </Text>
                    {!open ? <Caption>{whyNot(level, door.capability)}</Caption> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Appear>
      </ScrollView>

      <View style={{ padding: theme.space[6], paddingTop: theme.space[3] }}>
        <BigButton label="Entrar" icon={PawPrint} onPress={onEnter} />
      </View>
    </Screen>
  );
}

/** «3 años», «8 meses». La edad en meses no se le enseña a nadie. */
function ageLabel(months: number | null): string {
  if (months === null) return '—';
  if (months < 12) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} ${years === 1 ? 'año' : 'años'}${rest > 0 ? ` y ${rest} ${rest === 1 ? 'mes' : 'meses'}` : ''}`;
}

/**
 * Elegir la raza.
 *
 * Un buscador y una lista, y la lista **abre con mestizo arriba**: es la
 * respuesta más frecuente y tenerla que buscar sería hacer trabajar a la
 * mayoría. Se puede elegir mestizo a secas o decir de qué es mezcla, hasta tres
 * apellidos: tres ya es una conjetura y cinco es un formulario.
 *
 * Y se puede no saberlo. Quien adopta un adulto en la calle muchas veces no lo
 * sabe, y obligarle a inventarse una raza mete un dato falso justo donde se
 * decide si su perro sale a treinta grados.
 */
function BreedPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const results = searchBreeds(query).slice(0, 8);
  const mixed = selected.includes(MIXED_BREED_ID);
  const extras = selected.filter((id) => id !== MIXED_BREED_ID).length;

  const toggle = (id: string) => {
    haptics.tap();
    if (selected.includes(id)) {
      onChange(selected.filter((value) => value !== id));
      return;
    }
    /* «No lo sé» no se mezcla con nada: decir que no lo sabes y a la vez que es
       medio labrador es decir dos cosas distintas. */
    if (id === UNKNOWN_BREED_ID) {
      onChange([id]);
      return;
    }
    const clean = selected.filter((value) => value !== UNKNOWN_BREED_ID);
    if (id !== MIXED_BREED_ID && clean.filter((value) => value !== MIXED_BREED_ID).length >= MAX_BREEDS) {
      return;
    }
    onChange([...clean, id]);
  };

  return (
    <View style={{ gap: theme.space[3] }}>
      {/*
        El campo **es** la píldora, con el icono encima.

        Antes eran dos cosas —una píldora con un campo dentro— y el navegador
        dibujaba el anillo de foco pegado al campo, así que salía un rectángulo
        a medio camino que parecía un fallo de maquetación. Con el fondo y el
        radio en el propio campo, el foco rodea lo que se ve.
      */}
      <View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar raza"
          placeholderTextColor={theme.colors.inputPlaceholder}
          accessibilityLabel="Buscar una raza"
          autoCapitalize="none"
          style={{
            minHeight: theme.touchTarget.comfortable,
            paddingLeft: theme.space[12],
            paddingRight: theme.space[4],
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.input,
            color: theme.colors.inputForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: theme.space[4],
            top: 0,
            bottom: 0,
            justifyContent: 'center',
          }}
        >
          <Icon icon={Search} size="base" color={theme.colors.inputPlaceholder} decorative />
        </View>
      </View>

      {selected.length > 0 ? (
        <View style={{ gap: theme.space[1] }}>
          {/* Cómo va a quedar escrito, y solo cuando aporta: con una sola raza
              elegida repetiría literalmente lo que dice la ficha de al lado. */}
          {selected.length > 1 ? <Caption>{describeBreeds(selected)}</Caption> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2] }}>
            {selected.map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${findBreed(id)?.name ?? id}`}
                onPress={() => toggle(id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space[1],
                  minHeight: theme.touchTarget.min,
                  paddingHorizontal: theme.space[4],
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.primary,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    color: theme.colors.primaryForeground,
                    fontFamily: fonts.bodyBold,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  {findBreed(id)?.name ?? id}
                </Text>
                <Icon icon={X} size="sm" color={theme.colors.primaryForeground} decorative />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: theme.space[2] }}>
        {results.length === 0 ? (
          <Caption>
  No encontramos esa raza. Puedes poner «Mestizo» o «No lo sé».
          </Caption>
        ) : null}
        {results
          .filter((breed) => !selected.includes(breed.id))
          .map((breed) => (
            <Pressable
              key={breed.id}
              accessibilityRole="button"
              accessibilityLabel={breed.name}
              onPress={() => toggle(breed.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space[3],
                minHeight: theme.touchTarget.comfortable,
                paddingHorizontal: theme.space[4],
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.surfaceSunken : theme.colors.surface,
              })}
            >
              <Text
                style={{
                  flex: 1,
                  color: theme.colors.foreground,
                  fontFamily: fonts.body,
                  fontSize: theme.fontSize.base,
                }}
              >
                {breed.name}
              </Text>
              {breed.flags && breed.flags.length > 0 ? (
                <Caption>{HEALTH_FLAG_LABEL[breed.flags[0]!] ?? ''}</Caption>
              ) : null}
            </Pressable>
          ))}
      </View>

      {mixed && extras < MAX_BREEDS ? (
        <Caption>
Si sabes de qué es mezcla, añádelo. Hasta {MAX_BREEDS}.
        </Caption>
      ) : null}
    </View>
  );
}

/**
 * Un interruptor con su explicación.
 *
 * Se usa en los dos pasos que no son una elección entre opciones sino un sí o
 * un no: enseñar el papel del perro, y cada acomodo de la persona. Lleva la
 * explicación **debajo y siempre visible**, no detrás de un icono de ayuda:
 * son justo los interruptores en los que hace falta saber qué hacen antes de
 * tocarlos.
 */
function Toggle({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        haptics.tap();
        onToggle();
      }}
      /* `accessibilityState` no llega a la web: react-native-web no lo traduce a
         `aria-checked` en un `Pressable` con papel de interruptor, así que un
         lector de pantalla anunciaba «interruptor» sin decir si estaba puesto.
         Se vio en la auditoría del empaquetado, que buscaba ese atributo para
         comprobar otra cosa y lo encontró vacío. En nativo manda el de arriba;
         en web, este. */
      aria-checked={on}

      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.space[3],
        minHeight: theme.touchTarget.comfortable,
        paddingVertical: theme.space[2],
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: theme.colors.foreground,
            fontFamily: on ? fonts.bodyBold : fonts.body,
            fontSize: theme.fontSize.base,
          }}
        >
          {label}
        </Text>
        <Caption>{hint}</Caption>
      </View>
      <View
        style={{
          width: 52,
          height: 32,
          borderRadius: theme.radius.full,
          padding: 3,
          justifyContent: 'center',
          alignItems: on ? 'flex-end' : 'flex-start',
          backgroundColor: on ? theme.colors.primary : theme.colors.muted,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            icon={on ? Check : X}
            size="sm"
            color={on ? theme.colors.primary : theme.colors.mutedForeground}
            decorative
          />
        </View>
      </View>
    </Pressable>
  );
}

/** Una línea de separación, para partir un paso en dos mitades. */
function Separator() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />;
}

/** Un enlace de texto, para lo que no es la acción principal del paso. */
function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: theme.touchTarget.min,
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          color: theme.colors.primary,
          fontFamily: fonts.bodyBold,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * La puerta de quien rescata y no tiene animal propio.
 *
 * Tres pasos, la misma forma. Lo que **no** abre esta puerta, ni siquiera
 * aprobada, está escrito en el último: quién pasea ahora y los horarios de
 * nadie. Rescatar no necesita saber a qué hora sale cada vecino, y si esa lista
 * se abriera enseñando un enlace, enseñar un enlace sería la forma más barata
 * de conseguirla.
 */
function AltaProtectora({ onBack }: { onBack: () => void }) {
  const theme = useTheme();

  const [index, setIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profile, setProfile] = useState('');
  const [activities, setActivities] = useState<string[]>([]);

  const link = validateShelterProfile(profile);
  const missing = missingShelterFields({ name, profile, activities });

  const steps: Step[] = [
    {
      id: 'account',
      title: 'Empecemos',
      why: 'Con el correo entráis, y ahí os avisamos en cuanto revisemos el perfil.',
      ready: credentialProblems({ email, password }).length === 0,
      content: (
        <View style={{ gap: theme.space[3] }}>
          <Input
            value={email}
            onChange={setEmail}
            placeholder="contacto@protectora.org"
            label="Correo"
            autoFocus
            url
          />
          <Input
            value={password}
            onChange={setPassword}
            placeholder="Cuatro palabras que recordéis"
            label="Contraseña"
            secret
          />
          <Strength password={password} email={email} />
          <Caption>{PASSWORD_ADVICE}</Caption>
        </View>
      ),
    },
    {
      id: 'name',
      title: '¿Cómo os llamáis?',
      why: 'El nombre por el que os conoce la gente.',
      ready: name.trim().length >= 3,
      content: (
        <Input
          value={name}
          onChange={setName}
          placeholder="Patitas del Sur"
          label="Nombre del colectivo"
          autoFocus
        />
      ),
    },
    {
      id: 'profile',
      title: '¿Dónde os podemos ver?',
      why: 'Instagram, Facebook, TikTok, X o vuestra web. El perfil entero, no una publicación suelta.',
      ready: link.ok,
      content: (
        <View style={{ gap: theme.space[3] }}>
          <Input
            value={profile}
            onChange={setProfile}
            placeholder="instagram.com/patitasdelsur"
            label="Enlace al perfil del colectivo"
            url
          />
          {profile.trim() !== '' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
              <Icon
                icon={link.ok ? BadgeCheck : CircleAlert}
                size="base"
                color={link.ok ? theme.colors.success : theme.colors.warning}
                decorative
              />
              <Caption>
                {link.ok
                  ? `${link.platform}${link.handle ? ` · @${link.handle}` : ''}. Lo revisará una persona.`
                  : link.reason}
              </Caption>
            </View>
          ) : null}
        </View>
      ),
    },
    {
      id: 'activities',
      title: '¿Qué hacéis?',
      why: 'Así sabemos qué avisos os interesan y cuáles no.',
      ready: activities.length > 0,
      content: (
        <Chips
          options={SHELTER_ACTIVITIES.map((activity) => ({
            id: activity.id,
            label: activity.label,
          }))}
          selected={activities}
          onPress={(id) =>
            setActivities((current) =>
              current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
            )
          }
        />
      ),
    },
    {
      id: 'done',
      title: 'Gracias por lo que hacéis',
      why: SHELTER_REVIEW_NOTE,
      ready: missing.length === 0,
      cta: 'Enviar a revisión',
      content: (
        <View
          style={{
            gap: theme.space[2],
            padding: theme.space[4],
            borderRadius: theme.radius.lg,
            backgroundColor: theme.colors.surfaceSunken,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
            <Icon icon={Lock} size="base" color={theme.colors.mutedForeground} decorative />
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayBold,
                fontSize: theme.fontSize.base,
              }}
            >
              Qué podréis ver
            </Text>
          </View>
          <Caption>{SHELTER_SCOPE_NOTE}</Caption>
        </View>
      ),
    },
  ];

  const step = steps[index]!;
  const last = index === steps.length - 1;

  return (
    <Wizard
      steps={steps.length}
      index={index}
      step={step}
      intro={index === 0 ? SHELTER_GATE_NOTE : undefined}
      onBack={() => (index === 0 ? onBack() : setIndex(index - 1))}
      onNext={() => {
        if (!last) {
          setIndex(index + 1);
          return;
        }
        if (!link.ok) return;
        haptics.commit();
        registerShelter({
          name,
          profile,
          activities,
          normalizedProfile: link.normalized,
          email: validateEmail(email).ok
            ? (validateEmail(email) as { normalized: string }).normalized
            : undefined,
        });
      }}
      onSkip={() => setIndex(index + 1)}
    />
  );
}

/**
 * El armazón de un paso.
 *
 * Barra de progreso arriba, atrás a la izquierda, una pregunta grande, su
 * motivo, el control, y el botón abajo del todo **fijo**: en un registro, el
 * botón que continúa no se busca con el dedo, está donde estaba en el paso
 * anterior.
 *
 * El progreso va sin números por lo mismo que en Instagram: «paso 4 de 9» hace
 * contar lo que queda, y una barra que avanza dice lo mismo sin invitar a
 * abandonar. El lector de pantalla sí recibe la cuenta, que es donde hace falta.
 */
function Wizard({
  steps,
  index,
  step,
  intro,
  card,
  onBack,
  onNext,
  onSkip,
}: {
  steps: number;
  index: number;
  step: Step;
  intro?: string;
  /** La ficha que se va rellenando. Fija arriba, fuera del desplazamiento. */
  card?: ReactNode;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const theme = useTheme();

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[3],
          paddingRight: theme.space[5],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => {
            haptics.tap();
            onBack();
          }}
          style={({ pressed }) => ({
            width: theme.touchTarget.min,
            height: theme.touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon icon={ArrowLeft} size="lg" decorative />
        </Pressable>

        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Paso ${index + 1} de ${steps}`}
          style={{
            flex: 1,
            height: 3,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.muted,
            overflow: 'hidden',
          }}
        >
          <Progress value={(index + 1) / steps} />
        </View>
      </View>

      {card ? (
        <View style={{ paddingHorizontal: theme.space[6], paddingTop: theme.space[4] }}>{card}</View>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: theme.space[6],
          paddingTop: theme.space[4],
          gap: theme.space[5],
        }}
      >
        {/* La clave cambia con el paso, así que la entrada se repite en cada
            uno: es lo que hace que se lea como avanzar y no como un formulario
            que se reescribe solo. Con movimiento reducido, nada de esto pasa. */}
        <Appear key={step.id}>
          <View style={{ gap: theme.space[3] }}>
            {intro ? <Body muted>{intro}</Body> : null}
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.displayExtrabold,
                fontSize: theme.fontSize['3xl'],
                letterSpacing: -0.6,
              }}
            >
              {step.title}
            </Text>
            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
                lineHeight: theme.fontSize.sm * 1.5,
              }}
            >
              {step.why}
            </Text>
            {step.hint ? (
              /* «Puesto por la raza». Va pegado al control y no en el motivo de
                 arriba: explica **este** valor, no la pregunta. */
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space[2],
                  paddingTop: theme.space[1],
                }}
              >
                <Icon icon={Check} size="sm" color={theme.colors.success} decorative />
                <Caption>{step.hint}</Caption>
              </View>
            ) : null}
            <View style={{ paddingTop: theme.space[2] }}>{step.content}</View>
            {step.live ? (
              <View
                style={{
                  gap: theme.space[2],
                  marginTop: theme.space[4],
                  paddingTop: theme.space[4],
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border,
                }}
              >
                {step.live}
              </View>
            ) : null}
          </View>
        </Appear>
      </ScrollView>

      <View
        style={{
          gap: theme.space[2],
          paddingHorizontal: theme.space[6],
          paddingBottom: theme.space[6],
          paddingTop: theme.space[3],
        }}
      >
        <BigButton
          label={step.cta ?? 'Siguiente'}
          disabled={!step.ready}
          onPress={() => {
            haptics.tap();
            onNext();
          }}
        />
        {step.skippable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Omitir"
            accessibilityHint="Puedes añadirlo después desde el perfil"
            onPress={() => {
              haptics.tap();
              onSkip();
            }}
            style={({ pressed }) => ({
              minHeight: theme.touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.sm,
              }}
            >
              Omitir
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

/**
 * La barra de progreso, que **se desliza** al pasar de paso.
 *
 * Un salto no dice de dónde a dónde ha ido; el recorrido sí, y es la única
 * respuesta que da la pantalla a haber contestado. Trescientos milisegundos:
 * lo justo para verlo sin que estorbe al que va rápido.
 *
 * Con movimiento reducido salta, que es lo correcto: el estado final es el
 * mismo y no se pierde nada.
 */
function Progress({ value }: { value: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(value);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: value,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      /* Se anima el ancho, que no puede ir por el hilo nativo. Es una barra de
         tres píxeles y no se nota; usar `scaleX` sí se notaría, porque
         escalaría también el redondeo de las puntas. */
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, value]);

  return (
    <Animated.View
      style={{
        width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        height: 3,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primary,
      }}
    />
  );
}

/** El botón de abajo: ancho entero y de una sola cosa, como en un registro. */
/**
 * Una ficha de tipo de cuenta.
 *
 * Icono, nombre, una línea de qué es y una flecha. La flecha no es adorno: dice
 * que esto lleva a algún sitio en vez de confirmar algo aquí mismo, que es la
 * diferencia entre elegir y aceptar.
 */
function AccountChoice({
  icon,
  title,
  description,
  onPress,
}: {
  icon: typeof PawPrint;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={{ borderRadius: theme.radius.lg }}
    >
      {({ pressed }) => (
        <Press pressed={pressed}>
          <View
            style={{
              flexDirection: 'row',
              /* Arriba y no centrado: con una descripción de dos o tres
                 renglones, un icono centrado en la fila queda a la altura de la
                 segunda línea y parece que se ha caído. Alineado con el título,
                 el ojo lee icono y nombre como una sola cosa. */
              alignItems: 'flex-start',
              gap: theme.space[4],
              padding: theme.space[4],
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.accent,
              }}
            >
              <Icon icon={icon} size="lg" color={theme.colors.primary} decorative />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  color: theme.colors.foreground,
                  fontFamily: fonts.displayBold,
                  fontSize: theme.fontSize.lg,
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  color: theme.colors.mutedForeground,
                  fontFamily: fonts.body,
                  fontSize: theme.fontSize.sm,
                  lineHeight: theme.fontSize.sm * 1.45,
                }}
              >
                {description}
              </Text>
            </View>

            {/* La flecha sí se centra: acompaña a la ficha entera, no al
                título. */}
            <View style={{ alignSelf: 'center' }}>
              <Icon icon={ChevronRight} size="base" color={theme.colors.mutedForeground} decorative />
            </View>
          </View>
        </Press>
      )}
    </Pressable>
  );
}

function BigButton({
  label,
  icon,
  tone = 'solid',
  disabled = false,
  onPress,
}: {
  label: string;
  icon?: typeof PawPrint;
  tone?: 'solid' | 'outline';
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const outline = tone === 'outline';
  const foreground = disabled
    ? theme.colors.mutedForeground
    : outline
      ? theme.colors.foreground
      : theme.colors.primaryForeground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space[2],
        minHeight: theme.touchTarget.comfortable + 4,
        borderRadius: theme.radius.full,
        borderWidth: outline ? 1 : 0,
        borderColor: theme.colors.border,
        backgroundColor: disabled
          ? theme.colors.muted
          : outline
            ? 'transparent'
            : theme.colors.primary,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon ? <Icon icon={icon} size="base" color={foreground} decorative /> : null}
      <Text
        style={{
          color: foreground,
          fontFamily: fonts.displayBold,
          fontSize: theme.fontSize.base,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  label,
  autoFocus = false,
  numeric = false,
  url = false,
  secret = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  numeric?: boolean;
  url?: boolean;
  /** Contraseña: se tapa, y se puede destapar. */
  secret?: boolean;
}) {
  const theme = useTheme();
  /*
   * El ojo para ver lo que escribes.
   *
   * En un teclado de móvil, escribir una contraseña larga a ciegas es la razón
   * por la que la gente pone contraseñas cortas. Poder mirarla mientras la
   * escribes es lo que hace viable pedir longitud en vez de símbolos, así que
   * este botón no es una comodidad: sostiene la regla de la pantalla anterior.
   */
  const [shown, setShown] = useState(false);

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inputPlaceholder}
        accessibilityLabel={label}
        autoFocus={autoFocus}
        autoCapitalize={url || secret ? 'none' : 'sentences'}
        autoCorrect={!secret}
        secureTextEntry={secret && !shown}
        keyboardType={numeric ? 'number-pad' : url ? 'url' : 'default'}
        style={{
          minHeight: theme.touchTarget.comfortable,
          paddingLeft: theme.space[4],
          paddingRight: secret ? theme.space[12] : theme.space[4],
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.input,
          color: theme.colors.inputForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.base,
        }}
      />
      {secret ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Ocultar la contraseña' : 'Ver la contraseña'}
          onPress={() => {
            haptics.tap();
            setShown(!shown);
          }}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: theme.touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon
            icon={shown ? EyeOff : Eye}
            size="base"
            color={theme.colors.mutedForeground}
            decorative
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * La fuerza de la contraseña, mientras se escribe.
 *
 * Tres marcas y una frase con **qué hacer**, no un porcentaje: «fuerza 42 %» no
 * le dice a nadie qué escribir, y «añade una palabra más» sí. La nota la calcula
 * el núcleo, que es donde están las reglas y sus tests.
 */
function Strength({ password, email }: { password: string; email: string }) {
  const theme = useTheme();
  const strength = passwordStrength(password, email);

  if (password.length === 0) return null;

  const color = strength.usable
    ? strength.score >= 3
      ? theme.colors.success
      : theme.colors.primary
    : theme.colors.warning;

  return (
    <View style={{ gap: theme.space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
        {[1, 2, 3].map((step) => (
          <View
            key={step}
            style={{
              flex: 1,
              height: 4,
              borderRadius: theme.radius.full,
              backgroundColor: strength.score >= step ? color : theme.colors.muted,
            }}
          />
        ))}
        <Text
          style={{
            color,
            fontFamily: fonts.bodyBold,
            fontSize: theme.fontSize.xs,
          }}
        >
          {strength.label}
        </Text>
      </View>
      {strength.advice ? <Caption>{strength.advice}</Caption> : null}
    </View>
  );
}

function NumberBox({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, gap: theme.space[1] }}>
      <Caption>{label}</Caption>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={theme.colors.inputPlaceholder}
        accessibilityLabel={label}
        style={{
          minHeight: theme.touchTarget.comfortable,
          paddingHorizontal: theme.space[4],
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.input,
          color: theme.colors.inputForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.base,
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[3],
        minHeight: theme.touchTarget.min - 12,
      }}
    >
      <Text
        style={{
          flex: 1,
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flex: 2,
          textAlign: 'right',
          color: theme.colors.foreground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        {value || '—'}
      </Text>
    </View>
  );
}

/**
 * Fichas que se tocan.
 *
 * Lo elegido lleva **marca además de color**: un relleno distinto se pierde en
 * una captura en gris y en cualquier deficiencia de visión del color, y aquí lo
 * elegido decide con quién se junta un animal.
 */
function Chips({
  options,
  selected,
  onPress,
  compact = false,
}: {
  options: ReadonlyArray<{ id: string; label: string; hint?: string }>;
  selected: readonly string[];
  onPress: (id: string) => void;
  /**
   * Fichas de una letra, en una sola fila.
   *
   * Los siete días con el ancho normal se salían y «D» caía a una segunda
   * fila, que rompe la lectura de una semana: se leen en línea o no se leen.
   * Cuarenta y cuatro de ancho por siete más los huecos entra justo en la
   * pantalla estrecha, y cuarenta y cuatro es además el suelo táctil, así que
   * el ajuste no cuesta accesibilidad.
   *
   * Aquí lo elegido se marca **rellenando**, no con la marca de verificación:
   * en una ficha de una letra no cabe, y el relleno es lo que sobrevive a una
   * captura en gris igual de bien.
   */
  compact?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: compact ? theme.space[1] : theme.space[2],
      }}
    >
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            onPress={() => {
              haptics.tap();
              onPress(option.id);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: compact ? 'center' : 'flex-start',
              gap: theme.space[1],
              width: compact ? theme.touchTarget.min : undefined,
              minHeight: theme.touchTarget.min,
              paddingHorizontal: compact ? 0 : theme.space[4],
              borderRadius: theme.radius.full,
              borderWidth: on ? 2 : 1,
              borderColor: on ? theme.colors.primary : theme.colors.border,
              backgroundColor:
                compact && on
                  ? theme.colors.primary
                  : pressed
                    ? theme.colors.surfaceSunken
                    : theme.colors.surface,
            })}
          >
            {on && !compact ? (
              <Icon icon={Check} size="sm" color={theme.colors.primary} decorative />
            ) : null}
            <Text
              style={{
                color: compact && on
                  ? theme.colors.primaryForeground
                  : on
                    ? theme.colors.foreground
                    : theme.colors.mutedForeground,
                fontFamily: on ? fonts.bodyBold : fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              {option.label}
            </Text>
            {option.hint ? (
              <Text
                style={{
                  color: theme.colors.mutedForeground,
                  fontFamily: fonts.body,
                  fontSize: theme.fontSize['2xs'],
                }}
              >
                {option.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
