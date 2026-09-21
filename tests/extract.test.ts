import { describe, it, expect } from 'vitest'
import { extractByExtension, UNSUPPORTED_DOC_NOTE } from '../src/core/extract'
import { makeDocxBytes, makePdfBytes } from './helpers/fixtures'

describe('extractByExtension', () => {
  it('.doc 标记为不支持', async () => {
    const out = await extractByExtension('a.doc', new ArrayBuffer(0))
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.note).toBe(UNSUPPORTED_DOC_NOTE)
  })

  it('未知扩展名标记为不支持', async () => {
    const out = await extractByExtension('a.txt', new ArrayBuffer(0))
    expect(out.ok).toBe(false)
  })

  it('.docx 提取中文文本', async () => {
    const buf = await makeDocxBytes(['中文文档内容 123', 'Second paragraph with English.'])
    const out = await extractByExtension('b.docx', new Uint8Array(buf).buffer)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.text).toContain('中文文档内容 123')
      expect(out.text).toContain('Second paragraph with English.')
    }
  })

  it('.pdf 提取文本', async () => {
    const buf = makePdfBytes()
    const out = await extractByExtension('a.pdf', new Uint8Array(buf).buffer)
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.text).toContain('Hello PDF World')
  })
})
