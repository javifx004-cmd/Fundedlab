(() => {
  const $ = (s) => document.querySelector(s);
  const notice = (t, err) => { const n = $('#notice'); n.textContent = t; n.classList.toggle('err', !!err); n.classList.remove('hidden'); };
  if (new URLSearchParams(location.search).has('cancelado')) notice('Has cancelado el pago. Puedes intentarlo de nuevo cuando quieras.');

  fetch('/api/config').then((r) => r.json()).then((c) => {
    $('#price').textContent = c.priceLabel || '';
    $('#months').textContent = c.months;
    if (!c.checkout) { $('#buyBtn').disabled = true; $('#buyBtn').textContent = 'Próximamente'; }
  }).catch(() => {});

  $('#buyBtn').addEventListener('click', async () => {
    const btn = $('#buyBtn');
    btn.disabled = true; btn.textContent = 'Abriendo el pago…';
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('#email').value }) });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.message || 'No se pudo iniciar el pago');
      location.href = d.url;
    } catch (e) {
      notice(e.message, true);
      btn.disabled = false; btn.textContent = 'Comprar el curso';
    }
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
