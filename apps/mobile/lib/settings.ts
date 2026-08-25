/**
 * Los ajustes que de verdad hacen algo.
 *
 * La regla de este módulo es la que decide si una pantalla de configuración
 * sirve o es decorado: **aquí solo entra lo que cambia el comportamiento de la
 * aplicación**. Un interruptor que no está conectado a nada es peor que no
 * tenerlo, porque alguien lo apaga y se queda tranquilo. Eso ya se razonó para
 * el modo fantasma —«un interruptor de privacidad que solo te esconde de tu
 * propia pantalla enseña a confiar en él»— y aquí vale igual para los cuatro.
 *
 * Lo que **no** vive aquí, a propósito:
 *
 *  - **El modo fantasma.** Es un ajuste de pleno derecho y sale en la pantalla,
 *    pero su estado sigue viviendo en `lib/presence`, que es quien lo apaga de
 *    verdad. Copiarlo aquí serían dos fuentes para el mismo interruptor, y de
 *    ahí a que la pantalla diga «apagado» mientras el radar publica presencia
 *    hay un despiste.
 *  - **El acento de color.** No es una preferencia: se deduce de qué mascota
 *    está activa. Ponerlo en ajustes lo convertiría en dos cosas que se
 *    contradicen.
 */

import { useSyncExternalStore } from 'react';

import { NEARBY_RADII_M, type NearbyRadius } from './posts';

/** Claro, oscuro, o lo que diga el teléfono. */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** El movimiento se puede reducir desde aquí; nunca forzar. Ver `lib/motion`. */
export type MotionChoice = 'system' | 'reduced';

export type Settings = {
  theme: ThemeChoice;
  motion: MotionChoice;
  /**
   * Recibir los avisos de rescate con el alcance de quien se desplaza.
   *
   * No es «más notificaciones»: son dos usos distintos del mismo hecho. Un
   * tutor decide por dónde pasear —le sirve lo que tiene a mano—; una
   * rescatista coge el coche, así que se entera desde mucho más lejos y también
   * de lo que no es un peligro para su propio paseo, como un animal atado sin
   * agua en un patio ajeno. El catálogo lleva los dos radios desde el principio
   * (`alertReachM`); lo que faltaba era decir cuál eres.
   */
  rescuer: boolean;
  /** Cuánto barrio entra en el feed de vecindario. */
  feedRadiusM: NearbyRadius;
};

const DEFAULTS: Settings = {
  theme: 'system',
  motion: 'system',
  /* Apagado por defecto, y no por prudencia: encender esto a todo el mundo
     llenaría el teléfono de un tutor de avisos a cinco kilómetros, y un aviso
     que no te toca enseña a silenciar los que sí. */
  rescuer: false,
  feedRadiusM: NEARBY_RADII_M[0],
};

let settings: Settings = DEFAULTS;
const listeners = new Set<() => void>();

/**
 * Escuchar cambios.
 *
 * Se exporta —el resto de almacenes de la aplicación lo guardan para sí— porque
 * los tests de esta pantalla comprueban **cuándo no se avisa**, y eso no se
 * puede mirar desde fuera sin poder escuchar.
 */
export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): Settings => settings;

/** Leerlos fuera de un componente. Lo usan los tests y nadie más lo necesita. */
export function readSettings(): Settings {
  return settings;
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, snapshot, snapshot);
}

/**
 * Cambiar un ajuste.
 *
 * Se sale sin avisar si el valor ya era ese: sin eso, tocar el mismo botón dos
 * veces repinta la aplicación entera para dejarla igual.
 */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  if (settings[key] === value) return;
  settings = { ...settings, [key]: value };
  for (const listener of listeners) listener();
}

/** Volver a lo de fábrica. Lo usan los tests para no heredarse entre sí. */
export function resetSettings(): void {
  settings = DEFAULTS;
  for (const listener of listeners) listener();
}

/**
 * El fondo, dentro de la dirección.
 *
 * Sigue existiendo porque una dirección no elige por ti si son las siete de la
 * mañana o las once de la noche. Lo que ya no hace es elegir la identidad: eso
 * es la dirección, y vive en `lib/direcciones`.
 */
export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: 'El del teléfono',
  light: 'Claro',
  dark: 'Oscuro',
};

/**
 * El índice de la pantalla de ajustes, como dato.
 *
 * Está aquí y no dentro de la pantalla por dos motivos, y el segundo es el que
 * importa:
 *
 *  1. El buscador necesita una lista sobre la que buscar, y buscar sobre
 *     componentes ya dibujados es rebuscar en el DOM.
 *  2. **Se puede comprobar.** Con esto escrito como dato, un test afirma que
 *     cada fila o cambia un ajuste de verdad, o lleva a una ruta que existe, o
 *     está declarada como «todavía no hay» con su motivo. Eso es lo único que
 *     impide que una pantalla de configuración se llene de interruptores
 *     bonitos: no la disciplina de quien la escriba, sino que la suite se ponga
 *     roja al añadir uno que no hace nada.
 */
export type SettingKind = 'switch' | 'choice' | 'link' | 'missing';

export type SettingRow = {
  id: string;
  label: string;
  hint: string;
  /**
   * Por lo que alguien lo buscaría y no está en el rótulo.
   *
   * «Vacunas» tiene que llevar a la ficha médica, y nadie escribe «ficha
   * médica» cuando lo que quiere ver es si toca la antirrábica.
   */
  keywords: readonly string[];
  kind: SettingKind;
  /** Solo en `link`: a dónde va. El test comprueba que la ruta existe. */
  href?: string;
  /** Solo en `missing`: por qué no está. Sin excusa no entra en la lista. */
  why?: string;
  /**
   * Para qué tipo de cuenta tiene sentido esta fila.
   *
   * Una protectora no tiene chip que verificar y un tutor no tiene revisión de
   * perfil pendiente. Enseñar la fila del otro sería enseñar un ajuste que no
   * se puede tocar, que es la versión educada del interruptor decorativo.
   */
  only?: 'tutor' | 'rescuer';
};

export type SettingGroup = {
  id: string;
  title: string;
  note?: string;
  rows: readonly SettingRow[];
};

export const SETTINGS: readonly SettingGroup[] = [
  {
    id: 'look',
    title: 'Aspecto',
    note: 'Una dirección es paleta, tipografía y forma a la vez. Se cambian juntas o no se cambian.',
    rows: [
      {
        id: 'direccion',
        label: 'Dirección visual',
        hint: 'Nocturno, Papel o Señal',
        keywords: [
          'tema', 'aspecto', 'estilo', 'diseño', 'color', 'paleta', 'tipografía',
          'letra', 'nocturno', 'papel', 'señal', 'instagram',
        ],
        kind: 'choice',
      },
    ],
  },
  {
    id: 'visibility',
    title: 'Privacidad',
    rows: [
      {
        id: 'blocked',
        label: 'Bloqueados',
        hint: 'Quién no te ve y a quién no ves',
        keywords: ['bloqueo', 'bloquear', 'denunciar', 'reportar', 'acoso', 'seguridad'],
        kind: 'link',
        href: '/bloqueados',
      },
      {
        id: 'ghost',
        label: 'Modo fantasma',
        hint: 'Desapareces del mapa',
        keywords: ['invisible', 'esconder', 'privacidad', 'mapa', 'ubicación'],
        kind: 'switch',
      },
      {
        id: 'rescuer',
        label: 'Soy rescatista',
        hint: 'Recibes avisos de más lejos',
        keywords: ['rescate', 'protectora', 'voluntaria', 'maltrato', 'avisos'],
        kind: 'switch',
        only: 'tutor',
      },
    ],
  },
  {
    id: 'trust',
    title: 'Tu cuenta',
    note: 'Los sitios se ven siempre. Para ver a otras personas, verifica el chip.',
    rows: [
      {
        id: 'chip',
        label: 'Chip verificado',
        hint: 'Ver quién pasea, los horarios y escribir primero',
        keywords: ['microchip', 'verificar', 'cartilla', 'tutor verificado', 'identidad'],
        kind: 'switch',
        only: 'tutor',
      },
      {
        id: 'shelter',
        label: 'Cuenta revisada',
        hint: 'Recibir avisos de rescate',
        keywords: ['protectora', 'albergue', 'perfil', 'revisión', 'aprobar'],
        kind: 'switch',
        only: 'rescuer',
      },
    ],
  },
  {
    id: 'display',
    title: 'Preferencias',
    rows: [
      {
        id: 'feedRadius',
        label: 'Distancia del feed',
        hint: 'Cuánto barrio ves en «cerca de mí»',
        keywords: ['distancia', 'kilómetros', 'feed', 'cerca'],
        kind: 'choice',
      },
      {
        id: 'theme',
        label: 'Tema',
        hint: 'Claro, oscuro o el del sistema',
        keywords: ['oscuro', 'claro', 'noche', 'color', 'apariencia'],
        kind: 'choice',
      },
      {
        id: 'motion',
        label: 'Reducir movimiento',
        hint: 'Menos animaciones',
        keywords: ['animación', 'accesibilidad', 'mareo', 'pulso'],
        kind: 'choice',
      },
    ],
  },
  {
    id: 'handler',
    title: 'Sobre ti',
    note: 'Privado. No aparece en tu perfil ni lo ve nadie.',
    rows: [
      {
        id: 'needs',
        label: 'Ajustes personales',
        hint: 'Sitios tranquilos, quedar con antelación, menos movimiento',
        keywords: [
          'autismo', 'autista', 'tea', 'accesibilidad', 'sensorial', 'ansiedad',
          'ruido', 'tranquilo', 'planes', 'antelación',
        ],
        kind: 'link',
        href: '/acomodos',
      },
    ],
  },
  {
    id: 'private',
    title: 'Tu contenido',
    note: 'Solo lo ves tú.',
    rows: [
      {
        id: 'walks',
        label: 'Historial de paseos',
        hint: 'Tus salidas y tu ritmo semanal',
        keywords: ['paseos', 'rutina', 'estadísticas', 'ritmo'],
        kind: 'link',
        href: '/historial',
      },
      {
        id: 'record',
        label: 'Ficha médica',
        hint: 'Vacunas y desparasitación',
        keywords: ['vacunas', 'antirrábica', 'veterinario', 'desparasitación', 'salud'],
        kind: 'link',
        href: '/perfil?tab=record',
      },
      {
        id: 'saved',
        label: 'Guardados',
        hint: 'Solo tú los ves',
        keywords: ['favoritos', 'marcadores', 'publicaciones'],
        kind: 'link',
        href: '/perfil?tab=saved',
      },
      {
        id: 'walkmode',
        label: 'Modo Paseo',
        hint: 'Código por si se pierde',
        keywords: ['qr', 'código', 'perdido', 'chip', 'emergencia', 'teléfono'],
        kind: 'link',
        href: '/perfil?modo=paseo',
      },
      {
        id: 'activity',
        label: 'Tu actividad',
        hint: 'Reacciones y avisos',
        keywords: ['notificaciones', 'novedades', 'avisos'],
        kind: 'link',
        href: '/actividad',
      },
    ],
  },
  {
    id: 'missing',
    title: 'Todavía no disponible',
    note: 'Preferimos decirlo antes que poner un botón que no hace nada.',
    rows: [
      {
        id: 'account',
        label: 'Cambiar la contraseña',
        hint: 'Falta el servidor',
        keywords: ['correo', 'contraseña', 'sesión', 'cerrar sesión', 'borrar cuenta'],
        kind: 'missing',
        why: 'No guardamos contraseñas, así que no hay ninguna que cambiar. Cambiarla, cerrar sesión o borrar la cuenta necesitan servidor.',
      },
      {
        id: 'push',
        label: 'Notificaciones',
        hint: 'Por ahora, solo dentro de la app',
        keywords: ['push', 'sonido', 'silenciar', 'alertas'],
        kind: 'missing',
        why: 'El reparto de avisos está construido y probado, pero enviarlos al teléfono necesita credenciales que este entorno no tiene.',
      },
      {
        id: 'export',
        label: 'Descargar tus datos',
        hint: 'Falta el servidor',
        keywords: ['exportar', 'datos', 'copia', 'rgpd'],
        kind: 'missing',
        why: 'Ahora los datos viven en el teléfono y se borran al cerrar. Cuando estén en el servidor podrás descargarlos.',
      },
    ],
  },
];

/** Sin tildes y en minúsculas: quien busca «medica» quiere la ficha médica. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Filtrar los ajustes por lo escrito, **conservando los grupos**.
 *
 * Devolver una lista plana sería más fácil y perdería lo único que da sentido a
 * un resultado: «Soy rescatista» debajo de «Quién te ve» se entiende, y suelta
 * en una lista parece otra casilla más.
 */
export function searchSettings(query: string, kind: 'tutor' | 'rescuer' = 'tutor'): SettingGroup[] {
  const needle = fold(query.trim());

  return SETTINGS.map((group) => ({
    ...group,
    rows: group.rows
      .filter((row) => row.only === undefined || row.only === kind)
      .filter(
        (row) =>
          needle === '' ||
          fold([row.label, row.hint, ...row.keywords].join(' ')).includes(needle),
      ),
  })).filter((group) => group.rows.length > 0);
}
