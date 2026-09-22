/** FsBridge 的测试实现：基于 node:fs 操作真实临时目录 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { FsBridge } from '../../src/core/fs-bridge'

async function listFilesRecursive(dir: string, base: string, out: string[]) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) await listFilesRecursive(join(dir, entry.name), rel, out)
    else if (entry.isFile()) out.push(rel)
  }
}

export const nodeBridge: FsBridge = {
  async listFiles(dir) {
    const out: string[] = []
    await listFilesRecursive(dir, '', out)
    return out
  },
  readFile: (path) => readFile(path),
  async copyFile(src, dest) {
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(src, dest)
  },
  async writeFile(path, data) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, data)
  },
}
