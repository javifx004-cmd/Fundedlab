// Gestión manual de alumnos en el servidor (usa la misma base de datos que la app):
//   npm run grant -- alumno@correo.com [meses]   → da acceso (p. ej. regalos o pagos fuera de Stripe)
//   npm run grant -- --revoke alumno@correo.com  → quita el acceso y cierra sus sesiones
//   npm run grant -- --list                      → lista los alumnos
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, makeStore } from '../lib/db.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = await openDb({ dir: process.env.DATA_DIR || join(root, 'data'), url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const store = makeStore(db, { months: Number(process.env.ACCESS_MONTHS || 3) });
const [a, b] = process.argv.slice(2);
const d = (ms) => (ms ? new Date(ms).toLocaleString('es-ES') : '—');
if (a === '--list') {
  for (const u of await store.users()) console.log(`${u.email.padEnd(36)} ${u.access_until > Date.now() ? 'ACTIVO ' : 'caducado'} hasta ${d(u.access_until)} · ${u.devices} disp.`);
} else if (a === '--revoke' && b) {
  console.log((await store.revokeUser(b)) ? `Acceso retirado a ${b}` : `No existe ${b}`);
} else if (a && a.includes('@')) {
  const r = await store.grant({ email: a, source: 'manual', months: Number(b || process.env.ACCESS_MONTHS || 3) });
  console.log(`${r.user.email}: acceso hasta ${d(r.user.access_until)}`);
} else {
  console.log('Uso: npm run grant -- correo [meses] | --revoke correo | --list');
}
