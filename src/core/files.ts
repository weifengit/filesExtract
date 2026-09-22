import { joinPath, type FsBridge } from './fs-bridge'

/** 归一化相对路径：统一分隔符、小写、去前导 ./（Windows 文件系统大小写不敏感） */
export function normalizeRelPath(p: string): string {
  return p
    .trim()
    .replace(/\\/g, '/')
    .toLowerCase()
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
}

/**
 * 校验 Excel 中的文件名是否为安全的相对路径。
 * 拒绝绝对路径、盘符、`..` 段 —— Excel 内容是不可信输入，必须防路径穿越。
 * 返回归一化后的相对路径；非法时返回 null。
 */
export function sanitizeRelPath(raw: string): string | null {
  const p = raw.trim()
  if (!p) return null
  // 绝对路径 / 盘符
  if (/^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\')) {
    return null
  }
  const normalized = normalizeRelPath(p)
  const segments = normalized.split('/')
  if (segments.some((s) => s === '..' || s === '' || s === '.')) return null
  return normalized
}

/**
 * 递归遍历目录，建立 归一化相对路径 -> 绝对路径 的索引。
 * 子目录中的文件以 `sub/file.pdf` 形式入索引。
 */
export async function buildFileIndex(
  bridge: FsBridge,
  dir: string,
): Promise<Map<string, string>> {
  const index = new Map<string, string>()
  for (const rel of await bridge.listFiles(dir)) {
    index.set(normalizeRelPath(rel), joinPath(dir, rel))
  }
  return index
}

const EXT_FALLBACKS = ['.pdf', '.docx', '.doc']

export interface ResolvedFile {
  /** 文件绝对路径 */
  path: string
  /** 索引中的实际键（归一化相对路径，含真实扩展名） */
  key: string
}

/**
 * 在索引中解析文件名：
 * - 优先精确匹配（已归一化）
 * - 若名称不带扩展名，补试常见扩展名
 * 返回实际命中的键，便于后续按真实扩展名分发提取逻辑。
 */
export function resolveInIndex(
  relPath: string,
  index: Map<string, string>,
): ResolvedFile | null {
  const key = normalizeRelPath(relPath)
  const direct = index.get(key)
  if (direct) return { path: direct, key }

  if (!key.includes('.')) {
    for (const ext of EXT_FALLBACKS) {
      const hit = index.get(key + ext)
      if (hit) return { path: hit, key: key + ext }
    }
  }
  return null
}

/** 将文件从路径2 复制到输出目录（含相对子目录），覆盖已有文件 */
export async function copyFileToDir(
  bridge: FsBridge,
  srcPath: string,
  destDir: string,
  relPath: string,
): Promise<void> {
  await bridge.copyFile(srcPath, joinPath(destDir, relPath))
}
