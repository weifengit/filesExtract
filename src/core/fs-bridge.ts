/**
 * 文件系统抽象：core 层只依赖此接口（路径字符串），
 * 生产环境由 tauri-fs.ts（Tauri 插件）实现，测试由 node:fs 实现。
 */
export interface FsBridge {
  /** 递归列出目录下所有文件，返回相对路径（/ 分隔，含子目录前缀） */
  listFiles(dir: string): Promise<string[]>
  /** 读取文件字节 */
  readFile(path: string): Promise<Uint8Array>
  /** 复制文件，自动创建目标父目录，覆盖已有文件 */
  copyFile(src: string, dest: string): Promise<void>
  /** 写入文件，自动创建父目录，覆盖已有文件 */
  writeFile(path: string, data: Uint8Array): Promise<void>
}

/**
 * 拼接 基础目录 + 相对路径（/ 分隔）。
 * Windows 的 std::fs 接受正斜杠，无需按平台转换分隔符。
 */
export function joinPath(base: string, rel: string): string {
  return `${base.replace(/[/\\]+$/, '')}/${rel.replace(/^[/\\]+/, '')}`
}
