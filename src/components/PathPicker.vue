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
  <div class="path-row">
    <span class="path-label">{{ label }}</span>
    <button type="button" @click="pick">
      {{ modelValue ? '重新选择' : buttonText }}
    </button>
    <span class="path-value" :class="{ empty: !modelValue }">
      {{ modelValue ? modelValue.name : '未选择（刷新后需重新选择）' }}
    </span>
  </div>
</template>

<style scoped>
.path-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.path-label {
  width: 150px;
  flex-shrink: 0;
  font-weight: 600;
}
.path-value {
  color: var(--text-muted);
  word-break: break-all;
}
.path-value.empty {
  color: var(--warn);
}
</style>
