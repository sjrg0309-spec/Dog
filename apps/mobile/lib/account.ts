/**
 * La cuenta, y lo que puede ver.
 *
 * Aquí vive la decisión de producto que más cambia esta aplicación: **no hay
 * modo mirón**. Sin animal dado de alta no se entra, y con el animal recién
 * dado de alta se ven **sitios** —parques, fuentes, sombra, veterinarios— pero
 * no **personas**: ni quién está paseando ahora, ni a qué hora sale nadie.
 *
 * La lógica —los cuatro peldaños y qué abre cada uno— está en `@coincide/core`
 * con sus tests, sin red y sin React. Aquí solo está el estado de esta cuenta y
 * el alta, que es lo que no se puede probar en un test puro.
 *
 * ## Lo que hace y lo que no
 *
 * No impide que alguien que roba animales se registre: cualquiera puede
 * escribir un nombre. Impide **mirar sin dejar nada**, que es lo que se puede
 * construir de verdad, y por eso la puerta está puesta justo delante de las
 * tres cosas que le sirven a quien busca animales para llevárselos: la cara, el
 * sitio y la hora.
 */

import { useSyncExternalStore } from 'react';

import {
  accessLevel,
  can,
  whyNot,
  type AssistanceType,
  type DogRole,
  type Handler,
  type HandlerNeed,
  type AccessLevel,
  type AccountKind,
  type Capability,
  type PetDraft,
  type ShelterDraft,
} from '@coincide/core';

import { setActivePetId } from './active-pet';
import { setSetting } from './settings';
import { addMyPet, MY_PETS, PLACES, type DemoPet } from './demo-data';

type Account = {
  registered: boolean;
  /**
   * El correo con el que se entró, ya normalizado.
   *
   * **La contraseña no está aquí, ni cifrada ni de ninguna forma.** Se comprueba
   * al escribirla y se tira: guardar una contraseña «de mentira» en el teléfono
   * para que el prototipo pareciera completo no protegería nada y enseñaría a
   * confiar, que es lo peor de las dos opciones.
   */
  email: string | null;
  /**
   * Lo que necesita la persona para que esto le sirva.
   *
   * Vive aquí, **no se publica y no sale del teléfono**. Que alguien sea
   * autista, o que prefiera sitios tranquilos, no es información que le
   * corresponda a quien queda con él en un parque: lo que esa persona ve es que
   * se le propone quedar el martes a las siete en un sitio concreto.
   *
   * Y el diagnóstico ni siquiera hace falta para que funcione: lo que la
   * aplicación mira son los acomodos, que existen por su cuenta y que puede
   * encender cualquiera sin decir por qué.
   */
  handler: Handler;
  kind: AccountKind;
  /** Solo en cuentas de protectora. */
  shelterName: string | null;
  shelterProfile: string | null;
  shelterActivities: readonly string[];
  shelterReviewed: boolean;
  /** El código tal cual lo escribió el tutor, ya normalizado. Declarado ≠ verificado. */
  microchipCode: string | null;
  microchipVerified: boolean;
  walks: number;
  meetupsAttended: number;
};

let account: Account = {
  registered: false,
  email: null,
  handler: { needs: [] },
  kind: 'tutor',
  shelterName: null,
  shelterProfile: null,
  shelterActivities: [],
  shelterReviewed: false,
  microchipCode: null,
  microchipVerified: false,
  walks: 0,
  meetupsAttended: 0,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): Account => account;

export function useAccount(): Account {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** El peldaño de esta cuenta, calculado por el núcleo. */
export function useAccessLevel(): AccessLevel {
  const state = useAccount();
  return accessLevel({
    kind: state.kind,
    pets: state.registered && state.kind === 'tutor' ? MY_PETS.length : 0,
    microchipVerified: state.microchipVerified,
    walks: state.walks,
    meetupsAttended: state.meetupsAttended,
    shelterProfile: state.shelterProfile,
    shelterReviewed: state.shelterReviewed,
  });
}

/** ¿Puede esta cuenta ver esto? */
export function useCan(capability: Capability): boolean {
  return can(useAccessLevel(), capability);
}

/** Y si no puede, por qué. Se enseña en el hueco, no en un aviso aparte. */
export function useWhyNot(capability: Capability): string | null {
  return whyNot(useAccessLevel(), capability);
}

/**
 * Verificar el chip.
 *
 * **En esta versión es un atajo de demostración y la pantalla lo dice.** La
 * verificación de verdad necesita un documento veterinario o un acuerdo con un
 * registro nacional: el número del chip no lleva dígito de control, así que
 * validar el formato —que sí se hace, con el validador ISO real de
 * `@coincide/trackers`— no demuestra que el chip exista ni que sea tuyo.
 *
 * Se deja accesible porque sin ello la mitad de la escalera no se podría ver
 * funcionando, igual que la semilla de rescate enseña un parque que se marca y
 * otro que no.
 */
export function setMicrochipVerified(value: boolean): void {
  if (account.microchipVerified === value) return;
  account = { ...account, microchipVerified: value };
  emit();
}

/** Apuntar el chip. Que esté escrito no lo verifica: son dos cosas distintas. */
export function setMicrochipCode(code: string | null): void {
  account = { ...account, microchipCode: code };
  emit();
}

/**
 * Entrar con una cuenta que ya existe.
 *
 * En esta versión abre **la cuenta de este teléfono**: las mascotas de la
 * semilla, que es lo que hay. No comprueba la contraseña contra nada porque no
 * hay contra qué, y la pantalla lo dice en vez de fingir un «bienvenida de
 * nuevo» que no significa nada.
 *
 * Lo que sí es real es lo de antes de llegar aquí: el correo se valida y se
 * normaliza con el mismo módulo del núcleo que usará el servidor cuando lo haya.
 */
export function signIn(email: string): void {
  account = { ...account, registered: true, kind: 'tutor', email };
  emit();
}

/**
 * Cambiar los acomodos. Lo único de la persona que la aplicación mira.
 *
 * «Menos movimiento» no se queda aquí guardado esperando a que alguien lo
 * consulte: **enciende el ajuste de movimiento reducido**, que ya existe y que
 * ya apaga el pulso del radar y las entradas animadas. Un acomodo que solo se
 * guarda es un acomodo que no hace nada.
 */
export function setHandler(handler: Handler): void {
  account = { ...account, handler };
  if (handler.needs.includes('less_motion')) setSetting('motion', 'reduced');
  emit();
}

/** ¿Ha pedido esto la persona? Lo consultan las pantallas que cambian por ello. */
export function useHandlerNeed(need: HandlerNeed): boolean {
  return useAccount().handler.needs.includes(need);
}

/** Lo que se gana usando la aplicación, no diciéndolo. */
export function recordWalk(): void {
  account = { ...account, walks: account.walks + 1 };
  emit();
}

export function recordMeetupAttended(): void {
  account = { ...account, meetupsAttended: account.meetupsAttended + 1 };
  emit();
}

/**
 * El alta.
 *
 * Crea el animal de verdad —entra en la lista de mascotas del tutor y queda
 * seleccionado— y abre la aplicación. No pide dónde vives: la posición del
 * mapa es la del barrio de la demostración, porque la dirección de casa es
 * justo lo que esta aplicación no guarda de nadie.
 */
export function registerPet(
  draft: PetDraft & {
    sex: 'male' | 'female';
    days: readonly number[];
    startTime: string;
    endTime: string;
    /** Opcional: hay animales adoptados hace años y sin chip. */
    microchipCode?: string | null;
    /** Cómo se llama su raza, ya escrita: «Mestizo de labrador y pastor». */
    breedLabel?: string;
    /** Qué hace este perro: compañía, asistencia, terapia, trabajo, deporte. */
    role?: DogRole;
    /**
     * Para qué asiste. **No se publica nunca.**
     *
     * Se guarda para no proponerle lo que le estorba y para recordar lo que le
     * corresponde a su trabajo. «Alerta médica» es una enfermedad y «autismo» es
     * un diagnóstico de su tutora: eso no va al lado de la foto de un perro en
     * una aplicación de barrio. La proyección pública vive en `publicPetCard`,
     * en el núcleo, con el test que lo comprueba.
     */
    assistanceType?: AssistanceType;
    /** Enseñar o no que es perro de asistencia. Lo decide su tutora. */
    showRole?: boolean;
    /** Los acomodos de la persona, que se guardan en la cuenta y no en el perro. */
    handler?: Handler;
    /** El correo de la cuenta, ya normalizado. La contraseña no se guarda. */
    email?: string;
    /**
     * La semilla del retrato, que pasa a ser su identificador.
     *
     * El dibujo del animal sale de su identificador, así que durante el alta se
     * dibuja con lo contestado hasta ese momento. Si al registrar se generara
     * un identificador nuevo, el perro cambiaría de cara al entrar — que es
     * justo lo que no puede pasar después de haberlo estado mirando.
     */
    seed?: string;
    /**
     * Lo que trae de serie y cambia lo que puede hacer hoy.
     *
     * Sale del catálogo de razas y no de un formulario médico: el hocico chato
     * de un carlino no es una enfermedad que haya que declarar, es un hecho de
     * la raza que baja cuatro grados el techo de calor. Que llegue desde el
     * alta es la diferencia entre que la capa de bienestar funcione desde el
     * primer día o solo para quien se acuerde de rellenar la ficha.
     */
    healthFlags?: readonly string[];
    trustCircle?: readonly string[];
  },
): void {
  const pet: DemoPet = {
    id: draft.seed ?? `mine-${Date.now()}`,
    name: draft.name.trim(),
    ownerName: 'Tú',
    ownerId: 'me',
    speciesId: draft.speciesId,
    breeds: draft.breedLabel ? [draft.breedLabel] : [],
    bio: '',
    size: (draft.size ?? 'medium') as DemoPet['size'],
    energyLevel: (draft.energy ?? 'medium') as DemoPet['energyLevel'],
    playStyles: draft.playStyles as DemoPet['playStyles'],
    trustCircle: (draft.trustCircle && draft.trustCircle.length > 0
      ? draft.trustCircle
      : ['loves_everyone']) as DemoPet['trustCircle'],
    sex: draft.sex,
    ageMonths: draft.ageMonths ?? 12,
    isMicrochipVerified: false,
    healthFlags: (draft.healthFlags ?? []) as DemoPet['healthFlags'],
    role: draft.role ?? 'companion',
    assistanceType: draft.assistanceType ?? null,
    showRole: draft.showRole ?? true,
    availability: draft.days.map((weekday) => ({
      weekday,
      startTime: draft.startTime,
      endTime: draft.endTime,
      placeId: PLACES.central.id,
    })),
    /* Ni se pregunta ni se guarda dónde vive nadie. Estas son las coordenadas
       del barrio de la demostración, para que el mapa tenga contenido. */
    home: { lat: 40.4112, lng: -3.6951 },
    location: { lat: 40.4098, lng: -3.6939 },
    walkingUntilMinutes: null,
    placeName: null,
  };

  addMyPet(pet);
  setActivePetId(pet.id);
  account = {
    ...account,
    registered: true,
    microchipCode: draft.microchipCode ?? null,
    handler: draft.handler ?? account.handler,
    email: draft.email ?? account.email,
  };
  if (account.handler.needs.includes('less_motion')) setSetting('motion', 'reduced');
  emit();
}

/**
 * El alta de una protectora, que entra por la otra puerta.
 *
 * No crea ningún animal: esta cuenta no tiene animal propio, y por eso tampoco
 * puede hacer check-in. Queda **pendiente de revisión** desde el primer
 * momento; aprobar es un acto de alguien, nunca del tiempo que pase.
 */
export function registerShelter(
  draft: ShelterDraft & { normalizedProfile: string; email?: string },
): void {
  account = {
    ...account,
    registered: true,
    email: draft.email ?? account.email,
    kind: 'rescuer',
    shelterName: draft.name.trim(),
    shelterProfile: draft.normalizedProfile,
    shelterActivities: [...draft.activities],
    shelterReviewed: false,
  };
  emit();
}

/**
 * Aprobar la cuenta de una protectora.
 *
 * **En esta versión es un atajo de demostración y la pantalla lo dice**, igual
 * que la verificación del chip. La revisión de verdad la hace una persona
 * mirando el perfil: aquí no hay forma de preguntarle a esas redes si una
 * cuenta existe, y aunque la hubiera, un enlace ajeno lo pega cualquiera.
 *
 * Se deja accesible porque sin ello no se podría ver funcionando la mitad de la
 * regla —qué abre una cuenta aprobada y qué sigue sin abrir—, que es justo la
 * parte que hay que poder discutir.
 */
export function setShelterReviewed(value: boolean): void {
  if (account.shelterReviewed === value) return;
  account = { ...account, shelterReviewed: value };
  emit();
}
