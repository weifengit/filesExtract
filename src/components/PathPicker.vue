<script setup lang="ts">
defineProps<{
  label: string
  buttonText: string
  modelValue: FileSystemDirectoryHandle | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: FileSystemDirectoryHandle | null): void
}>()

async function pick() {
  // showDirectoryPicker 必须同步在用户手势内调用（前面不能有 await）
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
    emit('update:modelValue', handle)
  } catch (e) {
    if ((e as DOMException)?.name !== 'AbortError') {
      alert(`选择目录失败：${(e as Error)?.message ?? String(e)}`)
    }
  }
}
</script>

<template>
  <div class="path-picker">
    <div class="path-label">{{ label }}</div>
    <div class="path-controls">
      <button type="button" class="path-btn" @click="pick">
        {{ modelValue ? '重新选择' : buttonText }}
      </button>
      <span
        v-if="modelValue"
        class="path-value"
        :title="modelValue.name"
      >
        已选择：{{ modelValue.name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.path-picker {
  padding: 10px 0;
}
.path-label {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
}
.path-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
}
.path-btn {
  min-width: 100px;
  text-align: center;
  padding: 7px 16px;
}
.path-value {
  color: var(--text-muted);
  font-size: 13px;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
