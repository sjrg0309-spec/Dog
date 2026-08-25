-- Catálogo de especies.
--
-- Es la tabla que convierte Petnav en una aplicación de mascotas y no en una
-- de perros con excepciones. Cada fila trae tres cosas que deciden el producto:
--
--   1. `social_model`  — si la especie participa en encuentros, y de qué forma.
--   2. `applicable_play_styles` — qué se le pregunta al tutor. A un conejo no se
--      le pregunta por lucha libre, y a un reptil no se le pregunta nada.
--   3. `juvenile_until_months` — una rata es adulta a los tres meses y un perro
--      sigue siendo cachorro al año. Un umbral único convertiría a media fauna
--      del catálogo en cachorro perpetuo.
--
-- Añadir una especie es añadir una fila, no tocar código.

create table public.species (
  id text primary key,
  common_name text not null,
  scientific_name text not null,
  taxon_group public.taxon_group not null,
  social_model public.social_model not null,
  applicable_play_styles public.play_style[] not null default '{}',
  /**
   * Especies con las que existe relación de depredador y presa.
   *
   * Hoy no cambia ningún resultado, porque los encuentros son siempre entre la
   * misma especie. Está aquí para poder explicar POR QUÉ cuando alguien
   * pregunte, y para que el día que se estudien encuentros mixtos el dato ya
   * esté modelado en vez de improvisado.
   */
  predator_prey_with text[] not null default '{}',
  /** Vacunas o pruebas que conviene tener al día antes de un encuentro. */
  health_for_meetups text[] not null default '{}',
  juvenile_until_months smallint not null check (juvenile_until_months between 1 and 240),
  /** Explicación para el tutor de por qué su especie queda o no queda. */
  social_note text not null,
  created_at timestamptz not null default now()
);

create index species_social_model_idx on public.species (social_model);
create index species_taxon_idx on public.species (taxon_group);

-- ---------------------------------------------------------------------------
-- Estado legal por jurisdicción.
--
-- Petnav NO da asesoramiento legal. Guarda un estado con su nota y su fuente,
-- y lo muestra tal cual; la lista vigente es siempre la del organismo
-- competente. Por eso `source` es obligatorio: un estado legal sin fuente no
-- debería poder existir en esta base.
-- ---------------------------------------------------------------------------

create table public.species_legal_status (
  species_id text not null references public.species (id) on delete cascade,
  /** Código de país o de región. `ES` para España. */
  jurisdiction text not null check (jurisdiction ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'),
  status public.legal_status not null,
  note text not null,
  source text not null check (length(trim(source)) > 0),
  reviewed_at date not null default current_date,
  primary key (species_id, jurisdiction)
);

/**
 * ¿Puede registrarse esta especie en esta jurisdicción?
 *
 * Solo bloquea lo que está excluido de forma expresa. Lo que está pendiente del
 * listado positivo se permite registrar mostrando el aviso: prohibirlo sería
 * decidir por el usuario sobre una norma que todavía se está desarrollando, y
 * ocultarlo sería peor.
 */
create or replace function public.species_is_registrable(
  target_species text,
  target_jurisdiction text default 'ES'
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not exists (
    select 1
    from public.species_legal_status s
    where s.species_id = target_species
      and s.jurisdiction = target_jurisdiction
      and s.status = 'excluded'
  );
$$;

-- ---------------------------------------------------------------------------
-- Datos de referencia.
--
-- Van en la migración y no en la semilla porque no son datos de ejemplo: son
-- parte del esquema del dominio. Una base sin catálogo de especies no puede
-- registrar ni una sola mascota.
-- ---------------------------------------------------------------------------

insert into public.species
  (id, common_name, scientific_name, taxon_group, social_model,
   applicable_play_styles, predator_prey_with, health_for_meetups,
   juvenile_until_months, social_note)
values
  ('dog', 'Perro', 'Canis familiaris', 'mammal_carnivore', 'pack',
   '{chase,wrestle,toys,calm_walk}',
   '{rabbit,guinea_pig,rat,hamster,canary,budgerigar}',
   '{"Polivalente al día","Antiparasitario al día","Rabia según comunidad"}', 12,
   'El perro es la única especie del catálogo que socializa bien en grupo abierto con desconocidos. Por eso las quedadas y el radar están pensados alrededor de él.'),

  ('cat', 'Gato', 'Felis catus', 'mammal_carnivore', 'solitary',
   '{chase,toys}', '{rat,hamster,canary,budgerigar,gerbil}', '{}', 12,
   'Los gatos son territoriales: llevar al tuyo a conocer a otro gato le genera estrés, no compañía. Petnav no organiza encuentros de gatos. Lo que sí ofrece es comunidad de tutores, veterinarios felinos y alojamientos que los admiten.'),

  ('ferret', 'Hurón', 'Mustela putorius furo', 'mammal_carnivore', 'small_group',
   '{chase,wrestle,toys,forage}',
   '{rabbit,guinea_pig,rat,hamster,canary,budgerigar,gerbil}',
   '{"Moquillo al día","Rabia según comunidad","Desparasitación reciente"}', 4,
   'Los hurones juegan muy bien entre ellos, pero en grupos pequeños y con presentación gradual en terreno neutral. Nada de sueltas masivas.'),

  ('rabbit', 'Conejo', 'Oryctolagus cuniculus', 'mammal_lagomorph', 'small_group',
   '{chase,grooming,side_by_side,forage}', '{dog,ferret,cat}',
   '{"Mixomatosis al día","Enfermedad hemorrágica vírica al día"}', 6,
   'Los conejos son sociales, pero presentarlos es un proceso delicado: territorio neutral, sesiones cortas y supervisión constante. Una presentación mal hecha acaba en peleas graves de verdad.'),

  ('guinea_pig', 'Cobaya', 'Cavia porcellus', 'mammal_rodent', 'small_group',
   '{side_by_side,forage,grooming}', '{dog,ferret,cat}',
   '{"Revisión reciente de piel y respiratoria"}', 4,
   'Las cobayas viven mejor acompañadas, pero se presentan en espacio neutral y con calma. No se mezclan con conejos: la diferencia de tamaño y de lenguaje corporal las pone en riesgo.'),

  ('rat', 'Rata', 'Rattus norvegicus domestica', 'mammal_rodent', 'small_group',
   '{chase,wrestle,grooming,forage}', '{dog,cat,ferret}',
   '{"Sin síntomas respiratorios","Cuarentena tras contacto reciente"}', 3,
   'Son de las especies más sociales del catálogo y disfrutan de compañía de su especie, con presentación gradual.'),

  ('hamster', 'Hámster sirio', 'Mesocricetus auratus', 'mammal_rodent', 'solitary',
   '{forage}', '{dog,cat,ferret}', '{}', 2,
   'El hámster sirio es solitario de forma estricta: juntar dos adultos termina en peleas que pueden ser mortales. Petnav no organiza encuentros de hámsteres, y esto no es una limitación de la aplicación sino de la especie.'),

  ('gerbil', 'Jerbo', 'Meriones unguiculatus', 'mammal_rodent', 'solitary',
   '{forage}', '{dog,cat,ferret}', '{}', 3,
   'Viven bien en grupo estable dentro de casa, pero no aceptan desconocidos: introducir un jerbo ajeno en su territorio provoca peleas.'),

  ('budgerigar', 'Periquito', 'Melopsittacus undulatus', 'bird', 'solitary',
   '{forage,side_by_side}', '{cat,dog,ferret}', '{}', 8,
   'Son muy sociales dentro de su bandada, pero juntar aves de casas distintas es una vía directa de contagio —psitacosis, entre otras—. Petnav ofrece comunidad y veterinarios de exóticos, no encuentros.'),

  ('canary', 'Canario', 'Serinus canaria domestica', 'bird', 'solitary',
   '{side_by_side}', '{cat,dog,ferret}', '{}', 8,
   'Mismo motivo que el resto de aves: el riesgo sanitario de mezclar ejemplares de hogares distintos no compensa.'),

  ('leopard_gecko', 'Gecko leopardo', 'Eublepharis macularius', 'reptile', 'solitary',
   '{}', '{cat,dog}', '{}', 12,
   'Los reptiles no socializan: la compañía les genera estrés, no bienestar. Además son portadores habituales de salmonela, así que un encuentro sería un problema de salud pública. Aquí encuentras comunidad de tutores y veterinarios especializados.'),

  ('bearded_dragon', 'Dragón barbudo', 'Pogona vitticeps', 'reptile', 'solitary',
   '{}', '{cat,dog}', '{}', 12,
   'Territorial con los de su especie. Dos machos juntos pelean. No hay encuentros, pero sí comunidad y directorio de veterinarios de exóticos.'),

  ('greek_tortoise', 'Tortuga mora', 'Testudo graeca', 'reptile', 'solitary',
   '{}', '{dog}', '{}', 60,
   'Solitaria y de vida muy larga. Petnav se centra en el papeleo, los veterinarios y la comunidad de tutores, no en encuentros.'),

  ('betta', 'Pez betta', 'Betta splendens', 'fish', 'solitary',
   '{}', '{}', '{}', 6,
   'El betta macho ataca a otros machos hasta matarlos; su nombre común es literalmente "pez luchador". No hay encuentros posibles. Sí hay comunidad de acuariofilia.'),

  ('monk_parakeet', 'Cotorra argentina', 'Myiopsitta monachus', 'bird', 'solitary',
   '{}', '{}', '{}', 12,
   'No procede: la especie no puede tenerse como animal de compañía en España.');

insert into public.species_legal_status (species_id, jurisdiction, status, note, source)
values
  ('dog', 'ES', 'companion_animal',
   'Considerado animal de compañía por la propia ley, sin depender del listado positivo.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('cat', 'ES', 'companion_animal',
   'Considerado animal de compañía por la propia ley, sin depender del listado positivo.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('ferret', 'ES', 'companion_animal',
   'Considerado animal de compañía por la propia ley, sin depender del listado positivo.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),

  ('rabbit', 'ES', 'domestic',
   'Especie doméstica, no fauna silvestre; queda fuera del ámbito del listado positivo.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('guinea_pig', 'ES', 'domestic',
   'Especie doméstica, no fauna silvestre; queda fuera del ámbito del listado positivo.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('rat', 'ES', 'domestic',
   'Especie doméstica, no fauna silvestre; queda fuera del ámbito del listado positivo.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('hamster', 'ES', 'domestic',
   'Especie doméstica, no fauna silvestre; queda fuera del ámbito del listado positivo.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('gerbil', 'ES', 'domestic',
   'Especie doméstica, no fauna silvestre; queda fuera del ámbito del listado positivo.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('budgerigar', 'ES', 'domestic',
   'Especie doméstica de cría en cautividad, ampliamente extendida como animal de compañía.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('canary', 'ES', 'domestic',
   'Especie doméstica de cría en cautividad, ampliamente extendida como animal de compañía.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('betta', 'ES', 'domestic',
   'Pez ornamental de cría en cautividad.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),

  ('leopard_gecko', 'ES', 'positive_list_pending',
   'Especie silvestre: su tenencia como animal de compañía depende del listado positivo, cuyo desarrollo reglamentario seguía en tramitación. No es venenosa y no alcanza los 2 kg en adulto, que son los dos criterios de exclusión expresos. Comprueba el listado vigente antes de adquirirla o registrarla.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),
  ('bearded_dragon', 'ES', 'positive_list_pending',
   'Especie silvestre: su tenencia depende del listado positivo, aún en desarrollo reglamentario. No es venenosa y en condiciones normales no supera los 2 kg en adulto. Comprueba el listado vigente.',
   'Ley 7/2023, de 28 de marzo — https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936'),

  ('greek_tortoise', 'ES', 'restricted',
   'Especie incluida en CITES: exige documentación de origen legal y, según la comunidad autónoma, registro del ejemplar. Sin ese papeleo su tenencia no es legal.',
   'CITES / Reglamento (CE) 338/97 — https://cites.org/esp'),

  ('monk_parakeet', 'ES', 'excluded',
   'Incluida en el Catálogo Español de Especies Exóticas Invasoras: su tenencia, cría y comercio están prohibidos. No puede registrarse en Petnav.',
   'Catálogo Español de Especies Exóticas Invasoras — https://www.miteco.gob.es/');
