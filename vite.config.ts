import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    // 避免预构建干扰 pdfjs 的 worker 资源加载
    exclude: ['pdfjs-dist'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
