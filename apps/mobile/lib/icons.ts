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
  /** El cuadrado con el «+» de la cabecera del feed: publicar. */
  SquarePlus,
  Check,
  Undo2,
  SquarePen,
  Search,
  Zap,
  Footprints,
  // Mensajería
  CheckCheck,
  Paperclip,
  Mic,
} from 'lucide-react-native';
