# `@deepseek-ai/dsh-tool-come-here`

[English](README.md) | 中文

面向模型的 `come_here_memory` 工具，用于服务端 Codex 与 Claude Code 记忆迁移。它在 Host 所有的 ComeHere 安全边界之上提供来源发现、无写入预览和明确确认后的只创建导入。浏览器上传仍位于 Settings → ComeHere。

## 模型体验

### 工具 schema

#### 模型看到的内容

生成的 [`come_here_memory` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-come-here)。它要求模型先发现候选项，预览确切选择，向用户展示计划，并取得明确批准后再导入。

#### Token 影响

工具可见时，每次请求承担一个固定 schema 成本。调用与结果会保留在对话历史中，直到压缩。

#### KV Cache 影响

只要 schema 与工具可见性不变，请求前缀即可稳定复用。
