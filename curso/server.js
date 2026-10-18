/*
 * Funded Lab · Curso de trading de futuros
 * Servidor de la app: venta con Stripe, acceso personal de 3 meses, contenido protegido y marca de agua por alumno.
 */
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import Stripe from 'stripe';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, makeStore, normEmail, hash } from './lib/db.js';
import { loadCourse } from './lib/content.js';
import { renderModule } from './lib/render.js';
import { makeMailer } from './lib/mail.js';
import { stampPdf, watermarkedVideo, hasFfmpeg } from './lib/protect.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const cfg = {
  port: Number(env.PORT || 3000),
  baseUrl: (env.BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  dataDir: env.DATA_DIR || join(ROOT, 'data'),
  months: Number(env.ACCESS_MONTHS || 3),
  maxDevices: Number(env.MAX_DEVICES || 2),
  priceId: env.STRIPE_PRICE_ID || '',
  priceLabel: env.COURSE_PRICE_LABEL || '',
  // Contraseña del panel de administración (también sirve como token de la API: Authorization: Bearer …)
  adminPassword: env.ADMIN_PASSWORD || env.ADMIN_TOKEN || '',
  // Correos con acceso gratis y sin caducidad, y con permiso para gestionar alumnos (separados por comas)
  adminEmails: String(env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
};
const secureCookie = cfg.baseUrl.startsWith('https://');

// Si falta algo al arrancar, se explica en el registro (Render → Logs) qué variable revisar.
function fatal(msg, e) {
  console.error(`\n*** NO SE PUEDE ARRANCAR: ${msg}\n*** Detalle: ${e?.message || e}\n`);
  process.exit(1);
}
const db = await openDb({ dir: cfg.dataDir, url: env.TURSO_DATABASE_URL?.trim() || undefined, authToken: env.TURSO_AUTH_TOKEN?.trim() || undefined })
  .catch((e) => fatal('no se pudo abrir la base de datos. Revisa TURSO_DATABASE_URL (empieza por libsql://) y TURSO_AUTH_TOKEN, o déjalas vacías las dos.', e));
const store = makeStore(db, { months: cfg.months, maxDevices: cfg.maxDevices });
// Vídeos: «burn» graba el correo de cada alumno en la imagen (necesita CPU); «overlay» solo lo muestra encima
// del reproductor (para servidores gratuitos, que tardarían minutos en grabarlo).
const videoMode = env.VIDEO_WATERMARK === 'overlay' ? 'overlay' : 'burn';
let content;
try {
  content = loadCourse({ root: ROOT, key: env.CONTENT_KEY?.trim(), cacheDir: join(cfg.dataDir, 'cache') });
} catch (e) {
  fatal(env.CONTENT_KEY ? 'CONTENT_KEY no es correcta (cópiala de nuevo, sin espacios).' : 'falta la variable CONTENT_KEY.', e);
}
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
const mail = makeMailer({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM || 'Funded Lab <curso@fundedlab.es>', contact: env.CONTACT_EMAIL || 'grupolab@proton.me' });
const ffmpeg = hasFfmpeg();
let pdfCache = new Map(); // userId → PDF con marca de agua (en memoria, se reconstruye al reiniciar)

console.log(`Curso cargado: ${content.order.length} módulos, ${content.videos.size} vídeos, PDF ${content.pdf ? 'sí' : 'no'}, ffmpeg ${ffmpeg ? 'sí' : 'no'}`);
if (!stripe) console.warn('Aviso: sin STRIPE_SECRET_KEY no se pueden hacer compras.');

// Identificador corto de licencia, visible en la marca de agua junto al correo.
const licenseId = (userId) => `FL-${String(userId).padStart(5, '0')}-${hash(`lic:${userId}:${env.CONTENT_KEY || 'dev'}`).slice(0, 4).toUpperCase()}`;

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});

// ---------------------------------------------------------------- utilidades

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setSessionCookie(res, sid) {
  res.cookie('fl_sid', sid, { httpOnly: true, sameSite: 'lax', secure: secureCookie, maxAge: 400 * 864e5, path: '/' });
}

const isAdmin = (email) => cfg.adminEmails.includes(normEmail(email));

async function startSession(req, res, userId) {
  const u = await store.userById(userId);
  const sid = await store.newSession(userId, { device: req.get('user-agent'), ip: req.ip, max: isAdmin(u?.email) ? 6 : undefined });
  setSessionCookie(res, sid);
  await store.log(userId, 'login', req.ip);
}

// Límite sencillo de peticiones por clave (IP o correo) para el formulario de acceso.
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}

// Exige sesión válida y acceso vigente.
async function auth(req, res, next) {
  const sid = cookies(req).fl_sid;
  const s = await store.session(sid);
  if (!s) return res.status(401).json({ error: 'login', message: 'Inicia sesión para ver el curso.' });
  const adm = isAdmin(s.email);
  // Los administradores tienen acceso gratis y sin caducidad.
  if (!adm && s.access_until <= Date.now()) return res.status(402).json({ error: 'expired', message: 'Tu acceso al curso ha caducado.', email: s.email, accessUntil: s.access_until });
  if (Date.now() - s.last_seen > 60e3) await store.touch(sid, req.ip);
  req.user = { id: s.user_id, email: s.email, accessUntil: adm ? null : s.access_until, admin: adm, sid, license: licenseId(s.user_id) };
  res.set('Cache-Control', 'private, no-store');
  next();
}

const absolute = (path) => `${cfg.baseUrl}${path}`;

async function sendLoginLink(user, ttlMs) {
  const t = await store.newLoginToken(user.id, ttlMs);
  await mail.loginLink(user.email, absolute(`/acceso?t=${encodeURIComponent(t)}`));
}

// ---------------------------------------------------------------- Stripe

// Comprueba que la sesión de pago corresponde a este curso (si hay STRIPE_PRICE_ID) y concede el acceso.
async function grantFromCheckout(session) {
  if (session.mode !== 'payment') return null;
  if (!['paid', 'no_payment_required'].includes(session.payment_status)) return null;
  if (cfg.priceId) {
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 20 });
    if (!items.data.some((li) => li.price?.id === cfg.priceId)) return null;
  }
  const email = normEmail(session.customer_details?.email || session.customer_email);
  if (!email) return null;
  const r = await store.grant({
    email,
    stripeSession: session.id,
    paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    amount: session.amount_total,
    currency: session.currency,
    months: cfg.months,
  });
  if (r.created) {
    console.log(`Acceso concedido a ${email} hasta ${new Date(r.user.access_until).toISOString()}`);
    const t = await store.newLoginToken(r.user.id, 72 * 3600e3);
    mail.welcome(email, absolute(`/acceso?t=${encodeURIComponent(t)}`), r.user.access_until).catch((e) => console.error('Correo de bienvenida:', e.message));
  }
  return r;
}

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe no configurado');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Firma no válida: ${e.message}`);
  }
  try {
    const o = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await grantFromCheckout(o);
        break;
      case 'charge.refunded':
        if (o.refunded) console.log('Reembolso: acceso retirado a', await store.revokeByPaymentIntent(o.payment_intent));
        break;
      case 'charge.dispute.created':
        console.log('Disputa: acceso retirado a', await store.revokeByPaymentIntent(o.payment_intent));
        break;
    }
    res.json({ received: true });
  } catch (e) {
    console.error('Webhook:', e);
    res.status(500).send('Error');
  }
});

app.use(express.json({ limit: '50kb' }));

app.get('/api/config', (req, res) => res.json({ priceLabel: cfg.priceLabel, months: cfg.months, checkout: !!stripe && !!cfg.priceId, maxDevices: cfg.maxDevices }));

app.post('/api/checkout', async (req, res) => {
  if (!stripe || !cfg.priceId) return res.status(503).json({ message: 'La venta todavía no está activada.' });
  if (limited(`co:${req.ip}`, 20, 15 * 60e3)) return res.status(429).json({ message: 'Demasiados intentos. Espera unos minutos.' });
  try {
    const email = normEmail(req.body?.email);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: cfg.priceId, quantity: 1 }],
      ...(email && email.includes('@') ? { customer_email: email } : {}),
      customer_creation: 'always',
      allow_promotion_codes: true,
      locale: 'es',
      success_url: absolute('/gracias?session_id={CHECKOUT_SESSION_ID}'),
      cancel_url: absolute('/?cancelado=1'),
      payment_intent_data: { description: 'Curso Funded Lab · Estrategia de ruptura 15:15 – 15:30' },
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('Checkout:', e.message);
    res.status(500).json({ message: 'No se pudo iniciar el pago. Inténtalo de nuevo.' });
  }
});

// Vuelta de Stripe tras pagar: concede el acceso (por si el webhook aún no llegó) y abre sesión en este dispositivo.
app.get('/gracias', async (req, res) => {
  const id = String(req.query.session_id || '');
  if (!stripe || !id.startsWith('cs_')) return res.redirect('/entrar');
  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    const r = await grantFromCheckout(session);
    if (!r) return res.redirect('/entrar?pendiente=1');
    // El enlace de vuelta solo inicia sesión una vez y durante las primeras 2 horas.
    const fresh = Date.now() - r.purchase.created_at < 2 * 3600e3;
    if (fresh && (await store.claimAutologin(r.purchase.id))) {
      await startSession(req, res, r.user.id);
      return res.redirect('/app?bienvenida=1');
    }
    res.redirect('/entrar?comprado=1');
  } catch (e) {
    console.error('Gracias:', e.message);
    res.redirect('/entrar?pendiente=1');
  }
});

// ---------------------------------------------------------------- acceso

app.post('/api/login', async (req, res) => {
  const email = normEmail(req.body?.email);
  if (!email.includes('@') || email.length > 200) return res.status(400).json({ message: 'Escribe un correo válido.' });
  if (limited(`ip:${req.ip}`, 10, 15 * 60e3) || limited(`em:${email}`, 4, 15 * 60e3)) return res.status(429).json({ message: 'Demasiados intentos. Espera unos minutos.' });
  const u = await store.userByEmail(email);
  // Misma respuesta exista o no la cuenta, para no revelar quién ha comprado el curso.
  if (u && (u.access_until > Date.now() || isAdmin(u.email))) {
    try { await sendLoginLink(u); } catch (e) { console.error('Correo de acceso:', e.message); return res.status(500).json({ message: 'No se pudo enviar el correo. Inténtalo más tarde.' }); }
  }
  res.json({ ok: true, message: 'Si ese correo tiene el curso activo, te hemos enviado un enlace para entrar. Revisa también la carpeta de spam.' });
});

app.get('/acceso', async (req, res) => {
  const userId = await store.useLoginToken(req.query.t || '');
  if (!userId) return res.redirect('/entrar?caducado=1');
  await startSession(req, res, userId);
  res.redirect('/app');
});

app.post('/api/logout', async (req, res) => {
  const sid = cookies(req).fl_sid;
  if (sid) await store.endSession(sid);
  res.clearCookie('fl_sid', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', auth, async (req, res) => {
  const current = hash(req.user.sid);
  res.json({
    email: req.user.email,
    license: req.user.license,
    accessUntil: req.user.accessUntil,
    admin: req.user.admin,
    maxDevices: req.user.admin ? 6 : cfg.maxDevices,
    devices: (await store.sessionsOf(req.user.id)).map((d) => ({ device: d.device, lastSeen: d.last_seen, current: d.id_hash === current })),
  });
});

app.post('/api/devices/logout-others', auth, async (req, res) => {
  const current = hash(req.user.sid);
  for (const d of await store.sessionsOf(req.user.id)) if (d.id_hash !== current) await store.raw.delSession.run(d.id_hash);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- contenido

app.get('/api/course', auth, async (req, res) => {
  const { course } = content;
  res.json({
    title: course.title,
    subtitle: course.subtitle,
    hasPdf: !!content.pdf,
    parts: course.parts.map((p) => ({ num: p.num, title: p.title, intro: p.intro || '', modules: p.modules.map((m) => ({ id: m.id, num: m.num, title: m.title, video: content.videos.has(m.id) })) })),
    progress: await store.progress(req.user.id),
  });
});

app.get('/api/module/:id', auth, async (req, res) => {
  const mod = content.modules.get(req.params.id);
  if (!mod) return res.status(404).json({ message: 'Módulo no encontrado' });
  const i = content.order.indexOf(mod.id);
  await store.log(req.user.id, `module:${mod.id}`, req.ip);
  res.json({
    id: mod.id,
    title: mod.title,
    num: mod.num,
    prev: content.order[i - 1] || null,
    next: content.order[i + 1] || null,
    html: renderModule(mod, { email: req.user.email, licenseId: req.user.license, hasVideo: content.videos.has(mod.id) }),
  });
});

app.post('/api/progress', auth, async (req, res) => {
  const id = String(req.body?.id || '');
  if (!content.modules.has(id)) return res.status(400).json({ message: 'Módulo no válido' });
  await store.setProgress(req.user.id, id, !!req.body?.done);
  res.json({ progress: await store.progress(req.user.id) });
});

app.get('/api/pdf', auth, async (req, res) => {
  if (!content.pdf) return res.status(404).json({ message: 'PDF no disponible' });
  try {
    let pdf = pdfCache.get(req.user.id);
    if (!pdf) {
      pdf = await stampPdf(content.pdf, `${req.user.email} · ${req.user.license}`);
      if (pdfCache.size > 200) pdfCache = new Map();
      pdfCache.set(req.user.id, pdf);
    }
    await store.log(req.user.id, 'pdf', req.ip);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Funded_Lab_Curso_Trading_Futuros.pdf"' });
    res.send(pdf);
  } catch (e) {
    console.error('PDF:', e);
    res.status(500).json({ message: 'No se pudo generar el PDF' });
  }
});

// Vídeo del módulo con el correo del alumno grabado en la imagen (si hay ffmpeg) y por rangos.
app.get('/api/video/:id', auth, async (req, res) => {
  const id = req.params.id;
  if (!content.videos.has(id)) return res.status(404).json({ message: 'Vídeo no encontrado' });
  const src = join(content.videoDir, `${id}.mp4`);
  try {
    const file = ffmpeg && videoMode === 'burn' ? await watermarkedVideo(src, join(cfg.dataDir, 'cache'), req.user.id, id, `${req.user.email} · ${req.user.license}`) : src;
    if (!req.get('range') || req.get('range') === 'bytes=0-') await store.log(req.user.id, `video:${id}`, req.ip);
    res.set({ 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' });
    res.sendFile(file, { acceptRanges: true, lastModified: false, etag: false, cacheControl: false });
  } catch (e) {
    console.error('Vídeo:', e.message);
    res.status(500).json({ message: 'No se pudo preparar el vídeo' });
  }
});

// ---------------------------------------------------------------- administración

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// Permite el acceso con la sesión de un correo de ADMIN_EMAILS o con «Authorization: Bearer ADMIN_PASSWORD».
async function admin(req, res, next) {
  const t = String(req.get('authorization') || '').replace(/^Bearer /, '');
  if (cfg.adminPassword.length >= 8 && t && sameSecret(t, cfg.adminPassword)) return next();
  const s = await store.session(cookies(req).fl_sid);
  if (s && isAdmin(s.email)) { res.set('Cache-Control', 'private, no-store'); return next(); }
  res.status(403).json({ message: 'Solo para el administrador' });
}

// Entrada del administrador con su correo y la contraseña del panel (no necesita correo electrónico configurado).
app.post('/api/admin/login', async (req, res) => {
  if (limited(`adm:${req.ip}`, 8, 15 * 60e3)) return res.status(429).json({ message: 'Demasiados intentos. Espera 15 minutos.' });
  const email = normEmail(req.body?.email);
  if (!cfg.adminPassword || cfg.adminPassword.length < 8 || !isAdmin(email) || !sameSecret(req.body?.password || '', cfg.adminPassword)) {
    return res.status(403).json({ message: 'Correo o contraseña incorrectos.' });
  }
  await startSession(req, res, (await store.getOrCreateUser(email)).id);
  res.json({ ok: true });
});

const accessLink = async (userId) => absolute(`/acceso?t=${encodeURIComponent(await store.newLoginToken(userId, 7 * 864e5))}`);
const userView = (u) => ({
  email: u.email,
  license: licenseId(u.id),
  admin: isAdmin(u.email),
  active: isAdmin(u.email) || u.access_until > Date.now(),
  accessUntil: u.access_until || null,
  createdAt: u.created_at,
  devices: u.devices ?? 0,
});

app.get('/api/admin/users', admin, async (req, res) => res.json((await store.users()).map(userView)));

// Dar acceso (o ampliarlo): suma `months` meses. Devuelve un enlace de acceso de 7 días para enviarlo por WhatsApp o correo.
app.post('/api/admin/grant', admin, async (req, res) => {
  const email = normEmail(req.body?.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ message: 'Correo no válido' });
  const months = Math.min(36, Math.max(1, Math.round(Number(req.body?.months || cfg.months))));
  const r = await store.grant({ email, source: 'manual', months });
  const link = await accessLink(r.user.id);
  let mailed = false;
  if (req.body?.notify) {
    try { await mail.welcome(email, link, r.user.access_until); mailed = !!env.RESEND_API_KEY; } catch (e) { console.error('Correo:', e.message); }
  }
  res.json({ ...userView({ ...r.user, devices: (await store.sessionsOf(r.user.id)).length }), link, mailed });
});

// Bloquear: quita el acceso y cierra todas sus sesiones al momento.
app.post('/api/admin/revoke', admin, async (req, res) => {
  const email = normEmail(req.body?.email);
  if (isAdmin(email)) return res.status(400).json({ message: 'No puedes bloquear a un administrador' });
  res.json({ revoked: await store.revokeUser(email) });
});

// Nuevo enlace de acceso para un alumno activo (por si pierde el correo o cambia de móvil).
app.post('/api/admin/link', admin, async (req, res) => {
  const u = await store.userByEmail(req.body?.email);
  if (!u || !(u.access_until > Date.now() || isAdmin(u.email))) return res.status(400).json({ message: 'Ese alumno no tiene acceso activo' });
  res.json({ link: await accessLink(u.id) });
});

// Cierra la sesión en todos sus dispositivos (sin quitarle el acceso).
app.post('/api/admin/logout-devices', admin, async (req, res) => {
  const u = await store.userByEmail(req.body?.email);
  if (u) await store.endSessionsOf(u.id);
  res.json({ ok: !!u });
});

// Busca a quién pertenece una licencia vista en una copia filtrada.
app.get('/api/admin/license/:id', admin, async (req, res) => {
  const id = String(req.params.id).trim().toUpperCase();
  const m = /^FL-(\d+)-/.exec(id);
  const u = m && (await store.userById(Number(m[1])));
  res.json(u && licenseId(u.id) === id ? userView(u) : null);
});

// ---------------------------------------------------------------- páginas

const pub = join(ROOT, 'public');
const page = (file) => (req, res) => res.set('Cache-Control', 'no-cache').sendFile(join(pub, file));
app.get('/', page('index.html'));
app.get('/entrar', page('entrar.html'));
app.get('/app', page('app.html'));
app.get('/admin', page('admin.html'));
app.get('/sw.js', (req, res) => res.set({ 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' }).sendFile(join(pub, 'sw.js')));
app.use(express.static(pub, { index: false, maxAge: '1h' }));
app.use((req, res) => res.status(404).sendFile(join(pub, 'index.html')));

export { app, store, cfg, content };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  app.listen(cfg.port, () => console.log(`Funded Lab curso en ${cfg.baseUrl} (puerto ${cfg.port})`));
}
