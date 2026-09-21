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
 * 递归遍历目录，建立 归一化相对路径 -> 文件句柄 的索引。
 * 子目录中的文件以 `sub/file.pdf` 形式入索引。
 */
export async function buildFileIndex(
  root: FileSystemDirectoryHandle,
  basePath = '',
): Promise<Map<string, FileSystemFileHandle>> {
  const index = new Map<string, FileSystemFileHandle>()
  for await (const [name, handle] of root.entries()) {
    if (handle.kind === 'file') {
      index.set(normalizeRelPath(basePath + name), handle)
    } else if (handle.kind === 'directory') {
      const sub = await buildFileIndex(handle, basePath + name + '/')
      for (const [k, v] of sub) index.set(k, v)
    }
  }
  return index
}

const EXT_FALLBACKS = ['.pdf', '.docx', '.doc']

export interface ResolvedFile {
  handle: FileSystemFileHandle
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
  index: Map<string, FileSystemFileHandle>,
): ResolvedFile | null {
  const key = normalizeRelPath(relPath)
  const direct = index.get(key)
  if (direct) return { handle: direct, key }

  if (!key.includes('.')) {
    for (const ext of EXT_FALLBACKS) {
      const hit = index.get(key + ext)
      if (hit) return { handle: hit, key: key + ext }
    }
  }
  return null
}

/** 在目录下逐段创建子目录，返回最终子目录句柄 */
export async function createParentDirs(
  dir: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = dir
  for (const seg of segments) {
    current = await current.getDirectoryHandle(seg, { create: true })
  }
  return current
}

/**
 * 将文件从路径2 复制到目标目录（含相对子目录）。
 * 使用流式 pipeTo，避免整文件读入内存；createWritable 默认截断覆盖旧文件。
 */
export async function copyFileToDir(
  srcHandle: FileSystemFileHandle,
  destDir: FileSystemDirectoryHandle,
  relPath: string,
): Promise<void> {
  const parts = relPath.split('/').filter((s) => s.length > 0)
  const fileName = parts[parts.length - 1]
  const dirSegments = parts.slice(0, -1)

  const parent = await createParentDirs(destDir, dirSegments)
  const destHandle = await parent.getFileHandle(fileName, { create: true })
  const writable = await destHandle.createWritable()
  const srcFile = await srcHandle.getFile()
  try {
    await srcFile.stream().pipeTo(writable)
  } catch (e) {
    try {
      await writable.abort()
    } catch {
      /* 忽略二次错误 */
    }
    throw e
  }
}
