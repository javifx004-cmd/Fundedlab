/*
 * Contenido para Instagram: reels verticales (1080×1920, MP4) y carruseles (1080×1350, PNG),
 * con los mismos gráficos del curso. Se dibuja en HTML con Chromium (Playwright) y los reels se montan con ffmpeg.
 *   npm run social
 * Resultado: marketing/instagram/
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { renderFigure, EXAMPLES } from '../lib/charts.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'marketing', 'instagram');
const price = process.env.COURSE_PRICE_LABEL || '99,99 €';
const HANDLE = '@fundedlab_es';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/&lt;br&gt;/g, '<br>');
const read = (t, base = 1.4) => Math.min(6, base + String(t).replace(/\*/g, '').length * 0.05);
const icon = `data:image/svg+xml;base64,${readFileSync(join(root, 'public', 'icons', 'icon.svg')).toString('base64')}`;
const fig = (id, opts = {}) => renderFigure(id, '', opts);

const css = `
${readFileSync(join(root, 'public', 'style.css'), 'utf8')}
html, body { margin: 0; overflow: hidden; background: #0a0f1c; }
.s { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 120px 80px 110px; color: var(--text);
  background: radial-gradient(900px 600px at 90% -100px, rgba(127,216,239,.16), transparent 60%), radial-gradient(800px 500px at -10% 10%, rgba(52,211,153,.08), transparent 60%), #0a0f1c; }
.top { position: absolute; left: 80px; right: 80px; top: 52px; display: flex; justify-content: space-between; align-items: center; font-size: 26px; color: var(--muted); }
.top .brand { font-size: 30px; }
.top .brand img { width: 46px; height: 46px; border-radius: 12px; }
.bot { position: absolute; left: 80px; right: 80px; bottom: 44px; display: flex; justify-content: space-between; font-size: 24px; color: var(--muted); }
.bot b { color: var(--brand); }
.kick { color: var(--brand); text-transform: uppercase; letter-spacing: .16em; font-weight: 800; font-size: 28px; }
.h { font-family: var(--serif); font-weight: 700; line-height: 1.08; margin: 18px 0 26px; }
.h.xl { font-size: 104px; } .h.l { font-size: 76px; } .h.m { font-size: 58px; }
.p { font-size: 36px; line-height: 1.4; color: var(--text-2); margin: 0 0 20px; }
.p b, .li b, .cap b { color: var(--text); }
.center { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.list { display: grid; gap: 22px; margin-top: 10px; }
.li { display: flex; gap: 22px; font-size: 38px; line-height: 1.35; color: var(--text-2); background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 24px 28px; }
.li .n { flex: none; width: 56px; height: 56px; border-radius: 50%; background: var(--brand); color: var(--brand-ink); font-weight: 800; display: grid; place-items: center; font-size: 28px; }
.li.x .n { background: var(--red); color: #fff; }
.chartbox { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 26px; padding: 18px; }
.chartbox svg { width: 100%; height: auto; display: block; }
.chart-svg text { font-size: 15px; } .chart-svg .c-small { font-size: 14px; } .chart-svg .c-tiny { font-size: 12px; } .chart-svg .c-lbl { font-size: 14px; }
.cap { margin-top: 26px; font-size: 38px; line-height: 1.38; color: var(--text-2); background: var(--surface); border: 1px solid var(--line-strong); border-radius: 22px; padding: 26px 30px; }
.cap.ok { border-color: var(--green); background: var(--green-soft); }
.cap.ko { border-color: var(--red); background: var(--red-soft); }
.formula { font-family: var(--serif); font-weight: 700; font-size: 46px; text-align: center; padding: 34px; border: 3px solid var(--brand); border-radius: 26px; line-height: 1.3; }
.price { display: inline-flex; flex-direction: column; align-items: center; align-self: center; background: var(--brand); color: var(--brand-ink); border-radius: 30px; padding: 30px 60px; margin: 30px 0; }
.price .v { font-size: 92px; font-weight: 800; line-height: 1; }
.price .t { font-size: 30px; font-weight: 700; margin-top: 8px; }
.swipe { margin-top: 40px; font-size: 34px; color: var(--brand); font-weight: 700; }
.legal { font-size: 22px; color: var(--muted); text-align: center; margin-top: 18px; }
.logo-xl { width: 220px; height: 220px; border-radius: 48px; align-self: center; margin-bottom: 20px; }
.tag { align-self: flex-start; font-size: 28px; font-weight: 800; padding: 10px 22px; border-radius: 99px; background: var(--brand-soft); color: var(--brand); }
.chartbox.tall .chart-svg text { font-size: 17px; } .chartbox.tall .chart-svg .c-small, .chartbox.tall .chart-svg .c-lbl { font-size: 16px; }
.cap.big { font-size: 46px; padding: 30px 34px; }
.new { opacity: var(--a, 1); transform: translateY(calc((1 - var(--a, 1)) * 20px)); }
`;

const frame = (inner, { n, total } = {}) => `<div class="s">
  <div class="top"><span class="brand"><img src="${icon}">Funded<b>_lab</b></span>${n ? `<span>${n}/${total}</span>` : '<span>Curso de futuros</span>'}</div>
  ${inner}
  <div class="bot"><span>${HANDLE}</span><span>${n && n < total ? 'Desliza →' : '<b>Link en la bio</b>'}</span></div></div>`;

const ctaInner = (title = 'Aprende el método completo') => `<div class="center" style="text-align:center">
  <img class="logo-xl" src="${icon}">
  <div class="kick">Curso de trading de futuros</div>
  <div class="h l">${rich(title)}</div>
  <p class="p">20 módulos · 21 vídeos · 7 ejemplos interactivos<br>Calculadora, checklist y plan de trading<br>App para el móvil y el ordenador</p>
  <div class="price"><span class="v">${price}</span><span class="t">3 meses de acceso</span></div>
  <p class="p" style="color:var(--brand);font-weight:800">Link en la bio</p>
  <div class="legal">Contenido formativo. No es asesoramiento financiero. El trading apalancado conlleva un riesgo elevado.</div></div>`;

// ----------------------------------------------------------------- carruseles

const CAROUSELS = {
  '1-deja-de-quemar-cuentas': [
    `<div class="center"><div class="kick">Cuentas de fondeo</div><div class="h xl">Deja de quemar cuentas de fondeo</div><p class="p">El método de la ruptura de las 15:15 explicado en 5 reglas.</p><div class="swipe">Desliza →</div></div>`,
    `<div class="kick">El problema</div><div class="h m">No pierdes por la estrategia. Pierdes por romperla.</div><div class="list">
      <div class="li x"><span class="n">✕</span><span>Operar <b>sin stop</b> o moverlo en contra</span></div>
      <div class="li x"><span class="n">✕</span><span>Operar <b>demasiado grande</b> para tu drawdown</span></div>
      <div class="li x"><span class="n">✕</span><span>Volver a entrar <b>para recuperar</b> tras un stop</span></div>
      <div class="li x"><span class="n">✕</span><span>Añadir contratos <b>cuando va en contra</b></span></div></div>`,
    `<div class="kick">El método</div><div class="h m">5 reglas. Todos los días iguales.</div><div class="list">
      <div class="li"><span class="n">1</span><span><b>Ventana:</b> rango de 15:15 a 15:30, antes de la apertura de Nueva York</span></div>
      <div class="li"><span class="n">2</span><span><b>Entrada:</b> ruptura del máximo o del mínimo. Una al día</span></div>
      <div class="li"><span class="n">3</span><span><b>Stop:</b> 80 puntos, puesto con la entrada</span></div>
      <div class="li"><span class="n">4</span><span><b>Objetivo:</b> 80 puntos (1:1)</span></div>
      <div class="li"><span class="n">5</span><span><b>Gestión:</b> tras +80, parcial y stop a favor</span></div></div>`,
    `<div class="kick">Un día ganador</div><div class="h m">Ruptura a las 15:31, objetivo a las 15:49</div><div class="chartbox">${fig('ej-largo')}</div><div class="cap ok">Rango de 40 puntos. Compra en la ruptura, stop y objetivo a 80. <b>+80 puntos.</b> Sin tocar nada.</div><div class="legal">Velas de 1 minuto · precios ilustrativos</div>`,
    `<div class="kick">Un día perdedor</div><div class="h m">También forma parte del plan</div><div class="chartbox">${fig('ej-falsa')}</div><div class="cap ko">Ruptura falsa: <b>−80 puntos y fin del día.</b> Luego cae 150 puntos más… y no vuelves a entrar. Así se protege la cuenta.</div><div class="legal">Velas de 1 minuto · precios ilustrativos</div>`,
    ctaInner('Aprende el método completo'),
  ],
  '2-operarias-estos-dias': [
    `<div class="center"><div class="kick">Test</div><div class="h xl">¿Operarías estos 3 días?</div><p class="p">Son las 15:30. Mira el gráfico, decide y desliza para ver la respuesta.</p><div class="swipe">Desliza →</div></div>`,
    `<div class="tag">Día 1</div><div class="h m">Rango de 95 puntos. ¿Entras?</div><div class="chartbox">${fig('ej-ancho', { question: true })}</div><div class="cap">Comenta <b>SÍ</b> o <b>NO</b> antes de deslizar 👇</div>`,
    `<div class="tag">Día 1 · Respuesta</div><div class="h m">No. Ese día no se opera.</div><div class="chartbox">${fig('ej-ancho')}</div><div class="cap ko">El rango mide <b>más que el stop de 80</b>: el stop quedaría dentro del propio rango. Resultado: 0, y está bien.</div>`,
    `<div class="tag">Día 2</div><div class="h m">A las 15:30 ya está 26 puntos arriba. ¿Compras?</div><div class="chartbox">${fig('ej-antes', { question: true })}</div><div class="cap">Comenta <b>SÍ</b> o <b>NO</b> 👇</div>`,
    `<div class="tag">Día 2 · Respuesta</div><div class="h m">No. Se escapó antes de la apertura.</div><div class="chartbox">${fig('ej-antes')}</div><div class="cap ko">Sin compresión hasta las 15:30 no hay rango válido. Comprar ahí es <b>perseguir el precio</b>.</div>`,
    `<div class="tag">Día 3</div><div class="h m">Rango de 30 puntos, velas pequeñas. ¿Qué haces?</div><div class="chartbox">${fig('ej-corto', { question: true })}</div><div class="cap">¿Compras, vendes o pones las dos órdenes? 👇</div>`,
    `<div class="tag">Día 3 · Respuesta</div><div class="h m">Las dos órdenes. El mercado elige.</div><div class="chartbox">${fig('ej-corto')}</div><div class="cap ok">Buy stop y sell stop en OCO. Rompe abajo: venta y <b>+80 puntos</b> a las 15:51.</div><div class="legal">Velas de 1 minuto · precios ilustrativos</div>`,
    ctaInner('7 ejemplos como estos, resueltos vela a vela'),
  ],
  '3-cuantos-contratos': [
    `<div class="center"><div class="kick">Gestión del riesgo</div><div class="h xl">¿Cuántos contratos debes operar?</div><p class="p">La fórmula que evita que una operación normal te queme la cuenta.</p><div class="swipe">Desliza →</div></div>`,
    `<div class="kick">La fórmula</div><div class="h m">El tamaño no se decide por la garantía</div><div class="center"><div class="formula">contratos =<br>riesgo máximo ($)<br>÷<br>(stop en puntos × valor por punto)</div><p class="p" style="margin-top:30px">Y siempre se <b>redondea hacia abajo</b>.</p></div>`,
    `<div class="kick">Ejemplo</div><div class="h m">Riesgo de 400 $ con MNQ</div><div class="list">
      <div class="li"><span class="n">1</span><span>MNQ vale <b>2 $ por punto</b></span></div>
      <div class="li"><span class="n">2</span><span>Stop de 80 puntos: 80 × 2 = <b>160 $ por contrato</b></span></div>
      <div class="li"><span class="n">3</span><span>400 ÷ 160 = 2,5 → <b>2 MNQ</b></span></div>
      <div class="li"><span class="n">4</span><span>Riesgo real: <b>320 $</b></span></div></div>`,
    `<div class="kick">En fondeo</div><div class="h m">Se calcula sobre el drawdown, no sobre el saldo</div><div class="table-wrap"><table style="font-size:32px"><thead><tr><th>Cuenta</th><th>Drawdown</th><th>Contratos</th></tr></thead><tbody>
      <tr><td>25.000 $</td><td>1.500 $</td><td>1 MNQ</td></tr><tr><td>50.000 $</td><td>2.000 $</td><td>2 MNQ</td></tr><tr><td>100.000 $</td><td>3.000 $</td><td>3 MNQ</td></tr><tr><td>150.000 $</td><td>4.500 $</td><td>5 MNQ</td></tr></tbody></table></div>
      <div class="cap">Riesgo máximo: el <b>20 % del drawdown</b>. Los drawdowns son orientativos: cada firma usa los suyos.</div>`,
    ctaInner('La calculadora está dentro de la app'),
  ],
};

const POSTS = {
  'lanzamiento': `<div class="center" style="text-align:center">
    <img class="logo-xl" src="${icon}">
    <div class="kick">Ya disponible</div>
    <div class="h l">Estrategia de ruptura<br>15:15 – 15:30</div>
    <p class="p">Del primer gráfico de velas a la operativa en cuentas de fondeo. Con vídeos y ejemplos de entrada resueltos vela a vela.</p>
    <div class="price"><span class="v">${price}</span><span class="t">3 meses · ordenador y móvil</span></div>
    <p class="p" style="color:var(--brand);font-weight:800">Link en la bio</p>
    <div class="legal">Contenido formativo. No es asesoramiento financiero.</div></div>`,
};

// ----------------------------------------------------------------- reels

/*
 * Cada reel: gancho → repetición vela a vela con textos → cierre con precio.
 * En los replays, los textos cambian al dibujarse la vela indicada (las velas empiezan a las 15:05; la nº 26 es la de las 15:30).
 */
const REELS = {
  'reel-1-ruptura-1515': {
    hook: ['Así opero la apertura de Nueva York', 'en 20 segundos'],
    example: 'ej-largo', from: 6,
    caps: [[6, 'Velas de 1 minuto del Nasdaq.'], [11, '**15:15.** Empieza la ventana.'], [25, '**15:30.** Rango de 40 puntos. Válido.'], [26, 'Buy stop arriba, sell stop abajo. **Stop y objetivo: 80 puntos.**'], [27, '**15:31.** Rompe arriba: compra.'], [45, '**15:49.** Objetivo. **+80 puntos.** No he tocado nada.']],
    end: 'Aprende el método completo',
  },
  'reel-2-ruptura-falsa': {
    hook: ['El día que pierdes', 'también tiene reglas'],
    example: 'ej-falsa', from: 6,
    caps: [[11, '**15:15.** Rango de 35 puntos.'], [27, '**15:31.** Rompe arriba: compra con stop de 80.'], [32, 'Sube +22… y no sigue.'], [48, '**Stop: −80.** Fin del día.'], [62, 'Luego cae 150 puntos más. **¿Vendes?** No. Una operación al día.']],
    end: 'Disciplina antes que estrategia',
  },
  'reel-3-operarias-este-dia': {
    hook: ['¿Operarías este día?', 'Decide antes de las 15:30'],
    example: 'ej-ancho', from: 6, reveal: 26,
    caps: [[11, '**15:15.** Velas grandes desde el principio…'], [25, '**15:30.** Rango de **95 puntos**. ¿Entras?'], [26, '**No.** El stop de 80 quedaría dentro del rango.'], [45, 'El precio va arriba y abajo sin dirección. **Resultado: 0.** Y está bien.']],
    end: '7 ejemplos como este en el curso',
  },
  'reel-4-lanzamiento': {
    hook: ['Mi curso de trading de futuros', 'ya está disponible'],
    bullets: ['**20 módulos:** de las velas japonesas a las cuentas de fondeo', '**21 vídeos** con operaciones vela a vela', '**7 ejemplos interactivos:** decides tú a las 15:30', 'Calculadora de tamaño, checklist y **plan de trading**', '**App** para el móvil y el ordenador'],
    example: 'ej-piramide', from: 20,
    caps: [[20, 'Incluye sesiones completas como esta…'], [27, 'Entrada en la ruptura…'], [40, 'Parcial en +80 y stop a favor…'], [69, '…y salida por trailing. Todo con reglas escritas.']],
    end: 'Estrategia de ruptura 15:15 – 15:30',
  },
};

function reelSteps(r) {
  const S = [];
  const add = (html, dur, fade = false) => S.push({ html, dur, fade });
  add(frame(`<div class="center"><div class="kick">Curso de futuros</div><div class="h xl">${rich(r.hook[0])}</div><div class="h m" style="color:var(--brand);margin-top:0">${rich(r.hook[1])}</div></div>`), 2.6, true);
  if (r.bullets) {
    r.bullets.forEach((_, i) => add(frame(`<div class="kick">Qué incluye</div><div class="h m">Todo en una app</div><div class="list">${r.bullets.slice(0, i + 1).map((b, j) => `<div class="li ${j === i ? 'new' : ''}"><span class="n">${j + 1}</span><span>${rich(b)}</span></div>`).join('')}</div>`), 1.5, true));
    S[S.length - 1].dur += 1;
  }
  const total = EXAMPLES[r.example].candles.length;
  let ci = -1;
  for (let n = r.from; n <= total; n++) {
    let k = ci;
    while (k + 1 < r.caps.length && r.caps[k + 1][0] <= n) k++;
    const changed = k !== ci;
    const cap = k >= 0 ? r.caps[k][1] : '';
    add(frame(`<div class="kick">Velas de 1 minuto · NQ</div><div class="h m">${rich(r.hook[0])}</div><div class="chartbox tall">${fig(r.example, { show: n, tall: true, neutral: r.reveal ? n < r.reveal : false })}</div><div class="cap big ${changed ? 'new' : ''}">${rich(cap)}</div><div class="legal">Precios ilustrativos · contenido formativo</div>`), changed ? read(cap, 1.1) : 0.09, changed);
    ci = k;
  }
  S[S.length - 1].dur += 1.2;
  add(frame(ctaInner(r.end)), 4, true);
  return S;
}

// ----------------------------------------------------------------- render

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

async function pageOf(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div></body></html>`);
  return page;
}

const post = await pageOf(1080, 1350);
for (const [name, slides] of Object.entries(CAROUSELS)) {
  const dir = join(out, `carrusel-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < slides.length; i++) {
    await post.evaluate((h) => { document.getElementById('root').innerHTML = h; }, frame(slides[i], { n: i + 1, total: slides.length }));
    await post.screenshot({ path: join(dir, `${String(i + 1).padStart(2, '0')}.png`) });
  }
  console.log(`carrusel-${name}: ${slides.length} imágenes`);
}
for (const [name, inner] of Object.entries(POSTS)) {
  await post.evaluate((h) => { document.getElementById('root').innerHTML = h; }, frame(inner));
  await post.screenshot({ path: join(out, `post-${name}.png`) });
  console.log(`post-${name}.png`);
}

const reel = await pageOf(1080, 1920);
for (const [name, r] of Object.entries(REELS)) {
  const steps = reelSteps(r);
  const dir = join(tmpdir(), `fl-reel-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const list = [];
  let n = 0;
  const shot = async (html, a, dur) => {
    await reel.evaluate(([h, al]) => { const el = document.getElementById('root'); el.innerHTML = h; el.style.setProperty('--a', al); }, [html, a]);
    const f = join(dir, `${String(++n).padStart(5, '0')}.png`);
    await reel.screenshot({ path: f });
    list.push(`file '${f}'\nduration ${dur.toFixed(3)}`);
  };
  for (const s of steps) {
    if (s.fade) for (const a of [0.35, 0.7]) await shot(s.html, a, 0.07);
    await shot(s.html, 1, s.dur);
  }
  list.push(`file '${join(dir, `${String(n).padStart(5, '0')}.png`)}'`);
  writeFileSync(join(dir, 'list.txt'), list.join('\n'));
  const file = join(out, `${name}.mp4`);
  // Pista de audio en silencio: Instagram la acepta mejor y así puedes añadir música encima desde la app.
  const r2 = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '64k', '-shortest', '-movflags', '+faststart', file], { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  if (r2.status !== 0) throw new Error(`ffmpeg falló en ${name}`);
  const secs = steps.reduce((t, s) => t + s.dur + (s.fade ? 0.14 : 0), 0);
  console.log(`${name}.mp4: ${Math.round(secs)} s`);
}
await browser.close();
