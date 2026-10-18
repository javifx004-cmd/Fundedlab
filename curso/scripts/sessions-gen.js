/*
 * Genera sesiones de ejemplo nuevas (velas de 1 minuto, 15:05 en adelante) para las redes sociales.
 * Cada sesión se construye a partir de una «plantilla» de lo que se quiere enseñar y solo se acepta si el simulador
 * del curso da exactamente ese resultado. Los textos se calculan a partir de los datos: siempre cuadran con el gráfico.
 */
import { registerExample, fmtPrice as P } from '../lib/charts.js';

// Pseudoaleatorio con semilla: mismas sesiones cada vez que se genera.
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

const KINDS = ['long-win', 'short-win', 'long-loss', 'short-loss', 'wide', 'antes'];

// Puntos de paso [minuto, precio] para cada tipo de día. El minuto 0 es 15:05; el rango va de 10 (15:15) a 24 (15:29).
function pathFor(kind, r) {
  const base = 19700 + Math.round(r() * 140) * 5;
  const R = kind === 'wide' ? 85 + Math.round(r() * 5) * 5 : 20 + Math.round(r() * 8) * 5;
  const lo = base, hi = base + R;
  const mid = (lo + hi) / 2;
  const osc = (from, to, n) => Array.from({ length: n }, (_, i) => [from + Math.round(((to - from) * (i + 1)) / (n + 1)), i % 2 ? lo + R * (0.15 + r() * 0.2) : hi - R * (0.15 + r() * 0.2)]);
  const pre = [[0, mid + (r() - 0.5) * 70], [5, mid + (r() - 0.5) * 50], [10, mid]];
  const range = osc(10, 25, 5 + Math.floor(r() * 3));
  const up = kind.startsWith('long') || (kind !== 'wide' && kind !== 'antes' && r() < 0.5);
  const dir = kind.startsWith('short') ? -1 : 1;
  const edge = dir > 0 ? hi : lo;
  const e = edge + dir * 0.5;
  let post = [];
  // Ritmo distinto en cada sesión: unas rompen y llegan al objetivo rápido, otras tardan más.
  const f = 0.8 + r() * 0.7;
  const T = (m) => Math.round(27 + (m - 27) * f);
  switch (kind) {
    case 'long-win': case 'short-win': {
      const tgt = e + dir * (95 + r() * 40);
      post = [[26, edge - dir * 4], [27, edge - dir * 2], [T(29), edge + dir * 12], [T(32), edge + dir * 30], [T(35), edge + dir * 22], [T(40), edge + dir * 55], [T(44), edge + dir * 48], [T(50), e + dir * 88], [T(56), tgt], [T(61), tgt - dir * 12], [T(67), tgt + dir * 6]];
      break;
    }
    case 'long-loss': case 'short-loss': {
      const peak = edge + dir * (12 + r() * 18);
      post = [[26, edge - dir * 3], [27, edge - dir * 2], [T(29), edge + dir * 9], [T(32), peak], [T(36), edge + dir * 2], [T(40), (lo + hi) / 2], [T(45), e - dir * 60], [T(50), e - dir * 92], [T(55), e - dir * 80], [T(61), e - dir * 120], [T(68), e - dir * 135]];
      break;
    }
    case 'wide': {
      // Velas grandes desde el principio y luego sin dirección.
      post = [[25, mid], [30, hi - 10], [36, lo + 15], [42, hi - 5], [48, lo + 20], [55, mid + 20], [64, mid - 10]];
      // Tres vaivenes amplios dentro de la ventana (velas grandes, pero no de lado a lado en un minuto).
      const swings = [[13, hi - 12 - r() * 8], [17, lo + 10 + r() * 8], [21, hi - 6 - r() * 6], [24, lo + 25 + r() * 20]];
      return { def: { kind: 'ancho', hi, lo, noise: 5, wick: 6, path: [...pre, ...swings, ...post] }, R };
    }
    case 'antes': {
      // Compresión de 15:15 a 15:24 y escapada antes de la apertura.
      const R2 = 20 + Math.round(r() * 3) * 5;
      const h2 = lo + R2;
      return {
        def: {
          kind: 'antes', hi: h2, lo, shapeTo: 19, noise: 2.5, wick: 3,
          path: [[0, lo + 15], [6, lo + 5], [10, lo + R2 / 2], [12, h2 - 4], [14, lo + 4], [16, h2 - 6], [18, lo + 6], [20, lo + R2 / 2], [22, h2 + 12], [25, h2 + 32], [28, h2 + 26], [33, h2 + 50], [38, h2 + 42], [45, h2 + 65], [52, h2 + 55], [64, h2 + 75]],
        },
        R: R2,
      };
    }
  }
  void up;
  return { def: { kind: 'base', hi, lo, noise: 2.5, wick: 3, path: [...pre, ...range, ...post] }, R };
}

function accept(kind, ex) {
  const { sim, candles } = ex;
  if (kind === 'wide') return !sim.valid && sim.reason === 'rango';
  if (kind === 'antes') {
    const i = candles.findIndex((k, j) => j > ex.shapeTo && k.c > ex.hi + 10);
    return i > 19 && i < 25 && candles[25].o > ex.hi + 15;
  }
  if (!sim.valid || sim.ambiguous != null || !sim.pos || !sim.exit) return false;
  const dir = kind.startsWith('long') ? 1 : -1;
  const win = kind.endsWith('win');
  return sim.pos.dir === dir && sim.pos.i >= 26 && sim.pos.i <= 31 && (sim.exit.pts > 0) === win && sim.exit.i < candles.length - 6;
}

/**
 * Crea `n` sesiones de cada tipo indicado. Devuelve [{ id, kind, ...textos }] y las deja registradas para renderFigure.
 */
export function generateSessions(plan, seed0 = 1000) {
  const out = [];
  let seed = seed0;
  for (const [kind, n] of Object.entries(plan)) {
    if (!KINDS.includes(kind)) throw new Error(`Tipo desconocido: ${kind}`);
    for (let k = 0; k < n; k++) {
      let ex, id;
      for (let tries = 0; tries < 400; tries++) {
        const r = rng(++seed);
        const { def } = pathFor(kind, r);
        id = `rs-${kind}-${k + 1}`;
        ex = registerExample(id, { ...def, seed });
        if (accept(kind, ex)) break;
        ex = null;
      }
      if (!ex) throw new Error(`No se pudo generar una sesión ${kind}`);
      out.push({ id, kind, ...describe(kind, ex) });
    }
  }
  return out;
}

// Textos de la sesión, a partir de los datos.
function describe(kind, ex) {
  const { sim, candles } = ex;
  const t = (i) => candles[i].t;
  if (kind === 'wide') {
    return {
      setup: `Rango de ${P(sim.lo)} a ${P(sim.hi)}: **${P(sim.size)} puntos**`,
      answer: 'No',
      why: `El rango mide ${P(sim.size)} puntos, más que el stop de 80: el stop quedaría dentro del propio rango.`,
      caps: [[6, 'Velas de 1 minuto del Nasdaq.'], [11, '**15:15.** Velas grandes desde el principio…'], [25, `**15:30.** Rango de **${P(sim.size)} puntos**. ¿Entras?`], [26, '**No.** El stop de 80 quedaría dentro del rango.'], [45, 'Arriba y abajo sin dirección. **Resultado: 0.** Y está bien.']],
      result: 'Sin operación',
    };
  }
  if (kind === 'antes') {
    const i = candles.findIndex((k, j) => j > ex.shapeTo && k.c > ex.hi + 10);
    const over = Math.round(candles[25].o - ex.hi);
    return {
      setup: `Compresión de ${P(ex.lo)} a ${P(ex.hi)} hasta las 15:24… y a las 15:30 ya está **${over} puntos arriba**`,
      answer: 'No',
      why: 'El precio se escapó antes de la apertura: no hay rango válido. Comprar ahí es perseguir el precio.',
      caps: [[6, 'Velas de 1 minuto del Nasdaq.'], [11, `**15:15.** Compresión de ${P(ex.hi - ex.lo)} puntos…`], [i + 1, `**${t(i)}.** …pero se escapa antes de la apertura.`], [26, `**15:30.** Ya está ${over} puntos arriba. **No se opera.**`], [40, 'Aunque siga subiendo: **no era tu operación.**']],
      result: 'Sin operación',
    };
  }
  const { pos, exit } = sim;
  const long = pos.dir > 0;
  const win = exit.pts > 0;
  const caps = [
    [6, 'Velas de 1 minuto del Nasdaq, desde las 15:05.'],
    [11, '**15:15.** Empieza la ventana.'],
    [25, `**15:30.** Rango de ${P(sim.lo)} a ${P(sim.hi)} (${P(sim.size)} pts). Válido.`],
    [26, `Buy stop ${P(sim.buy)} · sell stop ${P(sim.sell)}. **Stop y objetivo: 80.**`],
    [pos.i + 1, `**${t(pos.i)}.** Rompe ${long ? 'arriba: **compra**' : 'abajo: **venta**'} en ${P(pos.entry)}.`],
    [exit.i + 1, win ? `**${t(exit.i)}.** Objetivo: **+80 puntos.**` : `**${t(exit.i)}.** Stop: **−80 puntos.** Fin del día.`],
  ];
  if (!win && exit.i + 12 < candles.length) caps.push([exit.i + 10, 'No hay segunda entrada. **Una operación al día.**']);
  return {
    setup: `Rango de ${P(sim.lo)} a ${P(sim.hi)}: **${P(sim.size)} puntos**`,
    answer: 'Sí',
    why: `Rango válido: buy stop en ${P(sim.buy)} y sell stop en ${P(sim.sell)} en OCO, con stop y objetivo de 80. ${long ? 'Rompe arriba' : 'Rompe abajo'} a las ${t(pos.i)} y ${win ? `toca el objetivo a las ${t(exit.i)}: +80.` : `toca el stop a las ${t(exit.i)}: −80 y fin del día.`}`,
    caps,
    result: win ? '+80 puntos' : '−80 puntos',
    entryTime: t(pos.i), exitTime: t(exit.i), long, win, size: sim.size,
  };
}
