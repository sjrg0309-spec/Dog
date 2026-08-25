import { FlatCompat } from '@eslint/eslintrc';

/**
 * Configuración de ESLint de la web.
 *
 * `eslint-config-next` todavía se publica en el formato antiguo, así que se
 * traduce con `FlatCompat` en lugar de renunciar a él: las reglas que trae
 * —enlaces sin `next/link`, imágenes sin `next/image`, hooks mal usados— son
 * justo las que se escapan en una revisión humana.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  { ignores: ['.next/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  ...compat.extends('next/core-web-vitals'),
];
