// Flujo completo: webhook de Stripe → acceso de 3 meses → contenido con marca de agua → límite de dispositivos → reembolso.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = mkdtempSync(join(tmpdir(), 'fl-test-'));
Object.assign(process.env, {
  DATA_DIR: dir,
  STRIPE_SECRET_KEY: 'sk_test_dummy',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  BASE_URL: 'http://localhost',
  ADMIN_PASSWORD: 'admin-token-de-prueba-123',
  ADMIN_EMAILS: 'Jefe@Correo.com',
});
delete process.env.STRIPE_PRICE_ID;
delete process.env.CONTENT_KEY;
delete process.env.TURSO_DATABASE_URL;

const { app, store, content } = await import('../server.js');
const Stripe = (await import('stripe')).default;
const stripe = new Stripe('sk_test_dummy');
let server, base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

async function webhook(type, object) {
  const payload = JSON.stringify({ id: `evt_${Math.random()}`, object: 'event', type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_secret' });
  return fetch(`${base}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': header }, body: payload });
}

async function loginAs(email) {
  const u = await store.userByEmail(email);
  const t = await store.newLoginToken(u.id);
  const r = await fetch(`${base}/acceso?t=${t}`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  return r.headers.get('set-cookie').split(';')[0];
}

const session = (id, email) => ({ id, object: 'checkout.session', mode: 'payment', payment_status: 'paid', customer_details: { email }, amount_total: 19700, currency: 'eur', payment_intent: `pi_${id}` });

test('rechaza webhooks sin firma válida', async () => {
  const r = await fetch(`${base}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=1,v1=x' }, body: '{}' });
  assert.equal(r.status, 400);
});

test('la compra da 3 meses de acceso y no cuenta dos veces', async () => {
  assert.equal((await webhook('checkout.session.completed', session('cs_1', 'Alumno@Correo.com'))).status, 200);
  assert.equal((await webhook('checkout.session.completed', session('cs_1', 'alumno@correo.com'))).status, 200);
  const u = await store.userByEmail('alumno@correo.com');
  const days = (u.access_until - Date.now()) / 864e5;
  assert.ok(days > 88 && days < 93, `días: ${days}`);
});

test('sin sesión no hay contenido', async () => {
  assert.equal((await fetch(`${base}/api/module/08-entrada`)).status, 401);
  assert.equal((await fetch(`${base}/api/pdf`)).status, 401);
});

test('el contenido lleva el correo del alumno', async () => {
  const cookie = await loginAs('alumno@correo.com');
  const r = await fetch(`${base}/api/module/08-entrada`, { headers: { cookie } });
  assert.equal(r.status, 200);
  const { html } = await r.json();
  assert.match(html, /alumno@correo\.com · FL-\d{5}-/);
  assert.ok((html.match(/alumno@correo\.com/g) || []).length > 10, 'marca en figuras y licencia');
  const pdf = await fetch(`${base}/api/pdf`, { headers: { cookie } });
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
});

test('un enlace de acceso solo sirve una vez', async () => {
  const u = await store.userByEmail('alumno@correo.com');
  const t = await store.newLoginToken(u.id);
  assert.equal((await fetch(`${base}/acceso?t=${t}`, { redirect: 'manual' })).headers.get('location'), '/app');
  assert.equal((await fetch(`${base}/acceso?t=${t}`, { redirect: 'manual' })).headers.get('location'), '/entrar?caducado=1');
});

test('máximo 2 dispositivos: el más antiguo se cierra', async () => {
  const a = await loginAs('alumno@correo.com');
  const b = await loginAs('alumno@correo.com');
  const c = await loginAs('alumno@correo.com');
  assert.equal((await fetch(`${base}/api/me`, { headers: { cookie: a } })).status, 401);
  assert.equal((await fetch(`${base}/api/me`, { headers: { cookie: b } })).status, 200);
  assert.equal((await fetch(`${base}/api/me`, { headers: { cookie: c } })).status, 200);
});

test('el vídeo se sirve por rangos y solo con sesión', { skip: !content.videos.size && 'sin vídeos generados' }, async () => {
  const id = [...content.videos][0];
  assert.equal((await fetch(`${base}/api/video/${id}`)).status, 401);
  const cookie = await loginAs('alumno@correo.com');
  const r = await fetch(`${base}/api/video/${id}`, { headers: { cookie, range: 'bytes=0-99' } });
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, 100);
  assert.ok(existsSync(join(dir, 'cache', 'wm')), 'copia con marca grabada');
});

test('acceso caducado → 402', async () => {
  await webhook('checkout.session.completed', session('cs_2', 'caducado@correo.com'));
  const cookie = await loginAs('caducado@correo.com');
  const u = await store.userByEmail('caducado@correo.com');
  await store.raw.setAccess.run(Date.now() - 1000, u.id);
  assert.equal((await fetch(`${base}/api/course`, { headers: { cookie } })).status, 402);
});

test('una segunda compra suma 3 meses al final', async () => {
  await webhook('checkout.session.completed', session('cs_3', 'renueva@correo.com'));
  const first = (await store.userByEmail('renueva@correo.com')).access_until;
  await webhook('checkout.session.completed', session('cs_4', 'renueva@correo.com'));
  const second = (await store.userByEmail('renueva@correo.com')).access_until;
  const extra = (second - first) / 864e5;
  assert.ok(extra > 88 && extra < 93, `extra: ${extra}`);
});

test('el reembolso retira el acceso y cierra las sesiones', async () => {
  const cookie = await loginAs('alumno@correo.com');
  assert.equal((await webhook('charge.refunded', { object: 'charge', refunded: true, payment_intent: 'pi_cs_1' })).status, 200);
  assert.equal((await fetch(`${base}/api/me`, { headers: { cookie } })).status, 401);
  assert.ok((await store.userByEmail('alumno@correo.com')).access_until <= Date.now());
});

test('el login no revela si un correo ha comprado', async () => {
  const a = await (await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nadie@correo.com' }) })).json();
  const b = await (await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'renueva@correo.com' }) })).json();
  assert.equal(a.message, b.message);
});

test('admin: API con contraseña, alta manual y búsqueda de licencia', async () => {
  const h = { Authorization: 'Bearer admin-token-de-prueba-123', 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/api/admin/users`)).status, 403);
  const g = await (await fetch(`${base}/api/admin/grant`, { method: 'POST', headers: h, body: JSON.stringify({ email: 'regalo@correo.com' }) })).json();
  assert.ok(g.accessUntil > Date.now());
  assert.match(g.link, /\/acceso\?t=/);
  const who = await (await fetch(`${base}/api/admin/license/${g.license}`, { headers: h })).json();
  assert.equal(who.email, 'regalo@correo.com');
});

test('el administrador entra gratis, sin caducidad, y gestiona alumnos desde su sesión', async () => {
  const post = (path, body, cookie) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
  assert.equal((await post('/api/admin/login', { email: 'jefe@correo.com', password: 'mal' })).status, 403);
  assert.equal((await post('/api/admin/login', { email: 'otro@correo.com', password: 'admin-token-de-prueba-123' })).status, 403);
  const r = await post('/api/admin/login', { email: 'jefe@correo.com', password: 'admin-token-de-prueba-123' });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(`${base}/api/me`, { headers: { cookie } })).json();
  assert.equal(me.admin, true);
  assert.equal(me.accessUntil, null);
  assert.equal((await fetch(`${base}/api/module/18-ejemplos-base`, { headers: { cookie } })).status, 200);

  // Dar acceso a un alumno con el enlace para WhatsApp, y que el enlace funcione
  const g = await (await post('/api/admin/grant', { email: 'nuevo@correo.com', months: 3 }, cookie)).json();
  const enter = await fetch(g.link.replace('http://localhost', base), { redirect: 'manual' });
  assert.equal(enter.headers.get('location'), '/app');
  const alumno = enter.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(`${base}/api/course`, { headers: { cookie: alumno } })).status, 200);

  // Un alumno no puede usar el panel
  assert.equal((await fetch(`${base}/api/admin/users`, { headers: { cookie: alumno } })).status, 403);

  // Bloquear: pierde el acceso al instante
  assert.equal((await post('/api/admin/revoke', { email: 'nuevo@correo.com' }, cookie)).status, 200);
  assert.equal((await fetch(`${base}/api/course`, { headers: { cookie: alumno } })).status, 401);
  const list = await (await fetch(`${base}/api/admin/users`, { headers: { cookie } })).json();
  assert.equal(list.find((u) => u.email === 'nuevo@correo.com').active, false);
  assert.equal(list.find((u) => u.email === 'jefe@correo.com').admin, true);

  // No se puede bloquear al administrador
  assert.equal((await post('/api/admin/revoke', { email: 'jefe@correo.com' }, cookie)).status, 400);
});
