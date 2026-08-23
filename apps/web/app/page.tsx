import { WELFARE_DISCLAIMER } from '@coincide/core';
import { Notice } from '@/components/notice';

import { RadarRing } from '@/components/radar-ring';
import { activeSpots, communitiesNear, recentPosts, servicesNear, upcomingPlaydates } from '@/lib/db';
import {
  ENERGY_LABEL,
  SIZE_LABEL,
  SERVICE_KIND_LABEL,
  formatPrice,
  formatRelative,
  formatWhen,
} from '@/lib/format';

// Los datos cambian con cada check-in, así que no tiene sentido servir una
// versión estática de esta página.
export const dynamic = 'force-dynamic';

const ENGINES = [
  {
    eyebrow: 'Ahora mismo',
    title: 'Radar, solo en zonas pet-friendly',
    body: 'El radar únicamente se enciende dentro de un parque, un área canina o una terraza que admite perros. Desde casa no se puede: lo que se comparte es el lugar, y tu portal no es un sitio al que nadie pueda ir. Y caduca solo, así que nadie se queda visible por olvido.',
  },
  {
    eyebrow: 'A cualquier hora',
    title: 'Coincidencia de horarios',
    body: 'Dices cuándo sales y con quién coincides aparece solo, sin que ninguno de los dos tenga que estar conectado. Es lo que hace que esto sirva a las once de la noche, que es cuando más solo se pasea.',
  },
  {
    eyebrow: 'Lo que no es una quedada',
    title: 'Comunidad y servicios',
    body: 'Quién cuida en agosto, qué parque está abierto, y qué veterinario coge el teléfono un domingo. Un tutor necesita esto tanto como un paseo, y no deja de necesitarlo los días que no sale.',
  },
  {
    eyebrow: 'Y por encima de los tres',
    title: 'El interés del animal',
    body: 'Un bulldog a 25 grados no sale, aunque tenga un match del 100 % a dos calles. La aplicación no lo avisa en gris debajo de la lista: quita la lista.',
  },
];

export default async function HomePage() {
  const [playdates, spots, communities, services, posts] = await Promise.all([
    upcomingPlaydates(3),
    activeSpots(2),
    communitiesNear(),
    servicesNear(),
    recentPosts(3),
  ]);

  const emergency = services.filter((entry) => entry.is_24h);

  return (
    <div className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Red social de paseos</p>
          <h1 className="hero__title">
            Que tu perro salga <em>con alguien</em>.
          </h1>
          <p className="lede">
            Coincide empareja perros por carácter, tamaño y forma de jugar, y cruza vuestros
            horarios de paseo. Y cuando al tuyo no le conviene salir —porque aprieta el calor,
            porque le falta pauta, porque ya salió hace un rato—, lo dice y deja de proponerlo.
          </p>

          <div className="row" style={{ marginTop: 'var(--co-space-6)' }}>
            <a className="button button--primary" href="#quedadas">
              Ver quedadas cerca
            </a>
            <a className="button button--outline" href="#bienestar">
              Cómo decide por tu perro
            </a>
          </div>

          <p
            className="card__meta"
            style={{ marginTop: 'var(--co-space-5)', maxWidth: 'var(--co-measure-narrow)' }}
          >
            {playdates.length > 0
              ? `Próxima quedada ${formatRelative(new Date(playdates[0]!.starts_at))}.`
              : 'Aún no hay quedadas programadas.'}
          </p>
        </div>

        <RadarRing label="Anillo de radar: perros compatibles cerca ahora mismo" />
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="como-funciona">
        <div className="section__head">
          <p className="eyebrow">Tres motores y un límite</p>
          <h2>Uno para cada momento, uno para quien no queda, y uno que dice que no</h2>
          <p className="lede">
            Un radar sin gente es una pantalla vacía. Por eso el motor central no es quién está
            fuera ahora, sino con quién coincides siempre. Y por encima de los tres hay un límite
            que no negocia: si el plan no le conviene al animal, no se propone.
          </p>
        </div>

        <div className="grid">
          {ENGINES.map((engine) => (
            <article className="card card--feature" key={engine.title}>
              <p className="eyebrow">{engine.eyebrow}</p>
              <h3 className="card__title">{engine.title}</h3>
              <p className="card__meta">{engine.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="feed">
        <div className="section__head">
          <p className="eyebrow">El feed</p>
          <h2>Fotos de perros que puedes identificar</h2>
          <p className="lede">
            Lo que distingue esto de una red social cualquiera: el perro de la foto está en el
            catálogo, así que la aplicación puede decirte que el tuyo encaja con él al 92 % y en qué
            parque coincidís. Una foto bonita sin eso no lleva a ninguna parte.
          </p>
        </div>

        <div className="grid">
          {posts.map((post) => (
            <article className="card" key={post.id}>
              {/* El hueco de la foto lleva su descripción, no un icono de rota.
                  Estas publicaciones son de demostración y no traen imagen: meter
                  fotos de archivo de perros que no son de nadie hace que todo se
                  vea como una maqueta, y además esas fotos tienen dueño. */}
              <div className="post__frame" role="img" aria-label={post.image_alt}>
                <p>{post.image_alt}</p>
                <span>Sin foto en la demostración</span>
              </div>

              <div className="row">
                <h3 className="card__title">{post.pet_name}</h3>
                {post.place_name ? <span className="badge">{post.place_name}</span> : null}
              </div>

              {post.caption ? <p className="card__meta">{post.caption}</p> : null}

              <p className="card__meta">
                {post.like_count === 1 ? '1 me gusta' : `${post.like_count} me gusta`}
                {' · '}
                {post.comment_count === 1
                  ? '1 comentario'
                  : `${post.comment_count} comentarios`}
                {' · '}
                {formatRelative(new Date(post.created_at))}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="quedadas">
        <div className="section__head">
          <p className="eyebrow">Próximas quedadas</p>
          <h2>Encuentros abiertos cerca de ti</h2>
          <p className="lede">
            Cada quedada dice a qué tallas y a qué nivel de actividad admite, y cuántos minutos de
            contacto seguidos propone. Un cachorro de pastor alemán y un bulldog de nueve años no
            hacen el mismo plan aunque los dos sean perros.
          </p>
        </div>

        {playdates.length === 0 ? (
          <Notice>
            <p>
              <strong>Todavía no hay ninguna quedada.</strong> Es el estado normal al empezar en un
              barrio: la primera la organiza alguien, y a partir de ahí el horario hace el resto.
            </p>
          </Notice>
        ) : (
          <div className="grid">
            {playdates.map((playdate) => (
              <a className="card" key={playdate.id} href={`/quedada/${playdate.public_slug}`}>
                <div className="row">
                  <span className="badge">{formatRelative(new Date(playdate.starts_at))}</span>
                  {playdate.leashed ? <span className="badge">Con correa</span> : null}
                </div>
                <h3 className="card__title">{playdate.title}</h3>
                <p className="card__meta">
                  {formatWhen(new Date(playdate.starts_at), new Date(playdate.ends_at))}
                </p>
                <p className="card__meta">
                  {playdate.place_name ?? 'Punto acordado en el mapa'} ·{' '}
                  {playdate.attendee_count === 1
                    ? '1 perro apuntado'
                    : `${playdate.attendee_count} perros apuntados`}
                </p>
                <div className="row">
                  {playdate.admits_sizes.map((size) => (
                    <span className="badge" key={size}>
                      {SIZE_LABEL[size] ?? size}
                    </span>
                  ))}
                  {playdate.admits_energy.map((energy) => (
                    <span className="badge" key={energy}>
                      {ENERGY_LABEL[energy] ?? energy}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="comunidad">
        <div className="section__head">
          <p className="eyebrow">Los días que no se sale</p>
          <h2>Un tutor necesita más cosas que un paseo</h2>
          <p className="lede">
            Quién cuida en agosto, qué veterinario está de guardia el domingo, con quién hablar
            cuando el suyo se pone raro a las tres de la mañana. Eso es tan producto como una
            quedada en el parque, y hace falta también los días de lluvia.
          </p>
        </div>

        <div className="grid">
          {communities.map((community) => (
            <article className="card" key={community.id}>
              <div className="row">
                <h3 className="card__title">{community.name}</h3>
                {community.species_name ? (
                  <span className="badge badge--accent">{community.species_name}</span>
                ) : (
                  <span className="badge">Cualquier mascota</span>
                )}
              </div>
              <p className="card__meta">
                {community.member_count === 1
                  ? '1 tutor'
                  : `${community.member_count} tutores`}
              </p>
            </article>
          ))}
        </div>

        {emergency.length > 0 ? (
          <Notice tone="warning">
            <p>
              <strong>Urgencias cerca:</strong> {emergency.map((entry) => entry.name).join(', ')}.
              El directorio se consulta sin cuenta, porque buscar un veterinario de guardia a las
              tres de la mañana no debería exigir registrarse.
            </p>
          </Notice>
        ) : null}

        <div className="grid" style={{ marginTop: 'var(--co-space-6)' }}>
          {services
            .filter((entry) => !entry.is_24h)
            .slice(0, 3)
            .map((service) => (
              <article className="card" key={service.id}>
                <div className="row">
                  <h3 className="card__title">{service.name}</h3>
                  {service.is_verified ? (
                    <span className="badge badge--verified">✓ Verificado</span>
                  ) : null}
                </div>
                <p className="card__meta">{SERVICE_KIND_LABEL[service.kind] ?? service.kind}</p>
                <p className="card__meta">
                  {service.species_names.length > 0
                    ? `Atiende: ${service.species_names.join(', ')}`
                    : 'No ha declarado a qué atiende'}
                </p>
              </article>
            ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="bienestar">
        <div className="section__head">
          <p className="eyebrow">De quién es esta aplicación</p>
          <h2>El plan es del tutor; el cuerpo que lo aguanta, no</h2>
          <p className="lede">
            Casi todas las aplicaciones de perros resuelven el problema de la persona: con quién
            queda, cómo llena la tarde, dónde encuentra sitio. Coincide hace eso, y además tiene una
            capa que puede contestar que no.
          </p>
        </div>

        <div className="grid">
          <article className="card card--feature">
            <p className="eyebrow">Calor</p>
            <h3 className="card__title">El techo no es el mismo para todos</h3>
            <p className="card__meta">
              El perro aguanta hasta cierta temperatura, y de ahí se descuenta lo que sepamos del
              tuyo: hocico chato, sénior, sensible al calor. Los descuentos se acumulan, porque
              sumar es la forma prudente de equivocarse. Y si el suelo es asfalto, el límite baja
              otra vez: el aire a 28 grados convive con un suelo bastante más caliente, y quien lo
              pisa descalzo es él.
            </p>
          </article>

          <article className="card card--feature">
            <p className="eyebrow">Duración</p>
            <h3 className="card__title">Dos horas es un buen plan para ti</h3>
            <p className="card__meta">
              Para un cachorro sin la pauta terminada, o para un galgo con las articulaciones
              tocadas, no lo es. Una quedada declara los minutos de contacto seguidos y ninguna
              puede pasarse del máximo de la especie; encima de eso, cada perro tiene el suyo. Lo
              impide un disparador en Postgres, no una comprobación del formulario.
            </p>
          </article>

          <article className="card card--feature">
            <p className="eyebrow">Estado</p>
            <h3 className="card__title">Quien está de baja, está de baja</h3>
            <p className="card__meta">
              En recuperación, con la pauta de vacunación sin terminar, o con un encuentro hace un
              rato: son motivos para no aparecer hoy en la lista de nadie. El grupo ve el
              resultado —«aguanta veinte minutos»— y no el motivo, que es un dato de salud y se
              queda en su ficha.
            </p>
          </article>
        </div>

        <Notice tone="warning">
          <p>
            <strong>Esto no es consejo veterinario.</strong> {WELFARE_DISCLAIMER} Los umbrales están
            umbrales prudentes de la propia aplicación y tu perro puede tener el suyo más estricto.
            Más laxo, no: un campo que pudiera subirlos sería una forma elegante de que la regla no
            existiera.
          </p>
        </Notice>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="espacios">
        <div className="section__head">
          <p className="eyebrow">Espacios privados</p>
          <h2>Un espacio cerrado sale barato entre varios</h2>
          <p className="lede">
            Alquilar un espacio privado a una persona es caro. Lo interesante es que Coincide ya
            sabe qué animales encajan entre sí, así que puede proponer el grupo y repartir el
            importe. Y para presentar conejos o hurones, un terreno neutral no es un lujo: es la
            única forma de hacerlo bien.
          </p>
        </div>

        <div className="grid">
          {spots.map((spot) => (
            <a className="card" key={spot.id} href={`/spot/${spot.public_slug}`}>
              <div className="row">
                <span className="badge badge--accent">
                  {formatPrice(spot.price_per_slot_cents, spot.slot_minutes)}
                </span>
                {spot.is_fenced ? <span className="badge">Vallado</span> : null}
              </div>
              <h3 className="card__title">{spot.title}</h3>
              <p className="card__meta">{spot.description}</p>
              <p className="card__meta">Hasta {spot.max_pets} perros</p>
            </a>
          ))}
        </div>

        <Notice tone="warning">
          <p>
            <strong>El cobro todavía no ocurre dentro de la aplicación.</strong> En esta fase el
            pago se acuerda con quien alquila el espacio. Repartir dinero entre varias personas
            exige reembolsos parciales, alta fiscal y una postura sobre responsabilidad civil, y es
            la única parte de esto de la que no se sale iterando.
          </p>
        </Notice>
      </section>
    </div>
  );
}
