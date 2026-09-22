# filesExtract · 文件提取工具

根据 Excel 字段批量处理文件的小工具：把「需要的文件」对应的文件复制到目标目录，
并把「提取文件内容」对应的 PDF / docx 打开、提取全文，生成新的 Excel。

技术路线：**Tauri 2 + Vue 3 + Vite + TypeScript**（Windows 桌面应用，原生文件对话框与文件系统，无浏览器权限弹窗）。

## 需求

- **路径1**：源 Excel 文件（界面直接指定具体 .xlsx，无需扫描目录）
- **路径2**：文件所在文件夹
- **输出目录**：复制的文件与生成的 `文件内容全文.xlsx` 写入位置
- 源 Excel 包含字段 **【文件名、需要的文件、提取文件内容】**：
  - `文件名`：路径2 中的文件（可能是全部，也可能是部分）
  - `需要的文件`：1 或 0（1 = 需要）
  - `提取文件内容`：1 或 0（1 = 需要）
- `需要的文件` = 1 → 将对应文件从路径2 复制到输出目录（保留相对子目录）
- `提取文件内容` = 1 → 打开该文件，获取全部文本内容（支持 PDF、docx）
- 生成新 Excel `文件内容全文.xlsx`（列：**文件名、文件内容全文**），放在输出目录下
  - 仅包含「提取文件内容 = 1」的行；内容无法提取时（如老版 `.doc`）写入提示文案

## 获取与使用

从 GitHub Release 下载 Windows 安装包（exe，NSIS），安装后运行：

1. 选择 **路径1**（源 Excel 文件）——选择后自动读取（列顺序不限，按表头名识别）
2. 选择 **路径2**（文件所在文件夹）
3. 选择 **输出目录**（复制文件与结果 Excel 写入位置）
4. 点击**开始处理**，观察进度与日志
5. 到输出目录查看复制的文件与 `文件内容全文.xlsx`

> 标题栏右侧提供**「下载示例 Excel」**：弹出保存对话框选择存放位置，
> 保存后日志会提示完整路径；按模板编辑后即可作为源 Excel 使用。

## 打包（仅 CI，本地不打包）

push 到 `main` 或打 `v*` 标签即可触发 [.github/workflows/build.yml](.github/workflows/build.yml)：

- 推送 main → 运行测试 + 构建 Windows exe（Actions 页面下载 artifact）
- 打 tag（如 `v0.1.0`）→ 自动创建 GitHub Release 并附带 exe 安装包

## 开发

```bash
pnpm install
pnpm tauri dev    # 本地调试（需本机装有 Rust 工具链）
pnpm build        # 类型检查 + 前端生产构建（输出到 dist/）
pnpm test         # 运行测试（vitest，覆盖 Excel 解析/复制/PDF/docx 提取/整链路）
```

## 技术要点

- **Excel 读写**：exceljs（仅支持 .xlsx；遇到 .xls 会提示先另存为 .xlsx）
- **PDF 提取**：pdfjs-dist（worker 按需加载）
- **docx 提取**：mammoth 浏览器构建（`mammoth/mammoth.browser`）
- **文件操作**：`@tauri-apps/plugin-fs` + `plugin-dialog` 原生接口；core 层通过 `FsBridge` 接口与平台解耦，测试用 node:fs 实现端到端覆盖
- **安全性**：Excel 中的文件名视为不可信输入，会拒绝绝对路径 / `..` 穿越路径

## 已知限制

- 老版 `.doc`（Word 97-2003 二进制）无法解析，会标记「不支持的格式，请另存为 .docx 或 PDF」
- 扫描版 PDF 无文本层，提取为空文本并给出提示
