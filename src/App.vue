<script setup lang="ts">
import { computed, ref } from 'vue'
import { save } from '@tauri-apps/plugin-dialog'
import PathPicker from './components/PathPicker.vue'
import ResultTable from './components/ResultTable.vue'
import LogPanel from './components/LogPanel.vue'
import { readSourceExcel } from './core/excel'
import { runPipeline } from './core/pipeline'
import { tauriFs } from './core/tauri-fs'
import type {
  LogLevel,
  LogLine,
  ParsedExcel,
  PipelineSummary,
  ResultRow,
} from './types'

// TODO: 换成你自己的 GitHub 页面地址
const GITHUB_URL = 'https://github.com/YOUR_NAME/filesExtract'

/** 是否运行在 Tauri 桌面环境（浏览器打开时插件 IPC 不可用，文件功能全部失效） */
const isTauri = '__TAURI_INTERNALS__' in window

// 路径1 = 源 Excel 文件；路径2 = 文件所在文件夹；输出目录 = 复制文件与结果 Excel 写入处
const path1 = ref('')
const path2 = ref('')
const outDir = ref('')

const parsed = ref<ParsedExcel | null>(null)

const rows = ref<ResultRow[]>([])
const logs = ref<LogLine[]>([])
const running = ref(false)
const progress = ref({ done: 0, total: 0 })
const summary = ref<PipelineSummary | null>(null)

const hasExcel = computed(() => parsed.value !== null)
const outputName = '文件内容全文.xlsx'

function now() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function addLog(level: LogLevel, message: string) {
  logs.value.push({ level, time: now(), message })
}

function logError(e: unknown, prefix: string) {
  const msg = e instanceof Error ? e.message : String(e)
  addLog('error', `${prefix}：${msg}`)
}

function fileNameOf(p: string) {
  return p.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? p
}

async function pickPath1(path: string) {
  path1.value = path
  parsed.value = null
  if (path) await loadExcel(path)
}

async function loadExcel(path: string) {
  const name = fileNameOf(path)
  if (/\.xls$/i.test(name)) {
    addLog('warn', `${name} 为旧版 .xls 格式，无法解析，请另存为 .xlsx`)
    return
  }
  try {
    const bytes = await tauriFs.readFile(path)
    parsed.value = await readSourceExcel(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      name,
    )
    addLog(
      'info',
      `已读取 ${name}：表头位于第 ${parsed.value.headerRow} 行，共 ${parsed.value.rows.length} 行数据`,
    )
  } catch (e) {
    parsed.value = null
    logError(e, `读取 ${name} 失败`)
  }
}

async function run() {
  if (running.value) return
  if (!path1.value || !path2.value || !outDir.value) {
    alert('请先选择 路径1（Excel 文件）、路径2 和 输出目录')
    return
  }
  if (!parsed.value) {
    alert('源 Excel 未成功读取，请查看日志后重新选择')
    return
  }

  running.value = true
  rows.value = []
  summary.value = null
  progress.value = { done: 0, total: parsed.value.rows.length }
  addLog('info', '========== 开始处理 ==========')

  try {
    summary.value = await runPipeline({
      bridge: tauriFs,
      outDir: outDir.value,
      path2: path2.value,
      excel: parsed.value,
      onLog: addLog,
      onRow: (row) => rows.value.push(row),
      onProgress: (done, total) => (progress.value = { done, total }),
    })
    addLog('info', `========== 处理完成，结果已写入 ${outDir.value} ==========`)
  } catch (e) {
    logError(e, '处理中断')
  } finally {
    running.value = false
  }
}

// 示例 Excel 模板随应用打包（public/示例.xlsx → dist/ → Tauri 资源），
// 通过保存对话框让用户选择存放位置，保存后提示完整路径
async function downloadExample() {
  try {
    const dest = await save({
      defaultPath: '示例.xlsx',
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
    })
    if (!dest) return
    const res = await fetch(`${import.meta.env.BASE_URL}示例.xlsx`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await tauriFs.writeFile(dest, new Uint8Array(await res.arrayBuffer()))
    addLog('info', `示例模板已保存到：${dest}`)
  } catch (e) {
    logError(e, '保存示例模板失败')
  }
}
</script>

<template>
  <header class="header">
    <h1>filesExtract</h1>
    <span class="subtitle">
      按 Excel 清单批量复制文件并提取全文，结果写入输出目录
    </span>
    <button type="button" class="link-btn" @click="downloadExample">
      下载示例 Excel
    </button>
  </header>

  <p v-if="!isTauri" class="env-warn">
    当前在浏览器中运行，文件功能不可用。请使用 pnpm tauri dev 或安装后的桌面版 exe 打开。
  </p>

  <section class="card">
    <PathPicker
      kind="file"
      label="路径1 · Excel"
      button-text="选择文件"
      :model-value="path1"
      @update:model-value="pickPath1"
    />
    <PathPicker
      label="路径2 · 文件夹"
      button-text="选择目录"
      :model-value="path2"
      @update:model-value="path2 = $event"
    />
    <PathPicker
      label="输出目录"
      button-text="选择目录"
      :model-value="outDir"
      @update:model-value="outDir = $event"
    />
  </section>

  <section class="card run-card">
    <button
      class="primary"
      :disabled="running || !path1 || !path2 || !outDir || !hasExcel"
      @click="run"
    >
      {{ running ? '处理中…' : '开始处理' }}
    </button>
    <template v-if="running || progress.total > 0">
      <div class="bar">
        <div
          class="bar-inner"
          :style="{ width: progress.total ? (progress.done / progress.total) * 100 + '%' : '0%' }"
        />
      </div>
      <span class="progress-text">{{ progress.done }} / {{ progress.total }}</span>
    </template>
    <span v-if="summary" class="summary">
      共 {{ summary.total }} 行 · 复制 {{ summary.copied }} · 提取
      {{ summary.extracted }} · 缺失 {{ summary.missing }} · 不支持
      {{ summary.unsupported }} · 出错 {{ summary.errors }}
    </span>
  </section>

  <section v-if="rows.length" class="card result-card">
    <ResultTable :rows="rows" />
  </section>

  <section class="card log-card">
    <LogPanel :logs="logs" />
  </section>

  <footer class="footer">
    <span>filesExtract v0.1.0 · {{ outputName }}</span>
    <a :href="GITHUB_URL" target="_blank" rel="noopener">有问题请联系作者 →</a>
  </footer>
</template>

<style scoped>
.header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}
.header h1 {
  margin: 0;
}
.subtitle {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 12.5px;
}
.link-btn {
  flex: none;
  background: none;
  border: none;
  padding: 2px 4px;
  color: var(--primary);
  font-size: 12.5px;
  cursor: pointer;
  text-decoration: underline;
}
.link-btn:hover {
  opacity: 0.85;
}

.env-warn {
  margin: 0 0 8px;
  padding: 6px 10px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  color: #92400e;
  font-size: 12.5px;
}

.run-card {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.bar {
  flex: 1;
  min-width: 120px;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}
.bar-inner {
  height: 100%;
  background: var(--primary);
  border-radius: 4px;
  transition: width 0.15s ease;
}
.progress-text {
  font-size: 12.5px;
  color: var(--text-muted);
  min-width: 60px;
  text-align: right;
}
.summary {
  font-size: 12.5px;
  color: var(--text-muted);
}

.result-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.log-card {
  flex: 1;
  min-height: 80px;
  display: flex;
  flex-direction: column;
}
.result-card + .log-card {
  flex: none;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 12px;
}
.footer a {
  color: var(--primary);
  text-decoration: none;
}
.footer a:hover {
  text-decoration: underline;
}
</style>
