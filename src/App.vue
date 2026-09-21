<script setup lang="ts">
import { computed, ref } from 'vue'
import PathPicker from './components/PathPicker.vue'
import ExcelSelector from './components/ExcelSelector.vue'
import ResultTable from './components/ResultTable.vue'
import LogPanel from './components/LogPanel.vue'
import {
  buildOutputWorkbook,
  findSourceExcel,
  readSourceExcel,
} from './core/excel'
import { runPipeline } from './core/pipeline'
import type {
  ExcelCandidate,
} from './core/excel'
import type {
  LogLevel,
  LogLine,
  ParsedExcel,
  PipelineSummary,
  ResultRow,
} from './types'

const path1 = ref<FileSystemDirectoryHandle | null>(null)
const path2 = ref<FileSystemDirectoryHandle | null>(null)

const excelCandidates = ref<ExcelCandidate[]>([])
const selectedExcel = ref('')
const parsed = ref<ParsedExcel | null>(null)
const excelLoading = ref(false)

const rows = ref<ResultRow[]>([])
const logs = ref<LogLine[]>([])
const running = ref(false)
const progress = ref({ done: 0, total: 0 })
const summary = ref<PipelineSummary | null>(null)
const outputBlob = ref<Blob | null>(null)

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

async function pickPath1(handle: FileSystemDirectoryHandle | null) {
  path1.value = handle
  excelCandidates.value = []
  selectedExcel.value = ''
  parsed.value = null
  if (!handle) return
  try {
    excelCandidates.value = await findSourceExcel(handle)
    const first = excelCandidates.value.find((c) => !c.isXls)
    if (first) {
      selectedExcel.value = first.name
      addLog('info', `路径1 中找到源 Excel：${first.name}`)
    } else if (excelCandidates.value.length > 0) {
      addLog('warn', '路径1 中只有 .xls 文件，请先另存为 .xlsx')
    } else {
      addLog('warn', '路径1 中未找到 .xlsx 源文件')
    }
  } catch (e) {
    logError(e, '扫描路径1 失败')
  }
}

async function loadExcel(name: string) {
  selectedExcel.value = name
  if (!path1.value || !name) return
  excelLoading.value = true
  try {
    const handle = excelCandidates.value.find((c) => c.name === name)?.handle
    if (!handle) throw new Error('未找到该 Excel 文件句柄')
    parsed.value = await readSourceExcel(handle, name)
    addLog(
      'info',
      `已读取 ${name}：表头位于第 ${parsed.value.headerRow} 行，共 ${parsed.value.rows.length} 行数据`,
    )
  } catch (e) {
    parsed.value = null
    logError(e, `读取 ${name} 失败`)
  } finally {
    excelLoading.value = false
  }
}

async function pickPath2(handle: FileSystemDirectoryHandle | null) {
  path2.value = handle
}

async function run() {
  if (running.value) return
  if (!path1.value || !path2.value) {
    alert('请先选择 路径1 和 路径2')
    return
  }
  if (!parsed.value) {
    alert('请先加载源 Excel')
    return
  }

  running.value = true
  rows.value = []
  summary.value = null
  outputBlob.value = null
  progress.value = { done: 0, total: parsed.value.rows.length }
  addLog('info', '========== 开始处理 ==========')

  try {
    summary.value = await runPipeline({
      path1: path1.value,
      path2: path2.value,
      excel: parsed.value,
      onLog: addLog,
      onRow: (row) => rows.value.push(row),
      onProgress: (done, total) => (progress.value = { done, total }),
    })
    addLog('info', '========== 处理完成 ==========')

    // 生成可下载的输出 Excel（兜底，页面里可直接下载）
    if (parsed.value.rows.some((r) => r.extract === 1)) {
      const wb = buildOutputWorkbook(rows.value)
      const buffer = await wb.xlsx.writeBuffer()
      outputBlob.value = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    }
  } catch (e) {
    logError(e, '处理中断')
  } finally {
    running.value = false
  }
}

function downloadOutput() {
  if (!outputBlob.value) return
  const url = URL.createObjectURL(outputBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = outputName
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <header>
    <h1>filesExtract · 文件提取工具</h1>
    <p class="subtitle">
      根据 Excel 中的【文件名 / 需要的文件 / 提取文件内容】批量复制文件并提取全文，生成
      「{{ outputName }}」
    </p>
  </header>

  <section class="card">
    <h2>① 选择目录</h2>
    <PathPicker
      label="路径1 · Excel 所在目录（输出位置）"
      button-text="选择路径1"
      :model-value="path1"
      @update:model-value="pickPath1"
    />
    <PathPicker
      label="路径2 · 文件所在文件夹"
      button-text="选择路径2"
      :model-value="path2"
      @update:model-value="pickPath2"
    />
  </section>

  <section v-if="path1" class="card">
    <h2>② 加载源 Excel</h2>
    <ExcelSelector
      v-if="excelCandidates.some((c) => !c.isXls)"
      :candidates="excelCandidates"
      :model-value="selectedExcel"
      @update:model-value="loadExcel"
    />
    <p v-else-if="excelCandidates.length === 0" class="muted-text">
      路径1 中未找到 .xlsx 文件，请确认。
    </p>
    <p v-else class="muted-text">
      路径1 中只有 .xls 文件（不支持解析），请先另存为 .xlsx。
    </p>
    <button
      class="primary"
      :disabled="!selectedExcel || excelLoading"
      @click="loadExcel(selectedExcel)"
    >
      {{ excelLoading ? '读取中…' : hasExcel ? '重新读取' : '读取 Excel' }}
    </button>
    <p v-if="hasExcel" class="ok-text">
      已就绪：{{ parsed?.sourceName }}（{{ parsed?.rows.length }} 行）
    </p>
  </section>

  <section class="card">
    <h2>③ 开始处理</h2>
    <div class="run-row">
      <button
        class="primary"
        :disabled="running || !path1 || !path2 || !hasExcel"
        @click="run"
      >
        {{ running ? '处理中…' : '开始处理' }}
      </button>
      <button
        v-if="outputBlob"
        type="button"
        @click="downloadOutput"
      >
        下载 {{ outputName }}
      </button>
    </div>
    <div v-if="running || progress.total > 0" class="progress">
      <div class="bar">
        <div
          class="bar-inner"
          :style="{ width: progress.total ? (progress.done / progress.total) * 100 + '%' : '0%' }"
        />
      </div>
      <span class="progress-text">{{ progress.done }} / {{ progress.total }}</span>
    </div>
    <div v-if="summary" class="summary">
      完成：共 {{ summary.total }} 行 · 复制成功 {{ summary.copied }} · 提取成功
      {{ summary.extracted }} · 文件缺失 {{ summary.missing }} · 不支持
      {{ summary.unsupported }} · 出错 {{ summary.errors }}
    </div>
  </section>

  <section v-if="rows.length" class="card">
    <h2>④ 处理结果</h2>
    <ResultTable :rows="rows" />
  </section>

  <section class="card">
    <h2>运行日志</h2>
    <LogPanel :logs="logs" />
  </section>
</template>

<style scoped>
.muted-text {
  color: var(--text-muted);
}
.ok-text {
  color: var(--ok);
  margin: 8px 0 0;
}
.run-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.bar {
  flex: 1;
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
  font-size: 13px;
  color: var(--text-muted);
  min-width: 70px;
  text-align: right;
}
.summary {
  margin-top: 12px;
  font-size: 13.5px;
  color: var(--text);
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 8px 12px;
}
</style>
