<script setup lang="ts">
import type { ExcelCandidate } from '../core/excel'

defineProps<{
  candidates: ExcelCandidate[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()
</script>

<template>
  <div class="excel-selector">
    <label for="excel-select">源 Excel：</label>
    <select
      id="excel-select"
      :value="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="c in candidates.filter((c) => !c.isXls)"
        :key="c.name"
        :value="c.name"
      >
        {{ c.name }}
      </option>
    </select>
    <p v-if="candidates.some((c) => c.isXls)" class="warn">
      检测到 .xls 文件，本工具无法解析，请先在 Excel 中另存为 .xlsx 再处理。
    </p>
  </div>
</template>

<style scoped>
.excel-selector {
  margin: 10px 0;
}
.warn {
  color: var(--warn);
  margin: 6px 0 0;
  font-size: 13px;
}
select {
  font: inherit;
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
}
</style>
