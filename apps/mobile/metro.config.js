/**
 * Metro en un monorepo pnpm.
 *
 * Hay que decirle explícitamente dónde vive la raíz y dónde buscar módulos: con
 * pnpm las dependencias están enlazadas simbólicamente y el resolutor por
 * defecto no las encuentra al subir por el árbol.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// La búsqueda jerárquica se deja ACTIVADA a propósito. Con el enlazado aislado
// de pnpm, las dependencias de un paquete viven dentro de su propia carpeta en
// el almacén, y desactivarla obliga a declarar en la aplicación cada
// dependencia transitiva que Expo usa sin declarar. Es la diferencia entre que
// Metro encuentre `expo-modules-core` desde `expo` o que no lo encuentre.
config.resolver.disableHierarchicalLookup = false;

// Los enlaces simbólicos son la forma en que pnpm conecta los paquetes del
// monorepo; sin esto Metro no sigue el enlace a packages/core.
config.resolver.unstable_enableSymlinks = true;

/**
 * Una sola copia de React, y la de esta aplicación.
 *
 * El monorepo tiene dos: la web va con React 19 y Expo con 18.3. pnpm deja
 * **una** de las dos en `node_modules/.pnpm/node_modules/react` —la que le
 * toque—, y con la búsqueda jerárquica encendida (que hace falta, ver arriba)
 * Metro la encontraba desde dentro del almacén y la metía en el paquete junto a
 * la 18. Dos Reacts en un solo bundle mueren con el error #31 de React en
 * cuanto se pinta el primer componente, y solo en la máquina donde pnpm eligió
 * la 19: en otra funciona, y eso es lo peor que puede hacer un fallo.
 *
 * Aquí se fija: todo lo que pida `react`, `react-dom`, `react-native` o
 * `react-native-web` se resuelve contra la copia declarada en `apps/mobile`,
 * venga de donde venga la petición.
 */
/* Solo lo que esta aplicación declara: `scheduler`, por ejemplo, no está en
   su package.json y lo trae `react-dom` consigo, así que fijarlo aquí sería
   apuntar a una carpeta que no existe. */
const PINNED = ['react', 'react-dom', 'react-native', 'react-native-web'].filter((name) =>
  require('node:fs').existsSync(path.join(projectRoot, 'node_modules', name)),
);
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pinned = PINNED.find((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  if (pinned) {
    const rest = moduleName.slice(pinned.length);
    const target = path.join(projectRoot, 'node_modules', pinned) + rest;
    return context.resolveRequest({ ...context, originModulePath: projectRoot }, target, platform);
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
