import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { playdateAttendees, playdateBySlug } from '@/lib/db';
import {
  ENERGY_LABEL,
  KIND_LABEL,
  PLAY_STYLE_LABEL,
  SIZE_LABEL,
  formatRelative,
  formatWhen,
  triState,
  triStateLabel,
} from '@/lib/format';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

/**
 * La página pública de una quedada.
 *
 * Es la razón de que esta web exista. Cuando alguien organiza un paseo, pega
 * este enlace en el grupo del barrio, y quien lo abre tiene que poder verlo
 * todo sin instalar nada ni crear una cuenta. Una app que obliga a registrarse
 * para leer una invitación no se propaga.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const playdate = await playdateBySlug(slug);
  if (!playdate) return { title: 'Quedada no encontrada' };

  return {
    title: playdate.title,
    description:
      playdate.description ??
      `Quedada canina en ${playdate.place_name ?? 'Madrid'}. Únete con tu animal.`,
    openGraph: {
      title: playdate.title,
      description: playdate.description ?? undefined,
      type: 'article',
    },
  };
}

export default async function PlaydatePage({ params }: Params) {
  const { slug } = await params;
  const playdate = await playdateBySlug(slug);
  if (!playdate) notFound();

  const attendees = await playdateAttendees(playdate.id);
  const starts = new Date(playdate.starts_at);
  const ends = new Date(playdate.ends_at);
  const isOver = ends.getTime() < Date.now();

  return (
    <div className="shell section">
      <article className="stack" style={{ gap: 'var(--co-space-8)' }}>
        <header className="stack">
          <div className="row">
            <span className="badge badge--accent">{playdate.species_name}</span>
            <span className="badge">{KIND_LABEL[playdate.kind] ?? playdate.kind}</span>
            {isOver ? (
              <span className="badge">Ya ha terminado</span>
            ) : (
              <span className="badge badge--live">{formatRelative(starts)}</span>
            )}
          </div>

          <h1>{playdate.title}</h1>
          {playdate.description ? <p className="lede">{playdate.description}</p> : null}
        </header>

        <dl className="facts">
          <div>
            <dt>Cuándo</dt>
            <dd>{formatWhen(starts, ends)}</dd>
          </div>
          <div>
            <dt>Dónde</dt>
            <dd>{playdate.place_name ?? 'Punto acordado en el mapa'}</dd>
          </div>
          <div>
            <dt>Organiza</dt>
            <dd>{playdate.host_name ?? 'Un tutor de Coincide'}</dd>
          </div>
          <div>
            <dt>Contacto seguido</dt>
            <dd>{playdate.session_minutes} min</dd>
          </div>
          <div>
            <dt>Aforo</dt>
            <dd>
              {playdate.attendee_count}
              {playdate.max_pets ? ` de ${playdate.max_pets}` : ''} animales
            </dd>
          </div>
        </dl>

        {/* ---------------------------------------------------------------- */}
        <section className="stack">
          <h2>Quién puede venir</h2>
          <p className="card__meta">
            Esta quedada es solo de {playdate.species_name.toLowerCase()}. Los encuentros son
            siempre entre animales de la misma especie, y los parámetros de admisión evitan además
            que uno de treinta kilos acabe jugando con un juvenil de cuatro.
          </p>

          <div className="row">
            {playdate.admits_sizes.length > 0 ? (
              playdate.admits_sizes.map((size) => (
                <span className="badge badge--accent" key={size}>
                  {SIZE_LABEL[size] ?? size}
                </span>
              ))
            ) : (
              <span className="badge">Cualquier tamaño</span>
            )}
            {playdate.admits_energy.map((energy) => (
              <span className="badge" key={energy}>
                {ENERGY_LABEL[energy] ?? energy}
              </span>
            ))}
            <span className="badge">{playdate.leashed ? 'Con correa' : 'Suelto'}</span>
          </div>

          {playdate.leashed ? (
            <p className="card__meta">
              Es un paseo con correa, así que también pueden venir animales reactivos con correa
              siempre que su tutor lo tenga en cuenta.
            </p>
          ) : null}
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="stack">
          <h2>Cuánto dura de verdad</h2>
          <p className="card__meta">
            El encuentro son <strong>{playdate.session_minutes} min de contacto seguidos</strong>, y
            luego descanso. No es la duración del evento: es lo que aguanta un{' '}
            {playdate.species_name.toLowerCase()} de una vez, y el máximo para esta especie son{' '}
            {playdate.species_max_session_minutes} min.
          </p>
          <p className="card__meta">
            Una tarde puede durar dos horas y estar bien hecha si son sesiones cortas con pausa
            entre medias. Lo que no se puede es soltarlos dos horas y llamarlo lo mismo. Coincide no
            deja crear una quedada que se pase de ese límite, y no es una comprobación del
            formulario: la rechaza la base de datos.
          </p>
        </section>

        {playdate.health_for_meetups.length > 0 ? (
          <section className="stack">
            <h2>Antes de venir</h2>
            <p className="card__meta">
              Un encuentro entre animales de casas distintas es también una vía de contagio. Lo que
              conviene tener al día para esta especie:
            </p>
            <ul className="checklist">
              {playdate.health_for_meetups.map((requirement) => (
                <li data-state="yes" key={requirement}>
                  {requirement}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        {playdate.place_name ? (
          <section className="stack">
            <h2>El sitio</h2>
            <ul className="checklist">
              <li data-state={triState(playdate.place_is_fenced)}>
                {triStateLabel(playdate.place_is_fenced, 'Vallado')}
              </li>
              <li data-state={triState(playdate.place_has_water)}>
                {triStateLabel(playdate.place_has_water, 'Fuente de agua')}
              </li>
              <li data-state={triState(playdate.place_has_shade)}>
                {triStateLabel(playdate.place_has_shade, 'Sombra')}
              </li>
            </ul>
          </section>
        ) : null}

        {/* ---------------------------------------------------------------- */}
        <section className="stack">
          <h2>Animales apuntados</h2>

          {attendees.length === 0 ? (
            <div className="notice">
              <span aria-hidden="true">○</span>
              <p>
                <strong>Todavía no se ha apuntado nadie.</strong> Alguien tiene que ser el primero
                para que el resto se anime.
              </p>
            </div>
          ) : (
            <div className="grid">
              {attendees.map((dog) => (
                <article className="card" key={dog.id}>
                  <div className="row">
                    <h3 className="card__title">{dog.name}</h3>
                    {dog.is_microchip_verified ? (
                      <span className="badge badge--verified">
                        <span aria-hidden="true">✓</span> Chip verificado
                      </span>
                    ) : null}
                  </div>

                  <p className="card__meta">
                    {dog.breeds.join(', ') || dog.species_name}
                    {dog.age_months !== null
                      ? ` · ${Math.floor(dog.age_months / 12)} años`
                      : ''}
                    {dog.size ? ` · ${SIZE_LABEL[dog.size] ?? dog.size}` : ''}
                  </p>

                  <div className="row">
                    {dog.energy_level ? (
                      <span className="badge">{ENERGY_LABEL[dog.energy_level]}</span>
                    ) : null}
                    {dog.play_styles.map((style) => (
                      <span className="badge" key={style}>
                        {PLAY_STYLE_LABEL[style] ?? style}
                      </span>
                    ))}
                  </div>

                  {/* El techo, no el motivo. Que este animal aguante menos es
                      información que el grupo necesita para organizarse; por qué
                      aguanta menos es un dato de salud y se queda en su ficha. */}
                  {dog.session_ceiling_minutes < playdate.species_max_session_minutes ? (
                    <p className="card__meta">
                      Aguanta {dog.session_ceiling_minutes} min seguidos, menos que la media de su
                      especie. El grupo se organiza por él.
                    </p>
                  ) : null}

                  {dog.bio ? <p className="card__meta">{dog.bio}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        <section className="stack">
          <h2>Apuntarse</h2>
          <p className="card__meta">
            Para unirte hace falta la aplicación: es donde vive la ficha de tu animal y donde se
            calcula si encaja con el grupo. Esta página existe para que puedas ver el plan y
            decidir antes de instalar nada.
          </p>
          <div className="row">
            <button className="button button--primary" type="button" disabled>
              Abrir en Coincide
            </button>
            <Link className="button button--outline" href="/">
              Ver otras quedadas
            </Link>
          </div>
          <p className="card__meta">
            La aplicación móvil está en desarrollo, así que ese botón todavía no lleva a ninguna
            parte.
          </p>
        </section>
      </article>
    </div>
  );
}
