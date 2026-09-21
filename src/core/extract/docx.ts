// 使用 mammoth 的浏览器构建（自包含 UMD，支持 { arrayBuffer } 输入）。
// 主入口 lib/index.js 面向 Node（依赖 fs），不适合浏览器/测试环境直接使用。
import mammoth from 'mammoth/mammoth.browser'

/** 从 .docx 提取纯文本（浏览器端用 arrayBuffer 输入） */
export async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}
