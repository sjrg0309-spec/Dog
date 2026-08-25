/**
 * Tokens de componente — nivel 3 de 3.
 *
 * Referencian tokens semánticos por nombre (como `var(--co-*)` en web) para que
 * un cambio de tema los arrastre sin tocar nada aquí.
 */

import { duration, easing, fontSize, fontWeight, radius, space, touchTarget } from './primitives.js';

/** Referencia a una variable CSS semántica. */
const v = (name: string) => `var(--co-${name})`;

export const button = {
  radius: radius.md,
  fontWeight: fontWeight.semibold,
  transition: `background-color ${duration.fast} ${easing.standard}, border-color ${duration.fast} ${easing.standard}, color ${duration.fast} ${easing.standard}`,

  size: {
    sm: { height: '36px', paddingInline: space[3], fontSize: fontSize.sm, gap: space[1.5] },
    /** El tamaño por defecto respeta el área táctil mínima de 44 px. */
    md: {
      height: touchTarget.min,
      paddingInline: space[4],
      fontSize: fontSize.base,
      gap: space[2],
    },
    lg: {
      height: touchTarget.comfortable,
      paddingInline: space[6],
      fontSize: fontSize.lg,
      gap: space[2],
    },
  },

  variant: {
    primary: { bg: v('primary'), fg: v('primary-foreground'), border: 'transparent' },
    secondary: { bg: v('secondary'), fg: v('secondary-foreground'), border: 'transparent' },
    outline: { bg: 'transparent', fg: v('foreground'), border: v('border-strong') },
    ghost: { bg: 'transparent', fg: v('foreground'), border: 'transparent' },
    destructive: { bg: v('destructive'), fg: v('destructive-foreground'), border: 'transparent' },
    link: { bg: 'transparent', fg: v('primary'), border: 'transparent' },
  },

  disabledOpacity: '0.5',
} as const;

export const card = {
  radius: radius.lg,
  padding: space[5],
  gap: space[3],
  background: v('surface'),
  border: v('border'),
} as const;

export const input = {
  radius: radius.sm,
  height: touchTarget.min,
  paddingInline: space[3],
  fontSize: fontSize.base,
  background: v('input'),
  foreground: v('input-foreground'),
  border: v('border-strong'),
  placeholder: v('input-placeholder'),
} as const;

export const dialog = {
  radius: radius.xl,
  padding: space[6],
  maxWidth: '32rem',
  overlay: v('overlay'),
} as const;

export const badge = {
  radius: radius.full,
  paddingInline: space[2],
  height: '22px',
  fontSize: fontSize.xs,
  fontWeight: fontWeight.semibold,
} as const;

export const focusRing = {
  width: '2px',
  offset: '2px',
  color: v('focus-ring'),
  /** Solo `:focus-visible`. Nunca se suprime el foco sin sustituirlo. */
  style: `0 0 0 2px ${v('background')}, 0 0 0 4px ${v('focus-ring')}`,
} as const;

/**
 * El anillo del radar: el elemento distintivo del producto.
 *
 * Es el único elemento con movimiento continuo en toda la interfaz, y por eso
 * significa "en vivo". Bajo `prefers-reduced-motion` el pulso desaparece y deja
 * un anillo estático de doble grosor, que comunica lo mismo sin movimiento.
 */
export const radarRing = {
  color: v('live-ring'),
  surface: v('live-surface'),
  strokeWidth: '2px',
  strokeWidthStatic: '4px',
  pulseDuration: duration.pulse,
  pulseEasing: easing.standard,
  minScale: '1',
  maxScale: '2.4',
} as const;

export const affinityBands = {
  great: { min: 80, token: 'success', label: 'Gran match' },
  good: { min: 60, token: 'primary', label: 'Buen match' },
  supervised: { min: 40, token: 'warning', label: 'Con supervisión' },
  hidden: { min: 0, token: 'muted-foreground', label: 'No compatible' },
} as const;
