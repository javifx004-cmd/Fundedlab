/*
 * Piezas comunes para generar contenido de Instagram con el estilo y los gráficos del curso:
 * plantillas (frame, cierre con precio), reels a partir de sesiones vela a vela y render con Chromium + ffmpeg.
 * Lo usan make-social.js (contenido de lanzamiento) y make-plan90.js (calendario de 3 meses).
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { renderFigure, EXAMPLES } from '../lib/charts.js';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const price = process.env.COURSE_PRICE_LABEL || '99,99 €';
export const HANDLE = '@fundedlab_es';
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/&lt;br&gt;/g, '<br>');
export const read = (t, base = 1.4) => Math.min(6, base + String(t).replace(/\*/g, '').length * 0.05);
export const icon = `data:image/svg+xml;base64,${readFileSync(join(root, 'public', 'icons', 'icon.svg')).toString('base64')}`;
export const fig = (id, opts = {}) => renderFigure(id, '', opts);

export const css = `
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

export const frame = (inner, { n, total } = {}) => `<div class="s">
  <div class="top"><span class="brand"><img src="${icon}">Funded<b>_lab</b></span>${n ? `<span>${n}/${total}</span>` : '<span>Curso de futuros</span>'}</div>
  ${inner}
  <div class="bot"><span>${HANDLE}</span><span>${n && n < total ? 'Desliza →' : '<b>Link en la bio</b>'}</span></div></div>`;

export const ctaInner = (title = 'Aprende el método completo') => `<div class="center" style="text-align:center">
  <img class="logo-xl" src="${icon}">
  <div class="kick">Curso de trading de futuros</div>
  <div class="h l">${rich(title)}</div>
  <p class="p">20 módulos · 21 vídeos · 7 ejemplos interactivos<br>Calculadora, checklist y plan de trading<br>App para el móvil y el ordenador</p>
  <div class="price"><span class="v">${price}</span><span class="t">3 meses de acceso</span></div>
  <p class="p" style="color:var(--brand);font-weight:800">Link en la bio</p>
  <div class="legal">Contenido formativo. No es asesoramiento financiero. El trading apalancado conlleva un riesgo elevado.</div></div>`;

// Pasos de un reel: gancho → (lista opcional) → sesión vela a vela con textos → cierre con precio.
export function reelSteps(r) {
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


export async function openStudio() {
  const browser = await chromium.launch();
  const pageOf = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div></body></html>`);
    return page;
  };
  const post = await pageOf(1080, 1350);
  const reel = await pageOf(1080, 1920);

  // Imágenes 4:5 de un carrusel (o una sola si slides tiene un elemento).
  async function slides(list, dir, { single = false } = {}) {
    mkdirSync(dir, { recursive: true });
    const files = [];
    for (let i = 0; i < list.length; i++) {
      await post.evaluate((h) => { document.getElementById('root').innerHTML = h; }, frame(list[i], single ? {} : { n: i + 1, total: list.length }));
      const f = join(dir, single ? 'imagen.png' : `${String(i + 1).padStart(2, '0')}.png`);
      await post.screenshot({ path: f });
      files.push(f);
    }
    return files;
  }

  // Reel 9:16: captura cada paso y lo monta con ffmpeg (con pista de audio en silencio para añadir música en Instagram).
  async function video(steps, file) {
    const dir = join(tmpdir(), `fl-reel-${process.pid}-${Math.random().toString(36).slice(2)}`);
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
    mkdirSync(dirname(file), { recursive: true });
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-profile:v', 'high',
      '-c:a', 'aac', '-b:a', '64k', '-shortest', '-movflags', '+faststart', file], { stdio: 'inherit' });
    rmSync(dir, { recursive: true, force: true });
    if (r.status !== 0) throw new Error(`ffmpeg falló en ${file}`);
    return Math.round(steps.reduce((t, s) => t + s.dur + (s.fade ? 0.14 : 0), 0));
  }

  return { slides, video, close: () => browser.close() };
}
