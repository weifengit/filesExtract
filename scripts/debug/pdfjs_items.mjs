import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
// 仓库根下的 node_modules，避免把本机绝对路径写死进仓库
const base = fileURLToPath(new URL('../../node_modules/pdfjs-dist/', import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'legacy/build/pdf.worker.mjs';
const data = new Uint8Array(fs.readFileSync(process.argv[2]));
const doc = await pdfjsLib.getDocument({
  data, useSystemFonts: true, cMapUrl: base + 'cmaps/', cMapPacked: true,
  standardFontDataUrl: base + 'standard_fonts/',
}).promise;
const out = [];
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items = [];
  for (const it of tc.items) {
    if (!it.str) continue;
    const t = it.transform;
    // 与 pdf.js TextLayer 完全一致：tx = viewport.transform × item.transform
    const tx = [
      vp.transform[0] * t[0] + vp.transform[2] * t[1],
      vp.transform[1] * t[0] + vp.transform[3] * t[1],
      vp.transform[0] * t[2] + vp.transform[2] * t[3],
      vp.transform[1] * t[2] + vp.transform[3] * t[3],
      vp.transform[0] * t[4] + vp.transform[2] * t[5] + vp.transform[4],
      vp.transform[1] * t[4] + vp.transform[3] * t[5] + vp.transform[5],
    ];
    const fontHeight = Math.hypot(tx[2], tx[3]);
    items.push({
      str: it.str, width: it.width, fontHeight,
      left: tx[4], baseline: tx[5], hasEOL: !!it.hasEOL,
      tx,
    });
  }
  out.push({ page: n, pageWidth: vp.width, pageHeight: vp.height, items });
}
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log('wrote', process.argv[3], 'pages', out.length, 'items', out.reduce((a,p)=>a+p.items.length,0));
