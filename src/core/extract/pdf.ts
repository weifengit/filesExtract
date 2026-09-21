import * as pdfjsLib from 'pdfjs-dist'
// Vite 下通过 ?url 拿到 worker 资源地址，交给 pdfjs 加载（模块 worker）
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let workerReady = false

function ensurePdfWorker() {
  if (workerReady) return
  // 仅在真实浏览器（存在 window）中配置 worker；
  // Node 测试环境下 workerSrc 不设置，pdfjs 自动回退到进程内 fake worker。
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  }
  workerReady = true
}

/** 从 PDF 提取全文：逐页取 textContent 拼接，及时释放文档 */
export async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  ensurePdfWorker()
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  }).promise
  try {
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      try {
        const content = await page.getTextContent()
        const text = content.items
          .map((it) => ('str' in it ? it.str : ''))
          .join(' ')
        pages.push(text)
      } finally {
        page.cleanup()
      }
    }
    return pages.join('\n')
  } finally {
    await doc.destroy()
  }
}
