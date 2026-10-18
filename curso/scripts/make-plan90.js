/*
 * Calendario de contenido para Instagram: 91 días (13 semanas), una publicación al día.
 *   npm run plan90                      → desde el lunes 19/10/2026
 *   npm run plan90 -- 2026-11-02        → desde otra fecha (debe ser lunes)
 * Resultado: marketing/instagram-90/ (una carpeta por día con las imágenes o el vídeo y su texto) y CALENDARIO.md.
 *
 * Semana tipo: lunes carrusel de formación · martes reel de una sesión · miércoles regla · jueves reel «¿operarías?» ·
 * viernes carrusel de casos y gestión · sábado glosario · domingo presentación del curso.
 * Algunas fechas cambian el plan (cambios de hora, Fed, festivos de EE. UU., vencimiento de diciembre, Navidad).
 */
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { root, price, rich, fig, ctaInner, reelSteps, openStudio } from './social-kit.js';
import { generateSessions } from './sessions-gen.js';

const out = join(root, 'marketing', 'instagram-90');
const start = new Date(`${process.argv[2] || '2026-10-19'}T12:00:00Z`);
if (start.getUTCDay() !== 1) throw new Error('La fecha de inicio debe ser un lunes');
const only = process.argv[3]; // depuración: generar solo el día N

// ----------------------------------------------------------------- plantillas de diapositivas

const cover = (kicker, title, sub = '') => `<div class="center"><div class="kick">${rich(kicker)}</div><div class="h xl">${rich(title)}</div>${sub ? `<p class="p">${rich(sub)}</p>` : ''}<div class="swipe">Desliza →</div></div>`;
const list = (kicker, title, items, { bad = false, nums = true } = {}) => `<div class="kick">${rich(kicker)}</div><div class="h m">${rich(title)}</div><div class="list">${items.map((t, i) => `<div class="li ${bad ? 'x' : ''}"><span class="n">${bad ? '✕' : nums ? i + 1 : '✓'}</span><span>${rich(t)}</span></div>`).join('')}</div>`;
const chart = (kicker, title, svg, cap, tone = '') => `<div class="kick">${rich(kicker)}</div><div class="h m">${rich(title)}</div><div class="chartbox">${svg}</div>${cap ? `<div class="cap ${tone}">${rich(cap)}</div>` : ''}`;
const table = (kicker, title, head, rows, cap = '') => `<div class="kick">${rich(kicker)}</div><div class="h m">${rich(title)}</div><div class="table-wrap"><table style="font-size:30px"><thead><tr>${head.map((h) => `<th>${rich(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${rich(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${cap ? `<div class="cap">${rich(cap)}</div>` : ''}`;
const card = (kicker, title, text, tone = '') => `<div class="kick">${rich(kicker)}</div><div class="h m">${rich(title)}</div><div class="cap ${tone}" style="font-size:40px">${rich(text)}</div>`;
const formula = (kicker, title, f, note = '') => `<div class="kick">${rich(kicker)}</div><div class="h m">${rich(title)}</div><div class="formula">${rich(f)}</div>${note ? `<p class="p" style="margin-top:30px">${rich(note)}</p>` : ''}`;
// Publicación de una imagen: frase grande
const quote = (kicker, text, sub = '', tone = '') => `<div class="center"><div class="kick">${rich(kicker)}</div><div class="h l" style="${tone === 'brand' ? 'color:var(--brand)' : ''}">${rich(text)}</div>${sub ? `<p class="p">${rich(sub)}</p>` : ''}</div>`;
const legal = '<div class="legal">Precios ilustrativos · contenido formativo, no es asesoramiento financiero</div>';
const phone = `data:image/png;base64,${readFileSync(join(root, 'marketing', 'img', 'm-quiz.png')).toString('base64')}`;
const calcImg = `data:image/png;base64,${readFileSync(join(root, 'marketing', 'img', 'm-calc.png')).toString('base64')}`;

// ----------------------------------------------------------------- sesiones nuevas (reels)

const S = generateSessions({ 'long-win': 6, 'short-win': 4, 'long-loss': 3, 'short-loss': 3, wide: 4, antes: 3 }, 5000);
const pick = (kind) => { const i = S.findIndex((s) => s.kind === kind); if (i < 0) throw new Error(`faltan sesiones ${kind}`); return S.splice(i, 1)[0]; };
// Martes (13 repeticiones): 9 ganadoras y 4 perdedoras, intercaladas.
const REPLAYS = ['long-win', 'short-win', 'long-loss', 'long-win', 'short-win', 'short-loss', 'long-win', 'long-win', 'long-loss', 'short-win', 'long-win', 'short-loss', 'short-win'].map(pick);
// Jueves (10 tests): días que no se operan y días que sí.
const QUIZZES = ['wide', 'antes', 'long-loss', 'wide', 'antes', 'short-loss', 'wide', 'long-win', 'antes', 'wide'].map(pick);

const WIN_HOOKS = [['Así opero la apertura de Nueva York', 'en 30 segundos'], ['Ruptura de las 15:15', 'paso a paso'], ['Un día con el método', 'sin tocar nada'], ['15 minutos de rango', 'y una sola operación'], ['La apertura de Nueva York', 'vela a vela'], ['Stop y objetivo desde el primer segundo', 'y a esperar'], ['El método en una sesión', 'de principio a fin'], ['Así se ve una ruptura limpia', 'en el Nasdaq'], ['Rompe, entras', 'y dejas trabajar el plan']];
const LOSS_HOOKS = [['El día que pierdes', 'también tiene reglas'], ['Un día perdedor', 'bien gestionado'], ['Ruptura falsa', 'y qué hacer después'], ['−80 y a casa', 'así se protege una cuenta']];
let wi = 0, li = 0;

function replayReel(s) {
  const hook = s.win ? WIN_HOOKS[wi++ % WIN_HOOKS.length] : LOSS_HOOKS[li++ % LOSS_HOOKS.length];
  const steps = reelSteps({ hook, example: s.id, from: 6, caps: s.caps, end: s.win ? 'Aprende el método completo' : 'Disciplina antes que estrategia' });
  const caption = s.win
    ? `${hook[0]} ${hook[1]} ⏱️\n\n📍 ${s.setup.replace(/\*\*/g, '')}\n📍 Buy stop arriba y sell stop abajo, con stop y objetivo de 80 puntos\n📍 ${s.long ? 'Rompe arriba' : 'Rompe abajo'} a las ${s.entryTime}\n📍 Objetivo a las ${s.exitTime}: +80 puntos\n\nUna operación al día. Las mismas reglas siempre.`
    : `${hook[0]}: ${hook[1]} ❌\n\n📍 ${s.setup.replace(/\*\*/g, '')}\n📍 Entrada a las ${s.entryTime}… y a las ${s.exitTime} salta el stop: −80 puntos\n📍 Y no vuelvo a entrar\n\nLas cuentas no se queman por un stop. Se queman por lo que haces DESPUÉS del stop.`;
  return { type: 'reel', name: s.win ? 'reel-sesion-ganadora' : 'reel-sesion-perdedora', steps, caption };
}

function quizReel(s) {
  const steps = reelSteps({ hook: ['¿Operarías este día?', 'Decide antes de las 15:30'], example: s.id, from: 6, caps: s.caps, reveal: 26, end: 'Saber cuándo no operar también se aprende' });
  const caption = `¿Operarías este día? 🤔 Comenta SÍ o NO antes de ver el final 👇\n\n${s.setup.replace(/\*\*/g, '')}.\n\nRespuesta: ${s.answer}. ${s.why}`;
  return { type: 'reel', name: 'reel-operarias-este-dia', steps, caption };
}

// ----------------------------------------------------------------- carruseles de formación (lunes)

const EDU = [
  { name: 'la-ventana-1515', caption: 'La ventana de 15:15 a 15:30: por qué esos 15 minutos y no otros 🕒\n\nY ojo: esta semana Europa cambia la hora y EE. UU. no. Desliza 👉', slides: [
    cover('El sistema', 'Los 15 minutos que lo deciden todo', 'Por qué el rango de 15:15 a 15:30 y no otro.'),
    list('La ventana', 'Qué pasa de 15:15 a 15:30', ['Los datos macro de las 14:30 **ya se han digerido**', 'Los grandes operadores **esperan a la apertura**', 'El precio **se comprime**: es la acumulación', 'A las 15:30 abre Nueva York y **entra el volumen**']),
    chart('El rango', 'Máximo y mínimo de esos 15 minutos', fig('ej-largo', { question: true }), 'A las 15:30 marcas **las dos líneas** y colocas tus órdenes.'),
    card('Ojo · cambio de hora', 'La referencia es Nueva York, no Madrid', 'Europa retrasa el reloj el **25 de octubre** y EE. UU. el **1 de noviembre**. Esa semana Nueva York abre a las **14:30** en España: tu ventana es de **14:15 a 14:30**.', 'ko'),
    ctaInner('El sistema completo, paso a paso')] },
  { name: 'anatomia-de-una-vela', caption: 'Si no sabes leer una vela, no sabes leer el mercado 🕯️\n\nApertura, cierre, máximo y mínimo: todo lo que hizo el precio en una sola figura. Desliza 👉', slides: [
    cover('Fundamentos', 'Cómo se lee una vela japonesa', 'Lo primero que tienes que dominar.'),
    chart('Anatomía', 'Cuatro precios en una figura', fig('anatomy'), '**Cuerpo:** apertura y cierre. **Mechas:** máximo y mínimo.'),
    list('Qué te dice', 'Cuerpo y mechas', ['**Cuerpo grande:** un bando dominó', '**Cuerpo pequeño:** equilibrio', '**Mecha larga:** rechazo del precio', '**Sin mechas:** una sola dirección'], { nums: false }),
    ctaInner('Del primer gráfico de velas al fondeo')] },
  { name: 'tu-rango-es-una-vela', caption: 'Truco: tu rango de 15:15 a 15:30 es UNA sola vela 🤯\n\nCambia el gráfico a 15 minutos y lo verás. Desliza 👉', slides: [
    cover('Fundamentos', 'Tu rango es una sola vela', 'La misma acción del precio, con distinto zoom.'),
    chart('Temporalidades', '3 velas de 5 min = 1 vela de 15', fig('timeframes'), 'El máximo de la grande es el máximo de todas; el mínimo, el mínimo de todas.'),
    card('La clave', 'Pon el gráfico en 15 minutos', 'La vela que empieza a las **15:15** es exactamente tu rango: su máximo y su mínimo son **las dos líneas** que marcas cada día.', 'ok'),
    ctaInner('Aprende a leer el gráfico como un profesional')] },
  { name: 'seis-patrones-de-velas', caption: '6 patrones de velas que tienes que reconocer 👀\n\nY cuál es la vela de ruptura ideal. Desliza 👉', slides: [
    cover('Fundamentos', '6 patrones de velas que debes conocer'),
    chart('Patrones', 'Los más útiles para esta estrategia', fig('patterns'), ''),
    list('En la estrategia', 'Para qué sirve cada uno', ['**Marubozu:** la vela de ruptura ideal', '**Doji y vela interior:** típicos de la acumulación', '**Martillo y estrella fugaz:** rechazos, cuidado', '**Envolvente:** tras una ruptura falsa, confirma el giro'], { nums: false }),
    card('Atención', 'Un patrón aislado no es una señal', 'Un martillo en mitad de la nada no significa nada. Un marubozu saliendo de la acumulación a las 15:30, sí.', 'ko'),
    ctaInner('Del primer gráfico de velas al fondeo')] },
  { name: 'nq-o-mnq', caption: 'NQ o MNQ: cuánto vale cada punto y por qué importa más que la garantía 💵\n\nDesliza 👉', slides: [
    cover('Futuros', '¿NQ o MNQ?', 'Antes de operar, saber cuánto vale un punto.'),
    table('Los contratos', 'Valor de cada punto', ['Contrato', 'Punto', '80 puntos'], [['NQ', '20 $', '1.600 $'], ['MNQ', '2 $', '160 $'], ['ES', '50 $', '4.000 $'], ['MES', '5 $', '400 $']]),
    card('Apalancamiento', '1 NQ = 400.000 $ de exposición', 'Con el Nasdaq en 20.000, aunque el broker solo te pida una garantía de unos miles. Por eso el tamaño se decide por **cuánto pierdes si salta el stop**.', 'ko'),
    ctaInner('Futuros explicados desde cero')] },
  { name: 'tipos-de-ordenes', caption: 'Stop, límite, OCO, bracket… ¿cuál usar en cada momento? 🎯\n\nDesliza 👉', slides: [
    cover('Fundamentos', 'Las órdenes que usarás cada día'),
    chart('Dónde va cada orden', 'Respecto al precio actual', fig('orders'), '**Stop:** a favor del movimiento (ruptura). **Límite:** en contra (rebote).'),
    list('Resumen', 'Qué hace cada una', ['**Mercado:** entra ya, al precio que haya', '**Stop:** se activa al tocar un nivel', '**OCO:** si se ejecuta una, se cancela la otra', '**Bracket:** entrada con stop y objetivo adjuntos']),
    ctaInner('Aprende a ejecutar sin errores')] },
  { name: 'oco-y-bracket', caption: 'La combinación de órdenes que uso cada día a las 15:30 ⚙️\n\nOCO + bracket: nunca estás sin stop. Desliza 👉', slides: [
    cover('Ejecución', 'OCO + bracket', 'Tu operación preparada antes de que empiece.'),
    list('A las 15:30', 'Así se colocan', ['**Buy stop** 1–2 ticks sobre el máximo del rango', '**Sell stop** 1–2 ticks bajo el mínimo', 'Las dos vinculadas como **OCO**', 'Cada una con **bracket**: stop y objetivo de 80']),
    chart('El resultado', 'Si rompe arriba, el sell stop se cancela solo', fig('ej-corto'), 'Aquí rompió abajo: **venta**, y la compra se canceló sola. +80 puntos.', 'ok'),
    ctaInner('El sistema completo, paso a paso')] },
  { name: 'rango-y-ruptura', caption: 'El mercado alterna entre rangos y tendencias. Esta estrategia vive en el paso de uno a otro 📈\n\nDesliza 👉', slides: [
    cover('Estructura del precio', 'Rangos y rupturas'),
    chart('Conceptos', 'Soporte, resistencia, rango y ruptura', fig('range'), ''),
    list('Por qué funciona', 'La compresión acumula energía', ['Cuanto **más estrecho y más tiempo**, más energía', 'Un rango ordenado antes de la apertura suele dar una **ruptura limpia**', 'Una ruptura **con volumen** es más fiable'], { nums: false }),
    card('El enemigo', 'La ruptura falsa', 'El precio sale del rango, no encuentra continuidad y vuelve dentro. Por eso **el stop va puesto siempre** desde el primer segundo.', 'ko'),
    ctaInner('Aprende a operar las rupturas')] },
  { name: 'rango-valido-o-no', caption: '¿Cuándo un rango es válido y cuándo ese día NO se opera? ✅❌\n\nDesliza 👉', slides: [
    cover('El sistema', '¿Rango válido o no?', 'Si no cumple, ese día no se opera.'),
    chart('Válido frente a no válido', 'Compárelos', fig('valid'), ''),
    table('Reglas', 'Puntos de partida', ['Válido', 'No válido'], [['Velas pequeñas y solapadas', 'Una vela grande ya ha roto'], ['20 – 60 puntos en NQ', 'Más de 80 puntos'], ['Volumen bajo', 'Menos de 10 puntos sin noticias']], 'Defínelas con **tu backtest** y no las cambies sobre la marcha.'),
    ctaInner('Saber cuándo no operar también se aprende')] },
  { name: 'stop-o-cierre-de-vela', caption: 'Mismo día, dos métodos de entrada, dos resultados distintos 🤯\n\n¿Orden stop o cierre de vela? Desliza 👉', slides: [
    cover('Entrada', '¿Orden stop o cierre de vela?'),
    table('Dos métodos', 'Ventajas e inconvenientes', ['Método', 'A favor', 'En contra'], [['Orden stop', 'No te pierdes rupturas rápidas', 'Entras en las falsas'], ['Cierre de vela', 'Filtra parte de las falsas', 'Peor precio']]),
    chart('Ejemplo', 'Una mecha salta el buy stop', fig('ej-cierre'), 'Con **stop**: −80. Con **cierre de vela**: venta y +80. Otro día será al revés.'),
    card('La regla', 'Elige uno y no lo cambies', 'Ninguno es mejor siempre. Elígelo con **tu backtest** y no lo cambies según el día.', 'ok'),
    ctaInner('7 ejemplos resueltos vela a vela')] },
  { name: 'rr-1-1-y-acierto', caption: 'Con un riesgo/beneficio 1:1, ¿qué porcentaje de acierto necesitas? 🧮\n\nDesliza 👉', slides: [
    cover('Riesgo', 'Stop 80 / objetivo 80', '¿Qué acierto necesitas para ganar?'),
    table('100 operaciones 1:1', 'El acierto lo es todo', ['Acierto', 'Ganadas', 'Perdidas', 'Neto'], [['45 %', '45', '55', '−10'], ['50 %', '50', '50', '0'], ['55 %', '55', '45', '+10'], ['60 %', '60', '40', '+20']], 'Y súmale **comisiones y deslizamiento**.'),
    list('Reglas de riesgo', 'Las mías', ['**0,5 – 1 %** de la cuenta por operación', '**Un stop al día** y fin', '**Tres stops a la semana:** paro y reviso', 'El stop **solo se mueve a favor**']),
    ctaInner('La gestión del riesgo, explicada')] },
  { name: 'promediar-a-favor', caption: 'Promediar a favor sin arriesgar el día: el peor caso siempre positivo 🧠\n\nDesliza 👉', slides: [
    cover('Gestión', 'Promediar a favor', 'Solo tras +80. Y cubierto por el beneficio.'),
    chart('En tres pasos', 'Largo con 2 MNQ', fig('pyramid'), ''),
    list('Los pasos', 'Así se hace', ['Compra **2 MNQ**, stop y objetivo a 80', 'En **+80** cierras 1 y subes el stop del otro a +40', 'Añades 1 en un retroceso con stop en +40', '**Peor caso: +160 $**. El día ya no puede perder']),
    ctaInner('Sesiones completas resueltas en el curso')] },
  { name: 'como-hacer-un-backtest', caption: 'Ninguna regla está demostrada hasta que la pruebas con 100 sesiones 📊\n\nAsí se hace un backtest. Desliza 👉', slides: [
    cover('Validación', 'Cómo hacer un backtest', 'Antes de arriesgar un euro.'),
    list('Paso a paso', '5 pasos', ['Mínimo **100 sesiones** (mejor 6–12 meses)', 'Modo **replay**: sin mirar lo que viene', 'Las **reglas exactas**, todos los días igual', 'Suma **1–2 ticks** de deslizamiento', 'Calcula acierto, **peor racha** y drawdown']),
    card('La verdad', 'La peor racha del backtest es la que vas a vivir', 'Si no la aguantarías con dinero real, **reduce el tamaño** antes de empezar.', 'ok'),
    ctaInner('Diario y métricas incluidos en el curso')] },
];

// ----------------------------------------------------------------- carruseles de gestión y casos (viernes)

const PRO = [
  { name: 'tu-rutina-diaria', caption: 'Mi rutina de cada día, de 14:45 a la hora límite ⏰\n\nUna rutina fija elimina decisiones improvisadas. Desliza 👉', slides: [
    cover('Rutina', 'Un día con el método', 'Menos de una hora. Siempre igual.'),
    table('Hora de España', 'Paso a paso', ['Hora', 'Qué haces'], [['14:45', 'Calendario macro y horario de NY'], ['15:00', 'Plataforma, contrato y tamaño'], ['15:15', 'Observas la acumulación'], ['15:30', 'Rango y órdenes OCO'], ['Después', 'Gestionas según el plan'], ['Al cerrar', 'Diario con captura']]),
    ctaInner('Checklist diaria incluida en la app')] },
  { name: 'errores-1-a-5', caption: '5 errores que queman cuentas de fondeo (y la regla que evita cada uno) 🔥\n\nDesliza 👉', slides: [
    cover('Errores', '5 errores que queman cuentas'),
    list('Errores 1 – 5', 'Y su solución', ['**Sin stop** → bracket obligatorio', '**Mover el stop en contra** → solo a favor', '**Demasiado grande** → fórmula de tamaño', '**Volver a entrar tras un stop** → una al día', '**Perseguir la ruptura** → si no entraste en tu nivel, no']),
    chart('Error 5', 'Perseguir el precio', fig('ej-antes'), 'Se escapa antes de las 15:30. **Entrar ahí es perseguir.** No es tu operación.', 'ko'),
    ctaInner('Los 10 errores, explicados en el curso')] },
  { name: 'errores-6-a-10', caption: 'Otros 5 errores que cuestan dinero (el 7 es MUY típico estas semanas) 👇\n\nDesliza 👉', slides: [
    cover('Errores', '5 errores más que cuestan dinero'),
    list('Errores 6 – 10', 'Y su solución', ['**Ignorar el calendario macro** → revisión a las 14:45', '**Olvidar el cambio de hora** → manda Nueva York', '**Añadir sin proteger** → peor caso positivo', '**Cambiar reglas tras cada pérdida** → solo tras backtest', '**No llevar diario** → captura de cada sesión']),
    ctaInner('Aprende de los errores de otros, no de los tuyos')] },
  { name: 'fondeo-que-vigilar', caption: 'Cuentas de fondeo: lo que tienes que vigilar con esta estrategia 🏦\n\nDesliza 👉', slides: [
    cover('Fondeo', 'Lo que tu firma no te explica'),
    table('Reglas de la firma', 'Qué vigilar', ['Regla', 'Con esta estrategia'], [['Drawdown trailing', 'Piramidar puede subir tu límite'], ['Pérdida diaria', 'El stop de 80 debe caber con margen'], ['Consistencia', 'Un día enorme puede superar el %'], ['Contratos', 'Los añadidos suman']]),
    card('La clave', 'El riesgo se mide contra el drawdown', 'No contra el saldo. Con varias cuentas, **manda la de menos margen**.', 'ok'),
    ctaInner('Un módulo entero dedicado al fondeo')] },
  { name: 'tamano-segun-la-cuenta', caption: 'Cuántos contratos operar según el tamaño de tu cuenta de fondeo 📐\n\nGuárdalo 📌 Desliza 👉', slides: [
    cover('Fondeo', '¿Cuántos MNQ según tu cuenta?'),
    formula('La fórmula', 'Riesgo = 20 % del drawdown', 'contratos = riesgo ÷ (80 × 2 $)', 'Siempre **hacia abajo**.'),
    table('Ejemplos', 'Drawdowns orientativos', ['Cuenta', 'Drawdown', 'MNQ', 'Riesgo'], [['25.000 $', '1.500 $', '1', '160 $'], ['50.000 $', '2.000 $', '2', '320 $'], ['100.000 $', '3.000 $', '3', '480 $'], ['150.000 $', '4.500 $', '5', '800 $']], 'Cada firma usa sus drawdowns: **compruébalo en la tuya**.'),
    ctaInner('Calculadora de tamaño dentro de la app')] },
  { name: 'caso-drawdown-trailing', caption: 'Ganas la operación… y pierdes margen en la cuenta de fondeo. ¿Cómo? 🤔\n\nEl drawdown trailing, explicado. Desliza 👉', slides: [
    cover('Caso práctico', 'Ganas y pierdes margen', 'El drawdown trailing en una cuenta de fondeo.'),
    list('La situación', 'Cuenta de 50.000 $', ['Trailing de **2.000 $** sobre beneficio no realizado', 'Límite inicial en **48.000 $**', 'La operación llega a **+600 $**… y retrocede', 'La cierras en **+160 $**']),
    card('Qué ha pasado', 'Tu límite subió a 48.600 $', 'Con 50.160 $ de saldo te quedan **1.560 $** de margen, no 2.160 $. Piramidar puede comerte margen **aunque ganes**.', 'ko'),
    ctaInner('8 casos prácticos resueltos en el curso')] },
  { name: 'trampas-mentales', caption: 'La mayoría de cuentas no se pierden por la estrategia, sino por romperla 🧠\n\n6 trampas mentales y su antídoto. Desliza 👉', slides: [
    cover('Psicología', '6 trampas mentales del trader'),
    table('Trampa → antídoto', 'Reconócelas', ['Trampa', 'Antídoto'], [['Venganza', 'Una operación al día'], ['FOMO', 'Si no entraste en tu nivel, no es tuya'], ['Mover el stop', 'Solo a favor'], ['Cerrar en +40', 'El objetivo es 80'], ['Subir tamaño', 'Solo con reglas escritas'], ['Parálisis', 'Confía en el backtest']]),
    ctaInner('Psicología y disciplina, con reglas')] },
  { name: 'cambio-de-contrato-diciembre', caption: 'Cambio de contrato: el NQ de diciembre (NQZ6) vence el viernes 18. ¿Ya operas el de marzo? 📆\n\nDesliza 👉', slides: [
    cover('Futuros', 'Cambio de contrato: NQZ6 → NQH7', 'El de diciembre vence el 18 de diciembre.'),
    list('Vencimientos', 'Cómo funciona', ['Los futuros de índices vencen en **marzo (H), junio (M), septiembre (U) y diciembre (Z)**', 'Vencen el **tercer viernes** del mes', 'Días antes, **el volumen pasa al siguiente**', 'Opera siempre **el que tenga más volumen**']),
    card('Esta semana', 'Mira el volumen en tu plataforma', 'Si el **NQH7** (marzo 2027) ya tiene más volumen que el NQZ6, cambia el gráfico y las órdenes a ese contrato.', 'ok'),
    ctaInner('Futuros explicados desde cero')] },
  { name: 'caso-doble-ruptura', caption: 'Rompe arriba, te saca… y luego cae 200 puntos. ¿Vuelves a entrar? 😬\n\nDesliza 👉', slides: [
    cover('Caso práctico', 'La doble ruptura'),
    chart('La situación', 'Compra, stop y caída', fig('double'), ''),
    card('Qué haces', 'Nada', 'Ya has hecho tu operación del día. Duele ver la caída que «podrías haber cogido», pero **la regla de una operación al día** evita los días de −240.', 'ok'),
    ctaInner('8 casos prácticos resueltos en el curso')] },
  { name: 'tu-plan-de-trading-2027', caption: 'Año nuevo, plan nuevo: las 12 preguntas que tiene que responder tu plan de trading 📝\n\nGuárdalo 📌 Desliza 👉', slides: [
    cover('2027', 'Tu plan de trading para 2027', 'Escrito, firmado y delante cada sesión.'),
    list('Tu plan responde a…', 'Parte 1', ['Contrato y temporalidad', 'Tamaño de rango válido', 'Método de entrada', 'Riesgo por operación y contratos', 'Pérdida máxima diaria y semanal', 'Regla de noticias']),
    list('Tu plan responde a…', 'Parte 2', ['Hora límite para entrar', 'Cuándo y cómo añado', 'Cómo cierro la extensión', 'Regla de break-even', 'Qué hago tras un stop', 'Firma y fecha']),
    ctaInner('Plan de trading rellenable en la app')] },
  { name: 'casos-deslizamiento-y-70', caption: 'Dos situaciones que pasan más de lo que crees: deslizamiento y «llegó a +70 y se giró» 🙃\n\nDesliza 👉', slides: [
    cover('Casos prácticos', 'Dos clásicos de la apertura'),
    card('Deslizamiento', 'Buy stop en 20.000, ejecuta en 20.006', 'Calculas stop y objetivo **desde el precio real**: 19.926 y 20.086. El deslizamiento es un coste: inclúyelo en el backtest.'),
    card('+70 y se gira', 'No toca el objetivo y vuelve al stop', 'Si tu plan no tiene break-even, aceptas el stop. Esa regla **solo la decide el backtest**, nunca en mitad de la operación.', 'ko'),
    ctaInner('8 casos prácticos resueltos en el curso')] },
  { name: 'checklist-diaria', caption: 'La checklist que repaso cada día antes de las 15:15 ✅\n\nGuárdala 📌 Desliza 👉', slides: [
    cover('Rutina', 'Checklist antes de operar'),
    list('Antes de la ventana', 'Parte 1', ['Hora de apertura de **Nueva York**', 'Calendario macro: nada a las 16:00 ni Fed', 'Contrato con **más volumen**', 'Tamaño calculado y **drawdown** revisado'], { nums: false }),
    list('En la ventana', 'Parte 2', ['Rango **marcado y validado**', 'OCO con **stop y objetivo de 80**', 'Plan de extensión **decidido antes**', 'Operación **en el diario** con captura'], { nums: false }),
    ctaInner('Checklist interactiva en la app')] },
];

// ----------------------------------------------------------------- publicaciones sueltas

const RULES = [
  ['Una operación al día.', 'Si te saca y luego rompe por el otro lado, no hay segunda entrada.'],
  ['El stop solo se mueve a favor.', 'Nunca en contra. Sin excepciones.'],
  ['Si no entraste en tu nivel, no es tu operación.', 'Perseguir el precio es la forma más rápida de entrar mal.'],
  ['El tamaño se decide por la pérdida, no por la garantía.', 'contratos = riesgo ÷ (80 × valor por punto)'],
  ['Un día perdedor dentro del plan es una buena operación.', 'Es el coste normal de un sistema 1:1.'],
  ['Sin compresión hasta las 15:30, no hay operación.', 'Si el movimiento empieza antes, no es tu operación.'],
  ['Planifica la operación y opera el plan.', 'Las decisiones se toman antes de entrar, no durante.'],
  ['100 sesiones de backtest antes de dinero real.', 'Ninguna regla está demostrada hasta que la pruebas.'],
  ['El peor caso de la posición, siempre positivo.', 'Solo se añade después de +80, y cubierto por el beneficio.'],
  ['Tu peor enemigo no es el mercado. Es saltarte tus reglas.', ''],
  ['Revisa el calendario macro antes de las 15:15.', 'Un dato a las 16:00 puede girar la ruptura en dos minutos.'],
];
const GLOSS = [
  ['Acumulación', 'Fase en la que el precio se comprime en un rango estrecho antes de un movimiento. En esta estrategia: de 15:15 a 15:30.'],
  ['Ruptura falsa', 'El precio sale del rango, no encuentra continuidad y vuelve dentro. El principal enemigo de las rupturas.'],
  ['OCO', 'Dos órdenes vinculadas: cuando se ejecuta una, la otra se cancela sola.'],
  ['Bracket', 'Orden de entrada con el stop loss y el take profit ya adjuntos. Nunca estás sin stop.'],
  ['Drawdown', 'Caída desde un máximo de saldo. En fondeo, la pérdida máxima que te permite la firma.'],
  ['Tick', 'El movimiento mínimo del precio. En el NQ, 0,25 puntos.'],
  ['Deslizamiento', 'Diferencia entre el precio que esperabas y el que te ejecutan. Es un coste real.'],
  ['Trailing stop', 'Stop que sigue al precio a favor para proteger el beneficio.'],
  ['Piramidar', 'Añadir contratos a una posición que ya va ganando. Solo con el peor caso cubierto.'],
  ['RR (riesgo/beneficio)', 'Relación entre lo que arriesgas y lo que buscas ganar. Aquí: 80 / 80, es decir, 1:1.'],
  ['Break-even', 'Mover el stop al precio de entrada para no perder. Una regla que decide el backtest, no el miedo.'],
];
const PROMOS = [
  { title: 'Ya disponible', body: () => ctaInner('Estrategia de ruptura 15:15 – 15:30'), caption: 'Mi curso de trading de futuros ya está disponible 🚀\n\n📚 20 módulos · 🎬 21 vídeos · 🧠 7 ejemplos interactivos · 📱 app para móvil y ordenador.' },
  { title: 'Qué incluye', body: () => list('El curso', 'Qué incluye', ['**20 módulos:** de las velas al fondeo', '**21 vídeos** con operaciones vela a vela', '**7 ejemplos interactivos**', '**Calculadora, checklist y plan**', '**App** para móvil y ordenador', `**${price}** · 3 meses de acceso`]), caption: 'Todo lo que incluye el curso 👇' },
  { title: 'Ejemplos interactivos', body: () => `<div class="kick">Dentro del curso</div><div class="h m">Decide tú a las 15:30. Luego mira qué pasó.</div><div style="display:flex;justify-content:center"><img src="${phone}" style="width:520px;border-radius:40px;border:10px solid #1f2b47"></div>`, caption: 'Así son los ejemplos del curso: ves el gráfico a las 15:30, eliges qué harías y después ves la resolución vela a vela 🧠' },
  { title: 'Calculadora', body: () => `<div class="kick">Dentro de la app</div><div class="h m">Calculadora de tamaño</div><div style="display:flex;justify-content:center"><img src="${calcImg}" style="width:520px;border-radius:40px;border:10px solid #1f2b47"></div>`, caption: 'Pones tu riesgo y el contrato, y te dice cuántos operar. Se acabó operar a ojo 🧮' },
  { title: 'Para quién es', body: () => list('El curso es para ti si…', 'Para quién es', ['Empiezas de cero y quieres **un método claro**', 'Operas **fondeo** y quieres dejar de quemar cuentas', 'Puedes dedicar **15–60 minutos** al día', 'Aceptas que **un día perdedor** forma parte del plan'], { nums: false }), caption: '¿Es para ti? 👇' },
  { title: 'Vídeos', body: () => `<div class="kick">Dentro del curso</div><div class="h m">21 vídeos con operaciones vela a vela</div><div class="chartbox">${fig('ej-largo', { wide: true })}</div><div class="cap">Un vídeo por módulo: gráficos animados, tablas y sesiones completas.</div>${legal}`, caption: 'Un vídeo por cada módulo, con las operaciones repetidas vela a vela 🎬' },
  { title: 'Acceso', body: () => quote('Preguntas frecuentes', '¿Cuánto dura el acceso?', `**3 meses** desde la compra, en ordenador y móvil. Si renuevas antes de que termine, se suman al final.<br><br>${price} · pago único.`), caption: 'Pregunta frecuente: ¿cuánto dura el acceso? ⏳' },
  { title: 'Experiencia', body: () => quote('Preguntas frecuentes', '¿Necesito experiencia?', 'No. La primera parte empieza desde cero: qué es una vela, cómo funciona un futuro y qué órdenes vas a usar.'), caption: 'Pregunta frecuente: ¿necesito experiencia previa? 🤔' },
  { title: 'Navidad', body: () => quote('Diciembre', 'Regálate un método para 2027', `Empieza el año con reglas escritas, no con corazonadas.<br><br>${price} · 3 meses de acceso.`, 'brand'), caption: 'Regálate (o regala) un método para 2027 🎁' },
  { title: 'Fondeo', body: () => quote('Preguntas frecuentes', '¿Sirve para cuentas de fondeo?', 'Sí. Hay un módulo entero sobre el tamaño según el drawdown, el trailing y las reglas de las firmas.'), caption: 'Pregunta frecuente: ¿sirve para cuentas de fondeo? 🏦' },
  { title: 'Año nuevo', body: () => quote('2027', 'Empieza el año con un plan', 'Backtest, plan de trading y un método que puedes seguir cuando cuesta.', 'brand'), caption: 'Empieza 2027 con un plan, no con corazonadas 📝' },
  { title: 'Método', body: () => list('El método', 'En 5 reglas', ['**Ventana:** 15:15 – 15:30', '**Entrada:** ruptura, una al día', '**Stop:** 80 puntos', '**Objetivo:** 80 puntos', '**Gestión:** parcial y stop a favor']), caption: 'El método completo cabe en 5 reglas. Lo difícil es cumplirlas 👇' },
  { title: 'Compartir', body: () => quote('El acceso es personal', 'Tu curso lleva tu nombre', 'Cada página, vídeo y el PDF llevan tu correo como marca de agua. Es tuyo.'), caption: 'Cada alumno tiene su acceso personal, con su correo en todo el contenido 🔐' },
];

// ----------------------------------------------------------------- fechas especiales (por fecha AAAA-MM-DD)

const SPECIAL = {
  '2026-10-24': { type: 'post', name: 'cambio-de-hora-europa', slides: [quote('Atención · cambio de hora', 'Mañana cambia la hora en Europa', 'EE. UU. no cambia hasta el 1 de noviembre. **Del 26 al 30 de octubre**, Nueva York abre a las **14:30** en España: tu ventana es de **14:15 a 14:30**.', 'brand')], caption: '⚠️ Mañana cambia la hora en Europa, pero NO en EE. UU.\n\nDel lunes 26 al viernes 30 de octubre, Nueva York abre a las 14:30 hora española. Tu rango es de 14:15 a 14:30.\n\nLa referencia es siempre la apertura de Nueva York, no Madrid.' },
  '2026-10-28': { type: 'post', name: 'hoy-hay-fed', slides: [quote('Calendario macro', 'Hoy hay reunión de la Fed', 'El comunicado sale por la tarde (esta semana, a las **19:00** en España por el cambio de hora). Las sesiones de Fed suelen ser **lentas y engañosas**: cautela o no operar.')], caption: '🏦 Hoy hay decisión de la Fed.\n\nEl comunicado sale a las 14:00 de Nueva York: esta semana, a las 19:00 en España. Los días de Fed la sesión suele ser lenta y engañosa.\n\nTu regla de noticias decide: ¿operas o no? (Compruébalo siempre en tu calendario económico.)' },
  '2026-10-31': { type: 'post', name: 'cambio-de-hora-eeuu', slides: [quote('Atención · cambio de hora', 'Mañana cambia la hora en EE. UU.', 'Desde el **lunes 2 de noviembre** todo vuelve a la normalidad: Nueva York abre a las **15:30** y tu ventana es de **15:15 a 15:30**.', 'brand')], caption: '⏰ Mañana cambia la hora en EE. UU.\n\nDesde el lunes 2 de noviembre, Nueva York vuelve a abrir a las 15:30 hora española. Tu ventana: de 15:15 a 15:30.' },
  '2026-11-26': { type: 'post', name: 'accion-de-gracias', slides: [quote('Festivo en EE. UU.', 'Hoy es Acción de Gracias', 'Bolsa de Nueva York cerrada. **Hoy no hay apertura ni ventana.** Y mañana, sesión recortada con poco volumen: cautela.')], caption: '🦃 Hoy es Acción de Gracias en EE. UU.: la bolsa de Nueva York está cerrada. Sin apertura no hay ventana ni operación.\n\nMañana la sesión es más corta y con poco volumen. Los festivos y sesiones recortadas, mejor con cautela.' },
  '2026-12-09': { type: 'post', name: 'hoy-hay-fed-diciembre', slides: [quote('Calendario macro', 'Hoy hay reunión de la Fed', 'El comunicado sale a las **20:00** en España. Las sesiones de Fed suelen ser **lentas y engañosas**: aplica tu regla de noticias.')], caption: '🏦 Hoy hay decisión de la Fed: comunicado a las 20:00 hora española.\n\nLos días de Fed la sesión suele ser lenta y engañosa. ¿Tu regla de noticias dice que operas? (Compruébalo siempre en tu calendario económico.)' },
  '2026-12-24': { type: 'post', name: 'nochebuena', slides: [quote('Sesión recortada', 'Nochebuena: poco volumen', 'La sesión de EE. UU. cierra antes y hay muy poco volumen. **Sin volumen, las rupturas son menos fiables.** Buen día para descansar. 🎄')], caption: '🎄 Hoy la sesión de EE. UU. es más corta y con muy poco volumen. Las rupturas sin volumen son menos fiables.\n\nNo operar también es una decisión de trading. ¡Feliz Nochebuena!' },
  '2026-12-25': { type: 'post', name: 'navidad', slides: [quote('Feliz Navidad', 'Hoy el mercado descansa. Tú también.', 'Aprovecha para repasar tu diario y preparar tu plan para 2027. 🎄', 'brand')], caption: '🎄 Feliz Navidad. Hoy los mercados están cerrados.\n\nBuen momento para repasar tu diario del año y empezar a escribir tu plan para 2027.' },
  '2026-12-31': { type: 'post', name: 'nochevieja', slides: [quote('Último día del año', 'Lo que te llevas de 2026', '¿Seguiste tus reglas? ¿Cuántas veces te saltaste el stop? **Tu diario tiene las respuestas.** Feliz año. 🥂')], caption: '🥂 Último día de 2026.\n\nAntes de pensar en objetivos, mira tu diario: ¿cuántas veces seguiste tus reglas y cuántas te las saltaste? Ahí está tu verdadero resultado del año.\n\n¡Feliz año nuevo!' },
};

// ----------------------------------------------------------------- calendario

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const HASHTAGS = [
  '#trading #tradingdefuturos #futuros #nasdaq #NQ #daytrading #cuentasdefondeo #propfirm #traderespañol #fundedlab',
  '#trading #futures #nasdaq100 #MNQ #intradia #fondeo #gestiondelriesgo #aprendetrading #tradingespaña #fundedlab',
  '#daytrading #tradingdefuturos #nasdaq #cuentadefondeo #propfirmtrader #disciplina #tradingtips #traders #fundedlab #fundedlab_es',
];
const CTA = '\n\n👉 Curso completo en el link de la bio.\n📩 Dudas: grupolab@proton.me';
const NOTE = '\n\nContenido formativo. No es asesoramiento financiero.';

const iso = (d) => d.toISOString().slice(0, 10);
const plan = [];
let e = 0, p = 0, r = 0, g = 0, pr = 0, rp = 0, qz = 0;
for (let i = 0; i < 91; i++) {
  const d = new Date(start.getTime() + i * 864e5);
  const date = iso(d);
  const dow = d.getUTCDay();
  let item;
  if (SPECIAL[date]) item = { ...SPECIAL[date], caption: `${SPECIAL[date].caption}\n\n📩 Dudas: grupolab@proton.me${NOTE}` };
  else if (dow === 1) { const c = EDU[e++ % EDU.length]; item = { type: 'carrusel', name: c.name, slides: c.slides, caption: c.caption + CTA }; }
  else if (dow === 2) { const x = replayReel(REPLAYS[rp++ % REPLAYS.length]); item = { ...x, caption: x.caption + CTA + '\n\nPrecios ilustrativos.' + NOTE }; }
  else if (dow === 3) { const [t, sub] = RULES[r++ % RULES.length]; item = { type: 'post', name: 'regla', slides: [quote('Regla del método', t, sub, 'brand')], caption: `📌 ${t}\n\n${sub}${CTA}` }; }
  else if (dow === 4) { const x = quizReel(QUIZZES[qz++ % QUIZZES.length]); item = { ...x, caption: x.caption + CTA + '\n\nPrecios ilustrativos.' + NOTE }; }
  else if (dow === 5) { const c = PRO[p++ % PRO.length]; item = { type: 'carrusel', name: c.name, slides: c.slides, caption: c.caption + CTA }; }
  else if (dow === 6) { const [t, def] = GLOSS[g++ % GLOSS.length]; item = { type: 'post', name: 'glosario', slides: [quote('Glosario del trader', t, def)], caption: `📖 Glosario del trader: ${t}\n\n${def}\n\nGuárdalo para repasarlo 📌${CTA}` }; }
  else { const c = PROMOS[pr++ % PROMOS.length]; item = { type: 'post', name: `curso-${c.title.toLowerCase().replace(/\s+/g, '-')}`, slides: [c.body()], caption: `${c.caption}\n\n${price} · 3 meses de acceso.${CTA}${NOTE}` }; }
  item.caption += `\n\n${HASHTAGS[i % HASHTAGS.length]}`;
  plan.push({ n: i + 1, date, dow: DAYS[dow], ...item });
}

// ----------------------------------------------------------------- render

if (!only) rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const studio = await openStudio();
const rows = [];
for (const it of plan) {
  const dir = join(out, `${String(it.n).padStart(3, '0')}_${it.date}_${it.dow}_${it.type}-${it.name}`);
  const files = [];
  if (!only || Number(only) === it.n) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    if (it.type === 'reel') files.push(`${await studio.video(it.steps, join(dir, 'reel.mp4'))} s`);
    else files.push(`${(await studio.slides(it.slides, dir, { single: it.type === 'post' })).length} imagen(es)`);
    writeFileSync(join(dir, 'texto.txt'), it.caption + '\n');
    console.log(`${it.n}/91 ${it.date} ${it.dow} ${it.type} ${it.name} · ${files.join(', ')}`);
  }
  rows.push(`| ${it.n} | ${it.date} | ${it.dow} | ${it.type} | ${it.name.replace(/-/g, ' ')} | ${it.caption.split('\n')[0].replace(/\|/g, '/')} |`);
}
await studio.close();

writeFileSync(join(out, 'CALENDARIO.md'), `# Calendario de Instagram · 91 días · @fundedlab_es

Del ${plan[0].date} al ${plan[plan.length - 1].date}. Una publicación al día: cada carpeta tiene la imagen, las imágenes del
carrusel (súbelas en orden) o el reel, y \`texto.txt\` con el pie de foto y los hashtags.

- **Reels:** sin música. Al subirlos, toca «Audio» en Instagram y elige una canción en tendencia.
- **Mejor hora:** 13:00–14:00 o 20:00–21:30 hora de España. Los reels de las sesiones, mejor por la tarde.
- **Fechas especiales** (cambios de hora, Fed, Acción de Gracias, vencimiento de diciembre, Navidad): revisa siempre el
  calendario económico por si cambia algo.
- **Precios de los gráficos:** ilustrativos; ya lo indica cada publicación.

| Nº | Fecha | Día | Tipo | Tema | Primera línea del texto |
|---|---|---|---|---|---|
${rows.join('\n')}
`);
console.log(`Listo: ${out}`);
