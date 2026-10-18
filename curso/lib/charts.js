/*
 * Gráficos del curso en SVG, generados en el servidor para cada alumno.
 * Cada figura lleva incrustado el correo del alumno (marca de agua), así que una captura
 * o un SVG copiado sigue identificando a quién pertenece.
 * Los colores salen de clases CSS (app.css), de modo que se adaptan al tema de la app.
 */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (n, d = 2) => Number(n).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPrice = (n) => fmt(n, Number.isInteger(n) ? 0 : 2);
const r1 = (n) => Math.round(n * 10) / 10;

// Correo repetido en diagonal por toda la figura.
function watermark(w, h, mark) {
  if (!mark) return '';
  const out = [];
  for (let y = 40; y < h + 60; y += 90) {
    for (let x = -40 + ((y / 90) % 2) * 120; x < w; x += 300) {
      out.push(`<text x="${x}" y="${y}" transform="rotate(-18 ${x} ${y})">${esc(mark)}</text>`);
    }
  }
  return `<g class="c-wm" aria-hidden="true">${out.join('')}</g>`;
}

function svg(w, h, body, mark, label) {
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || '')}" xmlns="http://www.w3.org/2000/svg">${body}${watermark(w, h, mark)}</svg>`;
}

// ------------------------------------------------------------------ velas

// Generador pseudoaleatorio con semilla: mismas velas para todos los alumnos y en cada carga.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const tick = (n) => Math.round(n * 4) / 4;

/**
 * Construye velas de 1 minuto a partir de puntos de paso [minuto, precio].
 * El minuto 0 es la hora `start` (p. ej. 15:05). `noise` es el ruido del cierre y `wick` el tamaño de las mechas.
 */
export function buildCandles({ start = '15:05', path, seed = 1, noise = 3, wick = 4, overrides = {} }) {
  const rand = rng(seed);
  const last = path[path.length - 1][0];
  const at = (m) => {
    for (let i = 1; i < path.length; i++) {
      const [m0, p0] = path[i - 1], [m1, p1] = path[i];
      if (m <= m1) return p0 + ((p1 - p0) * (m - m0)) / (m1 - m0 || 1);
    }
    return path[path.length - 1][1];
  };
  const [hh, mm] = start.split(':').map(Number);
  const candles = [];
  let prev = path[0][1];
  for (let m = 0; m < last; m++) {
    const o = prev;
    const c = tick(at(m + 1) + (m + 1 < last ? (rand() - 0.5) * 2 * noise : 0));
    const h = tick(Math.max(o, c) + rand() * wick);
    const l = tick(Math.min(o, c) - rand() * wick);
    const t = hh * 60 + mm + m;
    candles.push({ t: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, o, h, l, c, ...(overrides[m] || {}) });
    prev = c;
  }
  return candles;
}

// Recorta las velas del rango (índices a..b) para que su máximo y su mínimo sean exactamente hi y lo.
export function shapeRange(candles, a, b, hi, lo) {
  const seg = candles.slice(a, b + 1);
  const H = Math.max(...seg.map((k) => k.h)), L = Math.min(...seg.map((k) => k.l));
  const map = (p) => tick(lo + ((p - L) * (hi - lo)) / (H - L || 1));
  for (let i = a; i <= b; i++) {
    const k = candles[i];
    k.o = map(k.o); k.h = map(k.h); k.l = map(k.l); k.c = map(k.c);
  }
  // Une la siguiente vela con el nuevo cierre para que no quede un hueco.
  if (candles[b + 1]) {
    const n = candles[b + 1];
    n.o = candles[b].c; n.h = Math.max(n.h, n.o); n.l = Math.min(n.l, n.o);
  }
  if (a > 0) {
    const p = candles[a - 1];
    p.c = candles[a].o; p.h = Math.max(p.h, p.c); p.l = Math.min(p.l, p.c);
  }
  return candles;
}

/**
 * Simula la estrategia base con órdenes stop (OCO) sobre el rango de 15:15 a 15:30.
 * Devuelve la entrada, la salida y el resultado en puntos, para que el texto del ejemplo cuadre con el gráfico.
 */
export function simulate(candles, { rangeFrom, rangeTo, offset = 0.5, sl = 80, tp = 80, maxRange = 80, minRange = 10 }) {
  const seg = candles.slice(rangeFrom, rangeTo + 1);
  const hi = Math.max(...seg.map((k) => k.h)), lo = Math.min(...seg.map((k) => k.l));
  const size = hi - lo;
  const res = { hi, lo, size, buy: hi + offset, sell: lo - offset };
  if (size > maxRange) return { ...res, valid: false, reason: 'rango' };
  if (size < minRange) return { ...res, valid: false, reason: 'estrecho' };
  let pos = null;
  for (let i = rangeTo + 1; i < candles.length; i++) {
    const k = candles[i];
    if (!pos) {
      const up = k.h >= res.buy, dn = k.l <= res.sell;
      if (up && dn) return { ...res, valid: true, ambiguous: i };
      if (up) pos = { dir: 1, entry: res.buy, i };
      else if (dn) pos = { dir: -1, entry: res.sell, i };
      if (pos) { pos.sl = pos.entry - pos.dir * sl; pos.tp = pos.entry + pos.dir * tp; }
      continue;
    }
    const hitSl = pos.dir > 0 ? k.l <= pos.sl : k.h >= pos.sl;
    const hitTp = pos.dir > 0 ? k.h >= pos.tp : k.l <= pos.tp;
    if (hitSl && hitTp) return { ...res, valid: true, pos, ambiguous: i };
    if (hitSl) return { ...res, valid: true, pos, exit: { i, price: pos.sl, pts: -sl } };
    if (hitTp) return { ...res, valid: true, pos, exit: { i, price: pos.tp, pts: tp } };
  }
  return { ...res, valid: true, pos, exit: null };
}

/**
 * Gráfico de velas con rango, niveles y marcas.
 * opts: candles, range {from,to,cls}, levels [{price,label,cls,dash}], marks [{i,price,label,cls,pos}],
 *       cut (índice a partir del cual se ocultan velas: versión «¿qué harías?»), pad (márgenes de precio)
 */
export function candleChart(opts, mark) {
  const { candles, range, cut = null, notes = [], title = '', show = null } = opts;
  // `show`: animación vela a vela (vídeos). Escala fija con todas las velas; solo se dibujan las primeras `show`.
  const levels = (opts.levels || []).filter((l) => show == null || (l.from ?? 0) < show);
  const marks = (opts.marks || []).filter((m) => show == null || m.i < show);
  const W = opts.wide ? 1040 : 760, H = opts.wide ? 400 : 380, L = 14, R = 150, T = 18, B = 34;
  const shown = cut == null ? candles : candles.slice(0, cut);
  const prices = shown.flatMap((k) => [k.h, k.l]).concat(levels.map((l) => l.price));
  let max = Math.max(...prices), min = Math.min(...prices);
  const padP = (max - min) * 0.06 + 2;
  max += padP; min -= padP;
  const cw = (W - L - R) / candles.length;
  const x = (i) => L + cw * (i + 0.5);
  const y = (p) => T + ((max - p) * (H - T - B)) / (max - min);
  const parts = [];

  // Fondo de la zona futura oculta
  if (cut != null) {
    parts.push(`<rect class="c-hidden" x="${r1(x(cut) - cw / 2)}" y="${T}" width="${r1(W - R - x(cut) + cw / 2)}" height="${H - T - B}"/>`);
    parts.push(`<text class="c-tx c-mut" x="${r1((x(cut) + W - R) / 2)}" y="${r1((H - B) / 2 + 6)}" text-anchor="middle">¿Qué harías aquí?</text>`);
  }

  if (range && (show == null || show > range.to)) {
    const seg = candles.slice(range.from, range.to + 1);
    const hi = Math.max(...seg.map((k) => k.h)), lo = Math.min(...seg.map((k) => k.l));
    const x0 = x(range.from) - cw / 2, x1 = x(range.to) + cw / 2;
    parts.push(`<rect class="c-range ${range.cls || ''}" x="${r1(x0)}" y="${r1(y(hi))}" width="${r1(x1 - x0)}" height="${r1(y(lo) - y(hi))}"/>`);
    parts.push(`<text class="c-tx c-mut c-small" x="${r1(x0 + 3)}" y="${r1(y(lo) + 14)}">${esc(range.label || `Rango ${fmtPrice(hi - lo)} pts`)}</text>`);
  }

  for (const lv of levels) {
    const yy = r1(y(lv.price));
    const x0 = lv.from != null ? x(lv.from) - cw / 2 : L;
    parts.push(`<line class="c-level ${lv.cls || ''}" x1="${r1(x0)}" x2="${W - R}" y1="${yy}" y2="${yy}"${lv.dash === false ? '' : ' stroke-dasharray="5 4"'}/>`);
    parts.push(`<text class="c-tx c-lbl ${lv.cls || ''}" x="${W - R + 6}" y="${yy + 4}">${esc(lv.label)}</text>`);
  }

  (show == null ? shown : candles.slice(0, show)).forEach((k, i) => {
    const up = k.c >= k.o;
    const cls = up ? 'c-up' : 'c-dn';
    const bx = x(i), w = Math.max(2, cw * 0.62);
    const top = y(Math.max(k.o, k.c)), bot = y(Math.min(k.o, k.c));
    parts.push(`<line class="${cls}" x1="${r1(bx)}" x2="${r1(bx)}" y1="${r1(y(k.h))}" y2="${r1(y(k.l))}"/>`);
    parts.push(`<rect class="${cls} c-body" x="${r1(bx - w / 2)}" y="${r1(top)}" width="${r1(w)}" height="${r1(Math.max(1, bot - top))}"/>`);
  });

  for (const m of marks) {
    if (cut != null && m.i >= cut) continue;
    const mx = r1(x(m.i)), my = r1(y(m.price));
    parts.push(`<circle class="c-mark ${m.cls || ''}" cx="${mx}" cy="${my}" r="6"/>`);
    if (m.n) parts.push(`<text class="c-mark-n" x="${mx}" y="${my + 3.5}" text-anchor="middle">${esc(m.n)}</text>`);
    if (m.label) {
      const below = m.pos === 'below';
      parts.push(`<text class="c-tx c-small c-strong" x="${mx}" y="${r1(my + (below ? 22 : -12))}" text-anchor="middle">${esc(m.label)}</text>`);
    }
  }

  // Eje de tiempo: una marca cada 15 minutos
  parts.push(`<line class="c-ax" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>`);
  candles.forEach((k, i) => {
    if (k.t.endsWith(':00') || k.t.endsWith(':15') || k.t.endsWith(':30') || k.t.endsWith(':45')) {
      parts.push(`<line class="c-ax" x1="${r1(x(i) - cw / 2)}" x2="${r1(x(i) - cw / 2)}" y1="${H - B}" y2="${H - B + 5}"/>`);
      parts.push(`<text class="c-tx c-mut c-small" x="${r1(x(i) - cw / 2)}" y="${H - B + 18}" text-anchor="middle">${k.t}${k.t === '15:30' ? ' NY' : ''}</text>`);
    }
  });
  notes.forEach((n, j) => parts.push(`<text class="c-tx c-mut c-small" x="${L}" y="${T + 4 + j * 14}">${esc(n)}</text>`));
  return svg(W, H, parts.join(''), mark, title);
}

// ------------------------------------------------------------------ figuras del manual

function equity(mark) {
  const a = [0, 6, 1, 13, 9, 21, 16, 31, 27, 40, 45], b = [0, 7, -4, 17, -9, -22, 3, -32, -42, -36, -48];
  const X = (i) => 70 + i * 52, Y = (v) => 140 - v * 2;
  const line = (arr) => arr.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  return svg(720, 280, `
    <line class="c-ax" x1="60" y1="20" x2="60" y2="250"/><line class="c-ax" x1="60" y1="250" x2="620" y2="250"/>
    <text class="c-tx c-mut c-small" x="20" y="16">Saldo</text>
    <text class="c-tx c-mut c-small" x="340" y="272" text-anchor="middle">Operaciones →</text>
    <polyline class="c-line c-up-s" points="${line(a)}"/>
    <polyline class="c-line c-dn-s" stroke-dasharray="6 4" points="${line(b)}"/>
    <text class="c-tx c-up-t c-strong" x="${X(10) + 8}" y="${Y(45) + 4}">Con reglas</text>
    <text class="c-tx c-dn-t c-strong" x="${X(10) + 8}" y="${Y(-48) + 4}">Sin reglas</text>`, mark, 'La misma estrategia con y sin reglas de riesgo');
}

function anatomy(mark) {
  const c = (x, up) => {
    const cls = up ? 'c-up' : 'c-dn';
    return `<line class="${cls}" x1="${x}" x2="${x}" y1="40" y2="250" stroke-width="3"/><rect class="${cls} c-body" x="${x - 28}" y="90" width="56" height="110"/>`;
  };
  const lbl = (x, y, t, anchor) => `<line class="c-ax" x1="${anchor === 'end' ? x + 6 : x - 36}" x2="${anchor === 'end' ? x + 36 : x - 6}" y1="${y}" y2="${y}"/><text class="c-tx c-small" x="${x}" y="${y + 4}" text-anchor="${anchor}">${t}</text>`;
  return svg(720, 300, `
    ${c(230, true)}${c(500, false)}
    ${lbl(150, 40, 'Máximo', 'end')}${lbl(150, 90, 'Cierre', 'end')}${lbl(150, 200, 'Apertura', 'end')}${lbl(150, 250, 'Mínimo', 'end')}
    <text class="c-tx c-mut c-small" x="275" y="62">Mecha superior</text><text class="c-tx c-mut c-small" x="275" y="150">Cuerpo</text><text class="c-tx c-mut c-small" x="275" y="230">Mecha inferior</text>
    ${lbl(580, 40, 'Máximo', 'start')}${lbl(580, 90, 'Apertura', 'start')}${lbl(580, 200, 'Cierre', 'start')}${lbl(580, 250, 'Mínimo', 'start')}
    <text class="c-tx c-strong c-small" x="230" y="285" text-anchor="middle">Alcista: cierra por encima de la apertura</text>
    <text class="c-tx c-strong c-small" x="500" y="285" text-anchor="middle">Bajista: cierra por debajo de la apertura</text>`, mark, 'Anatomía de una vela alcista y una bajista');
}

function timeframes(mark) {
  const k = (x, o, h, l, c, w = 22) => {
    const cls = c <= o ? 'c-up' : 'c-dn'; // coordenadas SVG: arriba = menor y
    return `<line class="${cls}" x1="${x}" x2="${x}" y1="${h}" y2="${l}"/><rect class="${cls} c-body" x="${x - w / 2}" y="${Math.min(o, c)}" width="${w}" height="${Math.abs(c - o)}"/>`;
  };
  return svg(720, 250, `
    <text class="c-tx c-strong c-small" x="160" y="22" text-anchor="middle">3 velas de 5 minutos</text>
    ${k(110, 170, 80, 182, 95)}${k(160, 95, 70, 175, 150)}${k(210, 150, 40, 160, 115)}
    <text class="c-tx c-mut c-small" x="110" y="215" text-anchor="middle">15:15</text><text class="c-tx c-mut c-small" x="160" y="215" text-anchor="middle">15:20</text><text class="c-tx c-mut c-small" x="210" y="215" text-anchor="middle">15:25</text>
    <path class="c-arrow" d="M300 120h60v-14l28 22-28 22v-14h-60z"/>
    <text class="c-tx c-strong c-small" x="480" y="22" text-anchor="middle">1 vela de 15 minutos</text>
    ${k(480, 170, 40, 182, 115, 34)}
    <line class="c-ax" x1="510" x2="540" y1="40" y2="40"/><text class="c-tx c-small" x="546" y="44">Máximo del rango</text>
    <line class="c-ax" x1="510" x2="540" y1="182" y2="182"/><text class="c-tx c-small" x="546" y="186">Mínimo del rango</text>
    <text class="c-tx c-mut c-small" x="480" y="215" text-anchor="middle">15:15–15:30</text>`, mark, 'Tres velas de 5 minutos forman una vela de 15 minutos');
}

function patterns(mark) {
  const k = (x, o, h, l, c, w = 18) => {
    const cls = c <= o ? 'c-up' : 'c-dn'; // coordenadas SVG: arriba = menor y
    return `<line class="${cls}" x1="${x}" x2="${x}" y1="${h}" y2="${l}"/><rect class="${cls} c-body" x="${x - w / 2}" y="${Math.min(o, c)}" width="${w}" height="${Math.max(3, Math.abs(c - o))}"/>`;
  };
  const cards = [
    ['Marubozu', 'Dominio total', k(55, 165, 40, 167, 42)],
    ['Doji', 'Indecisión', k(55, 100, 45, 150, 102)],
    ['Vela interior', 'Compresión', k(43, 150, 35, 160, 45, 16) + k(69, 80, 70, 125, 110, 14)],
    ['Martillo', 'Rechazo de mínimos', k(55, 70, 50, 160, 52)],
    ['Estrella fugaz', 'Rechazo de máximos', k(55, 140, 40, 157, 155)],
    ['Envolvente', 'Cambio de control', k(41, 70, 65, 115, 105, 14) + k(67, 125, 55, 130, 60, 16)],
  ];
  return svg(720, 230, cards.map(([n, d, g], i) => `<g transform="translate(${8 + i * 119} 6)"><rect class="c-card" x="0" y="0" width="111" height="216" rx="10"/>${g}<text class="c-tx c-strong c-small" x="55" y="188" text-anchor="middle">${n}</text><text class="c-tx c-mut c-tiny" x="55" y="204" text-anchor="middle">${d}</text></g>`).join(''), mark, 'Seis patrones de velas');
}

function orders(mark) {
  const row = (y, cls, a, b) => `<line class="c-level ${cls}" x1="90" x2="640" y1="${y}" y2="${y}" stroke-dasharray="6 4"/><text class="c-tx c-strong c-small ${cls}" x="94" y="${y - 7}">${a}</text><text class="c-tx c-small" x="230" y="${y - 7}">${b}</text>`;
  return svg(720, 270, `
    <text class="c-tx c-mut c-small" x="640" y="20" text-anchor="end">Por encima del precio</text>
    ${row(55, 'c-up-t', 'Buy stop 20.040', 'compra si SUBE hasta aquí (ruptura)')}
    ${row(95, 'c-dn-t', 'Sell limit 20.030', 'vende si SUBE hasta aquí (venta en resistencia)')}
    <line class="c-ax c-thick" x1="90" x2="640" y1="140" y2="140"/><text class="c-tx c-strong c-small" x="94" y="133">Precio actual 20.000</text>
    ${row(185, 'c-up-t', 'Buy limit 19.970', 'compra si BAJA hasta aquí (compra en soporte)')}
    ${row(225, 'c-dn-t', 'Sell stop 19.960', 'vende si BAJA hasta aquí (ruptura bajista)')}
    <text class="c-tx c-mut c-small" x="640" y="258" text-anchor="end">Por debajo del precio</text>`, mark, 'Dónde se coloca cada orden respecto al precio actual');
}

function rangeFig(mark) {
  return svg(720, 260, `
    <line class="c-level c-dn-t" x1="60" x2="460" y1="90" y2="90" stroke-dasharray="6 4"/>
    <line class="c-level c-up-t" x1="60" x2="460" y1="190" y2="190" stroke-dasharray="6 4"/>
    <text class="c-tx c-dn-t c-strong c-small" x="64" y="80">Resistencia: el precio rebota hacia abajo</text>
    <text class="c-tx c-up-t c-strong c-small" x="64" y="208">Soporte: el precio rebota hacia arriba</text>
    <text class="c-tx c-brand-t c-strong" x="250" y="145" text-anchor="middle">RANGO</text>
    <polyline class="c-line c-ink" points="60,180 100,92 145,186 190,92 235,188 280,92 325,186 370,120 410,100 440,90 480,62 515,72 560,40"/>
    <circle class="c-mark" cx="440" cy="90" r="6"/>
    <text class="c-tx c-strong c-small" x="450" y="118">Ruptura: el rango se rompe</text>
    <text class="c-tx c-mut c-tiny" x="450" y="132">y el precio busca un nuevo nivel</text>`, mark, 'Soporte, resistencia, rango y ruptura');
}

function validFig(mark) {
  const k = (x, o, h, l, c, w = 14) => {
    const cls = c <= o ? 'c-up' : 'c-dn'; // coordenadas SVG: arriba = menor y
    return `<line class="${cls}" x1="${x}" x2="${x}" y1="${h}" y2="${l}"/><rect class="${cls} c-body" x="${x - w / 2}" y="${Math.min(o, c)}" width="${w}" height="${Math.max(3, Math.abs(c - o))}"/>`;
  };
  const small = [[60, 128, 120, 138, 124], [95, 124, 118, 136, 132], [130, 132, 120, 140, 122], [165, 122, 118, 136, 130], [200, 130, 120, 138, 124], [235, 124, 120, 134, 130]];
  const big = [[420, 190, 140, 200, 150], [455, 150, 70, 160, 80], [490, 80, 60, 120, 110], [525, 110, 50, 125, 60], [560, 60, 55, 160, 130], [595, 130, 90, 145, 100]];
  return svg(720, 260, `
    <rect class="c-card" x="20" y="10" width="300" height="236" rx="12"/><rect class="c-card" x="370" y="10" width="330" height="236" rx="12"/>
    <text class="c-tx c-up-t c-strong" x="170" y="40" text-anchor="middle">Válido</text>
    <text class="c-tx c-dn-t c-strong" x="535" y="40" text-anchor="middle">No válido: no se opera</text>
    <rect class="c-range" x="45" y="114" width="205" height="30" rx="4"/>${small.map((a) => k(...a)).join('')}
    <text class="c-tx c-small" x="150" y="178" text-anchor="middle">Rango de 40 puntos</text>
    <text class="c-tx c-mut c-tiny" x="150" y="196" text-anchor="middle">Velas pequeñas y solapadas,</text>
    <text class="c-tx c-mut c-tiny" x="150" y="210" text-anchor="middle">sin dirección y con poco volumen</text>
    <rect class="c-range c-bad" x="400" y="48" width="215" height="160" rx="4"/>${big.map((a) => k(...a, 16)).join('')}
    <text class="c-tx c-strong c-small" x="625" y="132">95 pts</text>
    <text class="c-tx c-mut c-tiny" x="535" y="230" text-anchor="middle">Velas grandes; rango mayor que el stop de 80</text>`, mark, 'Rango válido frente a rango no válido');
}

function pyramidFig(mark) {
  return svg(720, 300, `
    <line class="c-ax" x1="60" x2="640" y1="250" y2="250"/><text class="c-tx c-small" x="480" y="242">Entrada 20.000</text>
    <line class="c-level c-up-t" x1="60" x2="640" y1="120" y2="120" stroke-dasharray="6 4"/><text class="c-tx c-small c-up-t" x="480" y="112">TP base 20.080 (+80)</text>
    <line class="c-level c-dn-t" x1="245" x2="640" y1="185" y2="185" stroke-dasharray="6 4"/><text class="c-tx c-strong c-small c-dn-t" x="480" y="177">Stop subido 20.040</text>
    <polyline class="c-line c-ink" points="72,250 125,200 155,215 205,120 240,145 270,120 330,60 360,85 410,30"/>
    ${[[72, 250, 1], [205, 120, 2], [270, 120, 3]].map(([cx, cy, n]) => `<circle class="c-mark" cx="${cx}" cy="${cy}" r="11"/><text class="c-mark-n c-big" x="${cx}" y="${cy + 4}" text-anchor="middle">${n}</text>`).join('')}`, mark, 'Promediado a favor en tres pasos');
}

function doubleFig(mark) {
  return svg(720, 280, `
    <rect class="c-range" x="60" y="40" width="100" height="40"/><text class="c-tx c-mut c-small" x="110" y="98" text-anchor="middle">Rango</text>
    <line class="c-ax c-thick" x1="60" x2="640" y1="40" y2="40"/><text class="c-tx c-strong c-small" x="480" y="32">Compra en 20.000</text>
    <line class="c-level c-dn-t" x1="60" x2="640" y1="120" y2="120" stroke-dasharray="6 4"/><text class="c-tx c-strong c-small c-dn-t" x="480" y="112">SL 19.920: −80, fin del día</text>
    <polyline class="c-line c-ink" points="60,60 85,52 110,70 135,50 160,58 195,14 230,30 265,120 300,85 340,145 385,190 425,170 470,240"/>
    <circle class="c-mark" cx="195" cy="14" r="6"/><circle class="c-mark c-dn-f" cx="265" cy="120" r="6"/>
    <text class="c-tx c-mut c-small" x="470" y="262" text-anchor="middle">Caída posterior: ya no es tu operación</text>`, mark, 'Caso 1: doble ruptura');
}

// ------------------------------------------------------------------ ejemplos de entrada

/*
 * Cada ejemplo usa velas de 1 minuto de 15:05 a ~16:20 en el NQ/MNQ (precios ilustrativos).
 * Rango: velas de 15:15 a 15:29 (índices 10..24). Órdenes stop a 2 ticks (0,50 puntos) del rango.
 */
const RANGE_FROM = 10, RANGE_TO = 24;

function example(def) {
  const candles = shapeRange(buildCandles(def), RANGE_FROM, def.shapeTo ?? RANGE_TO, def.hi, def.lo);
  for (const [i, ov] of Object.entries(def.fix || {})) Object.assign(candles[i], ov);
  const sim = simulate(candles, { rangeFrom: RANGE_FROM, rangeTo: RANGE_TO });
  return { ...def, candles, sim };
}

export const EXAMPLES = {
  'ej-largo': example({
    seed: 11, hi: 20040, lo: 20000, noise: 2.5, wick: 3,
    path: [[0, 20060], [6, 20030], [10, 20020], [13, 20036], [16, 20006], [19, 20030], [22, 20012], [25, 20026], [28, 20044], [31, 20070], [34, 20062], [38, 20098], [41, 20088], [45, 20124], [48, 20112], [53, 20138], [58, 20130], [64, 20150]],
  }),
  'ej-corto': example({
    seed: 23, hi: 19985, lo: 19955, noise: 2.2, wick: 3,
    path: [[0, 19990], [5, 20004], [10, 19975], [13, 19960], [16, 19980], [19, 19962], [22, 19976], [25, 19968], [27, 19950], [30, 19925], [33, 19935], [37, 19905], [41, 19912], [45, 19882], [49, 19866], [53, 19876], [58, 19860], [64, 19868]],
  }),
  'ej-falsa': example({
    seed: 37, hi: 20030, lo: 19995, noise: 2.5, wick: 3,
    path: [[0, 20000], [6, 20020], [10, 20012], [13, 20026], [17, 19999], [21, 20022], [25, 20018], [27, 20036], [30, 20052], [33, 20044], [37, 20010], [41, 19990], [45, 19970], [49, 19945], [53, 19960], [58, 19930], [64, 19900], [70, 19880]],
  }),
  'ej-ancho': example({
    seed: 41, hi: 20060, lo: 19965, noise: 4, wick: 6,
    path: [[0, 19990], [6, 19975], [10, 19970], [12, 20010], [14, 19995], [17, 20050], [19, 20030], [21, 19985], [24, 20040], [26, 20010], [30, 20048], [36, 19998], [42, 20052], [48, 20015], [55, 20040], [64, 20000]],
  }),
  'ej-antes': example({
    seed: 53, hi: 20030, lo: 20000, noise: 2.5, wick: 3, shapeTo: 19,
    path: [[0, 20015], [6, 20000], [10, 20010], [14, 20025], [17, 20008], [20, 20018], [21, 20026], [24, 20060], [26, 20052], [30, 20078], [34, 20060], [38, 20085], [42, 20070], [48, 20090], [55, 20072], [64, 20095]],
  }),
  'ej-cierre': example({
    seed: 67, hi: 20020, lo: 19985, noise: 2.2, wick: 3, fix: { 25: { h: 20027 } },
    path: [[0, 20030], [6, 20010], [10, 20000], [13, 20015], [16, 19990], [19, 20010], [22, 19995], [25, 20008], [26, 20012], [28, 19998], [30, 19978], [34, 19962], [37, 19970], [41, 19945], [45, 19930], [49, 19905], [53, 19892], [58, 19880], [64, 19890]],
  }),
  'ej-piramide': example({
    seed: 79, hi: 20035, lo: 20000, noise: 2.5, wick: 3,
    path: [[0, 20010], [6, 20030], [10, 20018], [13, 20032], [16, 20004], [19, 20026], [22, 20008], [25, 20024], [27, 20042], [31, 20072], [34, 20064], [38, 20100], [41, 20122], [44, 20108], [47, 20112], [51, 20150], [54, 20142], [58, 20176], [61, 20166], [65, 20196], [68, 20186], [72, 20168], [76, 20172]],
  }),
};

// Precio en formato del curso: 20.040,50
const P = fmtPrice;

function exampleChart(id, mark, question, show = null, limit = null, wide = false) {
  const ex = EXAMPLES[id];
  const { sim } = ex;
  const candles = limit ? ex.candles.slice(0, limit) : ex.candles;
  const range = { from: RANGE_FROM, to: RANGE_TO, cls: sim.valid ? '' : 'c-bad' };
  const cut = question ? RANGE_TO + 1 : null;
  const levels = [], marks = [];
  const lastRangeCandle = RANGE_TO;
  if (id === 'ej-ancho') {
    range.label = `Rango ${P(sim.size)} pts: no se opera`;
  } else if (id === 'ej-antes') {
    // Compresión de 15:15 a 15:24 y escapada antes de la apertura: el rango queda invalidado.
    range.to = ex.shapeTo;
    range.label = 'Compresión 15:15–15:24';
    const i = ex.candles.findIndex((k, j) => j > ex.shapeTo && k.c > ex.hi + 10);
    marks.push({ i, price: ex.candles[i].c, label: `${ex.candles[i].t}: sale antes de la apertura`, cls: 'c-dn-f', pos: 'below' });
  } else if (id === 'ej-cierre') {
    // Mismo día con los dos métodos: la mecha activa el buy stop, pero ninguna vela cierra por encima del rango.
    const c = ex.close;
    levels.push({ price: sim.hi, label: `Máximo ${P(sim.hi)}`, cls: 'c-ink-t', from: RANGE_FROM, dash: false });
    levels.push({ price: sim.lo, label: `Mínimo ${P(sim.lo)}`, cls: 'c-ink-t', from: RANGE_FROM, dash: false });
    if (!question) {
      levels.push({ price: c.tp, label: `TP corto ${P(c.tp)}`, cls: 'c-up-t', from: c.i });
      levels.push({ price: sim.pos.sl, label: `SL largo ${P(sim.pos.sl)}`, cls: 'c-dn-t', from: sim.pos.i });
      marks.push({ i: sim.pos.i, price: ex.candles[sim.pos.i].h, label: 'Mecha: salta el buy stop' });
      marks.push({ i: c.i, price: c.entry, label: `Cierre fuera: venta ${P(c.entry)}`, cls: 'c-brand-f', pos: 'below' });
      if (sim.exit) marks.push({ i: sim.exit.i, price: sim.exit.price, label: 'Stop: −80', cls: 'c-dn-f', pos: 'above' });
      if (c.exit) marks.push({ i: c.exit.i, price: c.tp, label: 'Cierre: +80', cls: 'c-up-f', pos: 'below' });
    }
  } else if (sim.valid) {
    levels.push({ price: sim.buy, label: `Buy stop ${P(sim.buy)}`, cls: 'c-up-t', from: lastRangeCandle });
    levels.push({ price: sim.sell, label: `Sell stop ${P(sim.sell)}`, cls: 'c-dn-t', from: lastRangeCandle });
    if (!question && sim.pos) {
      const { pos, exit } = sim;
      const long = pos.dir > 0;
      levels.push({ price: pos.tp, label: `TP ${P(pos.tp)}`, cls: 'c-up-t', from: pos.i });
      levels.push({ price: pos.sl, label: `SL ${P(pos.sl)}`, cls: 'c-dn-t', from: pos.i });
      marks.push({ i: pos.i, price: pos.entry, label: `${long ? 'Compra' : 'Venta'} ${ex.candles[pos.i].t}`, pos: long ? 'above' : 'below' });
      if (id === 'ej-piramide') {
        // Paso 2: +80 → cierre parcial y stop a +40. Paso 3: añadido en el retroceso. Salida por trailing.
        const p = EXAMPLES[id].plan;
        marks.push({ i: p.partial.i, price: p.partial.price, n: '2', cls: 'c-up-f' });
        marks.push({ i: p.add.i, price: p.add.price, n: '3', cls: 'c-brand-f', pos: 'below' });
        marks.push({ i: p.exit.i, price: p.exit.price, label: `Trailing ${P(p.exit.price)}`, cls: 'c-dn-f', pos: 'below' });
        levels.push({ price: p.stop2, label: `Stop subido ${P(p.stop2)}`, cls: 'c-dn-t', from: p.partial.i });
      } else if (exit) {
        marks.push({ i: exit.i, price: exit.price, label: `${exit.pts > 0 ? '+' : '−'}80 · ${ex.candles[exit.i].t}`, cls: exit.pts > 0 ? 'c-up-f' : 'c-dn-f', pos: exit.pts > 0 === long ? 'above' : 'below' });
      }
    }
  }
  return candleChart({ candles, range, levels, marks: marks.filter((m) => m.i < candles.length), cut, show, wide, title: question ? 'Situación a las 15:30' : 'Resolución' }, mark);
}

// Plan del ejemplo de promediado (se calcula a partir de las velas para que todo cuadre).
(function planPyramid() {
  const ex = EXAMPLES['ej-piramide'];
  const { candles, sim } = ex;
  if (!sim.pos) return;
  const e = sim.pos.entry, tp = e + 80;
  const pi = candles.findIndex((k, i) => i > sim.pos.i && k.h >= tp);
  // Añadido: primera vela posterior que retrocede hasta el nivel de +80 o cerca (5 puntos) y vuelve a cerrar por encima.
  let ai = candles.findIndex((k, i) => i > pi && k.l <= tp + 6);
  if (ai < 0) ai = pi + 3;
  const addPrice = Math.min(candles[ai].h, Math.max(candles[ai].l, tp));
  // Salida: trailing bajo el mínimo de las últimas 5 velas, activo desde el añadido.
  let exit = null;
  for (let i = ai + 6; i < candles.length; i++) {
    const trail = Math.min(...candles.slice(i - 5, i).map((k) => k.l));
    if (candles[i].l <= trail) { exit = { i, price: trail }; break; }
  }
  exit ||= { i: candles.length - 1, price: candles[candles.length - 1].c };
  ex.plan = { partial: { i: pi, price: tp }, add: { i: ai, price: tick(addPrice) }, stop2: e + 40, exit };
})();

// Método de cierre de vela del ejemplo «ej-cierre»: primera vela de 1 minuto que cierra fuera del rango.
(function planClose() {
  const ex = EXAMPLES['ej-cierre'];
  const { candles, sim } = ex;
  const i = candles.findIndex((k, j) => j > RANGE_TO && (k.c > sim.hi || k.c < sim.lo));
  const dir = candles[i].c > sim.hi ? 1 : -1, entry = candles[i].c;
  const tp = entry + dir * 80, sl = entry - dir * 80;
  const j = candles.findIndex((k, n) => n > i && (dir > 0 ? k.h >= tp : k.l <= tp));
  const s = candles.findIndex((k, n) => n > i && (dir > 0 ? k.l <= sl : k.h >= sl));
  ex.close = { i, dir, entry, tp, sl, exit: j > 0 && (s < 0 || j < s) ? { i: j } : null, stopped: s > 0 && (j < 0 || s < j) };
})();

export const FIGURES = {
  equity, anatomy, timeframes, patterns, orders, range: rangeFig, valid: validFig, pyramid: pyramidFig, double: doubleFig,
  breakout: (mark) => exampleChart('ej-largo', mark, false),
};

export function renderFigure(id, mark, { question = false, show = null, limit = null, wide = false } = {}) {
  if (EXAMPLES[id]) return exampleChart(id, mark, question, show, limit, wide);
  const f = FIGURES[id];
  return f ? f(mark) : '';
}
