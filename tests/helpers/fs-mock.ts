/**
 * 用 Node 真实文件系统模拟 File System Access API 的目录/文件句柄，
 * 使 core/ 下依赖文件句柄的逻辑可以在 vitest（Node 环境）中端到端测试。
 *
 * createWritable() 返回的对象同时具备：
 * - FileSystemWritableFileStream 风格的 write()/close()/abort() 直接方法
 * - 真实 WritableStream 的能力（供 stream().pipeTo() 使用）
 */
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'

function chunkToBuffer(chunk: unknown): Promise<Buffer> {
  if (chunk instanceof Uint8Array) return Promise.resolve(Buffer.from(chunk))
  if (chunk instanceof Blob) return chunk.arrayBuffer().then((b) => Buffer.from(b))
  return Promise.resolve(Buffer.from(String(chunk)))
}

export interface MockWritableStream
  extends WritableStream,
    Pick<FileSystemWritableFileStream, 'write' | 'close' | 'abort'> {}

function makeWritable(path: string): MockWritableStream {
  const chunks: unknown[] = []
  const stream = new WritableStream({
    async write(chunk) {
      chunks.push(chunk)
    },
    async close() {
      const bufs: Buffer[] = []
      for (const c of chunks) bufs.push(await chunkToBuffer(c))
      await writeFile(path, Buffer.concat(bufs))
    },
    async abort() {
      chunks.length = 0
    },
  })
  const getWriter = () => stream.getWriter()
  const streamAny = stream as unknown as MockWritableStream
  streamAny.write = async (chunk) => {
    const w = getWriter()
    await w.write(chunk)
    w.releaseLock()
  }
  streamAny.close = async () => {
    const w = getWriter()
    await w.close()
    w.releaseLock()
  }
  streamAny.abort = async (reason) => {
    const w = getWriter()
    await w.abort(reason)
    w.releaseLock()
  }
  return streamAny
}

export class MockFileHandle {
  readonly kind = 'file'
  constructor(private readonly path: string) {}

  get name(): string {
    return basename(this.path)
  }

  async isSameEntry(): Promise<boolean> {
    return false
  }

  async getFile(): Promise<File> {
    const buf = await readFile(this.path)
    return new File([buf], this.name)
  }

  async createWritable(): Promise<MockWritableStream> {
    return makeWritable(this.path)
  }
}

export class MockDirHandle {
  readonly kind = 'directory'
  constructor(private readonly path: string) {}

  get name(): string {
    return basename(this.path) || this.path
  }

  async isSameEntry(): Promise<boolean> {
    return false
  }

  async *entries(): AsyncIterableIterator<[string, MockFileHandle | MockDirHandle]> {
    const entries = await readdir(this.path, { withFileTypes: true })
    for (const e of entries) {
      const p = join(this.path, e.name)
      yield [e.name, e.isDirectory() ? new MockDirHandle(p) : new MockFileHandle(p)]
    }
  }

  async getFileHandle(
    name: string,
    opts?: { create?: boolean },
  ): Promise<MockFileHandle> {
    const p = join(this.path, name)
    try {
      const s = await stat(p)
      if (!s.isFile()) throw new DOMException('not a file', 'TypeMismatchError')
    } catch (e) {
      if ((e as DOMException)?.name !== 'TypeMismatchError' && !opts?.create) {
        throw new DOMException('not found', 'NotFoundError')
      }
    }
    return new MockFileHandle(p)
  }

  async getDirectoryHandle(
    name: string,
    opts?: { create?: boolean },
  ): Promise<MockDirHandle> {
    const p = join(this.path, name)
    try {
      const s = await stat(p)
      if (!s.isDirectory()) throw new DOMException('not a dir', 'TypeMismatchError')
    } catch (e) {
      if ((e as DOMException)?.name !== 'TypeMismatchError' && !opts?.create) {
        throw new DOMException('not found', 'NotFoundError')
      }
      if (opts?.create) await mkdir(p, { recursive: true })
    }
    return new MockDirHandle(p)
  }

  async removeEntry(): Promise<void> {}
  async resolve(): Promise<string[] | null> {
    return null
  }
}
