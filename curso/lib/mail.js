/*
 * Envío de correos con Resend (https://resend.com) mediante su API HTTP, sin dependencias.
 * Sin RESEND_API_KEY los correos se escriben en la consola (útil en desarrollo).
 */
export function makeMailer({ apiKey, from, brand = 'Funded Lab', contact = 'grupolab@proton.me' }) {
  async function send(to, subject, html, text) {
    if (!apiKey) {
      console.log(`\n[correo sin enviar: falta RESEND_API_KEY]\nPara: ${to}\nAsunto: ${subject}\n${text}\n`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }

  const button = (url, label) => `<p style="margin:28px 0"><a href="${url}" style="background:#7fd8ef;color:#062330;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:700">${label}</a></p>`;
  const wrap = (body) => `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;color:#0b1120;line-height:1.5">
    <p style="font-size:20px;font-weight:800">Funded<span style="color:#0e9bb8">_lab</span></p>${body}
    <p style="color:#6b7280;font-size:12px;margin-top:32px">Si no has pedido este correo, ignóralo. El enlace es personal: no lo compartas.<br>¿Dudas? Escríbenos a <a href="mailto:${contact}">${contact}</a>.</p></div>`;
  const date = (ms) => new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  return {
    loginLink(to, url) {
      return send(to, `Tu acceso al curso de ${brand}`,
        wrap(`<p>Pulsa el botón para entrar al curso en este dispositivo. El enlace caduca en 30 minutos y solo sirve una vez.</p>${button(url, 'Entrar al curso')}`),
        `Entra al curso con este enlace (caduca en 30 minutos y solo sirve una vez):\n${url}`);
    },
    welcome(to, url, until) {
      return send(to, `Bienvenido al curso de ${brand}`,
        wrap(`<p>¡Gracias por tu compra! Ya tienes acceso al curso <b>Estrategia de ruptura 15:15 – 15:30</b> hasta el <b>${date(until)}</b>.</p>
          <p>Puedes instalarlo como app en el ordenador y en el móvil. Para entrar en otro dispositivo, pide un enlace con este mismo correo.</p>${button(url, 'Empezar el curso')}`),
        `Gracias por tu compra. Tienes acceso hasta el ${date(until)}.\nEntra aquí: ${url}`);
    },
  };
}
