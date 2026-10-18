/*
 * Genera los vídeos del curso (uno por módulo) a partir de content-src/videos.js.
 * Cada escena se dibuja en HTML con los mismos gráficos que la app, se captura con Chromium (Playwright)
 * y los fotogramas se montan con ffmpeg. Los vídeos base no llevan correo: la marca de agua de cada
 * alumno se graba al servirlos (lib/protect.js).
 *
 *   npm run videos                 → todos
 *   npm run videos -- 08-entrada   → solo esos módulos
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { renderFigure } from '../lib/charts.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'content-src');
const outDir = join(src, 'videos');
const { VIDEOS } = await import(pathToFileURL(join(src, 'videos.js')).href);
const course = JSON.parse(readFileSync(join(src, 'course.json'), 'utf8'));
const meta = new Map(course.parts.flatMap((p) => p.modules.map((m) => [m.id, { ...m, part: p }])));
const order = course.parts.flatMap((p) => p.modules.map((m) => m.id));

const W = 1280, H = 720;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// **negrita** en los textos de las escenas
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/&lt;br&gt;/g, '<br>');
// Tiempo de lectura: base + por carácter
const read = (text, base = 1.6) => Math.min(9, base + String(text).replace(/\*/g, '').length * 0.055);

const appCss = readFileSync(join(root, 'public', 'style.css'), 'utf8');
const stageCss = `
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #0a0f1c; }
body { background: radial-gradient(900px 420px at 85% -120px, rgba(127,216,239,.13), transparent 60%), radial-gradient(700px 380px at -10% 0, rgba(52,211,153,.06), transparent 60%), #0a0f1c; }
.stage { position: absolute; inset: 0; padding: 70px 80px 54px; display: flex; flex-direction: column; }
.bar-top { position: absolute; left: 80px; right: 80px; top: 26px; display: flex; align-items: center; justify-content: space-between; color: var(--muted); font-size: 15px; }
.bar-top .brand { font-size: 17px; }
.bar-top .brand img { width: 28px; height: 28px; }
.prog { position: absolute; left: 0; bottom: 0; height: 4px; background: linear-gradient(90deg, var(--brand), var(--green)); }
.kick { color: var(--brand); text-transform: uppercase; letter-spacing: .18em; font-size: 16px; font-weight: 700; }
h1.big { font-family: var(--serif); font-size: 66px; margin: 14px 0 18px; line-height: 1.08; }
.subt { font-family: var(--serif); font-style: italic; font-size: 26px; color: var(--text-2); max-width: 980px; line-height: 1.45; }
h2.sh { font-family: var(--serif); font-size: 40px; margin: 6px 0 22px; }
.items { list-style: none; padding: 0; margin: 0; display: grid; gap: 16px; }
.items li { font-size: 27px; line-height: 1.38; color: var(--text-2); padding-left: 36px; position: relative; }
.items li::before { content: "◆"; position: absolute; left: 0; top: 2px; color: var(--brand); font-size: 18px; }
.items li b, .cap b, .calc b, .card-x b { color: var(--text); }
.fig2 { flex: 1; min-height: 0; display: flex; gap: 26px; align-items: stretch; }
.fig2 .chart { flex: 1; min-width: 0; background: var(--bg-soft); border: 1px solid var(--line); border-radius: 18px; padding: 12px; display: flex; align-items: center; }
.fig2 .chart svg { width: 100%; height: 100%; }
.fig2 .side-notes { width: 330px; display: grid; align-content: start; gap: 14px; }
.fig2 .side-notes div { background: var(--surface); border: 1px solid var(--line); border-left: 4px solid var(--brand); border-radius: 12px; padding: 12px 14px; font-size: 19px; line-height: 1.35; color: var(--text-2); }
.fig1 { flex: 1; min-height: 0; background: var(--bg-soft); border: 1px solid var(--line); border-radius: 18px; padding: 10px 16px; display: flex; align-items: center; justify-content: center; }
.fig1 svg { width: 100%; height: 100%; }
.cap { margin-top: 18px; min-height: 76px; font-size: 25px; line-height: 1.4; color: var(--text-2); background: var(--surface); border: 1px solid var(--line-strong); border-radius: 14px; padding: 14px 20px; }
.chart-svg text { font-size: 14px; }
.chart-svg .c-small { font-size: 13px; }
.chart-svg .c-tiny { font-size: 11px; }
.chart-svg .c-lbl { font-size: 13px; }
table.tv { font-size: 21px; }
table.tv th { font-size: 19px; }
table.tv td { padding: 12px 14px; }
.calc { display: grid; gap: 16px; }
.calc div { font-size: 30px; color: var(--text-2); background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px 22px; }
.calc div.res { border-color: var(--brand); color: var(--text); }
.card-x { font-size: 28px; line-height: 1.45; color: var(--text-2); border-radius: 18px; padding: 26px 30px; background: var(--surface); border: 1px solid var(--line-strong); }
.card-x.warn { border-left: 6px solid var(--red); background: var(--red-soft); }
.card-x.ex { border-left: 6px solid var(--green); background: var(--green-soft); }
.card-x.rule { border-left: 6px solid var(--amber); background: var(--amber-soft); }
.card-x h3 { margin: 0 0 12px; font-size: 18px; text-transform: uppercase; letter-spacing: .12em; }
.card-x.warn h3 { color: var(--red); } .card-x.ex h3 { color: var(--green); } .card-x.rule h3 { color: var(--amber); }
.center { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.quote { font-family: var(--serif); font-style: italic; font-size: 40px; text-align: center; line-height: 1.35; color: var(--text); }
.endnext { margin-top: 30px; color: var(--muted); font-size: 22px; }
.endnext b { color: var(--brand); }
.disclaimer { position: absolute; left: 80px; right: 80px; bottom: 18px; font-size: 13px; color: var(--muted); text-align: center; }
.new { opacity: var(--a, 1); transform: translateY(calc((1 - var(--a, 1)) * 14px)); }
`;

// ----------------------------------------------------------------- escenas → pasos

/*
 * Cada escena se convierte en una lista de pasos { html, dur }. Un paso nuevo con `reveal` se dibuja
 * con un fundido corto del elemento recién aparecido.
 */
function header(mod, scene) {
  return `<div class="bar-top"><span class="brand"><img src="data:image/svg+xml;base64,${ICON}">Funded<b>_lab</b></span><span>${mod.num ? `Módulo ${esc(mod.num)} · ` : ''}${esc(mod.title)}</span></div>`;
}
const ICON = readFileSync(join(root, 'public', 'icons', 'icon.svg')).toString('base64');

function stepsFor(scene, mod, next) {
  const S = [];
  const add = (html, dur, fade = true) => S.push({ html, dur, fade });
  switch (scene.type) {
    case 'title': {
      add(`<div class="center"><div class="kick">${esc(scene.kicker || (mod.num ? `Parte ${mod.part.num} · Módulo ${mod.num}` : 'Funded Lab'))}</div><h1 class="big">${rich(scene.title || mod.title)}</h1>${scene.text ? `<div class="subt">${rich(scene.text)}</div>` : ''}</div>`, read(scene.text || '', 3));
      break;
    }
    case 'bullets': {
      scene.items.forEach((_, i) => {
        const lis = scene.items.slice(0, i + 1).map((t, j) => `<li class="${j === i ? 'new' : ''}">${rich(t)}</li>`).join('');
        add(`<h2 class="sh">${rich(scene.title)}</h2><ul class="items">${lis}</ul>`, read(scene.items[i], 1.4));
      });
      S[S.length - 1].dur += 1.2;
      break;
    }
    case 'card': {
      add(`<h2 class="sh">${rich(scene.title || '')}</h2><div class="center"><div class="card-x ${scene.tone || ''}">${scene.label ? `<h3>${esc(scene.label)}</h3>` : ''}${scene.lines.map((l) => `<p style="margin:8px 0">${rich(l)}</p>`).join('')}</div></div>`, read(scene.lines.join(' '), 2.2));
      break;
    }
    case 'calc': {
      scene.lines.forEach((_, i) => {
        const rows = scene.lines.slice(0, i + 1).map((t, j) => `<div class="${j === i ? 'new' : ''} ${j === scene.lines.length - 1 && scene.result !== false ? 'res' : ''}">${rich(t)}</div>`).join('');
        add(`<h2 class="sh">${rich(scene.title)}</h2><div class="calc">${rows}</div>`, read(scene.lines[i], 1.6));
      });
      S[S.length - 1].dur += 1.5;
      break;
    }
    case 'table': {
      scene.rows.forEach((_, i) => {
        const body = scene.rows.slice(0, i + 1).map((r, j) => `<tr class="${j === i ? 'new' : ''}">${r.map((c) => `<td>${rich(c)}</td>`).join('')}</tr>`).join('');
        add(`<h2 class="sh">${rich(scene.title)}</h2><div class="table-wrap"><table class="tv"><thead><tr>${scene.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`, read(scene.rows[i].join(' '), 1.2));
      });
      S[S.length - 1].dur += 1.5;
      break;
    }
    case 'figure': {
      const svg = renderFigure(scene.fig, '');
      const notes = scene.notes || [];
      if (!notes.length) add(`<h2 class="sh">${rich(scene.title)}</h2><div class="fig1">${svg}</div>`, scene.dur || 5);
      notes.forEach((_, i) => {
        const n = notes.slice(0, i + 1).map((t, j) => `<div class="${j === i ? 'new' : ''}">${rich(t)}</div>`).join('');
        add(`<h2 class="sh">${rich(scene.title)}</h2><div class="fig2"><div class="chart">${svg}</div><div class="side-notes">${n}</div></div>`, read(notes[i], 1.6));
      });
      break;
    }
    case 'replay': {
      // Las velas aparecen de una en una; los textos cambian en las velas indicadas y ahí se hace una pausa.
      const caps = [...scene.captions].sort((a, b) => a[0] - b[0]);
      const total = scene.to ?? 999;
      let shown = scene.from ?? 1;
      const last = Math.min(total, countCandles(scene.example));
      const frame = (n, cap, fade) => {
        const svg = renderFigure(scene.example, '', { show: n, limit: scene.to ? scene.to + 4 : null, wide: true });
        add(`<h2 class="sh">${rich(scene.title)}</h2><div class="fig1 chart">${svg}</div><div class="cap ${fade ? 'new' : ''}">${rich(cap)}</div>`, 0, false);
      };
      let capIdx = -1;
      for (; shown <= last; shown++) {
        let ci = capIdx;
        while (ci + 1 < caps.length && caps[ci + 1][0] <= shown) ci++;
        const cap = ci >= 0 ? caps[ci][1] : '';
        frame(shown, cap, ci !== capIdx);
        S[S.length - 1].dur = ci !== capIdx ? read(cap, 1.2) : (scene.speed || 0.13);
        S[S.length - 1].fade = ci !== capIdx;
        capIdx = ci;
      }
      S[S.length - 1].dur += 2;
      break;
    }
    case 'quote': {
      add(`<div class="center"><div class="quote">${rich(scene.text)}</div></div>`, read(scene.text, 2.5));
      break;
    }
    case 'end': {
      const nx = next ? meta.get(next) : null;
      add(`<div class="center"><div class="kick">Resumen</div><h1 class="big" style="font-size:52px">${rich(scene.title || 'Lo que te llevas')}</h1>
        <ul class="items">${scene.items.map((t) => `<li>${rich(t)}</li>`).join('')}</ul>
        ${nx ? `<div class="endnext">Siguiente: <b>${nx.num ? `Módulo ${esc(nx.num)} · ` : ''}${esc(nx.title)}</b></div>` : '<div class="endnext"><b>Planifica la operación y opera el plan.</b></div>'}</div>
        <div class="disclaimer">Material formativo. No constituye asesoramiento financiero. Precios de los ejemplos ilustrativos. © 2026 Funded Lab · @fundedlab_es</div>`, read(scene.items.join(' '), 2.5));
      break;
    }
    default:
      throw new Error(`Escena desconocida: ${scene.type}`);
  }
  if (S.length) S[0].fade = true;
  return S;
}

import { EXAMPLES } from '../lib/charts.js';
const countCandles = (id) => (EXAMPLES[id] ? EXAMPLES[id].candles.length : 0);

// ----------------------------------------------------------------- render

const FADE = [0.35, 0.7]; // fotogramas intermedios de 0,08 s antes de cada paso con fundido

async function renderVideo(page, id) {
  const mod = meta.get(id);
  const scenes = VIDEOS[id];
  const next = order[order.indexOf(id) + 1];
  const steps = scenes.flatMap((sc) => stepsFor(sc, mod, next).map((s, i) => ({ ...s, sceneStart: i === 0 })));
  const dir = join(tmpdir(), `flv-${id}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const total = steps.reduce((a, s) => a + s.dur, 0);
  const list = [];
  let t = 0, n = 0;
  const shot = async (html, alpha, dur, sceneFade) => {
    const prog = `<div class="prog" style="width:${((t / total) * 100).toFixed(2)}%"></div>`;
    const a = sceneFade ? alpha : 1;
    await page.evaluate(([h, al, sa]) => {
      const st = document.getElementById('stage');
      st.innerHTML = h;
      st.style.opacity = sa;
      st.style.setProperty('--a', al);
    }, [`${header(mod)}${html}${prog}`, alpha, a]);
    const f = join(dir, `${String(++n).padStart(5, '0')}.png`);
    await page.screenshot({ path: f });
    list.push(`file '${f}'\nduration ${dur.toFixed(3)}`);
  };
  for (const s of steps) {
    if (s.fade) for (const a of FADE) await shot(s.html, a, 0.08, s.sceneStart);
    await shot(s.html, 1, s.dur, false);
    t += s.dur;
  }
  list.push(`file '${join(dir, `${String(n).padStart(5, '0')}.png`)}'`);
  writeFileSync(join(dir, 'list.txt'), list.join('\n'));
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${id}.mp4`);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-tune', 'stillimage', '-movflags', '+faststart', out], { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg falló en ${id}`);
  return { id, seconds: Math.round(total), frames: n };
}

const only = process.argv.slice(2);
const ids = (only.length ? only : order).filter((id) => VIDEOS[id]);
const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? {} : {});
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${appCss}${stageCss}</style></head><body><div class="stage" id="stage"></div></body></html>`);
for (const id of ids) {
  const r = await renderVideo(page, id);
  console.log(`${r.id}: ${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, '0')} (${r.frames} fotogramas)`);
}
await browser.close();
