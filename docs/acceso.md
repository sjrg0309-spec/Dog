# Quién entra, y qué ve el que entra

Este documento explica la puerta de Coincide: por qué no hay modo mirón, qué
abre cada peldaño, cómo entra quien rescata sin tener animal propio, y qué
parte de todo esto es comprobable y cuál no.

Vive en el repositorio y no en la descripción del pull request por una razón
práctica: la descripción tiene un límite de 65.536 caracteres y lo tiene casi
gastado. Y por una mejor: esto es una postura de producto, y una postura se
mantiene al lado del código que la implementa.

El código y sus tests:

| Qué | Dónde |
|---|---|
| La escalera, las capacidades y el enlace del colectivo | `packages/core/src/access.ts` |
| Sus tests (38) | `packages/core/src/access.test.ts` |
| El estado de la cuenta en la aplicación | `apps/mobile/lib/account.ts` |
| El alta, con sus dos puertas | `apps/mobile/components/registro.tsx` |
| La comprobación de punta a punta | `scripts/check-app-artifact.mjs` |

---

## 1. No hay modo mirón

Para registrarse hay que dar de alta un animal: nombre, especie, edad, tamaño,
carácter y **horario de paseo**. Sin eso no se dibuja la aplicación — se dibuja
el alta en su lugar.

Y no como una ruta más. Una pantalla de registro que es una ruta se salta
escribiendo cualquier otra dirección; aquí, mientras no hay animal, detrás no
hay nada que alcanzar. La comprobación del empaquetado lo mira de las dos
formas: que salga el alta **y** que no exista la barra de pestañas.

### Lo que esto evita y lo que no

Conviene decirlo entero, porque la mitad se vende sola:

- **No evita** que alguien que roba animales se registre. Cualquiera puede
  escribir «Nina, mestiza, cuatro años» y entrar. Prometer lo contrario sería
  mentir, y peor: haría que alguien bajara la guardia en el parque porque «la
  aplicación verifica».
- **Sí evita** —y esto es lo que se puede construir de verdad— que se pueda
  **mirar sin dejar nada**. Las tres cosas que le sirven a quien busca animales
  para llevárselos son **la cara, el sitio y la hora**, y las tres quedan detrás
  de algo que cuesta.

El reparto es ese: **los sitios son públicos, las personas no**. Encaja con lo
que la aplicación ya prometía —el radar ancla al lugar y nunca a la persona, el
horario exacto solo se revela como coincidencia— y le pone la puerta que
faltaba.

---

## 2. La escalera

Cuatro peldaños para un tutor. Lo que cambia en cada uno es **qué se ve**, no
qué insignia sale al lado del nombre: una insignia sin consecuencias es
decoración.

| Peldaño | Cómo se llega | Qué abre |
|---|---|---|
| `none` | Sin animal | Nada. Ni el mapa de parques |
| `declared` | Animal dado de alta | Sitios, feed y **tu propio** check-in |
| `verified` | Chip verificado con la cartilla | Quién pasea ahora, horarios, escribir el primero, avisos de rescate |
| `established` | 5 paseos registrados o una quedada | Organizar quedadas y publicar un espacio |

Dos detalles que no son cosméticos:

- **El check-in está en `declared`** porque expone a quien lo pulsa y a nadie
  más. Cobrar un peaje por enseñarte tú sería proteger al revés.
- **El último peldaño se gana usando la aplicación**, no rellenando nada. Es la
  única parte de la escalera que no se puede escribir a mano, y por eso guarda
  lo que más daño haría en malas manos: convocar a un grupo y abrirle tu casa.

### El chip no es obligatorio para entrar

Es la decisión que más se puede discutir. Hay animales adoptados hace años o de
países donde no era obligatorio, y dejar fuera a sus tutores no protege a nadie.
El chip **abre puertas** en vez de cerrar la entrada.

Lo que sí se hace con el número es validar su formato con el validador ISO
11784/11785 real (`packages/trackers/src/microchip.ts`), y decir lo que eso
significa y lo que no: el número de la cartilla no lleva dígito de control, así
que **formato correcto no es chip existente**. Queda como *declarado*;
*verificado* pide documento veterinario.

### El papel de rescatista de un tutor también está detrás del chip

Amplía a kilómetros lo que te llega sobre animales heridos, perdidos o sin
dueño. Es exactamente la lista que no debe poder consultar quien esté buscando
animales fáciles de coger. Era el hueco más grande que quedaba: el catálogo
llevaba desde el principio dos radios por escenario (`alertReachM`) y la
aplicación no preguntaba cuál eres.

---

## 3. La segunda puerta: quien rescata y no tiene animal

Protectoras, albergues, casas de acogida, quien alimenta colonias. Dejarlas
fuera por la regla de arriba sería quitarle a esta aplicación justo a las
personas que la usarían para lo que más importa.

Entran por otra puerta y **a otra habitación**: se pide el enlace al perfil
público del colectivo —la cuenta que ya tienen y que ya se puede mirar— y la
cuenta queda **pendiente de revisión**.

| Peldaño | Qué abre |
|---|---|
| `shelter_pending` | Sitios y feed. Nada más |
| `shelter` | Avisos de rescate a kilómetros y escribir el primero |

**Esperar no abre nada.** Si la espera diera acceso a algo, la espera sería la
vía de entrada: cualquiera pega un enlace y se sienta.

**Aprobada no abre quién pasea ni los horarios de nadie**, y no es un descuido.
Rescatar no necesita saber a qué hora saca cada vecino a su perro, y si esa
lista se abriera enseñando un enlace, enseñar un enlace sería la forma más
barata de conseguirla. Por eso los niveles **no están en una línea** —una
protectora aprobada ve más rescate que un tutor verificado y menos gente— y por
eso las capacidades son una tabla y no una comparación de `>=`: con un `>=` esto
no se puede expresar, y al intentarlo se acaba dando de más.

### Qué se comprueba del enlace, y qué no

En código solo se puede mirar la **forma**. No hay API pública que diga si una
cuenta existe, y aunque la hubiera, el enlace de una cuenta ajena lo pega
cualquiera en diez segundos. Por eso la revisión es humana.

Aun así descarta lo que se manda cuando no hay nada detrás:

- **Acortadores** (bit.ly y compañía): un enlace que no dice a dónde va no se
  puede revisar, y quien revisa acabaría abriendo lo que le manden.
- **Publicaciones sueltas** en vez del perfil: un post no dice cuánto lleva la
  cuenta ni qué hace.
- **La portada de la red** o una búsqueda.

Se acepta una **web propia**, y no por generosidad: en América Latina media
protectora se organiza en una página de Facebook o en un sitio hecho a mano, y
exigir una lista cerrada de redes dejaría fuera a las de siempre.

Qué hace el colectivo se elige entre opciones, no se escribe: la misma regla que
en los avisos de rescate, donde un campo de texto libre acaba siendo un campo
para escribir sobre alguien.

---

## 4. Cómo está comprobado

**En el núcleo** (38 tests). Dos de ellos afirman que algo *sigue sin poder
hacerse*: que sin cuenta no se ve ni el mapa de sitios, y que una protectora
aprobada no ve quién pasea. Están escritos sobre la tabla de capacidades y no
sobre el texto de una pantalla, porque una regla de privacidad que vive en un
`if` dentro de un componente se pierde en el siguiente rediseño.

**En la pantalla**, que es donde el núcleo no llega. La auditoría del
empaquetado (`scripts/check-app-artifact.mjs`) da de alta un perro como lo haría
alguien —rellena el nombre, la edad, las fichas de tamaño, carácter, días y
franja— y después:

1. Comprueba que el radar **no** lista a nadie y que explica por qué.
2. Verifica el chip por el camino real: perfil → menú → configuración.
3. Comprueba que entonces **sí**.

Sin el paso 3, un radar roto pasaría por privado.

Quitando la guarda del radar a mano, la auditoría se pone roja con los dos
avisos que corresponden. Esa es la prueba de que la comprobación mide algo.

---

## 5. Los dos atajos de demostración, dichos donde están

Verificar el chip y aprobar una protectora son, en esta versión, dos
interruptores en configuración marcados como lo que son. La verificación de
verdad pide la cartilla del veterinario; la revisión de una protectora la hace
una persona mirando el perfil.

Están accesibles porque sin ellos no se podría ver funcionando la mitad de la
regla —qué abre cada peldaño y qué sigue sin abrir—, que es justo la parte que
hay que poder discutir. Es la misma postura que la semilla de rescate, que
enseña un parque que se marca y otro que no.

Y una limitación de la demostración, dicha en la propia pantalla de la cuenta de
protectora: esa cuenta conserva a Nina y a Kira para que el resto de pantallas
tengan contenido. En una cuenta de protectora de verdad no habría animales
propios — por eso esta no puede hacer check-in ni organizar quedadas.
