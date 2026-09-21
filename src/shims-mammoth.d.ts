// mammoth 的浏览器构建（自包含 UMD，支持 { arrayBuffer } 输入）。
// 主入口 lib/index.js 面向 Node（依赖 fs），仅在浏览器环境下由 Vite 的
// browser 字段映射为浏览器实现；而 mammoth.browser.js 在浏览器与 Node 中
// 都可用，故提取逻辑统一走该入口。此处补类型声明。
declare module 'mammoth/mammoth.browser' {
  interface MammothArrayBufferInput {
    arrayBuffer: ArrayBuffer
  }
  interface MammothResult {
    value: string
    messages: unknown[]
  }
  interface Mammoth {
    extractRawText(input: MammothArrayBufferInput): Promise<MammothResult>
  }
  const mammoth: Mammoth
  export default mammoth
}
