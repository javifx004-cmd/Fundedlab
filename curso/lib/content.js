/*
 * Contenido del curso.
 * El repositorio es público, así que el contenido se publica cifrado (AES-256-GCM) en content/:
 *   content/course.enc        → todos los textos, el índice y el PDF
 *   content/videos/<id>.enc   → cada vídeo
 * El servidor lo descifra al arrancar con CONTENT_KEY. En desarrollo, si existe content-src/, se usa tal cual.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

const MAGIC = Buffer.from('FLC1');

export function parseKey(k) {
  const key = Buffer.from(String(k || '').trim(), 'base64');
  if (key.length !== 32) throw new Error('CONTENT_KEY debe ser 32 bytes en base64 (genera una con: npm run seal -- --new-key)');
  return key;
}

export function encrypt(buf, key) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}

export function decrypt(buf, key) {
  if (!buf.subarray(0, 4).equals(MAGIC)) throw new Error('Archivo cifrado no válido');
  const d = createDecipheriv('aes-256-gcm', key, buf.subarray(4, 16));
  d.setAuthTag(buf.subarray(16, 32));
  return Buffer.concat([d.update(buf.subarray(32)), d.final()]);
}

function walk(dir, skip) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (skip(p)) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p, skip));
    else out.push(p);
  }
  return out;
}

const isVideoDir = (srcDir) => (p) => p.startsWith(join(srcDir, 'videos'));

// Empaqueta content-src (sin los vídeos) en un único bloque: { "ruta": base64 }.
export function packSource(srcDir) {
  const files = {};
  for (const p of walk(srcDir, isVideoDir(srcDir))) files[relative(srcDir, p).split('\\').join('/')] = readFileSync(p).toString('base64');
  return gzipSync(Buffer.from(JSON.stringify(files)));
}

export function seal(srcDir, outDir, key) {
  mkdirSync(join(outDir, 'videos'), { recursive: true });
  writeFileSync(join(outDir, 'course.enc'), encrypt(packSource(srcDir), key));
  const vdir = join(srcDir, 'videos');
  const vids = existsSync(vdir) ? readdirSync(vdir).filter((f) => f.endsWith('.mp4')) : [];
  for (const f of vids) writeFileSync(join(outDir, 'videos', basename(f, '.mp4') + '.enc'), encrypt(readFileSync(join(vdir, f)), key));
  return vids.length;
}

export function unseal(encDir, outDir, key) {
  const files = JSON.parse(gunzipSync(decrypt(readFileSync(join(encDir, 'course.enc')), key)).toString());
  for (const [rel, b64] of Object.entries(files)) {
    const p = join(outDir, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, Buffer.from(b64, 'base64'));
  }
  const vdir = join(encDir, 'videos');
  if (existsSync(vdir)) {
    mkdirSync(join(outDir, 'videos'), { recursive: true });
    for (const f of readdirSync(vdir).filter((x) => x.endsWith('.enc'))) {
      writeFileSync(join(outDir, 'videos', basename(f, '.enc') + '.mp4'), decrypt(readFileSync(join(vdir, f)), key));
    }
  }
  return Object.keys(files).length;
}

/**
 * Carga el curso en memoria. Devuelve { course, modules: Map(id → html), pdf: Buffer|null, videoDir }.
 * Los vídeos se descifran a `cacheDir/videos` (fuera de lo que se sirve públicamente) para poder servirlos por rangos.
 */
export function loadCourse({ root, key, cacheDir }) {
  const src = join(root, 'content-src');
  let files;
  let videoDir = null;
  if (key && existsSync(join(root, 'content', 'course.enc'))) {
    const k = parseKey(key);
    const raw = JSON.parse(gunzipSync(decrypt(readFileSync(join(root, 'content', 'course.enc')), k)).toString());
    files = Object.fromEntries(Object.entries(raw).map(([p, b]) => [p, Buffer.from(b, 'base64')]));
    const encVids = join(root, 'content', 'videos');
    videoDir = join(cacheDir, 'videos');
    mkdirSync(videoDir, { recursive: true });
    if (existsSync(encVids)) {
      for (const f of readdirSync(encVids).filter((x) => x.endsWith('.enc'))) {
        writeFileSync(join(videoDir, basename(f, '.enc') + '.mp4'), decrypt(readFileSync(join(encVids, f)), k));
      }
    }
  } else if (existsSync(src)) {
    files = Object.fromEntries(walk(src, isVideoDir(src)).map((p) => [relative(src, p).split('\\').join('/'), readFileSync(p)]));
    if (existsSync(join(src, 'videos'))) videoDir = join(src, 'videos');
  } else {
    throw new Error('No hay contenido: falta content/course.enc (con CONTENT_KEY) o content-src/');
  }

  const course = JSON.parse(files['course.json'].toString());
  const modules = new Map();
  const order = [];
  for (const part of course.parts) {
    for (const m of part.modules) {
      const html = files[`modules/${m.id}.html`];
      if (!html) throw new Error(`Falta modules/${m.id}.html`);
      modules.set(m.id, { ...m, part: part.title, partNum: part.num, html: html.toString() });
      order.push(m.id);
    }
  }
  // Un vídeo por módulo cuando existe: videos/<id-del-módulo>.mp4
  const videos = new Set();
  if (videoDir && existsSync(videoDir)) for (const f of readdirSync(videoDir)) if (extname(f) === '.mp4') videos.add(basename(f, '.mp4'));
  const pdf = course.pdf && files[course.pdf] ? files[course.pdf] : null;
  return { course, modules, order, pdf, videoDir, videos };
}
