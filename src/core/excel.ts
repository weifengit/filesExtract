import ExcelJS from 'exceljs'
import type { FieldRow, Flag, ParsedExcel, ResultRow } from '../types'

/** 路径1 下的候选源 Excel */
export interface ExcelCandidate {
  name: string
  handle: FileSystemFileHandle
  /** 是否为旧版 .xls（exceljs 无法解析） */
  isXls: boolean
}

/** 扫描路径1 顶层，找出可作为源 Excel 的文件（含 .xls 以便提示） */
export async function findSourceExcel(
  dir: FileSystemDirectoryHandle,
): Promise<ExcelCandidate[]> {
  const candidates: ExcelCandidate[] = []
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'file') continue
    const lower = name.toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      candidates.push({ name, handle, isXls: lower.endsWith('.xls') })
    }
  }
  // 优先 xlsx，多个则按名称排序，保证展示稳定
  candidates.sort((a, b) => {
    if (a.isXls !== b.isXls) return a.isXls ? 1 : -1
    return a.name.localeCompare(b.name, 'zh-CN')
  })
  return candidates
}

/** 读取并解析源 Excel（按表头名称映射列，列顺序不固定） */
export async function readSourceExcel(
  handle: FileSystemFileHandle,
  sourceName: string,
): Promise<ParsedExcel> {
  const file = await handle.getFile()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())

  for (const ws of wb.worksheets) {
    const header = locateHeaderRow(ws)
    if (!header) continue

    const rows: FieldRow[] = []
    const lastRow = ws.rowCount
    for (let r = header.row + 1; r <= lastRow; r++) {
      const row = ws.getRow(r)
      const fileName = cellToText(row.getCell(header.colFileName)).trim()
      // 跳过完全空行
      if (!fileName && !cellToText(row.getCell(header.colNeeded)) && !cellToText(row.getCell(header.colExtract))) {
        continue
      }
      rows.push({
        fileName,
        needed: normalizeFlag(row.getCell(header.colNeeded).value),
        extract: normalizeFlag(row.getCell(header.colExtract).value),
      })
    }

    if (rows.length === 0) continue
    return { sourceName, sheetName: ws.name, headerRow: header.row, rows }
  }

  throw new Error('未在 Excel 中找到包含【文件名、需要的文件、提取文件内容】表头的有效工作表')
}

interface HeaderInfo {
  row: number
  colFileName: number
  colNeeded: number
  colExtract: number
}

/** 在前 10 行内定位表头行：需含「文件名」且含「需要的文件」或「提取文件内容」 */
function locateHeaderRow(ws: ExcelJS.Worksheet): HeaderInfo | null {
  const maxScan = Math.min(ws.rowCount, 10)
  for (let r = 1; r <= maxScan; r++) {
    const row = ws.getRow(r)
    const colFileName = findColumnIndex(row, '文件名')
    if (colFileName === -1) continue
    const colNeeded = findColumnIndex(row, '需要的文件')
    const colExtract = findColumnIndex(row, '提取文件内容')
    if (colNeeded === -1 && colExtract === -1) continue
    return { row: r, colFileName, colNeeded, colExtract }
  }
  return null
}

/** 在表头行中查找包含指定文本的列（1-based），找不到返回 -1 */
function findColumnIndex(row: ExcelJS.Row, keyword: string): number {
  const last = row.cellCount
  for (let c = 1; c <= last; c++) {
    const text = cellToText(row.getCell(c).value).replace(/\s+/g, '')
    if (text.includes(keyword)) return c
  }
  return -1
}

/** 将 exceljs 单元格值稳妥地转成字符串 */
export function cellToText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString()
  // 富文本 / 超链接 / 公式等对象
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>)
        .map((t) => t.text ?? '')
        .join('')
    }
    if (typeof o.text === 'string') return o.text
    if ('result' in o) return cellToText(o.result)
  }
  return String(v)
}

/** 归一化 1/0：数字或字符串 '1'/'是'/'true'/'yes' 视为 1 */
export function normalizeFlag(v: unknown): Flag {
  const s = cellToText(v).trim().toLowerCase()
  return s === '1' || s === '是' || s === 'true' || s === 'yes' ? 1 : 0
}

const OUTPUT_SHEET_NAME = '文件内容全文'
const OUTPUT_COL_WIDTHS = [40, 80]

/** 生成输出工作簿：仅含「提取=1」的行，内容取全文，无全文取提示备注 */
export function buildOutputWorkbook(rows: ResultRow[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(OUTPUT_SHEET_NAME)

  ws.columns = [
    { header: '文件名', key: 'fileName', width: OUTPUT_COL_WIDTHS[0] },
    { header: '文件内容全文', key: 'content', width: OUTPUT_COL_WIDTHS[1] },
  ]
  ws.getRow(1).font = { bold: true }

  for (const row of rows) {
    if (row.extract !== 1) continue
    ws.addRow({ fileName: row.fileName, content: row.content ?? row.note })
  }
  return wb
}

/** 将工作簿保存为 xlsx 写入指定目录 */
export async function saveWorkbookToDir(
  wb: ExcelJS.Workbook,
  dir: FileSystemDirectoryHandle,
  fileName = '文件内容全文.xlsx',
): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const handle = await dir.getFileHandle(fileName, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(blob)
  } finally {
    await writable.close()
  }
}
