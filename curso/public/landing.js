(() => {
  const $ = (s) => document.querySelector(s);
  const notice = (t, err) => { const n = $('#notice'); n.textContent = t; n.classList.toggle('err', !!err); n.classList.remove('hidden'); };
  if (new URLSearchParams(location.search).has('cancelado')) notice('Has cancelado el pago. Puedes intentarlo de nuevo cuando quieras.');

  let cfg = {};
  fetch('/api/config').then((r) => r.json()).then((c) => {
    cfg = c;
    $('#price').textContent = c.priceLabel || '';
    $('#months').textContent = c.months;
    if (!c.checkout && c.manual) setupManual(c);
    else if (!c.checkout) { $('#buyBtn').disabled = true; $('#buyBtn').textContent = 'Próximamente'; }
  }).catch(() => {});

  // Pago manual: PayPal.me y/o Bizum, y aviso de «ya he pagado».
  function setupManual(c) {
    const m = c.manual;
    $('#email').classList.add('hidden');
    $('#buyNote').textContent = `Pago con PayPal${m.bizum ? ' o Bizum' : ''}. Acceso durante ${c.months} meses en ordenador y móvil.`;
    $('#payAmount').textContent = c.priceLabel || '';
    if (m.paypal) { $('#payPaypal').href = m.paypal; $('#payPaypal').classList.remove('hidden'); } else $('#payMethod').value = 'bizum';
    if (m.bizum) { $('#bizumNum').textContent = m.bizum; $('#payBizum').classList.remove('hidden'); }
    if (!m.paypal) $('#payMethod option[value=paypal]').remove();
    if (!m.bizum) $('#payMethod option[value=bizum]').remove();
    if (m.notes) { $('#payNotes').textContent = m.notes; $('#payNotes').classList.remove('hidden'); }
    $('#payContact').textContent = m.contact; $('#payContact').href = `mailto:${m.contact}`;
    $('#payForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#payForm button'); btn.disabled = true;
      const out = $('#payMsg');
      try {
        const r = await fetch('/api/pay-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('#payEmail').value, phone: $('#payPhone').value, method: $('#payMethod').value }) });
        const d = await r.json();
        out.textContent = d.message; out.classList.toggle('err', !r.ok); out.classList.remove('hidden');
        if (r.ok) $('#payForm').classList.add('hidden'); else btn.disabled = false;
      } catch { out.textContent = 'Sin conexión. Inténtalo de nuevo.'; out.classList.add('err'); out.classList.remove('hidden'); btn.disabled = false; }
    });
  }

  $('#buyBtn').addEventListener('click', async () => {
    if (!cfg.checkout && cfg.manual) { $('#pay').classList.remove('hidden'); $('#pay').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
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
