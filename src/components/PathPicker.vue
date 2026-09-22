<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'

const props = withDefaults(
  defineProps<{
    label: string
    buttonText: string
    /** dir=目录选择器（路径2/输出目录）；file=文件选择器（源 Excel） */
    kind?: 'dir' | 'file'
    /** 已选路径（完整路径），空串表示未选择 */
    modelValue: string
  }>(),
  { kind: 'dir' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

async function pick() {
  try {
    const selected = await open(
      props.kind === 'file'
        ? {
            multiple: false,
            filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls'] }],
          }
        : { directory: true },
    )
    if (typeof selected === 'string') emit('update:modelValue', selected)
  } catch (e) {
    alert(
      `选择${props.kind === 'file' ? '文件' : '目录'}失败：${
        (e as Error)?.message ?? String(e)
      }`,
    )
  }
}
</script>

<template>
  <div class="path-picker">
    <span class="path-label">{{ label }}</span>
    <button type="button" class="path-btn" @click="pick">
      {{ modelValue ? '重选' : buttonText }}
    </button>
    <span v-if="modelValue" class="path-value" :title="modelValue">
      {{ modelValue }}
    </span>
    <span v-else class="path-placeholder">未选择</span>
  </div>
</template>

<style scoped>
.path-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.path-label {
  flex: none;
  width: 128px;
  font-size: 13px;
  font-weight: 600;
}
.path-btn {
  flex: none;
  min-width: 64px;
  padding: 3px 10px;
  font-size: 13px;
}
.path-value,
.path-placeholder {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
}
.path-value {
  color: var(--text-muted);
}
.path-placeholder {
  color: var(--muted);
}
</style>
