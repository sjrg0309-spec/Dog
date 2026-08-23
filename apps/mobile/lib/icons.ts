/**
 * Los iconos de la aplicación, en un solo sitio.
 *
 * Antes eran caracteres Unicode sueltos —◎ ◉ ◇ ⬡ ◈— repartidos por las
 * pantallas. Parecía barato y no lo era: cada glifo tiene su propio peso óptico
 * y su propia caja, así que en una fila quedaban descuadrados; no escalan con el
 * ajuste de tamaño de texto del sistema; y lo que anuncia un lector de pantalla
 * al encontrarse un «◈» depende de la fuente instalada.
 *
 * Lucide resuelve las tres cosas: trazo uniforme de dos píxeles, rejilla de 24
 * y componentes de verdad con `size` y `color`.
 *
 * **Este fichero es la única puerta de entrada.** Importar un icono desde
 * cualquier otro sitio es cómo empiezan dos sistemas de iconos en la misma
 * aplicación, y a partir del segundo ya no hay forma de que casen.
 */

export type { LucideIcon } from 'lucide-react-native';

export {
  // Navegación principal
  PawPrint,
  Map,
  Megaphone,
  MessageCircleMore,
  UserRound,
  // Navegación secundaria
  Compass,
  Radar,
  CalendarDays,
  Fence,
  Users,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  X,
  Ellipsis,
  Settings,
  // Estado
  BadgeCheck,
  TriangleAlert,
  // Tiempo
  ThermometerSun,
  RefreshCw,
  CircleAlert,
  CircleCheck,
  Ban,
  Thermometer,
  Timer,
  Clock,
  Info,
  Lock,
  // Feed y reacciones
  Heart,
  MessageCircle,
  Send,
  Camera,
  ImagePlus,
  ImageOff,
  Share2,
  Bone,
  Sparkles,
  Grid3x3,
  Tag,
  Bell,
  UserPlus,
  Image as ImageIcon,
  Video,
  Volume2,
  VolumeOff,
  Play,
  // Seguridad
  Siren,
  ShieldAlert,
  Eye,
  /** Su pareja, para el modo fantasma. El estado se dice además con la
      etiqueta y con `active`, no solo cambiando el dibujo: un ojo tachado y un
      ojo abierto se distinguen mal a veinte píxeles y de un vistazo. */
  EyeOff,
  Flame,
  Wind,
  TreePine,
  Sun,
  Phone,
  // Mapa y lugares
  MapPin,
  MapPinned,
  Droplets,
  Stethoscope,
  Trees,
  Layers,
  Locate,
  Navigation,
  Route,
  // Ficha médica y modo paseo
  QrCode,
  Syringe,
  Pill,
  HeartPulse,
  Cake,
  FileText,
  BellRing,
  // Acciones
  Hand,
  CalendarPlus,
  Bookmark,
  Plus,
  /** La papelera con bolsas que se puede aportar al mapa. */
  Trash2,
  /** El «−» del control de alejar del mapa. Va en pareja con `Plus`. */
  Minus,
  /** El cuadrado con el «+» de la cabecera del feed: publicar. */
  SquarePlus,
  Check,
  /** El desplegable de los pasos de rescate. */
  ChevronDown,
  ChevronUp,
  Undo2,
  SquarePen,
  Search,
  Zap,
  Footprints,
  /** El 👍/👎 del resumen de paseo. Van en pareja y nunca solos: la selección
      se marca además con borde y con la etiqueta accesible, porque verde y
      rojo es justo el par que no distingue una de cada doce personas. */
  ThumbsUp,
  ThumbsDown,
  /** El paseo fijo que se propone desde el historial. */
  Repeat,
  // Mensajería
  CheckCheck,
  Paperclip,
  Mic,
} from 'lucide-react-native';
