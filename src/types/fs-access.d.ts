// TS 5.6 的 lib.dom 未包含 File System Access API 的完整类型，这里补齐
interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  >
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
  keys(): AsyncIterableIterator<string>
  [Symbol.asyncIterator](): AsyncIterableIterator<
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  >
}

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: string | FileSystemHandle
}

interface Window {
  showDirectoryPicker(
    options?: DirectoryPickerOptions,
  ): Promise<FileSystemDirectoryHandle>
  showOpenFilePicker(
    options?: OpenFilePickerOptions,
  ): Promise<FileSystemFileHandle[]>
}

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface OpenFilePickerOptions {
  id?: string
  multiple?: boolean
  types?: FilePickerAcceptType[]
  excludeAcceptAllOption?: boolean
  startIn?: string | FileSystemHandle
}
