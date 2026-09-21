# filesExtract · 文件提取工具

根据 Excel 字段批量处理文件的小工具：把「需要的文件」对应的文件复制到目标目录，
并把「提取文件内容」对应的 PDF / docx 打开、提取全文，生成新的 Excel。

技术路线：**Vue 3 + Vite + TypeScript**（纯浏览器端，File System Access API），后期可用 Tauri 打包分发。

## 需求

- **路径1**：Excel 所在目录（同时也是输出目录）
- **路径2**：文件所在文件夹
- 源 Excel 包含字段 **【文件名、需要的文件、提取文件内容】**：
  - `文件名`：路径2 中的文件（可能是全部，也可能是部分）
  - `需要的文件`：1 或 0（1 = 需要）
  - `提取文件内容`：1 或 0（1 = 需要）
- `需要的文件` = 1 → 将对应文件从路径2 复制到路径1（保留相对子目录）
- `提取文件内容` = 1 → 打开该文件，获取全部文本内容（支持 PDF、docx）
- 生成新 Excel `文件内容全文.xlsx`（列：**文件名、文件内容全文**），放在路径1 下
  - 仅包含「提取文件内容 = 1」的行；内容无法提取时（如老版 `.doc`）写入提示文案

## 运行

```bash
pnpm install
pnpm dev          # 启动开发服务器
```

用 **Edge 或 Chrome** 打开 `http://localhost:5173`（File System Access API 需要安全上下文，不能用 `file://` 直接打开）。

## 使用步骤

1. 选择 **路径1**（Excel 所在目录，即输出目录）
2. 选择 **路径2**（文件所在文件夹）
3. 选择并**读取源 Excel**（自动检测路径1 下的 .xlsx，列顺序不限，按表头名识别）
4. 点击**开始处理**，观察进度与日志
5. 到路径1 查看复制的文件与 `文件内容全文.xlsx`（也可在页面直接下载）

> 每次刷新页面需重新选择两个目录（浏览器授权仅存在于当前会话）。

## 开发

```bash
pnpm build        # 类型检查 + 生产构建（输出到 dist/）
pnpm preview      # 预览生产构建
pnpm test         # 运行测试（vitest，覆盖 Excel 解析/复制/PDF/docx 提取/整链路）
```

## 技术要点

- **Excel 读写**：exceljs（仅支持 .xlsx；遇到 .xls 会提示先另存为 .xlsx）
- **PDF 提取**：pdfjs-dist（worker 按需加载）
- **docx 提取**：mammoth 浏览器构建（`mammoth/mammoth.browser`）
- **文件复制**：File System Access API，流式 `pipeTo` 复制（不整文件读入内存），支持相对子目录
- **安全性**：Excel 中的文件名视为不可信输入，会拒绝绝对路径 / `..` 穿越路径

## 已知限制

- 仅 Chromium 内核浏览器（Chrome / Edge）支持
- 老版 `.doc`（Word 97-2003 二进制）无法在浏览器解析，会标记「不支持的格式，请另存为 .docx 或 PDF」
- 扫描版 PDF 无文本层，提取为空文本并给出提示
- 需 `http://localhost` 或 `https` 环境运行
