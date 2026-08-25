import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { buildTokensCss } = await import(resolve(here, '../dist/css.js'));

const out = resolve(here, '../dist/tokens.css');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buildTokensCss(), 'utf8');
console.log(`tokens.css -> ${out}`);
