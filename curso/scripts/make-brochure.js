/*
 * Dossier de venta del curso en PDF (A4), con los mismos gráficos que la app y un QR a la web de compra.
 *   npm run brochure -- https://tu-dominio.com
 * Resultado: marketing/Funded_Lab_Curso_Dossier.pdf
 */
import { chromium } from 'playwright';
import QRCode from 'qrcode';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFigure } from '../lib/charts.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = (process.argv[2] || process.env.BASE_URL || 'https://fundedlab-curso.onrender.com').replace(/\/$/, '');
const price = process.env.COURSE_PRICE_LABEL || '99,99 €';
const out = join(root, 'marketing', 'Funded_Lab_Curso_Dossier.pdf');

const img = (f, type) => `data:${type};base64,${readFileSync(join(root, 'marketing', 'img', f)).toString('base64')}`;
const icon = `data:image/svg+xml;base64,${readFileSync(join(root, 'public', 'icons', 'icon.svg')).toString('base64')}`;
const qr = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#0a0f1c', light: '#ffffff' } });
const fig = (id, opts) => renderFigure(id, 'Funded Lab · fundedlab_es', opts);
const host = url.replace(/^https?:\/\//, '');

const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5L20 7"/></svg>';
const cross = '<svg viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const foot = (n) => `<div class="foot"><span>Funded<b>_lab</b> · Curso de trading de futuros</span><span>${n}</span></div>`;

const css = `
${readFileSync(join(root, 'public', 'style.css'), 'utf8')}
@page { size: A4; margin: 0; }
html, body { background: #0a0f1c !important; color: var(--text) !important; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11.5pt; }
.page { width: 210mm; height: 297mm; padding: 16mm 15mm 18mm; position: relative; overflow: hidden; page-break-after: always; color: var(--text);
  background: radial-gradient(700px 360px at 90% -80px, rgba(127,216,239,.12), transparent 60%), radial-gradient(600px 320px at -10% 0, rgba(52,211,153,.06), transparent 60%), #0a0f1c; }
.page:last-child { page-break-after: auto; }
.foot { position: absolute; left: 15mm; right: 15mm; bottom: 8mm; display: flex; justify-content: space-between; font-size: 8pt; color: var(--muted); border-top: 1px solid var(--line); padding-top: 3mm; }
.foot b { color: var(--brand); font-weight: 700; }
.kick { color: var(--brand); text-transform: uppercase; letter-spacing: .2em; font-size: 9pt; font-weight: 700; }
h1, h2 { font-family: var(--serif); margin: 0; }
h2 { font-size: 24pt; margin: 2mm 0 5mm; }
p { color: var(--text-2); margin: 0 0 3mm; line-height: 1.55; }
.lead { font-family: var(--serif); font-style: italic; font-size: 13pt; color: var(--text-2); }

/* portada */
.cover { display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: center; }
.cover .frame { position: absolute; inset: 10mm; border: 1px solid rgba(127,216,239,.45); border-radius: 4mm; }
.cover img.logo { width: 46mm; height: 46mm; border-radius: 8mm; }
.cover .brandname { font-size: 30pt; font-weight: 800; margin: 4mm 0 12mm; letter-spacing: -.01em; }
.cover .brandname b { color: var(--brand); }
.cover h1 { font-size: 40pt; line-height: 1.1; margin: 4mm 0 5mm; }
.cover .rule { width: 30mm; height: 2px; background: var(--brand); margin: 2mm auto 6mm; }
.cover .lead { max-width: 150mm; }
.pricetag { margin-top: 14mm; display: inline-flex; flex-direction: column; align-items: center; gap: 1mm; padding: 6mm 12mm; border-radius: 5mm; background: var(--brand); color: var(--brand-ink); }
.pricetag .p { font-size: 28pt; font-weight: 800; }
.pricetag .s { font-size: 10pt; font-weight: 700; }
.cover .ig { position: absolute; bottom: 20mm; left: 0; right: 0; color: var(--brand); font-weight: 700; font-size: 12pt; }

.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.cards.three { grid-template-columns: 1fr 1fr 1fr; }
.cardx { background: var(--surface); border: 1px solid var(--line); border-radius: 4mm; padding: 4mm 5mm; }
.cardx h3 { margin: 0 0 2mm; font-size: 12.5pt; }
.cardx p { font-size: 10pt; margin: 0; }
.cardx .big { font-size: 24pt; font-weight: 800; color: var(--brand); line-height: 1; margin-bottom: 2mm; }
.ticks { list-style: none; padding: 0; margin: 0; display: grid; gap: 2.6mm; }
.ticks li { display: flex; gap: 3mm; color: var(--text-2); line-height: 1.45; }
.ticks li b { color: var(--text); }
.ticks svg { width: 5mm; height: 5mm; flex: none; color: var(--brand); margin-top: .6mm; }
.rules td, .rules th { font-size: 10.5pt; }
.rules { margin: 3mm 0 6mm; }
.part { display: grid; grid-template-columns: 16mm 1fr; gap: 3mm; padding: 4mm 0; border-top: 1px solid var(--line); }
.part .num { font-family: var(--serif); font-size: 24pt; color: var(--brand); font-weight: 700; line-height: 1; }
.part h3 { margin: 0 0 1.5mm; font-size: 13pt; }
.part p { margin: 0 0 1.5mm; font-size: 10pt; }
.part ol { margin: 0; padding-left: 5mm; columns: 2; column-gap: 8mm; font-size: 10pt; color: var(--text-2); }
.part ol li { margin: .6mm 0; break-inside: avoid; }
.figbox { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 4mm; padding: 3mm; margin: 2mm 0 2mm; }
.figcap { font-size: 9.5pt; color: var(--muted); font-style: italic; font-family: var(--serif); text-align: center; margin: 1mm 0 5mm; }
.chart-svg .c-wm text { opacity: .05; }
.phones { display: flex; gap: 6mm; justify-content: center; align-items: flex-start; }
.phone { width: 50mm; border-radius: 7mm; border: 2.2mm solid #1f2b47; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.5); background: #000; }
.phone img { display: block; width: 100%; }
.shot { border-radius: 3mm; border: 1px solid var(--line-strong); overflow: hidden; }
.shot img { display: block; width: 100%; }
.cta { display: grid; grid-template-columns: 1fr 52mm; gap: 8mm; align-items: center; background: var(--surface); border: 1px solid rgba(127,216,239,.45); border-radius: 5mm; padding: 7mm; }
.cta .p { font-size: 34pt; font-weight: 800; line-height: 1; }
.cta .qr { background: #fff; border-radius: 3mm; padding: 2mm; }
.cta .qr svg { display: block; width: 100%; height: auto; }
.cta .url { font-weight: 700; color: var(--brand); font-size: 12pt; word-break: break-all; }
.steps { counter-reset: s; list-style: none; padding: 0; margin: 4mm 0 0; display: grid; gap: 2mm; }
.steps li { counter-increment: s; display: flex; gap: 3mm; color: var(--text-2); font-size: 10.5pt; }
.steps li::before { content: counter(s); width: 6mm; height: 6mm; flex: none; border-radius: 50%; background: var(--brand); color: var(--brand-ink); font-weight: 800; font-size: 9pt; display: grid; place-items: center; }
.faq { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 6mm; margin-top: 6mm; }
.faq h4 { margin: 0 0 1mm; font-size: 10.5pt; }
.faq p { font-size: 9.5pt; margin: 0; }
.legal { font-size: 8pt; color: var(--muted); margin-top: 6mm; line-height: 1.5; }
`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head><body>

<section class="page cover">
  <div class="frame"></div>
  <img class="logo" src="${icon}" alt="">
  <div class="brandname">Funded<b>_lab</b></div>
  <div class="kick">Curso de trading de futuros</div>
  <h1>Estrategia de ruptura<br>15:15 – 15:30</h1>
  <div class="rule"></div>
  <p class="lead">Del primer gráfico de velas a la operativa en cuentas de fondeo. Un método concreto, explicado paso a paso, con vídeos y ejemplos de entrada resueltos vela a vela.</p>
  <div class="pricetag"><span class="p">${price}</span><span class="s">3 meses de acceso · ordenador y móvil</span></div>
  <div class="ig">@fundedlab_es</div>
</section>

<section class="page">
  <div class="kick">El curso</div>
  <h2>Un método. De principio a fin.</h2>
  <p class="lead">Este curso no promete atajos. Te da un método concreto, las herramientas para entenderlo y la disciplina para aplicarlo.</p>
  <p>Vas a aprender una única estrategia de futuros sobre el Nasdaq: marcar el rango de los 15 minutos previos a la apertura de Nueva York, entrar en la ruptura con el stop y el objetivo puestos desde el primer segundo, y gestionar la operación con reglas escritas. Y, antes de eso, los cimientos: velas japonesas, contratos de futuros y órdenes.</p>
  <div class="cards" style="margin:6mm 0">
    <div class="cardx"><h3>Para ti si…</h3><ul class="ticks">
      <li>${check}<span>Empiezas de cero y quieres <b>un método claro</b>, no veinte indicadores.</span></li>
      <li>${check}<span>Operas cuentas de <b>fondeo</b> y quieres dejar de quemarlas.</span></li>
      <li>${check}<span>Puedes dedicar <b>15–60 minutos</b> al día, a las 15:15 hora de España.</span></li>
    </ul></div>
    <div class="cardx"><h3>No es para ti si…</h3><ul class="ticks">
      <li>${cross}<span>Buscas dinero rápido o señales para copiar.</span></li>
      <li>${cross}<span>No estás dispuesto a hacer un <b>backtest</b> antes de operar en real.</span></li>
      <li>${cross}<span>No aceptas que un día perdedor forma parte del plan.</span></li>
    </ul></div>
  </div>
  <h3 style="margin:2mm 0 0">El sistema en cinco reglas</h3>
  <div class="table-wrap rules"><table><thead><tr><th>Elemento</th><th>Regla</th></tr></thead><tbody>
    <tr><td>Ventana</td><td>Rango de 15:15 a 15:30 (hora de España): los 15 minutos previos a la apertura de Nueva York</td></tr>
    <tr><td>Entrada</td><td>Ruptura del máximo o del mínimo del rango, con órdenes OCO. Una operación al día</td></tr>
    <tr><td>Stop loss</td><td>80 puntos, puesto a la vez que la entrada (bracket)</td></tr>
    <tr><td>Take profit</td><td>80 puntos (riesgo/beneficio 1:1)</td></tr>
    <tr><td>Gestión</td><td>Tras +80: cierre parcial, stop a favor y añadidos cubiertos por el beneficio</td></tr>
  </tbody></table></div>
  ${foot(2)}
</section>

<section class="page">
  <div class="kick">Programa</div>
  <h2>20 módulos en 4 partes</h2>
  <div class="part"><div class="num">I</div><div><h3>Fundamentos</h3><p>El lenguaje del mercado: cómo se lee un gráfico y con qué herramientas se opera.</p>
    <ol><li>Qué es el trading</li><li>Las velas japonesas</li><li>El mercado de futuros</li><li>Tipos de órdenes</li><li>Rangos y rupturas</li></ol></div></div>
  <div class="part"><div class="num">II</div><div><h3>El sistema</h3><p>Cuándo mirar, qué marcar, cómo entrar, cuánto arriesgar y cómo extender.</p>
    <ol start="6"><li>La ventana de 15:15 a 15:30</li><li>Identificar la acumulación</li><li>La ruptura y la entrada</li><li>Riesgo: SL 80 / TP 80</li><li>Promediar a favor y extender</li></ol></div></div>
  <div class="part"><div class="num">III</div><div><h3>Profesionalizar</h3><p>Fondeo, validación, mentalidad y plan: lo que separa un método de un negocio.</p>
    <ol start="11"><li>Cuentas de fondeo</li><li>Backtesting y diario</li><li>Psicología del trader</li><li>Casos prácticos</li><li>Los 10 errores más comunes</li><li>Tu plan de trading</li><li>Checklist, ejercicios y glosario</li></ol></div></div>
  <div class="part"><div class="num">IV</div><div><h3>Ejemplos de entrada</h3><p>Siete sesiones resueltas vela a vela: primero decides tú a las 15:30, después ves qué pasó.</p>
    <ol start="18"><li>Largo, corto y ruptura falsa</li><li>Días sin operación y cierre de vela</li><li>Sesión completa con promediado</li></ol></div></div>
  <div class="figbox" style="margin-top:4mm">${fig('valid')}</div>
  <div class="figcap">Del Módulo 7: cuándo un rango es válido y cuándo ese día no se opera.</div>
  ${foot(3)}
</section>

<section class="page">
  <div class="kick">Aprende con ejemplos</div>
  <h2>Decide a las 15:30. Luego mira qué pasó.</h2>
  <p>Cada ejemplo empieza con el gráfico tal y como lo tendrías a las 15:30. Eliges qué harías y después ves la resolución vela a vela, con la entrada, el stop, el objetivo y el resultado en dólares.</p>
  <div class="figbox">${fig('ej-largo', { question: true, wide: true })}</div>
  <div class="figcap">Situación a las 15:30: rango de 40 puntos. ¿Qué haces?</div>
  <div class="figbox">${fig('ej-largo', { wide: true })}</div>
  <div class="figcap">Resolución: ruptura alcista a las 15:31 y objetivo de +80 puntos a las 15:49 (precios ilustrativos).</div>
  <div class="cardx" style="margin-top:2mm"><h3>Y también los días que salen mal</h3><p>Rupturas falsas, rangos demasiado anchos, escapadas antes de la apertura y el mismo día visto con dos métodos de entrada. Saber cuándo no operar vale tanto como saber entrar.</p></div>
  ${foot(4)}
</section>

<section class="page">
  <div class="kick">Qué incluye</div>
  <h2>Todo en una app, en el ordenador y en el móvil</h2>
  <div class="cards three" style="margin-bottom:6mm">
    <div class="cardx"><div class="big">20</div><h3>Módulos</h3><p>Del primer gráfico de velas al plan de trading.</p></div>
    <div class="cardx"><div class="big">21</div><h3>Vídeos</h3><p>Uno por módulo, con gráficos animados y operaciones vela a vela.</p></div>
    <div class="cardx"><div class="big">7</div><h3>Ejemplos interactivos</h3><p>Largos, cortos, rupturas falsas, días sin operación y promediado.</p></div>
    <div class="cardx"><div class="big">PDF</div><h3>Manual completo</h3><p>Para leer sin conexión y repasar.</p></div>
    <div class="cardx"><div class="big">4</div><h3>Herramientas</h3><p>Calculadora de tamaño, reloj de la apertura de NY, checklist diaria y plan de trading.</p></div>
    <div class="cardx"><div class="big">App</div><h3>PC, Mac, Android, iPhone</h3><p>Se instala como una app. Tu progreso se guarda solo.</p></div>
  </div>
  <div class="phones">
    <div class="phone"><img src="${img('m-quiz.png', 'image/png')}" alt=""></div>
    <div class="phone"><img src="${img('m-calc.png', 'image/png')}" alt=""></div>
  </div>
  <div class="figcap">Ejemplos interactivos y calculadora de tamaño (capturas reales de la app en el móvil).</div>
  ${foot(5)}
</section>

<section class="page">
  <div class="kick">Acceso</div>
  <h2>Empieza hoy</h2>
  <div class="cta">
    <div>
      <div class="p">${price}</div>
      <p style="margin:2mm 0 4mm">IVA incluido · pago único · <b style="color:var(--text)">3 meses de acceso</b> a todo el curso</p>
      <div class="url">${host}</div>
      <ol class="steps">
        <li>Escanea el código o entra en la web y pulsa «Comprar el curso».</li>
        <li>Paga de forma segura con Stripe (tarjeta, Apple Pay o Google Pay).</li>
        <li>Entras al instante y recibes tu acceso por correo. Instálala en el móvil y en el ordenador.</li>
      </ol>
    </div>
    <div class="qr">${qr}</div>
  </div>
  <div class="faq">
    <div><h4>¿Cuánto dura el acceso?</h4><p>3 meses desde la compra. Si renuevas antes de que termine, se suman al final.</p></div>
    <div><h4>¿Necesito experiencia?</h4><p>No. La primera parte empieza desde cero: velas, futuros y órdenes.</p></div>
    <div><h4>¿En qué dispositivos?</h4><p>Ordenador y móvil: hasta dos dispositivos abiertos a la vez. Sin contraseñas: entras con un enlace a tu correo.</p></div>
    <div><h4>¿Puedo compartirlo?</h4><p>No. El acceso es personal y todo el contenido lleva tu correo como marca de agua.</p></div>
    <div><h4>¿Qué mercado se opera?</h4><p>Futuros del Nasdaq (NQ y micro MNQ), en la apertura de Nueva York: 15:30 en España.</p></div>
    <div><h4>¿Sirve para cuentas de fondeo?</h4><p>Sí: hay un módulo dedicado al tamaño según el drawdown y a las reglas de las firmas.</p></div>
  </div>
  <p class="legal"><b>Aviso legal.</b> Material exclusivamente formativo. No constituye asesoramiento financiero ni recomendación de inversión. Los ejemplos usan precios ilustrativos y los resultados pasados o simulados no garantizan resultados futuros. El trading de futuros apalancados conlleva un riesgo elevado y puede suponer pérdidas superiores al capital depositado.<br>© 2026 Funded Lab · @fundedlab_es</p>
  ${foot(6)}
</section>
</body></html>`;

mkdirSync(join(root, 'marketing'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`Dossier: ${out} (QR → ${url})`);
