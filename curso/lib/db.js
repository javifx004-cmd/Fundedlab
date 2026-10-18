/*
 * Base de datos SQLite (módulo integrado node:sqlite, sin dependencias nativas).
 * Guarda alumnos, compras, enlaces de acceso, sesiones (dispositivos) y progreso.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

export const hash = (s) => createHash('sha256').update(s).digest('hex');
export const token = (n = 32) => randomBytes(n).toString('base64url');
export const normEmail = (e) => String(e || '').trim().toLowerCase();

export function openDb(dir) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, 'curso.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      access_until INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS purchases (
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
    );
    CREATE INDEX IF NOT EXISTS purchases_pi ON purchases(payment_intent);
    CREATE TABLE IF NOT EXISTS login_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device TEXT,
      ip TEXT,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL,
      done_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, module_id)
    );
    CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      what TEXT NOT NULL,
      ip TEXT,
      at INTEGER NOT NULL
    );
  `);
  return db;
}

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

export function makeStore(db, { months = 3, maxDevices = 2 } = {}) {
  const q = (sql) => db.prepare(sql);
  const s = {
    userByEmail: q('SELECT * FROM users WHERE email = ?'),
    userById: q('SELECT * FROM users WHERE id = ?'),
    insUser: q('INSERT INTO users (email, created_at) VALUES (?, ?)'),
    setAccess: q('UPDATE users SET access_until = ? WHERE id = ?'),
    purchaseBySession: q('SELECT * FROM purchases WHERE stripe_session = ?'),
    purchasesByPi: q('SELECT * FROM purchases WHERE payment_intent = ? AND revoked_at IS NULL'),
    insPurchase: q('INSERT INTO purchases (user_id, stripe_session, payment_intent, amount, currency, source, months, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    usedAutologin: q('UPDATE purchases SET autologin_used = 1 WHERE id = ? AND autologin_used = 0'),
    revokePurchase: q('UPDATE purchases SET revoked_at = ? WHERE id = ?'),
    activePurchases: q('SELECT * FROM purchases WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at'),
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
    allUsers: q('SELECT u.*, (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS devices FROM users u ORDER BY created_at DESC'),
  };

  function getOrCreateUser(email) {
    email = normEmail(email);
    let u = s.userByEmail.get(email);
    if (!u) {
      s.insUser.run(email, Date.now());
      u = s.userByEmail.get(email);
    }
    return u;
  }

  // Recalcula el acceso a partir de las compras vigentes: cada compra suma `months` meses
  // desde su fecha o desde que terminaba el acceso anterior (si compra antes de que caduque).
  function recompute(userId) {
    let until = 0;
    for (const p of s.activePurchases.all(userId)) until = addMonths(Math.max(until, p.created_at), p.months);
    s.setAccess.run(until, userId);
    return until;
  }

  return {
    raw: s,
    getOrCreateUser,
    userByEmail: (e) => s.userByEmail.get(normEmail(e)),
    userById: (id) => s.userById.get(id),

    // Idempotente: la misma sesión de Stripe (webhook + página de gracias) solo cuenta una vez.
    grant({ email, stripeSession = null, paymentIntent = null, amount = null, currency = null, source = 'stripe', months: m = months }) {
      const existing = stripeSession && s.purchaseBySession.get(stripeSession);
      if (existing) return { user: s.userById.get(existing.user_id), purchase: existing, created: false };
      db.exec('BEGIN IMMEDIATE');
      try {
        const u = getOrCreateUser(email);
        s.insPurchase.run(u.id, stripeSession, paymentIntent, amount, currency, source, m, Date.now());
        recompute(u.id);
        db.exec('COMMIT');
        const purchase = stripeSession ? s.purchaseBySession.get(stripeSession) : null;
        return { user: s.userById.get(u.id), purchase, created: true };
      } catch (e) {
        db.exec('ROLLBACK');
        if (String(e.message).includes('UNIQUE') && stripeSession) {
          const p = s.purchaseBySession.get(stripeSession);
          return { user: s.userById.get(p.user_id), purchase: p, created: false };
        }
        throw e;
      }
    },

    // Reembolso o disputa: anula la compra, recalcula el acceso y cierra sus sesiones si se queda sin él.
    revokeByPaymentIntent(pi) {
      const affected = [];
      for (const p of s.purchasesByPi.all(pi)) {
        s.revokePurchase.run(Date.now(), p.id);
        const until = recompute(p.user_id);
        if (until <= Date.now()) s.delSessionsOf.run(p.user_id);
        affected.push(p.user_id);
      }
      return affected;
    },

    revokeUser(email) {
      const u = s.userByEmail.get(normEmail(email));
      if (!u) return false;
      for (const p of s.activePurchases.all(u.id)) s.revokePurchase.run(Date.now(), p.id);
      s.setAccess.run(0, u.id);
      s.delSessionsOf.run(u.id);
      return true;
    },

    claimAutologin: (purchaseId) => s.usedAutologin.run(purchaseId).changes === 1,

    newLoginToken(userId, ttlMs = 30 * 60e3) {
      const t = token();
      s.gcTokens.run(Date.now() - 864e5);
      s.insToken.run(hash(t), userId, Date.now() + ttlMs);
      return t;
    },
    useLoginToken(t) {
      const now = Date.now();
      return s.useToken.get(now, hash(String(t)), now)?.user_id ?? null;
    },

    // Crea una sesión de dispositivo. Si ya hay `maxDevices`, se cierra la más antigua:
    // la cuenta solo puede estar abierta a la vez en un número limitado de dispositivos.
    newSession(userId, { device, ip }) {
      const sid = token();
      const now = Date.now();
      const list = s.sessionsOf.all(userId);
      for (const old of list.slice(Math.max(0, maxDevices - 1))) s.delSession.run(old.id_hash);
      s.insSession.run(hash(sid), userId, String(device || '').slice(0, 200), ip, now, now);
      return sid;
    },
    session(sid) {
      if (!sid) return null;
      return s.session.get(hash(String(sid))) || null;
    },
    touch(sid, ip) { s.touch.run(Date.now(), ip, hash(String(sid))); },
    endSession(sid) { s.delSession.run(hash(String(sid))); },
    sessionsOf: (userId) => s.sessionsOf.all(userId),

    progress: (userId) => s.progress.all(userId).map((r) => r.module_id),
    setProgress(userId, moduleId, done) {
      if (done) s.setDone.run(userId, moduleId, Date.now());
      else s.unsetDone.run(userId, moduleId);
    },
    log: (userId, what, ip) => s.log.run(userId, what, ip, Date.now()),
    users: () => s.allUsers.all(),
  };
}
