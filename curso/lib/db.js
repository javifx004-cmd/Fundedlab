/*
 * Base de datos (libSQL / SQLite).
 *  - Con TURSO_DATABASE_URL (libsql://…) usa una base de datos de Turso: gratis y persistente, para servidores
 *    gratuitos cuyo disco se borra al reiniciar (Render Free).
 *  - Si no, un archivo SQLite local en DATA_DIR.
 * Guarda alumnos, compras, enlaces de acceso, sesiones (dispositivos) y progreso.
 */
import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

export const hash = (s) => createHash('sha256').update(s).digest('hex');
export const token = (n = 32) => randomBytes(n).toString('base64url');
export const normEmail = (e) => String(e || '').trim().toLowerCase();

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    access_until INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_session TEXT UNIQUE,
    payment_intent TEXT,
    amount INTEGER,
    currency TEXT,
    source TEXT NOT NULL DEFAULT 'stripe',
    months INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    autologin_used INTEGER NOT NULL DEFAULT 0,
    revoked_at INTEGER
  )`,
  'CREATE INDEX IF NOT EXISTS purchases_pi ON purchases(payment_intent)',
  `CREATE TABLE IF NOT EXISTS login_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device TEXT,
    ip TEXT,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)',
  `CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    done_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, module_id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pay_requests (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL,
    phone TEXT,
    method TEXT,
    note TEXT,
    ip TEXT,
    status TEXT NOT NULL DEFAULT 'pendiente',
    created_at INTEGER NOT NULL,
    resolved_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS access_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    what TEXT NOT NULL,
    ip TEXT,
    at INTEGER NOT NULL
  )`,
];

export async function openDb({ dir, url, authToken }) {
  let client;
  if (url) {
    client = createClient({ url, authToken });
  } else {
    mkdirSync(dir, { recursive: true });
    client = createClient({ url: `file:${join(dir, 'curso.sqlite')}` });
    await client.execute('PRAGMA journal_mode = WAL');
  }
  await client.batch(SCHEMA, 'write');
  return client;
}

// Filas de libSQL → objetos planos
const plain = (row) => (row ? Object.fromEntries(Object.entries(row)) : undefined);

// Suma `months` meses a una fecha (en ms), conservando el día cuando existe.
export function addMonths(ms, months) {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime();
}

export function makeStore(client, { months = 3, maxDevices = 2 } = {}) {
  const q = (sql) => ({
    get: async (...args) => plain((await client.execute({ sql, args })).rows[0]),
    all: async (...args) => (await client.execute({ sql, args })).rows.map(plain),
    run: async (...args) => ({ changes: (await client.execute({ sql, args })).rowsAffected }),
  });
  const s = {
    userByEmail: q('SELECT * FROM users WHERE email = ?'),
    userById: q('SELECT * FROM users WHERE id = ?'),
    insUser: q('INSERT OR IGNORE INTO users (email, created_at) VALUES (?, ?)'),
    setAccess: q('UPDATE users SET access_until = ? WHERE id = ?'),
    purchaseBySession: q('SELECT * FROM purchases WHERE stripe_session = ?'),
    purchasesByPi: q('SELECT * FROM purchases WHERE payment_intent = ? AND revoked_at IS NULL'),
    insPurchase: q('INSERT INTO purchases (user_id, stripe_session, payment_intent, amount, currency, source, months, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    usedAutologin: q('UPDATE purchases SET autologin_used = 1 WHERE id = ? AND autologin_used = 0'),
    revokePurchase: q('UPDATE purchases SET revoked_at = ? WHERE id = ?'),
    activePurchases: q('SELECT * FROM purchases WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at, id'),
    insToken: q('INSERT INTO login_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    useToken: q('UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING user_id'),
    gcTokens: q('DELETE FROM login_tokens WHERE expires_at < ?'),
    insSession: q('INSERT INTO sessions (id_hash, user_id, device, ip, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)'),
    session: q('SELECT s.*, u.email, u.access_until FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?'),
    touch: q('UPDATE sessions SET last_seen = ?, ip = ? WHERE id_hash = ?'),
    sessionsOf: q('SELECT id_hash, device, ip, created_at, last_seen FROM sessions WHERE user_id = ? ORDER BY last_seen DESC'),
    delSession: q('DELETE FROM sessions WHERE id_hash = ?'),
    delSessionsOf: q('DELETE FROM sessions WHERE user_id = ?'),
    progress: q('SELECT module_id FROM progress WHERE user_id = ?'),
    setDone: q('INSERT OR REPLACE INTO progress (user_id, module_id, done_at) VALUES (?, ?, ?)'),
    unsetDone: q('DELETE FROM progress WHERE user_id = ? AND module_id = ?'),
    log: q('INSERT INTO access_log (user_id, what, ip, at) VALUES (?, ?, ?, ?)'),
    settings: q('SELECT key, value FROM settings'),
    setSetting: q('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
    insRequest: q('INSERT INTO pay_requests (email, phone, method, note, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    requests: q("SELECT * FROM pay_requests WHERE status = 'pendiente' ORDER BY created_at DESC LIMIT 200"),
    request: q('SELECT * FROM pay_requests WHERE id = ?'),
    setRequest: q('UPDATE pay_requests SET status = ?, resolved_at = ? WHERE id = ?'),
    allUsers: q('SELECT u.*, (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS devices FROM users u ORDER BY created_at DESC'),
  };

  async function getOrCreateUser(email) {
    email = normEmail(email);
    await s.insUser.run(email, Date.now());
    return s.userByEmail.get(email);
  }

  // Recalcula el acceso a partir de las compras vigentes: cada compra suma `months` meses
  // desde su fecha o desde que terminaba el acceso anterior (si compra antes de que caduque).
  async function recompute(userId) {
    let until = 0;
    for (const p of await s.activePurchases.all(userId)) until = addMonths(Math.max(until, p.created_at), p.months);
    await s.setAccess.run(until, userId);
    return until;
  }

  return {
    raw: s,
    getOrCreateUser,
    userByEmail: (e) => s.userByEmail.get(normEmail(e)),
    userById: (id) => s.userById.get(id),

    // Idempotente: la misma sesión de Stripe (webhook + página de gracias) solo cuenta una vez
    // (la columna stripe_session es única).
    async grant({ email, stripeSession = null, paymentIntent = null, amount = null, currency = null, source = 'stripe', months: m = months }) {
      const existing = stripeSession && (await s.purchaseBySession.get(stripeSession));
      if (existing) return { user: await s.userById.get(existing.user_id), purchase: existing, created: false };
      const u = await getOrCreateUser(email);
      try {
        await s.insPurchase.run(u.id, stripeSession, paymentIntent, amount, currency, source, m, Date.now());
      } catch (e) {
        if (stripeSession && /UNIQUE/i.test(e.message)) {
          const p = await s.purchaseBySession.get(stripeSession);
          return { user: await s.userById.get(p.user_id), purchase: p, created: false };
        }
        throw e;
      }
      await recompute(u.id);
      const purchase = stripeSession ? await s.purchaseBySession.get(stripeSession) : null;
      return { user: await s.userById.get(u.id), purchase, created: true };
    },

    // Reembolso o disputa: anula la compra, recalcula el acceso y cierra sus sesiones si se queda sin él.
    async revokeByPaymentIntent(pi) {
      const affected = [];
      for (const p of await s.purchasesByPi.all(pi)) {
        await s.revokePurchase.run(Date.now(), p.id);
        const until = await recompute(p.user_id);
        if (until <= Date.now()) await s.delSessionsOf.run(p.user_id);
        affected.push(p.user_id);
      }
      return affected;
    },

    async revokeUser(email) {
      const u = await s.userByEmail.get(normEmail(email));
      if (!u) return false;
      for (const p of await s.activePurchases.all(u.id)) await s.revokePurchase.run(Date.now(), p.id);
      await s.setAccess.run(0, u.id);
      await s.delSessionsOf.run(u.id);
      return true;
    },

    claimAutologin: async (purchaseId) => (await s.usedAutologin.run(purchaseId)).changes === 1,

    async newLoginToken(userId, ttlMs = 30 * 60e3) {
      const t = token();
      await s.gcTokens.run(Date.now() - 864e5);
      await s.insToken.run(hash(t), userId, Date.now() + ttlMs);
      return t;
    },
    async useLoginToken(t) {
      const now = Date.now();
      return (await s.useToken.get(now, hash(String(t)), now))?.user_id ?? null;
    },

    // Crea una sesión de dispositivo. Si ya hay `max`, se cierra la más antigua:
    // la cuenta solo puede estar abierta a la vez en un número limitado de dispositivos.
    async newSession(userId, { device, ip, max = maxDevices }) {
      const sid = token();
      const now = Date.now();
      const list = await s.sessionsOf.all(userId);
      for (const old of list.slice(Math.max(0, max - 1))) await s.delSession.run(old.id_hash);
      await s.insSession.run(hash(sid), userId, String(device || '').slice(0, 200), ip ?? null, now, now);
      return sid;
    },
    async session(sid) {
      if (!sid) return null;
      return (await s.session.get(hash(String(sid)))) || null;
    },
    touch: (sid, ip) => s.touch.run(Date.now(), ip ?? null, hash(String(sid))),
    endSession: (sid) => s.delSession.run(hash(String(sid))),
    endSessionsOf: (userId) => s.delSessionsOf.run(userId),
    sessionsOf: (userId) => s.sessionsOf.all(userId),

    progress: async (userId) => (await s.progress.all(userId)).map((r) => r.module_id),
    setProgress: (userId, moduleId, done) => (done ? s.setDone.run(userId, moduleId, Date.now()) : s.unsetDone.run(userId, moduleId)),
    log: (userId, what, ip) => s.log.run(userId, what, ip ?? null, Date.now()),
    users: () => s.allUsers.all(),

    // Ajustes editables desde el panel (formas de pago manual).
    async settings() { return Object.fromEntries((await s.settings.all()).map((r) => [r.key, r.value])); },
    setSetting: (k, v) => s.setSetting.run(k, String(v ?? '')),

    // Avisos de «ya he pagado» (PayPal / Bizum) que el administrador confirma a mano.
    addRequest: ({ email, phone, method, note, ip }) => s.insRequest.run(normEmail(email), phone || null, method || null, note || null, ip ?? null, Date.now()),
    pendingRequests: () => s.requests.all(),
    request: (id) => s.request.get(id),
    resolveRequest: (id, status) => s.setRequest.run(status, Date.now(), id),
  };
}
