<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { LogLine } from '../types'

const props = defineProps<{
  logs: LogLine[]
}>()

const box = ref<HTMLElement | null>(null)

watch(
  () => props.logs.length,
  async () => {
    await nextTick()
    if (box.value) box.value.scrollTop = box.value.scrollHeight
  },
)
</script>

<template>
  <div ref="box" class="log-box">
    <div v-if="logs.length === 0" class="empty">暂无日志</div>
    <div
      v-for="(line, i) in logs"
      :key="i"
      class="log-line"
      :class="line.level"
    >
      <span class="time">{{ line.time }}</span>
      <span class="msg">{{ line.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.log-box {
  background: #111827;
  color: #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12.5px;
  max-height: 260px;
  overflow-y: auto;
  line-height: 1.7;
}
.empty {
  color: #6b7280;
}
.log-line {
  white-space: pre-wrap;
  word-break: break-all;
}
.time {
  color: #9ca3af;
  margin-right: 8px;
}
.log-line.info .msg {
  color: #d1d5db;
}
.log-line.warn .msg {
  color: #fbbf24;
}
.log-line.error .msg {
  color: #f87171;
}
</style>
