<script setup lang="ts">
import { ref } from 'vue'
import type { CopyStatus, ExtractStatus, ResultRow } from '../types'

defineProps<{
  rows: ResultRow[]
}>()

const expanded = ref<Set<number>>(new Set())

function toggle(i: number) {
  const next = new Set(expanded.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  expanded.value = next
}

function copyText(s: CopyStatus): string {
  return { pending: '—', copied: '已复制', missing: '文件缺失', error: '失败' }[s]
}

function extractText(s: ExtractStatus): string {
  return {
    pending: '—',
    ok: '成功',
    unsupported: '不支持',
    missing: '文件缺失',
    error: '失败',
  }[s]
}

function copyClass(s: CopyStatus): string {
  return { pending: 'muted', copied: 'ok', missing: 'warn', error: 'err' }[s]
}

function extractClass(s: ExtractStatus): string {
  return {
    pending: 'muted',
    ok: 'ok',
    unsupported: 'warn',
    missing: 'warn',
    error: 'err',
  }[s]
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="col-file">文件名</th>
          <th class="col-flag">需要的文件</th>
          <th class="col-flag">提取文件内容</th>
          <th class="col-status">复制状态</th>
          <th class="col-status">提取状态</th>
          <th class="col-note">备注 / 全文</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td class="col-file">{{ row.fileName }}</td>
          <td class="col-flag">{{ row.needed }}</td>
          <td class="col-flag">{{ row.extract }}</td>
          <td class="col-status">
            <span class="chip" :class="copyClass(row.copyStatus)">
              {{ copyText(row.copyStatus) }}
            </span>
          </td>
          <td class="col-status">
            <span class="chip" :class="extractClass(row.extractStatus)">
              {{ extractText(row.extractStatus) }}
            </span>
          </td>
          <td class="col-note">
            <template v-if="row.extractStatus === 'ok' && row.content">
              <div class="content-row">
                <span class="note-text">{{ row.note || '已提取' }}</span>
                <button
                  v-if="row.content.length > 0"
                  class="toggle"
                  type="button"
                  @click="toggle(i)"
                >
                  {{ expanded.has(i) ? '收起' : '展开全文' }}
                </button>
              </div>
              <div v-if="expanded.has(i)" class="content">
                <pre>{{ row.content }}</pre>
              </div>
            </template>
            <span v-else class="note-text">{{ row.note || '—' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  border: 1px solid var(--border);
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f0f3f8;
  font-weight: 600;
  white-space: nowrap;
}
.col-file {
  min-width: 180px;
  word-break: break-all;
}
.col-flag {
  width: 90px;
  text-align: center;
}
.col-status {
  width: 110px;
}
.col-note {
  min-width: 220px;
}
.chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
  white-space: nowrap;
}
.chip.ok {
  background: #dcfce7;
  color: var(--ok);
}
.chip.warn {
  background: #fef3c7;
  color: var(--warn);
}
.chip.err {
  background: #fee2e2;
  color: var(--err);
}
.chip.muted {
  background: #f3f4f6;
  color: var(--muted);
}
.note-text {
  color: var(--text-muted);
  word-break: break-all;
}
.content-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toggle {
  font-size: 12px;
  padding: 1px 8px;
}
.content {
  margin-top: 6px;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
}
.content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 12.5px;
  max-height: 300px;
  overflow-y: auto;
}
</style>
