/** 需要的文件 / 提取文件内容 的取值：1=需要，0=不需要 */
export type Flag = 0 | 1

export type CopyStatus = 'pending' | 'copied' | 'missing' | 'error'
export type ExtractStatus =
  | 'pending'
  | 'ok'
  | 'unsupported'
  | 'missing'
  | 'error'

/** 源 Excel 中的一行 */
export interface FieldRow {
  /** 原始文件名（可能含相对子路径，也可能不带扩展名） */
  fileName: string
  needed: Flag
  extract: Flag
}

/** 解析后的源 Excel */
export interface ParsedExcel {
  /** 来源工作簿文件名 */
  sourceName: string
  sheetName: string
  headerRow: number
  rows: FieldRow[]
}

/** 处理过程中的一行结果 */
export interface ResultRow {
  fileName: string
  needed: Flag
  extract: Flag
  copyStatus: CopyStatus
  extractStatus: ExtractStatus
  /** 面向用户的中文说明（缺失 / 不支持 / 错误详情等） */
  note: string
  /** 提取到的全文（仅 extractStatus === 'ok' 时存在） */
  content?: string
}

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogLine {
  level: LogLevel
  time: string
  message: string
}

export interface PipelineSummary {
  total: number
  copied: number
  extracted: number
  missing: number
  unsupported: number
  errors: number
}
