/*
 * Prepara cada lección para un alumno concreto: dibuja las figuras con su correo incrustado,
 * monta los ejemplos «¿Qué harías?» y añade su licencia personal al principio y al final.
 */
import { renderFigure } from './charts.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function licenseLine(email, licenseId) {
  return `Licencia personal de ${email} · ${licenseId} · Prohibida su reproducción o distribución`;
}

export function renderModule(mod, { email, licenseId, hasVideo }) {
  const mark = `${email} · ${licenseId}`;
  let html = mod.html;

  html = html.replace(/<figure data-fig="([\w-]+)">/g, (m, id) => `<figure class="fig">${renderFigure(id, mark)}`);

  html = html.replace(/<div class="quiz" data-example="([\w-]+)">/g, (m, id) =>
    `<div class="quiz" data-example="${id}"><div class="quiz-chart q-before">${renderFigure(id, mark, { question: true })}</div><div class="quiz-chart q-after" hidden>${renderFigure(id, mark)}</div>`);

  const video = hasVideo
    ? `<div class="video" data-video="${esc(mod.id)}"><button class="video-play" type="button" aria-label="Reproducir el vídeo del módulo"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><span>Vídeo del módulo</span></button></div>`
    : '';

  const head = `<header class="lesson-head"><div class="kicker">${mod.num ? `Módulo ${esc(mod.num)}` : esc(mod.part)}</div><h1>${esc(mod.title)}</h1></header>`;
  const lic = `<p class="license">${esc(licenseLine(email, licenseId))}</p>`;
  return `${head}${video}<div class="lesson-body">${html}</div>${lic}`;
}
