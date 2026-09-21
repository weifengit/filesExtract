import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import ExcelJS from 'exceljs'
import {
  buildOutputWorkbook,
  cellToText,
  findSourceExcel,
  normalizeFlag,
  readSourceExcel,
  saveWorkbookToDir,
} from '../src/core/excel'
import type { ResultRow } from '../src/types'
import { makeSourceXlsxBytes } from './helpers/fixtures'
import { MockDirHandle } from './helpers/fs-mock'

describe('cellToText', () => {
  it('处理各类单元格值', () => {
    expect(cellToText(1)).toBe('1')
    expect(cellToText(' 1 ')).toBe(' 1 ')
    expect(cellToText(true)).toBe('true')
    expect(cellToText(null)).toBe('')
    expect(cellToText({ text: 'a', hyperlink: '#' })).toBe('a')
    expect(cellToText({ richText: [{ text: 'a' }, { text: 'b' }] })).toBe('ab')
  })
})

describe('normalizeFlag', () => {
  it('数字与字符串 1/是/true/yes 视为 1，其余 0', () => {
    expect(normalizeFlag(1)).toBe(1)
    expect(normalizeFlag('1')).toBe(1)
    expect(normalizeFlag('是')).toBe(1)
    expect(normalizeFlag('true')).toBe(1)
    expect(normalizeFlag('yes')).toBe(1)
    expect(normalizeFlag(0)).toBe(0)
    expect(normalizeFlag('0')).toBe(0)
    expect(normalizeFlag('')).toBe(0)
    expect(normalizeFlag('2')).toBe(0)
  })
})

describe('readSourceExcel', () => {
  let root: string
  let dir: MockDirHandle

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fx-xlsx-'))
    dir = new MockDirHandle(root)
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('按表头名映射列（列顺序打乱也能读）', async () => {
    const buf = await makeSourceXlsxBytes(
      [
        ['a.pdf', 1, 1],
        ['b.docx', 1, 0],
        ['c.doc', 0, '是'],
        ['', '', ''],
      ],
      ['extract', 'needed', 'fileName'], // 打乱列顺序
    )
    const handle = await dir.getFileHandle('源.xlsx', { create: true })
    const w = await handle.createWritable()
    await w.write(new Blob([buf]))
    await w.close()

    const parsed = await readSourceExcel(handle, '源.xlsx')
    expect(parsed.headerRow).toBe(1)
    expect(parsed.rows).toHaveLength(3)
    expect(parsed.rows[0]).toEqual({ fileName: 'a.pdf', needed: 1, extract: 1 })
    expect(parsed.rows[1]).toEqual({ fileName: 'b.docx', needed: 1, extract: 0 })
    expect(parsed.rows[2]).toEqual({ fileName: 'c.doc', needed: 0, extract: 1 })
  })

  it('找不到有效表头时抛错', async () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('x')
    ws.addRow(['随便', '数据'])
    ws.addRow(['1', '2'])
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
    const handle = await dir.getFileHandle('bad.xlsx', { create: true })
    const w = await handle.createWritable()
    await w.write(new Blob([buf]))
    await w.close()
    await expect(readSourceExcel(handle, 'bad.xlsx')).rejects.toThrow(
      '未在 Excel 中找到',
    )
  })
})

describe('findSourceExcel', () => {
  it('只返回 .xlsx/.xls 并区分类型', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fx-find-'))
    try {
      const dir = new MockDirHandle(root)
      const wb = new ExcelJS.Workbook()
      wb.addWorksheet('s')
      const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
      await writeFileVia(dir, '源.xlsx', buf)
      await writeFileVia(dir, '旧.xls', buf)
      await writeFileVia(dir, 'readme.txt', Buffer.from('x'))

      const cands = await findSourceExcel(dir)
      expect(cands.map((c) => c.name).sort()).toEqual(['旧.xls', '源.xlsx'])
      expect(cands.find((c) => c.name === '旧.xls')!.isXls).toBe(true)
      expect(cands.find((c) => c.name === '源.xlsx')!.isXls).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('buildOutputWorkbook / saveWorkbookToDir', () => {
  it('仅保留提取=1 的行，内容缺省时用备注', async () => {
    const rows: ResultRow[] = [
      { fileName: 'a.pdf', needed: 1, extract: 1, copyStatus: 'copied', extractStatus: 'ok', note: '', content: 'PDF全文' },
      { fileName: 'b.docx', needed: 1, extract: 0, copyStatus: 'copied', extractStatus: 'pending', note: '已复制' },
      { fileName: 'c.doc', needed: 0, extract: 1, copyStatus: 'pending', extractStatus: 'unsupported', note: '不支持的格式，请另存为 .docx 或 PDF' },
    ]
    const wb = buildOutputWorkbook(rows)
    const ws = wb.getWorksheet('文件内容全文')!
    expect(ws.rowCount).toBe(3) // 表头 + 2 行（a.pdf、c.doc）
    const a = ws.getRow(2).getCell(2).value as string
    const c = ws.getRow(3).getCell(2).value as string
    expect(a).toBe('PDF全文')
    expect(c).toBe('不支持的格式，请另存为 .docx 或 PDF')
  })

  it('saveWorkbookToDir 写入真实文件且可再读回', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fx-save-'))
    try {
      const dir = new MockDirHandle(root)
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('文件内容全文')
      ws.columns = [{ header: '文件名', key: 'fileName' }, { header: '文件内容全文', key: 'content' }]
      ws.addRow({ fileName: 'a.pdf', content: '内容' })
      await saveWorkbookToDir(wb, dir, '文件内容全文.xlsx')

      const s = await stat(join(root, '文件内容全文.xlsx'))
      expect(s.isFile()).toBe(true)

      const back = new ExcelJS.Workbook()
      await back.xlsx.load(await readFile(join(root, '文件内容全文.xlsx')))
      const ws2 = back.getWorksheet('文件内容全文')!
      expect(ws2.getRow(2).getCell(1).value).toBe('a.pdf')
      expect(ws2.getRow(2).getCell(2).value).toBe('内容')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

async function writeFileVia(
  dir: MockDirHandle,
  name: string,
  data: Buffer | ArrayBuffer,
) {
  const h = await dir.getFileHandle(name, { create: true })
  const w = await h.createWritable()
  await w.write(new Blob([data]))
  await w.close()
}
