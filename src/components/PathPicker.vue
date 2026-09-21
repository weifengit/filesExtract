<script setup lang="ts">
type Picked = FileSystemFileHandle | FileSystemDirectoryHandle

const props = withDefaults(
  defineProps<{
    label: string
    buttonText: string
    /** dir=目录选择器（路径2/输出目录）；file=文件选择器（源 Excel） */
    kind?: 'dir' | 'file'
    modelValue: Picked | null
  }>(),
  { kind: 'dir' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: Picked | null): void
}>()

async function pick() {
  // 选择器必须同步在用户手势内调用（前面不能有 await）
  try {
    if (props.kind === 'file') {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Excel 文件',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
                '.xlsx',
                '.xls',
              ],
            },
          },
        ],
      })
      emit('update:modelValue', handle)
    } else {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      emit('update:modelValue', handle)
    }
  } catch (e) {
    if ((e as DOMException)?.name !== 'AbortError') {
      alert(
        `选择${props.kind === 'file' ? '文件' : '目录'}失败：${
          (e as Error)?.message ?? String(e)
        }`,
      )
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
        :title="`已选择${kind === 'file' ? '文件' : '文件夹'}：${modelValue.name}（浏览器安全限制，仅显示名称）`"
      >
        已选择：{{ modelValue.name }}<template v-if="kind === 'dir'">\</template>
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
