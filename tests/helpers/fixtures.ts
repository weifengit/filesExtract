/**
 * 测试夹具：生成源 Excel、最小 .docx、最小 .pdf。
 */
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

/** 生成源 Excel 的字节（列顺序可打乱，验证按表头名映射） */
export async function makeSourceXlsxBytes(
  rows: Array<[string, string | number, string | number]>,
  colOrder: Array<'fileName' | 'needed' | 'extract'> = ['fileName', 'needed', 'extract'],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('源数据')
  const headers: Record<string, string> = {
    fileName: '文件名',
    needed: '需要的文件',
    extract: '提取文件内容',
  }
  ws.addRow(colOrder.map((c) => headers[c]))
  // 数据行必须与 colOrder 保持同序，否则表头与数据错位
  for (const [name, needed, extract] of rows) {
    const map: Record<string, string | number> = { fileName: name, needed, extract }
    ws.addRow(colOrder.map((c) => map[c]))
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

/** 生成最小 .docx（含多段中文/英文文本） */
export async function makeDocxBytes(texts: string[]): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  )
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  )
  const paragraphs = texts
    .map(
      (t) =>
        `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`,
    )
    .join('')
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphs}</w:body>
</w:document>`,
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

/** 生成带可提取文本的最小 PDF（用标准 Type1 字体 + 精确 xref 偏移） */
export function makePdfBytes(): Buffer {
  const streamContent = 'BT /F1 24 Tf 72 700 Td (Hello PDF World) Tj ET'
  const objects: string[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'
  objects[3] =
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>'
  objects[4] = `<< /Length ${Buffer.byteLength(streamContent)} >>\nstream\n${streamContent}\nendstream`
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(pdf)
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xrefStart = Buffer.byteLength(pdf)
  pdf += `xref\n0 6\n0000000000 65535 f \n`
  for (let i = 1; i <= 5; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return Buffer.from(pdf, 'ascii')
}
