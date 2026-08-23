import type { Metadata } from 'next';

import { allSpecies } from '@/lib/db';
import { LEGAL_DISCLAIMER, LEGAL_STATUS_LABEL, SOCIAL_MODEL_LABEL, TAXON_LABEL } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Especies',
  description:
    'Qué mascotas tienen sitio en Coincide, cómo socializa cada una y qué dice la ley española sobre tenerla.',
};

const MODEL_ORDER = ['pack', 'small_group', 'solitary'] as const;

const MODEL_INTRO: Record<string, string> = {
  pack: 'Encuentros abiertos en grupo, con desconocidos. Es el modelo alrededor del que giran las quedadas y el radar.',
  small_group:
    'Dos o tres animales, en terreno neutral, con supervisión y sesiones cortas. Nada de sueltas de parque: una presentación mal hecha acaba en peleas de verdad.',
  solitary:
    'Sin encuentros, y no por una limitación de la aplicación sino de la especie. A cambio: comunidad de tutores, lugares que las admiten y veterinarios que de verdad saben tratarlas.',
};

/**
 * El catálogo de especies.
 *
 * Es la página que explica el producto mejor que ninguna otra: Coincide no es
 * una aplicación de perros con otras especies añadidas encima, y esto se ve en
 * cuanto se agrupa por modelo social.
 *
 * También es donde vive la información legal, con su fuente y su aviso. La
 * aplicación no da asesoramiento: repite lo que dice una norma concreta y
 * enlaza a ella.
 */
export default async function SpeciesPage() {
  const species = await allSpecies();

  // Las especies excluidas van aparte, y no dentro de un modelo social.
  //
  // La cotorra argentina es un ave gregaria: colocarla bajo "no socializa con
  // otros animales" para expresar que está prohibida sería decir algo falso
  // sobre el animal para contar un hecho jurídico. Son dos ejes distintos y la
  // página los mantiene separados.
  const excluded = species.filter((entry) => entry.legal_status === 'excluded');
  const allowed = species.filter((entry) => entry.legal_status !== 'excluded');

  const byModel = MODEL_ORDER.map((model) => ({
    model,
    entries: allowed.filter((entry) => entry.social_model === model),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="shell section">
      <div className="section__head">
        <p className="eyebrow">Catálogo</p>
        <h1>Qué mascotas tienen sitio aquí</h1>
        <p className="lede">
          Cada especie tiene su propia forma de relacionarse, y eso decide qué le ofrece Coincide.
          Algunas quedan en el parque; otras no deben conocer a nadie, y para ellas el producto es
          otro.
        </p>
      </div>

      {byModel.map((group) => (
        <section className="section" key={group.model} style={{ paddingBlock: 0 }}>
          <div className="section__head">
            <h2>{SOCIAL_MODEL_LABEL[group.model]}</h2>
            <p className="card__meta" style={{ maxWidth: 'var(--co-measure-base)' }}>
              {MODEL_INTRO[group.model]}
            </p>
          </div>

          <div className="grid" style={{ marginBottom: 'var(--co-space-12)' }}>
            {group.entries.map((entry) => {
              const isBlocked = entry.legal_status === 'excluded';

              return (
                <article className="card" key={entry.id}>
                  <div className="row">
                    <h3 className="card__title">{entry.common_name}</h3>
                    {entry.pet_count > 0 ? (
                      <span className="badge">
                        {entry.pet_count === 1 ? '1 registrada' : `${entry.pet_count} registradas`}
                      </span>
                    ) : null}
                  </div>

                  <p className="card__meta">
                    <em>{entry.scientific_name}</em> · {TAXON_LABEL[entry.taxon_group]}
                  </p>

                  <p className="card__meta">{entry.social_note}</p>

                  {entry.legal_status ? (
                    <div
                      style={{
                        borderTop: '1px solid var(--co-border)',
                        paddingTop: 'var(--co-space-3)',
                        display: 'grid',
                        gap: 'var(--co-space-2)',
                      }}
                    >
                      <div className="row">
                        {/* El estado nunca se comunica solo con color: lleva su
                            texto y, cuando bloquea, también un símbolo. */}
                        <span
                          className={
                            isBlocked
                              ? 'badge'
                              : entry.legal_status === 'companion_animal' ||
                                  entry.legal_status === 'domestic'
                                ? 'badge badge--verified'
                                : 'badge badge--live'
                          }
                        >
                          {isBlocked ? '× ' : ''}
                          {LEGAL_STATUS_LABEL[entry.legal_status] ?? entry.legal_status}
                        </span>
                      </div>
                      <p className="card__meta">{entry.legal_note}</p>
                      <p className="card__meta" style={{ fontSize: 'var(--co-font-size-xs)' }}>
                        Fuente: {entry.legal_source}
                      </p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {excluded.length > 0 ? (
        <section className="section" style={{ paddingBlock: 0 }}>
          <div className="section__head">
            <h2>No permitidas en España</h2>
            <p className="card__meta" style={{ maxWidth: 'var(--co-measure-base)' }}>
              Aparecen en el catálogo para poder decir que no, y por qué. Coincide no abre ficha a
              ninguna de ellas: el registro se rechaza en la base de datos, no solo en el
              formulario.
            </p>
          </div>

          <div className="grid" style={{ marginBottom: 'var(--co-space-12)' }}>
            {excluded.map((entry) => (
              <article className="card" key={entry.id}>
                <div className="row">
                  <h3 className="card__title">{entry.common_name}</h3>
                  <span className="badge">× {LEGAL_STATUS_LABEL.excluded}</span>
                </div>
                <p className="card__meta">
                  <em>{entry.scientific_name}</em> · {TAXON_LABEL[entry.taxon_group]}
                </p>
                <p className="card__meta">{entry.legal_note}</p>
                <p className="card__meta" style={{ fontSize: 'var(--co-font-size-xs)' }}>
                  Fuente: {entry.legal_source}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="notice">
        <span aria-hidden="true">!</span>
        <p>
          <strong>Sobre la información legal.</strong> {LEGAL_DISCLAIMER} El listado positivo de
          animales de compañía que introduce la Ley 7/2023 seguía pendiente de desarrollo
          reglamentario, así que varias especies aparecen como pendientes: se pueden registrar, con
          el aviso, porque prohibirlo sería decidir por ti sobre una norma que todavía se está
          escribiendo.
        </p>
      </div>
    </div>
  );
}
