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
  // Navegación
  Compass,
  Radar,
  CalendarDays,
  Fence,
  Users,
  // Estado
  BadgeCheck,
  TriangleAlert,
  CircleAlert,
  Ban,
  Thermometer,
  Timer,
  // Acciones
  Hand,
  CalendarPlus,
  Bookmark,
  Plus,
  Phone,
  MapPin,
  ChevronRight,
} from 'lucide-react-native';
