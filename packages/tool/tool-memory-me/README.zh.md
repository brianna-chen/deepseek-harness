# `@brianna-chen/dsh-tool-memory-me`

[English](README.md) | 中文

面向模型的 `memory_me` 工具，用于管理 Codex、Claude Code 与 DeepSeek Harness 记忆。它在 Host 所有的 Memory ME 安全边界之上提供发现、无写入预览、确认导入、历史、导出和确认回滚。浏览器文件与目录选择位于 Settings → Memory ME。

## 模型体验

### 工具 schema

#### 模型看到的内容

生成的 [`memory_me` schema](../../../docs/tool-catalog.md#brianna-chendsh-tool-memory-me)。它要求模型预览确切差异，并在导入或回滚前取得明确批准；历史与导出保持只读。

#### Token 影响

工具可见时，每次请求承担一个固定 schema 成本。调用与结果会保留在对话历史中，直到压缩。

#### KV Cache 影响

只要 schema 与工具可见性不变，请求前缀即可稳定复用。
