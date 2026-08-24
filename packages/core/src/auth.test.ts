/**
 * Correo y contraseña.
 *
 * Lo que se comprueba aquí es **lo comprobable sin servidor**, y un par de
 * tests existen para fijar decisiones que se discuten: que no se pida símbolo
 * ni mayúscula, y que al entrar no se diga cuál de los dos campos falla.
 */

import { describe, expect, it } from 'vitest';

import {
  COMMON_PASSWORDS,
  PASSWORD_MIN,
  credentialProblems,
  passwordStrength,
  signInProblems,
  validateEmail,
} from './auth.js';

describe('el correo', () => {
  it('acepta uno normal y lo normaliza', () => {
    /* La mitad de los teclados móviles ponen mayúscula al principio, y
       `Ana@…` y `ana@…` son la misma persona en cualquier servidor. */
    const check = validateEmail('  Ana.Ruiz@Correo.COM ');
    expect(check.ok).toBe(true);
    expect(check.ok && check.normalized).toBe('ana.ruiz@correo.com');
  });

  it('dice qué falta, no «correo inválido»', () => {
    expect(validateEmail('ana').ok).toBe(false);
    expect(!validateEmail('ana').ok && validateEmail('ana')).toMatchObject({
      reason: expect.stringContaining('arroba'),
    });
    expect(validateEmail('ana@correo')).toMatchObject({
      reason: expect.stringContaining('dominio'),
    });
    expect(validateEmail('an a@correo.com')).toMatchObject({
      reason: expect.stringContaining('espacios'),
    });
  });

  it('vacío se dice como vacío', () => {
    expect(validateEmail('   ')).toMatchObject({ reason: 'Escribe tu correo.' });
  });
});

describe('la contraseña', () => {
  it('por debajo del mínimo no vale, y dice cuánto va', () => {
    const weak = passwordStrength('perro');
    expect(weak.usable).toBe(false);
    expect(weak.advice).toContain(String(PASSWORD_MIN));
    expect(weak.advice).toContain('5');
  });

  it('las de siempre no valen por muy largas que sean', () => {
    /* Es lo que de verdad prueba un atacante antes que nada. */
    for (const common of COMMON_PASSWORDS) {
      expect(passwordStrength(common).usable, common).toBe(false);
    }
  });

  it('no puede llevar tu propio correo dentro', () => {
    const check = passwordStrength('anaruiz2024', 'anaruiz@correo.com');
    expect(check.usable).toBe(false);
    expect(check.label).toContain('correo');
  });

  it('larga y previsible tampoco: repetir un carácter no es longitud', () => {
    expect(passwordStrength('aaaaaaaaaaaaaa').usable).toBe(false);
  });

  it('NO se pide símbolo ni mayúscula ni número', () => {
    /* La regla clásica la desaconseja el propio NIST desde 2017: empuja a
       `Password1!`, que es corta, previsible y difícil de recordar. Este test
       está para que nadie «arregle» eso en el futuro sin leer por qué. */
    const passphrase = passwordStrength('el perro come pasto', 'ana@correo.com');
    expect(passphrase.usable).toBe(true);
    expect(passphrase.score).toBe(3);
    expect(passphrase.advice).toBeNull();
  });

  it('lo justo se dice como justo, y con qué hacer', () => {
    const fair = passwordStrength('perropato', 'ana@correo.com');
    expect(fair.usable).toBe(true);
    expect(fair.score).toBe(1);
    expect(fair.advice).toContain('palabra más');
  });

  it('doce caracteres ya es muy buena sin pedir nada más', () => {
    expect(passwordStrength('elgatonaranja', 'ana@correo.com').score).toBe(3);
  });
});

describe('crear la cuenta', () => {
  it('sin nada, faltan las dos cosas', () => {
    expect(credentialProblems({ email: '', password: '' })).toHaveLength(2);
  });

  it('con las dos bien, no falta nada', () => {
    expect(
      credentialProblems({ email: 'ana@correo.com', password: 'el perro come pasto' }),
    ).toEqual([]);
  });
});

describe('entrar', () => {
  it('sin servidor no se inventa un «contraseña incorrecta»', () => {
    /* No hay contra qué comprobarla. Decirlo sería inventarse un resultado. */
    expect(signInProblems({ email: 'ana@correo.com', password: 'loquesea' })).toEqual([]);
  });

  it('lo que sí se puede decir es que falta algo', () => {
    expect(signInProblems({ email: 'ana', password: '' })).toHaveLength(2);
  });

  it('no dice cuál de los dos es el que no cuadra', () => {
    /* El día que haya servidor: «ese correo no existe» le confirma a quien
       prueba correos cuáles están registrados. La pantalla dice una sola cosa:
       no cuadra. */
    const messages = signInProblems({ email: 'ana@correo.com', password: '' }).join(' ');
    expect(messages).not.toContain('no existe');
    expect(messages).not.toContain('incorrecta');
  });
});
