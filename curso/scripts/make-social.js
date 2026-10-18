/*
 * Contenido de lanzamiento para Instagram: 4 reels (1080×1920), 3 carruseles y 1 post (1080×1350).
 *   npm run social
 * Resultado: marketing/instagram/
 */
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { root, price, rich, fig, ctaInner, reelSteps, openStudio } from './social-kit.js';

const out = join(root, 'marketing', 'instagram');

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

// ----------------------------------------------------------------- render

mkdirSync(out, { recursive: true });
const studio = await openStudio();
for (const [name, list] of Object.entries(CAROUSELS)) {
  const dir = join(out, `carrusel-${name}`);
  rmSync(dir, { recursive: true, force: true });
  await studio.slides(list, dir);
  console.log(`carrusel-${name}: ${list.length} imágenes`);
}
for (const [name, inner] of Object.entries(POSTS)) {
  const dir = join(out, `.post-${name}`);
  const [f] = await studio.slides([inner], dir, { single: true });
  const { renameSync } = await import('node:fs');
  renameSync(f, join(out, `post-${name}.png`));
  rmSync(dir, { recursive: true, force: true });
  console.log(`post-${name}.png`);
}
for (const [name, r] of Object.entries(REELS)) {
  const secs = await studio.video(reelSteps(r), join(out, `${name}.mp4`));
  console.log(`${name}.mp4: ${secs} s`);
}
await studio.close();
