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

module.exports = config;
