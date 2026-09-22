/** FsBridge 的 Tauri 实现：基于 @tauri-apps/plugin-fs，走原生文件系统（无浏览器权限弹窗） */
import { copyFile, exists, mkdir, readDir, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { joinPath, type FsBridge } from './fs-bridge'

async function ensureParentDir(path: string) {
  const parent = path.replace(/[/\\][^/\\]+$/, '')
  if (parent && !(await exists(parent))) {
    await mkdir(parent, { recursive: true })
  }
}

async function listFilesRecursive(dir: string, base: string, out: string[]) {
  for (const entry of await readDir(dir)) {
    const abs = joinPath(dir, entry.name)
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory) await listFilesRecursive(abs, rel, out)
    else if (entry.isFile) out.push(rel)
  }
}

export const tauriFs: FsBridge = {
  async listFiles(dir) {
    const out: string[] = []
    await listFilesRecursive(dir, '', out)
    return out
  },
  readFile: (path) => readFile(path),
  async copyFile(src, dest) {
    await ensureParentDir(dest)
    await copyFile(src, dest)
  },
  async writeFile(path, data) {
    await ensureParentDir(path)
    await writeFile(path, data)
  },
}
