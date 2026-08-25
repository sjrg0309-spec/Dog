/**
 * Los datos del prototipo, calculados con el algoritmo de verdad.
 *
 * El prototipo que se publica es una página estática, así que no puede importar
 * `@petnav/core` ni hablar con Postgres. En lugar de reimplementar el
 * algoritmo en la página —que sería enseñar otra cosa y llamarla la misma—, este
 * script **ejecuta el real** sobre todas las combinaciones que el prototipo
 * permite elegir y guarda los resultados.
 *
 * Son 3 mascotas × 7 temperaturas × 3 superficies: 63 casos. Los números que se
 * ven en la página salieron de `calculateAffinity`, `scheduleOverlap` y
 * `assessWelfare`, no de una tabla escrita a mano.
 */

import { writeFileSync } from 'node:fs';

import {
  assessWelfare,
  classifyResults,
  findSpecies,
  formatDistance,
  groupWelfare,
  rankCandidates,
} from '../packages/core/dist/index.js';

const { MY_PETS, OTHER_PETS, COMMUNITIES, SERVICES, PLAYDATES } = await import(
  './demo-pets.mjs'
);

const TEMPERATURES = [5, 12, 18, 22, 26, 30, 34];
const SURFACES = ['grass', 'asphalt', 'indoor'];
const DURATION = 45;

/** Las mascotas entre las que puede cambiar quien abra el prototipo. */
const VIEWER_PETS = MY_PETS;

const cases = {};

for (const pet of VIEWER_PETS) {
  for (const temperatureC of TEMPERATURES) {
    for (const surface of SURFACES) {
      const conditions = { temperatureC, surface, durationMinutes: DURATION };
      const species = findSpecies(pet.speciesId);
      const social = species !== null && species.socialModel !== 'solitary';

      const sameSpecies = OTHER_PETS.filter(
        (other) => other.speciesId === pet.speciesId && other.id !== pet.id,
      );
      const candidates = sameSpecies.map((other) => ({
        pet: other,
        availability: other.availability,
        location: other.location,
      }));
      const viewer = { pet, availability: pet.availability, location: pet.location };

      const matches = social ? rankCandidates(viewer, candidates, { radiusMeters: 5000, conditions }) : [];
      const byId = new Map(sameSpecies.map((other) => [other.id, other]));

      cases[`${pet.id}|${temperatureC}|${surface}`] = {
        welfare: assessWelfare(pet, conditions),
        emptyReason: social ? classifyResults(viewer, candidates, matches, conditions) : 'solitary',
        resting: sameSpecies.filter(
          (other) => groupWelfare([pet, other], conditions).level === 'stop',
        ).length,
        matches: matches.map((match) => {
          const other = byId.get(match.petId);
          return {
            id: other.id,
            name: other.name,
            breeds: other.breeds,
            ageMonths: other.ageMonths,
            size: other.size,
            energyLevel: other.energyLevel,
            playStyles: other.playStyles,
            isMicrochipVerified: other.isMicrochipVerified,
            walkingUntilMinutes: other.walkingUntilMinutes,
            placeName: other.placeName,
            score: match.affinity.score,
            band: match.affinity.band,
            reasons: match.affinity.reasons.slice(0, 2),
            schedule: match.scheduleSummary,
            distance: match.distanceMeters === null ? null : formatDistance(match.distanceMeters),
            welfare: match.welfare,
          };
        }),
      };
    }
  }
}

const pets = VIEWER_PETS.map((pet) => {
  const species = findSpecies(pet.speciesId);
  return {
    id: pet.id,
    name: pet.name,
    speciesId: pet.speciesId,
    speciesName: species.commonName,
    socialModel: species.socialModel,
    socialNote: species.socialNote,
    breeds: pet.breeds,
    healthFlags: pet.healthFlags ?? [],
    care: species.care,
    juvenileUntilMonths: species.juvenileUntilMonths,
  };
});

const speciesCatalog = ['dog', 'cat', 'ferret', 'rabbit', 'leopard_gecko', 'hamster', 'betta'].map(
  (id) => {
    const species = findSpecies(id);
    return {
      id,
      commonName: species.commonName,
      scientificName: species.scientificName,
      socialModel: species.socialModel,
      socialNote: species.socialNote,
      care: species.care,
    };
  },
);

writeFileSync(
  new URL('../artifacts/demo-data.json', import.meta.url),
  JSON.stringify(
    {
      pets,
      cases,
      speciesCatalog,
      playdates: PLAYDATES,
      communities: COMMUNITIES,
      services: SERVICES,
      temperatures: TEMPERATURES,
      surfaces: SURFACES,
    },
    null,
    0,
  ),
);

console.log(`✓ ${Object.keys(cases).length} casos calculados con el algoritmo real`);
