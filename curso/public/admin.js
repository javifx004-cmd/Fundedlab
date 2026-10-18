/* Funded Lab · panel de alumnos (solo administradores) */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmt = (ms) => (ms ? new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const view = $('#view');
  let users = [], filter = 'Activos', query = '', status = null, requests = [], settings = {};

  async function api(path, body) {
    const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.message || 'Error'); e.status = r.status; throw e; }
    return d;
  }
  function toast(t) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = t;
    document.body.append(d);
    setTimeout(() => d.remove(), 2600);
  }

  // ------------------------------------------------------------ entrada

  function loginForm(msg) {
    view.innerHTML = `<div class="center-page" style="min-height:70vh"><form class="card login" id="f">
      <h1>Panel de alumnos</h1>
      <p class="muted" style="margin:0">Entra con tu correo de administrador y la contraseña del panel (<code>ADMIN_PASSWORD</code>).</p>
      ${msg ? `<div class="msg err">${esc(msg)}</div>` : ''}
      <input class="input" type="email" id="em" placeholder="tu@correo.com" autocomplete="username" required>
      <input class="input" type="password" id="pw" placeholder="Contraseña" autocomplete="current-password" required>
      <button class="btn primary big">Entrar</button></form></div>`;
    $('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await api('/api/admin/login', { email: $('#em').value, password: $('#pw').value }); load(); } catch (err) { loginForm(err.message); }
    });
  }

  async function load() {
    try { users = await api('/api/admin/users'); } catch (e) { if (e.status === 403) return loginForm(); view.innerHTML = `<p class="msg err">${esc(e.message)}</p>`; return; }
    try { status = await api('/api/admin/status'); } catch { status = null; }
    try { [requests, settings] = await Promise.all([api('/api/admin/requests'), api('/api/admin/settings')]); } catch { requests = []; settings = {}; }
    render();
  }

  // ------------------------------------------------------------ panel

  function render() {
    const active = users.filter((u) => u.active).length;
    view.innerHTML = `
      <h1 style="font-family:var(--serif);margin:10px 0 4px">Alumnos</h1>
      <p class="muted" style="margin:0 0 18px">${active} con acceso · ${users.length - active} sin acceso · ${users.length} en total</p>
      ${requestsCard()}
      ${statusCard()}
      ${payCard()}

      <form class="card adm-grant" id="grant">
        <h3>Dar acceso</h3>
        <div class="adm-row">
          <input class="input" type="email" id="gEmail" placeholder="correo@alumno.com" required>
          <select class="input" id="gMonths"><option value="1">1 mes</option><option value="3" selected>3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select>
          <button class="btn primary">Dar acceso</button>
        </div>
        <label class="adm-check"><input type="checkbox" id="gMail"> Enviarle también el enlace por correo</label>
        <div id="gOut"></div>
      </form>

      <div class="adm-tools">
        <input class="input" id="q" placeholder="Buscar por correo o licencia (FL-…)" value="${esc(query)}">
        <div class="adm-tabs">${['Activos', 'Sin acceso', 'Todos'].map((t) => `<button class="btn small ${t === filter ? 'primary' : ''}" data-f="${t}">${t}</button>`).join('')}</div>
      </div>
      <div id="list"></div>`;
    $('#grant').addEventListener('submit', grant);
    $('#payCfg')?.addEventListener('submit', savePay);
    view.querySelectorAll('[data-req]').forEach((b) => b.addEventListener('click', () => resolveReq(b)));
    $('#q').addEventListener('input', (e) => { query = e.target.value; list(); });
    view.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; render(); }));
    list();
  }

  // Estado de la configuración del servidor (variables de Render), sin mostrar valores secretos.
  function statusCard() {
    if (!status) return '';
    const row = (ok, label, hint) => `<li style="margin:4px 0">${ok ? '✅' : '❌'} ${label}${!ok && hint ? `<br><span class="muted" style="font-size:13px">${hint}</span>` : ''}</li>`;
    const s = status;
    return `<div class="card" style="margin-bottom:18px"><h3 style="margin-top:0">Estado de la configuración</h3>
      <p style="margin:0 0 8px;font-weight:700">${s.checkout ? `✅ La venta está activa con Stripe (${s.stripeMode === 'real' ? 'cobros reales' : 'modo de prueba'})` : s.manual ? '✅ La venta está activa con PayPal / Bizum (confirmas tú cada pago)' : '❌ La venta está desactivada: el botón dice «Próximamente». Rellena «Formas de pago» aquí abajo.'}</p>
      <ul style="list-style:none;padding:0;margin:0">
        ${s.manual && !s.stripeKey ? '' : `
        ${row(s.stripeKey && s.stripeKeyLooksOk, 'Clave secreta de Stripe (STRIPE_SECRET_KEY)', s.stripeKey ? 'No parece una clave secreta: debe empezar por sk_test_ o sk_live_.' : 'Falta. Cópiala en Stripe → Desarrolladores → Claves de API (empieza por sk_test_).')}
        ${row(s.stripePrice && s.stripePriceLooksOk, 'Precio del curso (STRIPE_PRICE_ID)', s.stripePrice ? 'Debe empezar por price_.' : 'Falta.')}
        ${row(s.stripeWebhook && s.stripeWebhookLooksOk, 'Webhook de Stripe (STRIPE_WEBHOOK_SECRET)', s.stripeWebhook ? 'Debe empezar por whsec_.' : 'Falta: sin él, los pagos no dan acceso automáticamente.')}
        `}
        ${row(!!s.priceLabel, `Precio en la web (COURSE_PRICE_LABEL)${s.priceLabel ? `: ${esc(s.priceLabel)}` : ''}`, 'Opcional: el texto del precio, p. ej. 99,99 €.')}
        ${row(s.turso, 'Base de datos Turso', 'Sin ella, los alumnos se borran al reiniciarse el servidor gratuito.')}
        ${row(s.mail, 'Correos (RESEND_API_KEY)', 'Opcional: sin ella no se envían correos; usa los enlaces de WhatsApp del panel.')}
      </ul></div>`;
  }

  // Número para wa.me: solo dígitos; los móviles españoles de 9 cifras llevan el prefijo 34.
  const waNumber = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 9 ? `34${d}` : d; };

  function requestsCard() {
    if (!requests.length) return '';
    return `<div class="card" style="margin-bottom:18px;border-color:var(--amber)"><h3 style="margin-top:0">💶 Pagos pendientes de confirmar (${requests.length})</h3>
      <p class="muted" style="margin:0 0 10px;font-size:14px">Comprueba en tu PayPal o Bizum que el pago ha llegado y pulsa «Dar acceso».</p>
      ${requests.map((r) => `<div class="adm-user" style="padding:12px 0;border-top:1px solid var(--line)" data-rid="${r.id}">
        <b>${esc(r.email)}</b> <span class="badge b-adm">${esc(r.method || 'pago')}</span>
        <div class="muted adm-meta">${new Date(r.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}${r.phone ? ` · WhatsApp ${esc(r.phone)}` : ''}</div>
        <div class="adm-actions"><button class="btn small primary" data-req="grant" data-id="${r.id}">Dar acceso</button><button class="btn small ghost" data-req="dismiss" data-id="${r.id}">Descartar</button></div>
        <div class="adm-out"></div></div>`).join('')}</div>`;
  }

  async function resolveReq(btn) {
    const box = btn.closest('[data-rid]');
    if (btn.dataset.req === 'dismiss' && !confirm('¿Descartar este aviso? No se le dará acceso.')) return;
    try {
      const r = await api(`/api/admin/requests/${btn.dataset.id}`, { action: btn.dataset.req });
      if (btn.dataset.req === 'dismiss') { requests = requests.filter((x) => String(x.id) !== btn.dataset.id); render(); return; }
      users = await api('/api/admin/users');
      box.querySelector('.adm-actions').remove();
      const out = box.querySelector('.adm-out');
      out.innerHTML = linkBox(r.email, r.link, `Acceso dado hasta el ${fmt(r.accessUntil)}. Envíale su enlace:`, r.phone);
      wireLink(out);
      requests = requests.filter((x) => String(x.id) !== btn.dataset.id);
    } catch (err) { toast(err.message); }
  }

  function payCard() {
    const open = !(settings.paypal || settings.bizum);
    return `<details class="card" style="margin-bottom:18px" ${open ? 'open' : ''}><summary style="cursor:pointer;font-weight:700">Formas de pago (PayPal y Bizum)</summary>
      <form id="payCfg" style="display:grid;gap:10px;margin-top:12px">
        <label class="muted" style="font-size:14px">Tu usuario de PayPal.me (lo que va después de paypal.me/)<input class="input" id="cfgPaypal" placeholder="p. ej. grupolab" value="${esc(settings.paypal || '')}"></label>
        <label class="muted" style="font-size:14px">Tu número de Bizum<input class="input" id="cfgBizum" inputmode="tel" placeholder="p. ej. 600 000 000" value="${esc(settings.bizum || '')}"></label>
        <label class="muted" style="font-size:14px">Nota para el comprador (opcional)<input class="input" id="cfgNotes" placeholder="p. ej. Con PayPal, elige «Pago a amigos o familiares» no; usa «Bienes y servicios»" value="${esc(settings.payNotes || '')}"></label>
        <button class="btn primary">Guardar</button>
        <p class="muted" style="margin:0;font-size:13px">Con al menos uno de los dos, el botón «Comprar» de la web muestra cómo pagar y el formulario «Ya he pagado». Los avisos te llegan aquí arriba.</p>
      </form></details>`;
  }

  async function savePay(e) {
    e.preventDefault();
    try {
      settings = await api('/api/admin/settings', { paypal: $('#cfgPaypal').value, bizum: $('#cfgBizum').value, payNotes: $('#cfgNotes').value });
      status = await api('/api/admin/status');
      toast('Formas de pago guardadas'); render();
    } catch (err) { toast(err.message); }
  }

  function list() {
    const q = query.trim().toLowerCase();
    const rows = users
      .filter((u) => (filter === 'Todos' ? true : filter === 'Activos' ? u.active : !u.active))
      .filter((u) => !q || u.email.includes(q) || u.license.toLowerCase().includes(q));
    $('#list').innerHTML = rows.length ? rows.map((u) => `
      <div class="card adm-user" data-email="${esc(u.email)}">
        <div class="adm-head">
          <b>${esc(u.email)}</b>
          <span class="badge ${u.admin ? 'b-adm' : u.active ? 'b-ok' : 'b-off'}">${u.admin ? 'Administrador' : u.active ? 'Activo' : 'Sin acceso'}</span>
        </div>
        <div class="muted adm-meta">${u.admin ? 'Acceso gratis sin caducidad' : u.active ? `Hasta el ${fmt(u.accessUntil)}` : u.accessUntil ? `Terminó el ${fmt(u.accessUntil)}` : 'Sin compras'} · ${u.devices} disp. · ${esc(u.license)}</div>
        <div class="adm-actions">
          ${u.admin ? '' : `<button class="btn small" data-a="grant">${u.active ? '+3 meses' : 'Dar 3 meses'}</button>`}
          ${u.active ? '<button class="btn small" data-a="link">Enlace de acceso</button>' : ''}
          ${u.devices ? '<button class="btn small ghost" data-a="logout">Cerrar sesiones</button>' : ''}
          ${u.active && !u.admin ? '<button class="btn small danger" data-a="block">Bloquear</button>' : ''}
        </div>
        <div class="adm-out"></div>
      </div>`).join('') : '<p class="muted">No hay alumnos en esta lista.</p>';
    $('#list').querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => action(b)));
  }

  function linkBox(email, link, note, phone) {
    const text = `Hola! Aquí tienes tu acceso al curso de Funded Lab: ${link}\n\nEl enlace es personal y caduca en 7 días. Ábrelo en el móvil o en el ordenador; para entrar en otro dispositivo, pide un enlace nuevo en la web con este correo (${email}).`;
    return `<div class="adm-link">${note ? `<div class="msg">${esc(note)}</div>` : ''}
      <input class="input" readonly value="${esc(link)}">
      <div class="adm-actions">
        <button class="btn small primary" type="button" data-copy="${esc(link)}">Copiar enlace</button>
        <a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}">Enviar por WhatsApp${phone ? ` a ${esc(phone)}` : ''}</a>
        <a class="btn small" href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Tu acceso al curso Funded Lab')}&body=${encodeURIComponent(text)}">Enviar por correo</a>
        ${navigator.share ? `<button class="btn small" type="button" data-share="${esc(text)}">Compartir…</button>` : ''}
      </div>
      <p class="muted" style="font-size:13px;margin:6px 0 0">Caduca en 7 días y solo sirve una vez.</p></div>`;
  }
  function wireLink(el) {
    el.querySelector('[data-copy]')?.addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(e.target.dataset.copy); toast('Enlace copiado'); } catch { el.querySelector('input').select(); }
    });
    el.querySelector('[data-share]')?.addEventListener('click', (e) => navigator.share({ text: e.target.dataset.share }).catch(() => {}));
  }

  async function grant(e) {
    e.preventDefault();
    const email = $('#gEmail').value.trim().toLowerCase();
    try {
      const r = await api('/api/admin/grant', { email, months: Number($('#gMonths').value), notify: $('#gMail').checked });
      users = await api('/api/admin/users');
      const out = $('#gOut');
      out.innerHTML = linkBox(email, r.link, `${email} tiene acceso hasta el ${fmt(r.accessUntil)}.${r.mailed ? ' Correo enviado.' : ''} Envíale este enlace para entrar:`);
      wireLink(out);
      $('#gEmail').value = '';
      list();
    } catch (err) { toast(err.message); }
  }

  async function action(btn) {
    const card = btn.closest('.adm-user');
    const email = card.dataset.email;
    const out = card.querySelector('.adm-out');
    try {
      if (btn.dataset.a === 'grant') {
        const r = await api('/api/admin/grant', { email, months: 3 });
        toast(`Acceso hasta el ${fmt(r.accessUntil)}`);
        users = await api('/api/admin/users'); list();
        const c = $(`.adm-user[data-email="${CSS.escape(email)}"] .adm-out`);
        c.innerHTML = linkBox(email, r.link); wireLink(c);
      } else if (btn.dataset.a === 'link') {
        const r = await api('/api/admin/link', { email });
        out.innerHTML = linkBox(email, r.link); wireLink(out);
      } else if (btn.dataset.a === 'logout') {
        await api('/api/admin/logout-devices', { email });
        toast('Sesiones cerradas'); users = await api('/api/admin/users'); list();
      } else if (btn.dataset.a === 'block') {
        if (!confirm(`¿Bloquear a ${email}? Pierde el acceso y se cierran sus sesiones al momento.`)) return;
        await api('/api/admin/revoke', { email });
        toast('Alumno bloqueado'); users = await api('/api/admin/users'); list();
      }
    } catch (err) { toast(err.message); }
  }

  load();
})();
