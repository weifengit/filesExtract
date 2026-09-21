import {
  buildOutputWorkbook,
  saveWorkbookToDir,
} from './excel'
import {
  buildFileIndex,
  copyFileToDir,
  resolveInIndex,
  sanitizeRelPath,
} from './files'
import { extractByExtension } from './extract'
import type {
  LogLevel,
  ParsedExcel,
  PipelineSummary,
  ResultRow,
} from '../types'

export interface RunOptions {
  path1: FileSystemDirectoryHandle
  path2: FileSystemDirectoryHandle
  excel: ParsedExcel
  onLog: (level: LogLevel, message: string) => void
  onRow: (row: ResultRow) => void
  onProgress: (done: number, total: number) => void
}

/** 让出执行权，保证浏览器能重绘进度/日志 */
function yieldToUi() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0))
}

/**
 * 主流程：
 * 1. 构建路径2 文件索引
 * 2. 逐行：需要=1 复制；提取=1 提取全文（串行以限制内存）
 * 3. 有提取行则生成 文件内容全文.xlsx 写入路径1
 */
export async function runPipeline(opts: RunOptions): Promise<PipelineSummary> {
  const results: ResultRow[] = []
  const summary: PipelineSummary = {
    total: opts.excel.rows.length,
    copied: 0,
    extracted: 0,
    missing: 0,
    unsupported: 0,
    errors: 0,
  }

  opts.onLog('info', '正在构建路径2 文件索引…')
  const index = await buildFileIndex(opts.path2)
  opts.onLog('info', `索引构建完成，共 ${index.size} 个文件`)
  await yieldToUi()

  for (let i = 0; i < opts.excel.rows.length; i++) {
    const row = opts.excel.rows[i]
    const result: ResultRow = {
      fileName: row.fileName,
      needed: row.needed,
      extract: row.extract,
      copyStatus: 'pending',
      extractStatus: 'pending',
      note: '',
    }

    /** 记录本行结果并让出 UI */
    const emitRow = async () => {
      results.push(result)
      opts.onRow(result)
      opts.onProgress(i + 1, summary.total)
      await yieldToUi()
    }

    const rel = sanitizeRelPath(row.fileName)
    if (!rel) {
      result.copyStatus = row.needed ? 'error' : 'pending'
      result.extractStatus = row.extract ? 'error' : 'pending'
      result.note = '非法的文件路径'
      summary.errors++
      await emitRow()
      continue
    }

    const resolved = resolveInIndex(rel, index)
    if (!resolved) {
      result.copyStatus = row.needed ? 'missing' : 'pending'
      result.extractStatus = row.extract ? 'missing' : 'pending'
      result.note = '路径2中未找到该文件'
      summary.missing++
      await emitRow()
      continue
    }

    // 需要=1：复制到路径1（含相对子目录）
    if (row.needed === 1) {
      try {
        await copyFileToDir(resolved.handle, opts.path1, resolved.key)
        result.copyStatus = 'copied'
        result.note = '已复制'
        summary.copied++
        opts.onLog('info', `已复制 ${resolved.key} → 路径1`)
      } catch (e) {
        result.copyStatus = 'error'
        result.note = describeError(e)
        summary.errors++
        opts.onLog('error', `复制 ${resolved.key} 失败：${result.note}`)
      }
    }

    // 提取=1：读取并解析全文
    if (row.extract === 1) {
      try {
        const file = await resolved.handle.getFile()
        const buf = await file.arrayBuffer()
        const out = await extractByExtension(resolved.key, buf)
        if (out.ok) {
          result.extractStatus = 'ok'
          result.content = out.text
          summary.extracted++
          if (out.text.trim()) {
            opts.onLog(
              'info',
              `提取 ${resolved.key} 全文成功（${out.text.length} 字符）`,
            )
          } else {
            opts.onLog(
              'warn',
              `${resolved.key} 未提取到文本，可能为扫描件（无文本层）`,
            )
          }
        } else {
          result.extractStatus = 'unsupported'
          result.note = out.note
          summary.unsupported++
          opts.onLog('warn', `跳过 ${resolved.key}：${out.note}`)
        }
      } catch (e) {
        result.extractStatus = 'error'
        result.note = describeError(e)
        summary.errors++
        opts.onLog('error', `提取 ${resolved.key} 失败：${result.note}`)
      }
    }

    await emitRow()
  }

  // 有提取需求才生成输出 Excel
  if (opts.excel.rows.some((r) => r.extract === 1)) {
    opts.onLog('info', '正在生成 文件内容全文.xlsx…')
    await saveWorkbookToDir(buildOutputWorkbook(results), opts.path1)
    opts.onLog('info', '已生成 文件内容全文.xlsx')
  }

  return summary
}

/** 将异常转成面向用户的中文描述 */
function describeError(e: unknown): string {
  if (e instanceof DOMException) {
    switch (e.name) {
      case 'NotAllowedError':
        return '文件被占用或没有写入权限'
      case 'NotFoundError':
        return '文件不存在'
      case 'QuotaExceededError':
        return '磁盘空间不足'
      case 'InvalidCharacterError':
        return '文件名包含非法字符'
      default:
        return `${e.name}`
    }
  }
  const msg = e instanceof Error ? e.message : String(e)
  return msg || '未知错误'
}
