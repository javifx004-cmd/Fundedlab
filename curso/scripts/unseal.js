// Descifra content/ en content-src/ para editar el curso:  CONTENT_KEY=... npm run unseal
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unseal, parseKey } from '../lib/content.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const n = unseal(join(root, 'content'), join(root, 'content-src'), parseKey(process.env.CONTENT_KEY));
console.log(`${n} archivos descifrados en content-src/ (y los vídeos en content-src/videos/).`);
