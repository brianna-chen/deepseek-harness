# `@deepseek-ai/dsh-come-here`

[English](README.md) | 中文

用于将 Codex 与 Claude Code 可移植记忆迁移到 DeepSeek Harness 的可安装 ComeHere 组合包。其 patch 会挂载 Host 安全服务、面向模型的 `come_here_memory` 工具，以及 Settings → ComeHere 图形向导。

安装到 Web profile：

```sh
dsh plugin --profile web add @deepseek-ai/dsh-come-here
dsh --profile web --dump-config
dsh --profile web
```

## 模型体验

间接影响，来自 bundle 挂载的 `@deepseek-ai/dsh-tool-come-here`；该包拥有 `come_here_memory` schema 与确认契约。

#### KV Cache 影响

Bundle 本身不增加 token；挂载的工具包记录其稳定 schema 成本。
