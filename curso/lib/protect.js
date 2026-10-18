/*
 * Marca de agua en los archivos descargables:
 *  - PDF: el correo del alumno en diagonal y en el pie de cada página (pdf-lib).
 *  - Vídeo: el correo grabado en la imagen con ffmpeg (cambia de posición cada pocos segundos).
 * Los resultados se guardan en caché por alumno para no repetir el trabajo.
 */
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

export async function stampPdf(pdfBytes, text) {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const small = await doc.embedFont(StandardFonts.Helvetica);
  doc.setTitle('Funded Lab · Estrategia de ruptura 15:15 – 15:30');
  doc.setSubject(text);
  doc.setKeywords([text]);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const size = 15;
    const w = font.widthOfTextAtSize(text, size);
    for (let y = -40; y < height + 40; y += 170) {
      for (let x = -w / 2 + ((y / 170) % 2) * 140; x < width; x += w + 120) {
        page.drawText(text, { x, y, size, font, color: rgb(0.45, 0.55, 0.65), opacity: 0.13, rotate: degrees(28) });
      }
    }
    const foot = `Licencia personal: ${text}`;
    page.drawText(foot, { x: (width - small.widthOfTextAtSize(foot, 7)) / 2, y: 10, size: 7, font: small, color: rgb(0.45, 0.5, 0.58), opacity: 0.9 });
  }
  return Buffer.from(await doc.save());
}

export const hasFfmpeg = () => {
  try { return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0; } catch { return false; }
};

// Escapa texto para el filtro drawtext de ffmpeg.
const dt = (s) => String(s).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\u2019").replace(/%/g, '\\%');

const pending = new Map();

/**
 * Devuelve la ruta de una copia del vídeo con el correo grabado. Si aún no existe, la genera
 * (solo una vez aunque lleguen varias peticiones a la vez).
 */
export function watermarkedVideo(src, cacheDir, userId, videoId, text) {
  const dir = join(cacheDir, 'wm', String(userId));
  const out = join(dir, `${videoId}.mp4`);
  if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) return Promise.resolve(out);
  const key = out;
  if (pending.has(key)) return pending.get(key);
  mkdirSync(dir, { recursive: true });
  const tmp = `${out}.${process.pid}.tmp.mp4`;
  const t = dt(text);
  // Dos marcas fijas tenues + una más visible que salta entre 4 posiciones cada 7 segundos.
  const filters = [
    `drawtext=text='${t}':fontcolor=white@0.10:fontsize=h/30:x=(w-tw)/2:y=h*0.18`,
    `drawtext=text='${t}':fontcolor=white@0.10:fontsize=h/30:x=(w-tw)/2:y=h*0.82`,
    `drawtext=text='${t}':fontcolor=white@0.32:fontsize=h/40:box=1:boxcolor=black@0.18:boxborderw=6:` +
      `x='if(lt(mod(t,28),14),w*0.04,w*0.96-tw)':y='if(lt(mod(t,14),7),h*0.14,h*0.90-th)'`,
  ].join(',');
  const p = new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', filters, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', tmp]);
    let err = '';
    ff.stderr.on('data', (d) => { err += d; });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) { renameSync(tmp, out); resolve(out); } else { rmSync(tmp, { force: true }); reject(new Error(`ffmpeg ${code}: ${err.slice(-500)}`)); }
    });
  }).finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}
