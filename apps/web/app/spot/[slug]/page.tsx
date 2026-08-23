import type { Metadata } from 'next';
import { Notice } from '@/components/notice';
import { notFound } from 'next/navigation';

import { formatCents, splitCost } from '@coincide/core';
import { spotBySlug } from '@/lib/db';
import { formatPrice, triState, triStateLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const spot = await spotBySlug(slug);
  if (!spot) return { title: 'Espacio no encontrado' };

  return {
    title: spot.title,
    description: spot.description ?? 'Espacio privado para perros en Coincide.',
  };
}

export default async function SpotPage({ params }: Params) {
  const { slug } = await params;
  const spot = await spotBySlug(slug);
  if (!spot) notFound();

  // El reparto se calcula con la misma función que usa la aplicación y que la
  // base de datos espeja, así que lo que se ve aquí es exactamente lo que se
  // cobrará: sin descuadres de céntimos entre pantallas.
  const splitExamples = [2, 3, 4, spot.max_pets]
    .filter((count, index, all) => count >= 2 && count <= spot.max_pets && all.indexOf(count) === index)
    .map((count) => ({
      count,
      share: splitCost(spot.price_per_slot_cents, count)[0] ?? 0,
    }));

  return (
    <div className="shell section">
      <article className="stack" style={{ gap: 'var(--co-space-8)' }}>
        <header className="stack">
          <div className="row">
            <span className="badge badge--accent">
              {formatPrice(spot.price_per_slot_cents, spot.slot_minutes)}
            </span>
            {spot.is_private_single_group ? (
              <span className="badge">Un grupo cada vez</span>
            ) : null}
          </div>
          <h1>{spot.title}</h1>
          {spot.description ? <p className="lede">{spot.description}</p> : null}
        </header>

        <dl className="facts">
          <div>
            <dt>Aforo</dt>
            <dd>Hasta {spot.max_pets} animales</dd>
          </div>
          <div>
            <dt>Superficie</dt>
            <dd>{spot.size_m2 ? `${spot.size_m2.toLocaleString('es-ES')} m²` : 'Sin especificar'}</dd>
          </div>
          <div>
            <dt>Valla</dt>
            <dd>{spot.fence_height_cm ? `${spot.fence_height_cm} cm` : 'Sin especificar'}</dd>
          </div>
          <div>
            <dt>Anfitrión</dt>
            <dd>{spot.host_name ?? 'Un tutor de Coincide'}</dd>
          </div>
        </dl>

        {/* ---------------------------------------------------------------- */}
        <section className="stack">
          <h2>Reservar en grupo</h2>
          <p className="card__meta">
            Aquí está la diferencia con alquilar un espacio a título individual: Coincide conoce el
            temperamento de cada perro, así que propone el grupo que mejor encaja y reparte el
            importe. Lo que decide si un grupo funciona es su pareja más floja, no su promedio.
          </p>

          <div className="scroll-x">
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 'var(--co-font-size-sm)',
              }}
            >
              <caption className="visually-hidden">
                Coste por perro según cuántos compartan la reserva
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    style={{
                      textAlign: 'left',
                      padding: 'var(--co-space-2)',
                      borderBottom: '1px solid var(--co-border-strong)',
                    }}
                  >
                    Perros
                  </th>
                  <th
                    scope="col"
                    style={{
                      textAlign: 'right',
                      padding: 'var(--co-space-2)',
                      borderBottom: '1px solid var(--co-border-strong)',
                    }}
                  >
                    Por perro
                  </th>
                </tr>
              </thead>
              <tbody>
                {splitExamples.map((example) => (
                  <tr key={example.count}>
                    <th
                      scope="row"
                      style={{
                        textAlign: 'left',
                        padding: 'var(--co-space-2)',
                        borderBottom: '1px solid var(--co-border)',
                        fontWeight: 'var(--co-font-weight-medium)',
                      }}
                    >
                      {example.count}
                    </th>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: 'var(--co-space-2)',
                        borderBottom: '1px solid var(--co-border)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatCents(example.share)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="card__meta">
            El reparto se hace en céntimos enteros: cuando el importe no divide exacto, alguien paga
            un céntimo más y la suma cuadra con el total. Nunca falta ni sobra dinero.
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="stack">
          <h2>El espacio</h2>
          <ul className="checklist">
            <li data-state={triState(spot.is_fenced)}>{triStateLabel(spot.is_fenced, 'Vallado')}</li>
            <li data-state={triState(spot.has_water)}>
              {triStateLabel(spot.has_water, 'Agua disponible')}
            </li>
            <li data-state={triState(spot.has_shade)}>{triStateLabel(spot.has_shade, 'Sombra')}</li>
            <li data-state={triState(spot.is_private_single_group)}>
              {triStateLabel(spot.is_private_single_group, 'Uso exclusivo por grupo')}
            </li>
          </ul>

          {spot.rules ? (
            <>
              <h3>Normas del anfitrión</h3>
              <p className="card__meta">{spot.rules}</p>
            </>
          ) : null}

          {spot.cancellation_policy ? (
            <>
              <h3>Cancelación</h3>
              <p className="card__meta">{spot.cancellation_policy}</p>
            </>
          ) : null}
        </section>

        {/* ---------------------------------------------------------------- */}
        <Notice tone="warning">
          <p>
            <strong>La dirección exacta se envía al confirmar la reserva.</strong> Antes solo se
            muestra la zona: es la propiedad privada de alguien, y publicarla a cualquiera que abra
            la página no sería aceptable por muy cómodo que resultara. El pago, en esta fase, se
            acuerda directamente con el anfitrión.
          </p>
        </Notice>
      </article>
    </div>
  );
}
