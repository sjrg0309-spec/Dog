'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'coincide-theme';

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'Automático', icon: Monitor },
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
];

/**
 * Selector de tema.
 *
 * Antes era un botón que rotaba entre tres estados. Funcionaba, pero obligaba a
 * pulsar y ver qué salía: para llegar a «oscuro» desde «automático» había que
 * adivinar cuántas veces tocar, y quien usa lector de pantalla oía el estado
 * después del cambio, nunca antes. Ahora las tres opciones están a la vez y se
 * elige la que se quiere.
 *
 * El menú es de Radix y no propio a propósito. Un desplegable correcto necesita
 * foco atrapado mientras está abierto, cierre con Escape, navegación con
 * flechas, devolución del foco al disparador al cerrar y `aria-expanded`
 * coherente. Escribir todo eso a mano es la clase de cosa que parece hecha hasta
 * que alguien lo prueba con el teclado.
 *
 * `system` es el valor por defecto y **quita** el atributo del documento, así que
 * manda `prefers-color-scheme`. Elegir claro u oscuro lo estampa y gana sobre el
 * sistema en las dos direcciones.
 *
 * Cada lectura y escritura va en try/catch: el almacenamiento lanza en ventanas
 * privadas o con las cookies de sitio bloqueadas, y perder el tema nunca debe
 * romper la página.
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
      // Sin almacenamiento se sigue con "automático", que es un buen valor por
      // defecto de todas formas.
    }
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);

    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // El tema sigue aplicado en esta sesión aunque no se pueda recordar.
    }
  }

  const current = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[0]!;
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="button button--ghost"
          // Antes de hidratar no se sabe el tema guardado; se anuncia sin valor
          // en vez de mentir con uno que va a cambiar.
          aria-label={mounted ? `Tema: ${current.label}. Cambiar` : 'Cambiar tema'}
        >
          <CurrentIcon size={17} strokeWidth={2} aria-hidden="true" />
          <span className="theme-toggle__label">{mounted ? current.label : 'Tema'}</span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu" sideOffset={6} align="end">
          <DropdownMenu.RadioGroup value={theme} onValueChange={(value) => apply(value as Theme)}>
            {OPTIONS.map((option) => {
              const OptionIcon = option.icon;
              return (
                <DropdownMenu.RadioItem
                  key={option.value}
                  value={option.value}
                  className="menu__item"
                >
                  <OptionIcon size={16} strokeWidth={2} aria-hidden="true" />
                  <span>{option.label}</span>
                  {/* La marca de selección va además del resaltado: el estado no
                      se comunica solo con un fondo de color. */}
                  <DropdownMenu.ItemIndicator className="menu__check">
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
