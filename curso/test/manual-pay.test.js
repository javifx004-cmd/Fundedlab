// Pago manual (PayPal / Bizum): configuración en el panel, aviso del comprador y alta desde el panel.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = mkdtempSync(join(tmpdir(), 'fl-manual-'));
Object.assign(process.env, { DATA_DIR: dir, BASE_URL: 'http://localhost', ADMIN_EMAILS: 'jefe@correo.com', ADMIN_PASSWORD: 'clave-del-panel-123', COURSE_PRICE_LABEL: '99,99 €' });
for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET', 'CONTENT_KEY', 'TURSO_DATABASE_URL']) delete process.env[k];

const { app } = await import('../server.js');
let server, base, admin;
const post = (path, body, cookie) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const r = await post('/api/admin/login', { email: 'jefe@correo.com', password: 'clave-del-panel-123' });
  admin = r.headers.get('set-cookie').split(';')[0];
});
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

test('sin formas de pago, la venta está desactivada', async () => {
  const c = await (await fetch(`${base}/api/config`)).json();
  assert.equal(c.checkout, false);
  assert.equal(c.manual, null);
  assert.equal((await post('/api/pay-request', { email: 'a@b.com' })).status, 503);
});

test('el panel configura PayPal y Bizum, y la web los muestra', async () => {
  assert.equal((await post('/api/admin/settings', { paypal: 'https://paypal.me/grupolab', bizum: '600 11 22 33' })).status, 403);
  await post('/api/admin/settings', { paypal: 'https://paypal.me/grupolab', bizum: '600 11 22 33' }, admin);
  const c = await (await fetch(`${base}/api/config`)).json();
  assert.equal(c.manual.paypal, 'https://paypal.me/grupolab/99.99EUR');
  assert.equal(c.manual.bizum, '600112233');
  const st = await (await fetch(`${base}/api/admin/status`, { headers: { cookie: admin } })).json();
  assert.equal(st.manual, true);
});

test('aviso de pago → el administrador da acceso → el enlace funciona', async () => {
  const r = await post('/api/pay-request', { email: 'Comprador@Correo.com', phone: '611 22 33 44', method: 'bizum' });
  assert.equal(r.status, 200);
  const list = await (await fetch(`${base}/api/admin/requests`, { headers: { cookie: admin } })).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].email, 'comprador@correo.com');
  const g = await (await post(`/api/admin/requests/${list[0].id}`, { action: 'grant' }, admin)).json();
  assert.ok(g.accessUntil > Date.now() + 80 * 864e5);
  assert.equal(g.phone, '611 22 33 44');
  const enter = await fetch(g.link.replace('http://localhost', base), { redirect: 'manual' });
  assert.equal(enter.headers.get('location'), '/app');
  assert.equal((await (await fetch(`${base}/api/admin/requests`, { headers: { cookie: admin } })).json()).length, 0);
});

test('un aviso se puede descartar sin dar acceso', async () => {
  await post('/api/pay-request', { email: 'falso@correo.com', method: 'paypal' });
  const [r] = await (await fetch(`${base}/api/admin/requests`, { headers: { cookie: admin } })).json();
  await post(`/api/admin/requests/${r.id}`, { action: 'dismiss' }, admin);
  const users = await (await fetch(`${base}/api/admin/users`, { headers: { cookie: admin } })).json();
  assert.ok(!users.find((u) => u.email === 'falso@correo.com'));
});
