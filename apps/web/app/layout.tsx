import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Atkinson_Hyperlegible, Plus_Jakarta_Sans } from 'next/font/google';

import '@coincide/tokens/tokens.css';
import './globals.css';

import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Cuerpo: Atkinson Hyperlegible, diseñada para legibilidad en baja visión.
 * No es una elección estética. Esta aplicación se lee de pie, en la calle, a
 * contraluz y con una correa en la otra mano.
 */
const body = Atkinson_Hyperlegible({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

/**
 * Display: Plus Jakarta Sans, la familia que pide la especificación visual.
 * De las dos que nombra —Plus Jakarta Sans o Inter— se toma esta: Inter está en
 * la lista de bloqueantes del proyecto.
 */
const display = Plus_Jakarta_Sans({
  weight: ['600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: {
    default: 'Coincide — paseos que sí ocurren',
    template: '%s · Coincide',
  },
  description:
    'Encuentra perros compatibles con el tuyo, coincide con quien pasea a tu misma hora y organizad la salida. Funciona a las siete de la mañana y a las once de la noche.',
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'Coincide',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Fija el tema antes del primer pintado.
 *
 * Sin esto, quien tiene el tema oscuro elegido ve un destello claro en cada
 * carga. Es un script mínimo y envuelto en try/catch porque el almacenamiento
 * puede lanzar en ventanas privadas o con las cookies bloqueadas.
 */
const themeScript = `
try {
  var stored = localStorage.getItem('coincide-theme');
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.setAttribute('data-theme', stored);
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>

        <header className="site-header">
          <div className="shell site-header__inner">
            <Link className="brand" href="/">
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                <circle
                  cx="11"
                  cy="11"
                  r="4"
                  fill="none"
                  stroke="var(--co-primary)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="11"
                  cy="11"
                  r="9"
                  fill="none"
                  stroke="var(--co-live-ring)"
                  strokeWidth="1.5"
                  opacity="0.6"
                />
              </svg>
              <span className="brand__word">Coincide</span>
            </Link>

            <nav className="site-nav" aria-label="Principal">
              <Link className="site-nav__section" href="/#feed">
                Feed
              </Link>
              <Link href="/parques">Parques</Link>
              <Link className="site-nav__section" href="/#quedadas">
                Quedadas
              </Link>
              <Link className="site-nav__section" href="/#comunidad">
                Comunidad
              </Link>
              <Link className="site-nav__section" href="/#bienestar">
                Bienestar
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main id="contenido">{children}</main>

        <footer className="site-footer">
          <div className="shell stack">
            <p>
              Coincide es un MVP en construcción. Los datos que se muestran son una semilla de
              demostración, no usuarios reales.
            </p>
            <p>
              El horario de paseo de una persona es su rutina diaria: aquí solo se publica la
              coincidencia, nunca la agenda de nadie.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
