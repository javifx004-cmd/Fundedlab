/*
 * Publicaciones extra de tarde (20:30) para llegar a 45 publicaciones al mes junto al calendario de 91 días.
 *   npm run extra
 * Resultado: marketing/ig-extra/NNN_AAAA-MM-DD_tipo-nombre/ (imagen, imágenes o reel.mp4 + texto.txt) y EXTRA.md.
 *
 * Pensadas para ganar seguidores: reels «¿Operarías?» (comentarios), sesiones vela a vela (alcance), mitos y
 * publicaciones para guardar o comentar. Mes 1 reutiliza además el contenido de lanzamiento (marketing/instagram).
 */
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync, readFileSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { root, price, rich, ctaInner, reelSteps, openStudio } from './social-kit.js';
import { generateSessions } from './sessions-gen.js';

const out = join(root, 'marketing', 'ig-extra');
const launchDir = join(root, 'marketing', 'instagram');

const CTA = '\n\n👉 Curso completo en el link de la bio.\n📩 Dudas: grupolab@proton.me';
const FOLLOW = '\n\n🔔 Sígueme en @fundedlab_es: una sesión nueva cada día.';
const NOTE = '\n\nContenido formativo. No es asesoramiento financiero.';
const HASHTAGS = [
  '#trading #tradingdefuturos #futuros #nasdaq #NQ #daytrading #cuentasdefondeo #propfirm #traderespañol #fundedlab',
  '#trading #futures #nasdaq100 #MNQ #intradia #fondeo #gestiondelriesgo #aprendetrading #tradingespaña #fundedlab',
  '#daytrading #tradingdefuturos #nasdaq #cuentadefondeo #propfirmtrader #disciplina #tradingtips #traders #fundedlab #fundedlab_es',
];

// ----------------------------------------------------------------- plantillas

const quote = (kicker, text, sub = '', tone = '') => `<div class="center"><div class="kick">${rich(kicker)}</div><div class="h l" style="${tone === 'brand' ? 'color:var(--brand)' : ''}">${rich(text)}</div>${sub ? `<p class="p">${rich(sub)}</p>` : ''}</div>`;
const myth = (m, r) => `<div class="center"><div class="kick">Mito o realidad</div><div class="h m" style="text-decoration:line-through;opacity:.6">❌ ${rich(m)}</div><div class="h m" style="color:var(--brand)">✅ ${rich(r)}</div></div>`;
const poll = (q, opts) => `<div class="center"><div class="kick">Comenta 👇</div><div class="h l">${rich(q)}</div><div class="list">${opts.map((o, i) => `<div class="li"><span class="n">${'ABCD'[i]}</span><span>${rich(o)}</span></div>`).join('')}</div></div>`;

// ----------------------------------------------------------------- reels con sesiones nuevas

const S = generateSessions({ 'long-win': 4, 'short-win': 2, 'long-loss': 2, 'short-loss': 4, wide: 4, antes: 4 }, 9000);
const pick = (kind) => { const i = S.findIndex((s) => s.kind === kind); if (i < 0) throw new Error(`faltan sesiones ${kind}`); return S.splice(i, 1)[0]; };

const QUIZ_HOOKS = [['¿Operarías este día?', 'Decide antes de las 15:30'], ['¿Entras o no entras?', 'Comenta antes del final'], ['Test de 15 segundos', '¿Hay operación hoy?'], ['El 90 % falla este test', '¿Tú qué harías?']];
let qh = 0;
function quizReel(s) {
  const hook = QUIZ_HOOKS[qh++ % QUIZ_HOOKS.length];
  return {
    type: 'reel', name: 'reel-test',
    steps: reelSteps({ hook, example: s.id, from: 6, caps: s.caps, reveal: 26, end: 'Saber cuándo no operar también se aprende' }),
    caption: `${hook[0]} 🤔 Comenta SÍ o NO antes de ver el final 👇\n\n${s.setup.replace(/\*\*/g, '')}.\n\nRespuesta: ${s.answer}. ${s.why}\n\nEtiqueta a alguien que habría entrado 😅${FOLLOW}${CTA}\n\nPrecios ilustrativos.${NOTE}`,
  };
}
const WIN = [['Así se ve una ruptura limpia', 'de principio a fin'], ['15:30 en Nueva York', 'y una sola orden'], ['80 puntos', 'sin tocar nada']];
const LOSS = [['Así se pierde bien', 'y se protege la cuenta'], ['Stop y a casa', 'mañana hay otra sesión'], ['La ruptura falsa', 'que todos sufrimos']];
let wi = 0, li = 0;
function replayReel(s) {
  const hook = s.win ? WIN[wi++ % WIN.length] : LOSS[li++ % LOSS.length];
  const body = s.win
    ? `📍 ${s.setup.replace(/\*\*/g, '')}\n📍 ${s.long ? 'Rompe arriba' : 'Rompe abajo'} a las ${s.entryTime}\n📍 Objetivo a las ${s.exitTime}: +80 puntos`
    : `📍 ${s.setup.replace(/\*\*/g, '')}\n📍 Entrada a las ${s.entryTime}… stop a las ${s.exitTime}: −80 puntos\n📍 Y no vuelvo a entrar`;
  return {
    type: 'reel', name: s.win ? 'reel-sesion-ganadora' : 'reel-sesion-perdedora',
    steps: reelSteps({ hook, example: s.id, from: 6, caps: s.caps, end: s.win ? 'Aprende el método completo' : 'Disciplina antes que estrategia' }),
    caption: `${hook[0]}, ${hook[1]} ⏱️\n\n${body}\n\nGuárdalo para verlo antes de tu próxima sesión 📌${FOLLOW}${CTA}\n\nPrecios ilustrativos.${NOTE}`,
  };
}

// ----------------------------------------------------------------- publicaciones de una imagen

const MYTHS = [
  ['Más operaciones = más dinero', 'Una buena operación al día vale más que diez impulsivas.'],
  ['Con un 50 % de acierto no se gana', 'Con riesgo/beneficio 1:1 y 55 % de acierto, el sistema ya es positivo.'],
  ['Mover el stop te salva la operación', 'Mover el stop en contra es la forma más rápida de quemar una cuenta.'],
  ['Las cuentas de fondeo son una estafa', 'Las reglas son duras, pero claras. Se pierden por romperlas, no por la firma.'],
  ['Necesitas 8 horas delante de la pantalla', 'Esta estrategia se opera en menos de una hora al día.'],
  ['Más indicadores = mejores entradas', 'Máximo y mínimo de 15 minutos. Nada más.'],
];
const POLLS = [
  ['¿Qué contrato operas?', ['NQ', 'MNQ', 'ES / MES', 'Todavía ninguno']],
  ['¿Cuántas cuentas de fondeo has quemado?', ['Ninguna', '1 – 2', '3 – 5', 'Prefiero no decirlo 😅']],
  ['¿Qué te cuesta más?', ['No mover el stop', 'No volver a entrar', 'No operar de más', 'Esperar a las 15:30']],
  ['¿A qué hora operas?', ['Apertura de Nueva York', 'Sesión europea', 'Por la tarde', 'Cuando puedo']],
  ['Tras un stop, ¿qué haces?', ['Cierro la plataforma', 'Busco otra entrada', 'Subo el tamaño', 'Reviso el diario']],
  ['¿Cuánto arriesgas por operación?', ['Menos del 0,5 %', '0,5 – 1 %', '1 – 2 %', 'No lo calculo']],
];
const SAVE = [
  ['El mercado no te debe nada.', 'Tu trabajo es seguir tu plan, no tener razón.'],
  ['Un stop no es un fracaso.', 'Es el precio de saber si tenías razón.'],
  ['La paciencia también es una posición.', 'Esperar a las 15:30 es parte de la operación.'],
  ['No operes para recuperar.', 'Opera para ejecutar tu plan.'],
  ['Si no está en tu plan, no existe.', 'Las decisiones se toman antes de entrar.'],
  ['Menos pantalla, más proceso.', '15 minutos de rango, una orden y a vivir.'],
];

const mythPost = ([m, r]) => ({ type: 'post', name: 'mito', slides: [myth(m, r)], caption: `MITO: «${m}» ❌\n\nREALIDAD: ${r} ✅\n\n¿Lo creías? Dímelo en comentarios 👇${FOLLOW}${CTA}${NOTE}` });
const pollPost = ([q, o]) => ({ type: 'post', name: 'comenta', slides: [poll(q, o)], caption: `${q} 👇\n\n${o.map((x, i) => `${'ABCD'[i]}) ${x}`).join('\n')}\n\nResponde con la letra en comentarios. Leo todas 💬${FOLLOW}${CTA}` });
const savePost = ([t, s]) => ({ type: 'post', name: 'frase', slides: [quote('Guárdalo 📌', t, s, 'brand')], caption: `${t}\n\n${s}\n\nGuárdalo y compártelo con tu amigo trader 📌${FOLLOW}${CTA}` });

// ----------------------------------------------------------------- contenido de lanzamiento (solo mes 1)

function launchItems() {
  const md = readFileSync(join(launchDir, 'TEXTOS.md'), 'utf8');
  const items = [];
  for (const block of md.split('\n---\n')) {
    const m = block.match(/^## .+?\(`([^`]+)`/m);
    if (!m || m[1].startsWith('reel-1')) continue; // el reel 1 ya se publicó
    const file = m[1].replace(/\/$/, '');
    const text = block.slice(block.indexOf('\n', block.indexOf('## ')) + 1).trim().replace(/\*\*?([^*]+)\*\*?/g, '$1');
    items.push({ type: file.endsWith('.mp4') ? 'reel' : file.endsWith('.png') ? 'post' : 'carrusel', name: file.replace(/\.(mp4|png)$/, ''), copyFrom: join(launchDir, file), caption: text + FOLLOW });
  }
  return items;
}

// ----------------------------------------------------------------- reparto

const Q = ['wide', 'antes', 'long-win', 'wide', 'short-loss', 'antes', 'wide', 'antes', 'long-win', 'short-loss', 'wide', 'antes'].map((k) => quizReel(pick(k)));
const R = ['long-win', 'short-loss', 'short-win', 'long-loss', 'long-win', 'short-loss', 'short-win', 'long-loss'].map((k) => replayReel(pick(k)));
const MY = MYTHS.map(mythPost), PO = POLLS.map(pollPost), SA = SAVE.map(savePost);
const next = (a) => a.shift();
// Patrón que se repite: test, comenta, sesión, mito, test, frase
const rotation = [Q, PO, R, MY, Q, SA];
const fresh = (n) => { const r = []; let k = 0; while (r.length < n) { const src = rotation[k++ % rotation.length]; if (src.length) r.push(next(src)); else if (rotation.every((x) => !x.length)) throw new Error('sin contenido'); } return r; };

const L = launchItems();
const m1 = fresh(9);
const mes1 = []; while (L.length || m1.length) { if (m1.length) mes1.push(m1.shift()); if (L.length) mes1.push(L.shift()); }
const MONTHS = [
  { from: '2026-10-22', to: '2026-11-17', items: mes1 },
  { from: '2026-11-18', to: '2026-12-17', items: fresh(15) },
  { from: '2026-12-18', to: '2027-01-17', items: fresh(14) },
];

const day = (s) => new Date(`${s}T12:00:00Z`);
const plan = [];
for (const [mi, M] of MONTHS.entries()) {
  const days = Math.round((day(M.to) - day(M.from)) / 864e5) + 1;
  M.items.forEach((it, i) => {
    const d = new Date(day(M.from).getTime() + Math.floor(((i + 0.5) * days) / M.items.length) * 864e5);
    plan.push({ ...it, month: mi + 1, date: d.toISOString().slice(0, 10) });
  });
}

// ----------------------------------------------------------------- render

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const studio = await openStudio();
const rows = [];
for (const [i, it] of plan.entries()) {
  const dir = join(out, `${String(i + 1).padStart(3, '0')}_${it.date}_${it.type}-${it.name}`);
  mkdirSync(dir, { recursive: true });
  if (it.copyFrom) {
    if (statSync(it.copyFrom).isDirectory()) for (const f of readdirSync(it.copyFrom).sort()) copyFileSync(join(it.copyFrom, f), join(dir, f));
    else copyFileSync(it.copyFrom, join(dir, it.type === 'reel' ? 'reel.mp4' : 'imagen.png'));
  } else if (it.type === 'reel') await studio.video(it.steps, join(dir, 'reel.mp4'));
  else await studio.slides(it.slides, dir, { single: true });
  const caption = `${it.caption}\n\n${HASHTAGS[i % HASHTAGS.length]}`;
  writeFileSync(join(dir, 'texto.txt'), caption + '\n');
  rows.push(`| ${i + 1} | Mes ${it.month} | ${it.date} 20:30 | ${it.type} | ${it.name.replace(/-/g, ' ')} | ${caption.split('\n')[0].replace(/\|/g, '/')} |`);
  console.log(`${i + 1}/${plan.length} ${it.date} ${it.type} ${it.name}`);
}
await studio.close();
writeFileSync(join(out, 'EXTRA.md'), `# Publicaciones extra · 20:30 · @fundedlab_es

Se suman al calendario de 91 días (13:30) para llegar a **45 publicaciones al mes**. Precio: ${price}.

| Nº | Mes | Fecha | Tipo | Tema | Primera línea |
|---|---|---|---|---|---|
${rows.join('\n')}
`);
console.log(`Listo: ${out} (${plan.length} publicaciones)`);
