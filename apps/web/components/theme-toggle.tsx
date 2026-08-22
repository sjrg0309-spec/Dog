'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'doggymeet-theme';

const LABEL: Record<Theme, string> = {
  light: 'Claro',
  dark: 'Oscuro',
  system: 'Sistema',
};

const NEXT: Record<Theme, Theme> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

/**
 * Conmutador de tema con tres estados.
 *
 * "Sistema" es el valor por defecto y quita el atributo del documento, de modo
 * que manda `prefers-color-scheme`. Elegir claro u oscuro estampa el atributo y
 * gana sobre el sistema en ambas direcciones.
 *
 * Cada lectura y escritura va en try/catch: el almacenamiento puede lanzar en
 * ventanas privadas o con las cookies de sitio bloqueadas, y perder el tema
 * nunca debe romper la página.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    } catch {
      // Sin almacenamiento se sigue con "sistema", que es un buen valor por
      // defecto de todas formas.
    }
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', next);
    }
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // El tema sigue aplicado en esta sesión aunque no se pueda recordar.
    }
  }

  return (
    <button
      type="button"
      className="button button--ghost"
      onClick={() => apply(NEXT[theme])}
      // Antes de hidratar no se sabe el tema guardado; se anuncia como
      // indeterminado en vez de mentir con un valor que puede cambiar.
      aria-label={mounted ? `Tema: ${LABEL[theme]}. Cambiar a ${LABEL[NEXT[theme]]}` : 'Cambiar tema'}
    >
      <span aria-hidden="true">
        {theme === 'dark' ? '◐' : theme === 'light' ? '○' : '◑'}
      </span>
      <span className="theme-toggle__label">{mounted ? LABEL[theme] : 'Tema'}</span>
    </button>
  );
}
