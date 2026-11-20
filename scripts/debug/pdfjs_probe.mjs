import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
// 仓库根下的 node_modules，避免把本机绝对路径写死进仓库
const base = fileURLToPath(new URL('../../node_modules/pdfjs-dist/', import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'legacy/build/pdf.worker.mjs';
const data = new Uint8Array(fs.readFileSync(process.argv[2]));
const doc = await pdfjsLib.getDocument({
  data, useSystemFonts: true,
  cMapUrl: base + 'cmaps/', cMapPacked: true,
  standardFontDataUrl: base + 'standard_fonts/',
}).promise;
console.log('pages', doc.numPages);
const page = await doc.getPage(Number(process.argv[3] || 1));
const tc = await page.getTextContent();
let n = 0;
for (const it of tc.items) {
  if (!it.str || !it.str.trim()) continue;
  const t = it.transform;
  console.log(JSON.stringify({str: it.str, width: +it.width.toFixed(3), a:+t[0].toFixed(3), b:+t[1].toFixed(3), c:+t[2].toFixed(3), d:+t[3].toFixed(3), e:+t[4].toFixed(3), f:+t[5].toFixed(3), hasEOL: it.hasEOL}));
  if (++n >= 12) break;
}
