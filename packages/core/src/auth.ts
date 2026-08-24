/**
 * Correo y contraseña: lo que se puede comprobar sin servidor.
 *
 * Empiezo por lo que **no** hay, porque decide cómo hay que leer el resto: en
 * esta versión no hay servidor, no hay cuentas y **no se guarda ninguna
 * contraseña, ni siquiera cifrada**. Lo que hay aquí es la parte que no depende
 * del servidor —comprobar lo que alguien escribe y decirle qué le falta— y que
 * es la misma el día que haya uno detrás.
 *
 * Guardar una contraseña «de mentira» en el teléfono para que el prototipo
 * pareciera completo sería lo peor de las dos opciones: no protege nada y
 * enseña a confiar. Se comprueba y se tira.
 *
 * ## Por qué las reglas son estas y no las de siempre
 *
 * La regla clásica —ocho caracteres con mayúscula, número y símbolo— la
 * desaconseja el propio NIST desde 2017 (SP 800-63B): esas exigencias empujan a
 * `Password1!`, que es corta, previsible y encima difícil de recordar. Lo que sí
 * recomienda es lo que hay aquí:
 *
 *  - **Longitud** por encima de composición. Ocho es el mínimo y se premia
 *    llegar a doce o más.
 *  - **Lista de las más usadas**, que es lo que de verdad prueba un atacante.
 *    La de aquí es corta —las que salen en cualquier filtración— y en un
 *    servidor de verdad iría contra una lista larga.
 *  - **Que no sea tu correo**, que es el primer intento después de las
 *    anteriores.
 *
 * Y no se rechaza nada por no tener símbolos. Una frase de cuatro palabras es
 * mejor contraseña que `P@ss1234`, y la pantalla lo dice.
 */

/** Mínimo que se acepta. Por debajo no se deja seguir. */
export const PASSWORD_MIN = 8;

/** A partir de aquí se considera buena por longitud, sin pedir nada más. */
export const PASSWORD_COMFORTABLE = 12;

/**
 * Las que prueba cualquiera antes de nada.
 *
 * Corta a propósito: es una demostración de la regla, no una defensa. Un
 * servidor de verdad compara contra listas de millones —las de filtraciones
 * conocidas— y eso no cabe ni tiene sentido dentro de una aplicación.
 */
export const COMMON_PASSWORDS: readonly string[] = [
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'contraseña',
  'contrasena',
  'qwertyuiop',
  'iloveyou',
  'princesa',
  'futbol123',
  'password1',
  'admin1234',
  'micontrasena',
  'perroperro',
];

export type EmailCheck = { ok: true; normalized: string } | { ok: false; reason: string };

/**
 * El correo.
 *
 * Se comprueba la **forma**, que es lo único comprobable sin mandar nada: que
 * hay algo antes de la arroba, algo después, y un punto con dominio detrás. Que
 * exista y sea tuyo lo dice el correo de confirmación, que es cosa del servidor.
 *
 * Se normaliza a minúsculas y sin espacios porque la mitad de los teclados
 * móviles ponen una mayúscula al principio, y `Ana@…` y `ana@…` son la misma
 * persona en cualquier servidor de correo del mundo.
 */
export function validateEmail(input: string): EmailCheck {
  const normalized = input.trim().toLowerCase();

  if (normalized === '') return { ok: false, reason: 'Falta el correo.' };
  if (/\s/.test(normalized)) return { ok: false, reason: 'Un correo no lleva espacios.' };
  if (!normalized.includes('@')) return { ok: false, reason: 'Falta la arroba.' };

  const [user, ...rest] = normalized.split('@');
  const domain = rest.join('@');

  if (!user) return { ok: false, reason: 'Falta lo de antes de la arroba.' };
  if (rest.length !== 1 || !domain) return { ok: false, reason: 'Falta el dominio: lo de después de la arroba.' };
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return { ok: false, reason: 'El dominio no está completo: falta el punto y lo que va detrás.' };
  }
  if (/[^a-z0-9.!#$%&'*+/=?^_`{|}~-]/.test(user)) {
    return { ok: false, reason: 'Ese correo lleva algún carácter que no puede llevar.' };
  }
  if (/[^a-z0-9.-]/.test(domain)) {
    return { ok: false, reason: 'El dominio lleva algún carácter que no puede llevar.' };
  }

  return { ok: true, normalized };
}

export type PasswordStrength = {
  /** 0 no vale; 1 justa; 2 bien; 3 muy bien. */
  score: 0 | 1 | 2 | 3;
  /** Se puede seguir con ella. */
  usable: boolean;
  label: string;
  /** Qué le falta, en llano y en una frase. Null cuando ya está bien. */
  advice: string | null;
};

/**
 * La fuerza de una contraseña, dicha como se le dice a una persona.
 *
 * Devuelve una nota y **qué hacer**, no un porcentaje. «Fuerza: 42 %» no le
 * dice a nadie qué escribir; «añade una palabra más» sí.
 */
export function passwordStrength(password: string, email = ''): PasswordStrength {
  const value = password;

  if (value.length === 0) {
    return { score: 0, usable: false, label: 'Sin contraseña', advice: 'Escribe una contraseña.' };
  }

  if (value.length < PASSWORD_MIN) {
    return {
      score: 0,
      usable: false,
      label: 'Demasiado corta',
      advice: `Necesita ${PASSWORD_MIN} caracteres como mínimo. Van ${value.length}.`,
    };
  }

  if (COMMON_PASSWORDS.includes(value.toLowerCase())) {
    return {
      score: 0,
      usable: false,
      label: 'Es de las más usadas',
      advice: 'Esa es de las primeras que se prueban. Cualquier otra cosa es mejor.',
    };
  }

  const local = email.trim().toLowerCase().split('@')[0] ?? '';
  if (local.length >= 3 && value.toLowerCase().includes(local)) {
    return {
      score: 0,
      usable: false,
      label: 'Lleva tu correo dentro',
      advice: 'Si alguien sabe tu correo, ya la tiene medio adivinada.',
    };
  }

  /* Repetir el mismo carácter o teclear una fila seguida es largo y previsible
     a la vez, que es el único caso en el que la longitud engaña. */
  if (/^(.)\1+$/.test(value)) {
    return {
      score: 0,
      usable: false,
      label: 'Es un carácter repetido',
      advice: 'Larga no es lo mismo que difícil. Prueba con varias palabras.',
    };
  }

  const words = value.trim().split(/\s+/).filter((word) => word.length > 0).length;

  if (value.length >= PASSWORD_COMFORTABLE || words >= 3) {
    return { score: 3, usable: true, label: 'Muy buena', advice: null };
  }

  if (value.length >= 10) {
    return { score: 2, usable: true, label: 'Bien', advice: null };
  }

  return {
    score: 1,
    usable: true,
    label: 'Justa',
    advice: 'Vale, pero con una palabra más sería bastante mejor. La longitud protege más que los símbolos.',
  };
}

export type Credentials = { email: string; password: string };

/** Qué falta para poder crear la cuenta, en el orden en que se pregunta. */
export function credentialProblems(input: Credentials): string[] {
  const problems: string[] = [];
  const email = validateEmail(input.email);
  if (!email.ok) problems.push(email.reason);

  const strength = passwordStrength(input.password, input.email);
  if (!strength.usable) problems.push(strength.advice ?? strength.label);

  return problems;
}

/**
 * Entrar: qué se puede decir de lo escrito antes de preguntarle a un servidor.
 *
 * Aquí **no se comprueba la contraseña contra nada** —no hay contra qué— y por
 * eso solo se mira que estén las dos cosas y que el correo tenga forma de
 * correo. Decir «contraseña incorrecta» sin servidor sería inventarse un
 * resultado.
 *
 * Y hay un motivo para no decir cuál de las dos falla cuando falla de verdad,
 * el día que haya servidor: «ese correo no existe» le confirma a quien prueba
 * correos cuáles están registrados. La pantalla dice una sola cosa: no cuadra.
 */
export function signInProblems(input: Credentials): string[] {
  const problems: string[] = [];
  if (!validateEmail(input.email).ok) problems.push('Ese correo no tiene forma de correo.');
  if (input.password.length === 0) problems.push('Falta la contraseña.');
  return problems;
}

export const NO_SERVER_NOTE =
  'En esta versión no hay servidor: no se guarda ninguna contraseña, ni cifrada. Lo que se comprueba de verdad es lo que escribes; entrar abre la cuenta de este teléfono.';

export const PASSWORD_ADVICE =
  'Cuatro palabras seguidas son mejor contraseña que ocho caracteres con símbolos, y se recuerdan. Aquí no se pide ni mayúscula ni número: lo que protege es la longitud.';

export const FORGOT_NOTE =
  'Recuperar la contraseña necesita un servidor que mande el correo, y todavía no lo hay. Cuando lo haya, el enlace caduca y solo sirve una vez.';
