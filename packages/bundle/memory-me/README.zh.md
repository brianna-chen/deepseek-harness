# `@brianna-chen/dsh-memory-me`

[English](README.md) | 中文

Memory ME 0.2 可安装组合包，用于把 Codex 与 Claude Code 可移植记忆迁移到 DeepSeek Harness，并再次导出 Harness 记忆。其 patch 会挂载 Host 安全服务、面向模型的 `memory_me` 工具，以及 Settings → Memory ME 图形中心。

安装到 Web profile：

```sh
dsh plugin --profile web add @brianna-chen/dsh-memory-me
dsh --profile web --dump-config
dsh --profile web
```

## 模型体验

间接影响，来自 bundle 挂载的 `@brianna-chen/dsh-tool-memory-me`；该包拥有 `memory_me` schema 与确认契约。

#### KV Cache 影响

Bundle 本身不增加 token；挂载的工具包记录其稳定 schema 成本。
