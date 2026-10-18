// Cifra content-src/ en content/ para poder publicarlo en el repositorio.
//   npm run seal -- --new-key   → genera una CONTENT_KEY nueva (guárdala: sin ella no se puede descifrar)
//   CONTENT_KEY=... npm run seal
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seal, parseKey } from '../lib/content.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.argv.includes('--new-key')) {
  console.log(randomBytes(32).toString('base64'));
  process.exit(0);
}
const key = parseKey(process.env.CONTENT_KEY);
const n = seal(join(root, 'content-src'), join(root, 'content'), key);
console.log(`Contenido cifrado en content/ (${n} vídeos).`);
