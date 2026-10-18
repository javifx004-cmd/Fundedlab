/* Funded Lab · app del curso */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmtDate = (ms) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  };

  let me = null, course = null, progress = new Set();
  const modules = [];

  // ------------------------------------------------------------ API

  async function api(path, opts = {}) {
    const r = await fetch(path, { credentials: 'same-origin', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (r.status === 401) { location.replace(me ? '/entrar?expulsado=1' : '/entrar'); throw new Error('login'); }
    if (r.status === 402) { showExpired(await r.json()); throw new Error('expired'); }
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Error de conexión');
    return r.json();
  }

  function toast(t) {
    const d = document.createElement('div');
    d.className = 'toast'; d.textContent = t;
    document.body.append(d);
    setTimeout(() => d.remove(), 2600);
  }

  // ------------------------------------------------------------ marca de agua

  // Capa fija sobre toda la app con el correo y la licencia repetidos en diagonal.
  // Si alguien la borra o la oculta desde las herramientas del navegador, se vuelve a poner.
  function watermark() {
    const text = `${me.email} · ${me.license}`;
    const w = Math.max(320, text.length * 8.2 + 80), h = 170;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="20" y="${h / 2}" transform="rotate(-24 ${w / 2} ${h / 2})" fill="rgba(200,215,235,0.075)" font-family="sans-serif" font-size="14" font-weight="700">${esc(text)}</text></svg>`;
    const bg = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    const css = `position:fixed;inset:0;z-index:9999;pointer-events:none;background-image:${bg};background-repeat:repeat;display:block;opacity:1;visibility:visible`;
    let applied = null; // cssText tal y como lo normaliza el navegador
    const apply = () => {
      let el = document.getElementById('wm');
      if (!el) { el = document.createElement('div'); el.id = 'wm'; el.setAttribute('aria-hidden', 'true'); document.body.append(el); }
      if (el.className || el.hidden) { el.className = ''; el.hidden = false; }
      if (el.style.cssText !== applied) { el.style.cssText = css; applied = el.style.cssText; }
      if (el.parentNode !== document.body || el !== document.body.lastElementChild) document.body.append(el);
    };
    apply();
    new MutationObserver(apply).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'id'] });
    setInterval(apply, 3000);

    // Al copiar texto del curso se añade la licencia.
    document.addEventListener('copy', (e) => {
      const sel = String(document.getSelection() || '');
      if (!sel.trim() || !e.clipboardData) return;
      e.clipboardData.setData('text/plain', `${sel}\n\n— Curso Funded Lab · Licencia personal de ${me.email} (${me.license}). Prohibida su distribución.`);
      e.preventDefault();
    });
    document.addEventListener('contextmenu', (e) => { if (e.target.closest('.chart-svg, video, .video')) e.preventDefault(); });
  }

  // ------------------------------------------------------------ navegación

  function renderNav(activeId) {
    const nav = $('#nav');
    nav.innerHTML = course.parts.map((p) => `
      <div class="nav-part">${p.num === '0' ? esc(p.title) : `Parte ${esc(p.num)} · ${esc(p.title)}`}</div>
      ${p.modules.map((m) => `<a href="#/m/${m.id}" data-id="${m.id}" class="${m.id === activeId ? 'active' : ''} ${progress.has(m.id) ? 'done' : ''}">
        <span class="n">${progress.has(m.id) ? '✓' : esc(m.num || '·')}</span><span>${esc(m.title)}</span>
        ${m.video ? '<svg class="vid" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>' : ''}</a>`).join('')}`).join('');
    const pct = Math.round((progress.size / modules.length) * 100);
    $('#bar').style.width = `${pct}%`;
    $('#progressText').textContent = `${progress.size} de ${modules.length} módulos · ${pct} %`;
  }

  function closeMenu() { $('#app').classList.remove('open'); }
  $('#menu').addEventListener('click', () => $('#app').classList.add('open'));
  $('#scrim').addEventListener('click', closeMenu);

  async function route() {
    closeMenu();
    const m = /^#\/m\/([\w-]+)/.exec(location.hash);
    if (m) await showModule(m[1]);
    else showHome();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ inicio

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; $('#installBtn')?.classList.remove('hidden'); });

  function showHome() {
    renderNav(null);
    $('#topTitle').textContent = 'Inicio';
    const next = modules.find((m) => !progress.has(m.id)) || modules[0];
    const days = me.admin ? null : Math.max(0, Math.ceil((me.accessUntil - Date.now()) / 864e5));
    const welcome = new URLSearchParams(location.search).has('bienvenida');
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    $('#view').innerHTML = `<div class="home">
      <div class="kicker" style="color:var(--brand);text-transform:uppercase;letter-spacing:.14em;font-size:12.5px;font-weight:700">${welcome ? '¡Bienvenido!' : 'Tu curso'}</div>
      <h1>${esc(course.title)}</h1>
      <p class="muted">${esc(course.subtitle)}</p>
      <p><a class="btn primary big" href="#/m/${next.id}">${progress.size ? 'Continuar' : 'Empezar'}: ${esc(next.num ? `Módulo ${next.num}` : next.title)}</a></p>
      <div class="grid2">
        <div class="card"><div class="muted">Progreso</div><div class="stat">${progress.size} / ${modules.length}</div><div class="bar" style="margin-top:8px"><i style="width:${Math.round((progress.size / modules.length) * 100)}%"></i></div></div>
        ${me.admin
          ? '<div class="card"><div class="muted">Acceso</div><div class="stat">Ilimitado</div><div class="muted">Eres administrador</div><p style="margin:10px 0 0"><a class="btn primary small" href="/admin">Panel de alumnos</a></p></div>'
          : `<div class="card"><div class="muted">Acceso hasta</div><div class="stat">${fmtDate(me.accessUntil)}</div><div class="muted">Quedan ${days} días</div></div>`}
      </div>
      <div class="grid2">
        ${course.hasPdf ? `<div class="card"><h3 style="margin-top:0">Manual en PDF</h3><p class="muted">El curso completo para leer sin conexión. Lleva tu correo y tu licencia en cada página.</p><a class="btn" href="/api/pdf" download>Descargar PDF</a></div>` : ''}
        ${standalone ? '' : `<div class="card"><h3 style="margin-top:0">Instalar como app</h3>
          <p class="muted">${ios ? 'En iPhone/iPad: Safari → botón Compartir → «Añadir a pantalla de inicio».' : 'Tenla en el escritorio o en la pantalla de inicio, como cualquier app.'}</p>
          <button class="btn ${installPrompt ? '' : 'hidden'}" id="installBtn">Instalar app</button>
          ${!ios && !installPrompt ? '<p class="muted" style="font-size:14px">En Chrome o Edge: menú ⋮ → «Instalar aplicación». En Android: ⋮ → «Añadir a pantalla de inicio».</p>' : ''}</div>`}
      </div>
      <div class="card">
        <h3 style="margin-top:0">Mi cuenta</h3>
        <p style="margin:0">${esc(me.email)} <span class="muted">· licencia ${esc(me.license)}</span></p>
        <p class="muted" style="font-size:14px">El acceso es personal: puedes tenerlo abierto en ${me.maxDevices} dispositivos a la vez. Todo el contenido lleva tu correo como marca de agua.</p>
        <div class="muted" style="font-size:13px;text-transform:uppercase;letter-spacing:.08em">Dispositivos con sesión abierta</div>
        <ul class="devices">${me.devices.map((d) => `<li>${esc(deviceName(d.device))}${d.current ? ' · <b>este</b>' : ''} <span class="muted">· ${new Date(d.lastSeen).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span></li>`).join('')}</ul>
        <p style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:0">
          ${me.devices.length > 1 ? '<button class="btn small" id="logoutOthers">Cerrar los demás</button>' : ''}
          <button class="btn small ghost" id="logout">Cerrar sesión</button>
        </p>
      </div>
    </div>`;
    $('#installBtn')?.addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('#installBtn').classList.add('hidden'); });
    $('#logout').addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST' }); location.replace('/entrar?salir=1'); });
    $('#logoutOthers')?.addEventListener('click', async () => { await api('/api/devices/logout-others', { method: 'POST' }); me = await api('/api/me'); showHome(); toast('Sesiones cerradas'); });
  }

  function deviceName(ua = '') {
    const os = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /mac os/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : /linux/i.test(ua) ? 'Linux' : 'Dispositivo';
    const br = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Navegador';
    return `${os} · ${br}`;
  }

  // ------------------------------------------------------------ lección

  async function showModule(id) {
    renderNav(id);
    const meta = modules.find((m) => m.id === id);
    $('#topTitle').textContent = meta ? (meta.num ? `${meta.num} · ${meta.title}` : meta.title) : 'Curso';
    $('#view').innerHTML = '<p class="muted">Cargando…</p>';
    let mod;
    try { mod = await api(`/api/module/${encodeURIComponent(id)}`); } catch (e) {
      if (e.message !== 'login' && e.message !== 'expired') $('#view').innerHTML = `<p class="msg err">${esc(e.message)}</p>`;
      return;
    }
    const done = progress.has(id);
    $('#view').innerHTML = `<article class="lesson">${mod.html}</article>
      <div class="lesson-nav">
        ${mod.prev ? `<a class="btn" href="#/m/${mod.prev}">← Anterior</a>` : '<span></span>'}
        <button class="btn done-btn ${done ? 'is-done' : ''}" id="doneBtn">${done ? '✓ Completado' : 'Marcar como completado'}</button>
        ${mod.next ? `<a class="btn primary" href="#/m/${mod.next}" id="nextBtn">Siguiente →</a>` : '<a class="btn primary" href="#/">Terminar</a>'}
      </div>`;
    enhance($('#view'));
    $('#doneBtn').addEventListener('click', () => setDone(id, !progress.has(id)));
    $('#nextBtn')?.addEventListener('click', () => { if (!progress.has(id)) setDone(id, true, true); });
  }

  async function setDone(id, done, quiet) {
    const r = await api('/api/progress', { method: 'POST', body: JSON.stringify({ id, done }) });
    progress = new Set(r.progress);
    renderNav(id);
    const b = $('#doneBtn');
    if (b && !quiet) { b.classList.toggle('is-done', done); b.textContent = done ? '✓ Completado' : 'Marcar como completado'; }
  }

  // Convierte los elementos especiales de la lección en componentes interactivos.
  function enhance(root) {
    $$('table', root).forEach((t) => { if (!t.parentElement.classList.contains('table-wrap')) { const w = document.createElement('div'); w.className = 'table-wrap'; t.replaceWith(w); w.append(t); } });
    $$('.quiz', root).forEach(quiz);
    $$('.video', root).forEach(video);
    $$('[data-widget="sizer"]', root).forEach(sizer);
    $$('[data-widget="nyclock"]', root).forEach(nyclock);
    $$('[data-widget="plan"]', root).forEach(plan);
    $$('[data-widget="checklist"]', root).forEach(checklist);
  }

  function quiz(el) {
    const answer = $('.answer', el);
    const opts = $('.opts', el);
    answer.hidden = true;
    const reveal = () => {
      answer.hidden = false;
      $('.q-before', el).hidden = true;
      $('.q-after', el).hidden = false;
      $('.reveal', el)?.remove();
    };
    if (opts) {
      $$('li', opts).forEach((li) => {
        const ok = li.hasAttribute('data-ok');
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = li.innerHTML;
        li.replaceChildren(b);
        b.addEventListener('click', () => {
          $$('button', opts).forEach((x) => { x.disabled = true; if (x.parentElement.hasAttribute('data-ok')) x.classList.add('ok'); });
          if (!ok) b.classList.add('ko');
          reveal();
        });
      });
    }
    const r = document.createElement('button');
    r.type = 'button'; r.className = 'btn small reveal'; r.textContent = 'Ver la resolución';
    r.addEventListener('click', () => { $$('button', opts || el).forEach((x) => { x.disabled = true; if (x.parentElement?.hasAttribute('data-ok')) x.classList.add('ok'); }); reveal(); });
    (opts || $('.q', el)).after(r);
  }

  // Reproductor: el vídeo llega del servidor con el correo grabado y, además, se muestra encima una marca que cambia de sitio.
  function video(el) {
    const id = el.dataset.video;
    $('.video-play', el).addEventListener('click', () => {
      el.innerHTML = `<video controls playsinline preload="auto" controlslist="nodownload noremoteplayback" disablepictureinpicture></video><div class="vwm"></div><div class="vstatus">Preparando tu vídeo con marca de agua…</div>`;
      const v = $('video', el), wm = $('.vwm', el), st = $('.vstatus', el);
      wm.textContent = `${me.email} · ${me.license}`;
      const move = () => { wm.style.left = `${4 + Math.random() * 56}%`; wm.style.top = `${6 + Math.random() * 78}%`; };
      move();
      const timer = setInterval(() => { if (!document.contains(el)) clearInterval(timer); else move(); }, 6000);
      v.addEventListener('canplay', () => st.remove(), { once: true });
      v.addEventListener('error', () => { st.textContent = 'No se pudo cargar el vídeo. Vuelve a intentarlo.'; });
      v.src = `/api/video/${encodeURIComponent(id)}`;
      v.play().catch(() => {});
    });
  }

  function sizer(el) {
    el.classList.add('widget');
    el.innerHTML = `<h4>Calculadora de tamaño</h4>
      <div class="row">
        <label>Riesgo máximo ($)<input class="input" type="number" min="0" step="10" value="400" data-k="risk"></label>
        <label>Contrato<select class="input" data-k="pv"><option value="2">MNQ (2 $/punto)</option><option value="20">NQ (20 $/punto)</option><option value="5">MES (5 $/punto)</option><option value="50">ES (50 $/punto)</option></select></label>
        <label>Stop (puntos)<input class="input" type="number" min="1" step="1" value="80" data-k="sl"></label>
      </div><div class="out"></div>`;
    const calc = () => {
      const risk = +$('[data-k=risk]', el).value || 0, pv = +$('[data-k=pv]', el).value, sl = +$('[data-k=sl]', el).value || 1;
      const per = sl * pv, n = Math.floor(risk / per);
      const name = $('[data-k=pv]', el).selectedOptions[0].text.split(' ')[0];
      $('.out', el).innerHTML = n > 0
        ? `<b>${n} ${name}</b> · riesgo real ${(n * per).toLocaleString('es-ES')} $ <span class="muted">(${per.toLocaleString('es-ES')} $ por contrato)</span>`
        : `<b>0 ${name}</b> · <span class="muted">con ese riesgo no cabe ni un contrato (${per.toLocaleString('es-ES')} $ por contrato)</span>`;
    };
    $$('input,select', el).forEach((i) => i.addEventListener('input', calc));
    calc();
  }

  // Hora de apertura de Nueva York (9:30) en hora de España, para hoy y los próximos días con cambios.
  function nyOpenInSpain(date) {
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    const off = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(date).find((p) => p.type === 'timeZoneName').value;
    const h = Number((/GMT([+-]\d+)/.exec(off) || [0, -5])[1]);
    const utc = new Date(`${ymd}T09:30:00Z`).getTime() - h * 3600e3;
    return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(utc);
  }
  function nyclock(el) {
    el.classList.add('widget');
    const today = new Date();
    const open = nyOpenInSpain(today);
    const minus15 = (t) => { const [h, m] = t.split(':').map(Number); const x = h * 60 + m - 15; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
    const changes = [];
    for (let d = 1; d <= 60; d++) {
      const day = new Date(today.getTime() + d * 864e5);
      const o = nyOpenInSpain(day);
      if (o !== (changes.at(-1)?.o ?? open)) changes.push({ day, o });
    }
    el.innerHTML = `<h4>Tu ventana de hoy</h4>
      <div class="out">Nueva York abre a las <b>${open}</b> hora de España → marca el rango de <b>${minus15(open)} a ${open}</b>.</div>
      ${changes.length ? `<p class="muted" style="margin:10px 0 0;font-size:14px">${changes.map((c) => `Desde el ${c.day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}: apertura a las ${c.o} (ventana ${minus15(c.o)}–${c.o}).`).join('<br>')}</p>` : ''}
      <p class="muted" style="margin:6px 0 0;font-size:13px">Calculado con la zona horaria de Nueva York y de Madrid. No tiene en cuenta festivos ni sesiones recortadas.</p>`;
  }

  function plan(el) {
    const key = `fl-plan-${me.license}`;
    const data = store.get(key, []);
    $$('textarea', el).forEach((t, i) => {
      t.value = data[i] || '';
      const fit = () => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; };
      fit();
      t.addEventListener('input', () => { data[i] = t.value; store.set(key, data); fit(); });
    });
  }

  function checklist(el) {
    const day = new Date().toISOString().slice(0, 10);
    const key = `fl-check-${me.license}`;
    let st = store.get(key, {});
    if (st.day !== day) st = { day, v: [] };
    $$('input', el).forEach((c, i) => {
      c.checked = !!st.v[i];
      c.addEventListener('change', () => { st.v[i] = c.checked; store.set(key, st); });
    });
  }

  // ------------------------------------------------------------ acceso caducado

  function showExpired(d) {
    $('#app').innerHTML = `<main class="center-page"><div class="card login">
      <a class="brand" href="/"><img src="/icons/icon.svg" alt="">Funded<b>_lab</b></a>
      <h1>Tu acceso ha caducado</h1>
      <p class="muted">El acceso de ${esc(d.email || '')} terminó el ${d.accessUntil ? fmtDate(d.accessUntil) : '—'}. Puedes renovarlo otros 3 meses con el mismo correo y conservarás tu progreso.</p>
      <a class="btn primary big" href="/">Renovar acceso</a>
      <button class="btn ghost" id="out">Cerrar sesión</button></div></main>`;
    $('#out').addEventListener('click', async () => { await fetch('/api/logout', { method: 'POST' }); location.replace('/entrar?salir=1'); });
  }

  // ------------------------------------------------------------ arranque

  async function boot() {
    try {
      [me, course] = await Promise.all([api('/api/me'), api('/api/course')]);
    } catch { return; }
    progress = new Set(course.progress);
    course.parts.forEach((p) => p.modules.forEach((m) => modules.push(m)));
    watermark();
    if (me.admin) $('.side-foot').insertAdjacentHTML('beforeend', '<a class="btn small primary" href="/admin">Panel de alumnos</a>');
    window.addEventListener('hashchange', route);
    route();
    // Comprueba cada 5 minutos que la sesión sigue activa (otro dispositivo puede haberla cerrado o el acceso caducado).
    setInterval(() => api('/api/me').then((m) => { me = m; }).catch(() => {}), 5 * 60e3);
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  boot();
})();
