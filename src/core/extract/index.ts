export const UNSUPPORTED_DOC_NOTE = '不支持的格式，请另存为 .docx 或 PDF'

export type ExtractResult =
  | { ok: true; text: string }
  | { ok: false; note: string }

/**
 * 按真实扩展名分发提取逻辑。
 * fileName 应传入索引中实际命中的键（含真实扩展名），
 * 避免 Excel 中省略扩展名导致分发错误。
 *
 * pdf/docx 提取器使用动态导入：pdfjs/mammoth 体积较大，
 * 按需加载可拆分打包，避免首屏加载全部解析库。
 */
export async function extractByExtension(
  fileName: string,
  arrayBuffer: ArrayBuffer,
): Promise<ExtractResult> {
  const dot = fileName.lastIndexOf('.')
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : ''

  switch (ext) {
    case 'pdf': {
      const { extractPdfText } = await import('./pdf')
      return { ok: true, text: await extractPdfText(arrayBuffer) }
    }
    case 'docx': {
      const { extractDocxText } = await import('./docx')
      return { ok: true, text: await extractDocxText(arrayBuffer) }
    }
    case 'doc':
      return { ok: false, note: UNSUPPORTED_DOC_NOTE }
    default:
      return { ok: false, note: `不支持的格式（${ext ? '.' + ext : '未知'}）` }
  }
}
