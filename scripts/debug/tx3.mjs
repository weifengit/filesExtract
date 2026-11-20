import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
// 仓库根下的 node_modules，避免把本机绝对路径写死进仓库
const base = fileURLToPath(new URL('../../node_modules/pdfjs-dist/', import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'legacy/build/pdf.worker.mjs';
const data = new Uint8Array(fs.readFileSync(process.argv[2]));
const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true, cMapUrl: base+'cmaps/', cMapPacked: true, standardFontDataUrl: base+'standard_fonts/' }).promise;
const page = await doc.getPage(1);
const vp = page.getViewport({ scale: 1 });
const tc = await page.getTextContent();
for (const it of tc.items.slice(0, 6)) {
  const t = it.transform;
  const tx = [
    vp.transform[0]*t[0]+vp.transform[2]*t[1], vp.transform[1]*t[0]+vp.transform[3]*t[1],
    vp.transform[0]*t[2]+vp.transform[2]*t[3], vp.transform[1]*t[2]+vp.transform[3]*t[3],
    vp.transform[0]*t[4]+vp.transform[2]*t[5]+vp.transform[4], vp.transform[1]*t[4]+vp.transform[3]*t[5]+vp.transform[5],
  ];
  console.log(JSON.stringify({str:it.str, raw_transform:t.map(v=>+v.toFixed(3)), tx:tx.map(v=>+v.toFixed(3)), fontHeight:+Math.hypot(tx[2],tx[3]).toFixed(3), width:+it.width.toFixed(3)}));
}
