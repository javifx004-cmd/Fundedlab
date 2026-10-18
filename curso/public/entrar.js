(() => {
  const $ = (s) => document.querySelector(s);
  const msg = (t, err) => { const m = $('#msg'); m.textContent = t; m.classList.toggle('err', !!err); m.classList.remove('hidden'); };
  const q = new URLSearchParams(location.search);
  if (q.has('caducado')) msg('Ese enlace ya se usó o ha caducado. Pide uno nuevo.', true);
  if (q.has('comprado')) msg('¡Compra completada! Te hemos enviado un correo con tu enlace de acceso.');
  if (q.has('pendiente')) msg('Estamos confirmando tu pago. En unos minutos recibirás un correo con tu acceso; si no, pide el enlace aquí.');
  if (q.has('salir')) msg('Has cerrado la sesión en este dispositivo.');
  if (q.has('expulsado')) msg('Tu sesión se cerró porque entraste en otro dispositivo. Pide un enlace para volver a entrar.');

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#send');
    btn.disabled = true;
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('#email').value }) });
      const d = await r.json();
      msg(d.message, !r.ok);
    } catch {
      msg('Sin conexión. Inténtalo de nuevo.', true);
    }
    btn.disabled = false;
  });

  fetch('/api/me').then((r) => { if (r.ok) location.replace('/app'); }).catch(() => {});
})();
