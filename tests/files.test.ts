import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildFileIndex,
  copyFileToDir,
  normalizeRelPath,
  resolveInIndex,
  sanitizeRelPath,
} from '../src/core/files'
import { nodeBridge } from './helpers/node-bridge'

describe('normalizeRelPath', () => {
  it('统一分隔符、去空白、转小写', () => {
    expect(normalizeRelPath(' A\\B.PDF ')).toBe('a/b.pdf')
    expect(normalizeRelPath('./x/y.txt')).toBe('x/y.txt')
    expect(normalizeRelPath('sub/')).toBe('sub')
  })
})

describe('sanitizeRelPath', () => {
  it('拒绝绝对路径/盘符/穿越路径', () => {
    expect(sanitizeRelPath('C:\\evil\\a.pdf')).toBeNull()
    expect(sanitizeRelPath('/abs/a.pdf')).toBeNull()
    expect(sanitizeRelPath('a/../b.pdf')).toBeNull()
    expect(sanitizeRelPath('a//b.pdf')).toBeNull()
    expect(sanitizeRelPath('  ')).toBeNull()
  })
  it('接受合法相对路径', () => {
    expect(sanitizeRelPath('a/b.pdf')).toBe('a/b.pdf')
    expect(sanitizeRelPath('a.pdf')).toBe('a.pdf')
  })
})

describe('buildFileIndex / resolveInIndex', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fx-index-'))
    await mkdir(join(root, 'sub'), { recursive: true })
    await writeFile(join(root, 'a.pdf'), 'x')
    await writeFile(join(root, 'b.docx'), 'x')
    await writeFile(join(root, 'sub', 'e.pdf'), 'x')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('递归索引含子目录文件', async () => {
    const index = await buildFileIndex(nodeBridge, root)
    expect([...index.keys()].sort()).toEqual(['a.pdf', 'b.docx', 'sub/e.pdf'])
  })

  it('精确匹配 / 扩展名补试', async () => {
    const index = await buildFileIndex(nodeBridge, root)
    expect(resolveInIndex('a.pdf', index)?.key).toBe('a.pdf')
    // 省略扩展名
    expect(resolveInIndex('a', index)?.key).toBe('a.pdf')
    expect(resolveInIndex('sub/e', index)?.key).toBe('sub/e.pdf')
    // 大小写不敏感（Windows）
    expect(resolveInIndex('A.PDF', index)?.key).toBe('a.pdf')
    expect(resolveInIndex('missing', index)).toBeNull()
  })
})

describe('copyFileToDir', () => {
  it('复制文件到目标目录并保留相对子目录', async () => {
    const srcRoot = await mkdtemp(join(tmpdir(), 'fx-src-'))
    const dstRoot = await mkdtemp(join(tmpdir(), 'fx-dst-'))
    try {
      await mkdir(join(srcRoot, 'sub'), { recursive: true })
      await writeFile(join(srcRoot, 'sub', 'e.pdf'), 'HELLO-CONTENT')

      const srcIndex = await buildFileIndex(nodeBridge, srcRoot)

      await copyFileToDir(nodeBridge, srcIndex.get('sub/e.pdf')!, dstRoot, 'sub/e.pdf')

      const copied = await readFile(join(dstRoot, 'sub', 'e.pdf'), 'utf8')
      expect(copied).toBe('HELLO-CONTENT')
      const s = await stat(join(dstRoot, 'sub', 'e.pdf'))
      expect(s.isFile()).toBe(true)
    } finally {
      await rm(srcRoot, { recursive: true, force: true })
      await rm(dstRoot, { recursive: true, force: true })
    }
  })

  it('再次复制覆盖旧内容', async () => {
    const srcRoot = await mkdtemp(join(tmpdir(), 'fx-src2-'))
    const dstRoot = await mkdtemp(join(tmpdir(), 'fx-dst2-'))
    try {
      await writeFile(join(srcRoot, 'a.txt'), 'NEW')
      await writeFile(join(dstRoot, 'a.txt'), 'OLD')
      const srcIndex = await buildFileIndex(nodeBridge, srcRoot)
      await copyFileToDir(nodeBridge, srcIndex.get('a.txt')!, dstRoot, 'a.txt')
      expect(await readFile(join(dstRoot, 'a.txt'), 'utf8')).toBe('NEW')
    } finally {
      await rm(srcRoot, { recursive: true, force: true })
      await rm(dstRoot, { recursive: true, force: true })
    }
  })
})
