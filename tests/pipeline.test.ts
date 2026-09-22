import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, readFile, stat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import ExcelJS from 'exceljs'
import { runPipeline } from '../src/core/pipeline'
import { readSourceExcel } from '../src/core/excel'
import { nodeBridge } from './helpers/node-bridge'
import { makeDocxBytes, makePdfBytes, makeSourceXlsxBytes } from './helpers/fixtures'
import type { LogLine, ResultRow } from '../src/types'

describe('runPipeline 端到端', () => {
  let path1Root: string
  let path2Root: string

  beforeEach(async () => {
    path1Root = await mkdtemp(join(tmpdir(), 'fx-p1-'))
    path2Root = await mkdtemp(join(tmpdir(), 'fx-p2-'))

    // 路径2：真实样例文件
    await mkdir(join(path2Root, 'sub'), { recursive: true })
    await writeFile(join(path2Root, 'a.pdf'), makePdfBytes())
    await writeFile(join(path2Root, 'b.docx'), await makeDocxBytes(['中文文档内容 123']))
    await writeFile(join(path2Root, 'c.doc'), Buffer.from('old binary doc'))
    await writeFile(join(path2Root, 'd.txt'), Buffer.from('plain text'))
    await writeFile(join(path2Root, 'sub', 'e.pdf'), makePdfBytes())

    // 路径1：源 Excel（打乱列顺序）
    const srcBuf = await makeSourceXlsxBytes(
      [
        ['a.pdf', 1, 1],
        ['b.docx', 1, 1],
        ['c.doc', 0, 1],
        ['d.txt', 1, 0],
        ['sub/e.pdf', 0, 1],
        ['missing.pdf', 1, 1],
      ],
      ['extract', 'needed', 'fileName'],
    )
    await writeFile(join(path1Root, '源.xlsx'), Buffer.from(srcBuf))
  })

  afterEach(async () => {
    await rm(path1Root, { recursive: true, force: true })
    await rm(path2Root, { recursive: true, force: true })
  })

  it('复制、提取、生成输出 Excel 全链路', async () => {
    const excelBytes = await readFile(join(path1Root, '源.xlsx'))
    const parsed = await readSourceExcel(
      excelBytes.buffer.slice(excelBytes.byteOffset, excelBytes.byteOffset + excelBytes.byteLength) as ArrayBuffer,
      '源.xlsx',
    )
    expect(parsed.rows).toHaveLength(6)

    const logs: LogLine[] = []
    const rows: ResultRow[] = []
    const progress: Array<[number, number]> = []

    const summary = await runPipeline({
      bridge: nodeBridge,
      outDir: path1Root,
      path2: path2Root,
      excel: parsed,
      onLog: (level, message) => logs.push({ level, time: '', message }),
      onRow: (row) => rows.push(row),
      onProgress: (done, total) => progress.push([done, total]),
    })

    // ---- 汇总统计 ----
    expect(summary.total).toBe(6)
    expect(summary.copied).toBe(3) // a.pdf, b.docx, d.txt
    expect(summary.extracted).toBe(3) // a.pdf, b.docx, sub/e.pdf
    expect(summary.unsupported).toBe(1) // c.doc
    expect(summary.missing).toBe(1) // missing.pdf
    expect(summary.errors).toBe(0)

    // ---- 复制结果 ----
    expect(await readFile(join(path1Root, 'a.pdf'), 'utf8')).toContain('Hello PDF World')
    const bStat = await stat(join(path1Root, 'b.docx'))
    expect(bStat.isFile()).toBe(true)
    expect(bStat.size).toBeGreaterThan(0)
    expect(await readFile(join(path1Root, 'd.txt'), 'utf8')).toBe('plain text')
    // sub/e.pdf 配置为 不需要复制（needed=0），不产生任何文件
    await expect(stat(join(path1Root, 'sub', 'e.pdf'))).rejects.toThrow()
    // c.doc 不需要复制
    await expect(stat(join(path1Root, 'c.doc'))).rejects.toThrow()
    // missing 不产生文件
    await expect(stat(join(path1Root, 'missing.pdf'))).rejects.toThrow()

    // ---- 输出 Excel ----
    const outExists = await stat(join(path1Root, '文件内容全文.xlsx'))
    expect(outExists.isFile()).toBe(true)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await readFile(join(path1Root, '文件内容全文.xlsx')))
    const ws = wb.getWorksheet('文件内容全文')!
    // 表头 + 5 行：a.pdf、b.docx、c.doc、sub/e.pdf、missing.pdf（不含 d.txt）
    expect(ws.rowCount).toBe(6)

    const contentByName = new Map<string, string>()
    for (let r = 2; r <= ws.rowCount; r++) {
      contentByName.set(ws.getRow(r).getCell(1).value as string, ws.getRow(r).getCell(2).value as string)
    }
    expect([...contentByName.keys()].sort()).toEqual([
      'a.pdf',
      'b.docx',
      'c.doc',
      'missing.pdf',
      'sub/e.pdf',
    ])
    expect(contentByName.get('a.pdf')).toContain('Hello PDF World')
    expect(contentByName.get('b.docx')).toContain('中文文档内容 123')
    expect(contentByName.get('c.doc')).toContain('不支持的格式，请另存为 .docx 或 PDF')
    expect(contentByName.get('sub/e.pdf')).toContain('Hello PDF World')
    expect(contentByName.get('missing.pdf')).toBe('路径2中未找到该文件')

    // ---- 进度与行结果 ----
    expect(progress.length).toBe(6)
    expect(progress[5]).toEqual([6, 6])
    expect(rows).toHaveLength(6)
    const missingRow = rows.find((r) => r.fileName === 'missing.pdf')!
    expect(missingRow.copyStatus).toBe('missing')
    expect(missingRow.extractStatus).toBe('missing')
    const docRow = rows.find((r) => r.fileName === 'c.doc')!
    expect(docRow.extractStatus).toBe('unsupported')
    const txtRow = rows.find((r) => r.fileName === 'd.txt')!
    expect(txtRow.copyStatus).toBe('copied')
    expect(txtRow.extractStatus).toBe('pending')

    // ---- 日志 ----
    expect(logs.some((l) => l.message.includes('已复制 a.pdf → 输出目录'))).toBe(true)
    expect(logs.some((l) => l.message.includes('已生成 文件内容全文.xlsx'))).toBe(true)
  })

  it('路径穿越文件名被拒绝且不写入任何文件', async () => {
    const srcBuf = await makeSourceXlsxBytes([['../evil.pdf', 1, 1]])
    await writeFile(join(path1Root, '源2.xlsx'), Buffer.from(srcBuf))

    const parsed = await readSourceExcel(srcBuf, 'evil.xlsx')
    const rows: ResultRow[] = []
    const summary = await runPipeline({
      bridge: nodeBridge,
      outDir: path1Root,
      path2: path2Root,
      excel: parsed,
      onLog: () => {},
      onRow: (row) => rows.push(row),
      onProgress: () => {},
    })
    expect(summary.errors).toBe(1)
    expect(rows[0].note).toBe('非法的文件路径')
    // 路径1 不应产生 evil.pdf（穿越文件）
    const files = (await readdir(path1Root)).sort()
    expect(files.some((f) => f.includes('evil'))).toBe(false)
  })
})
