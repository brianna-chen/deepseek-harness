# `@deepseek-ai/dsh-come-here`

English | [中文](README.zh.md)

Installable ComeHere bundle for migrating portable Codex and Claude Code memory into DeepSeek Harness. Its patch mounts the Host safety service, the model-facing `come_here_memory` tool, and the Settings → ComeHere graphical wizard.

Install it into a Web profile with:

```sh
dsh plugin --profile web add @deepseek-ai/dsh-come-here
dsh --profile web --dump-config
dsh --profile web
```

## Model Experience

Indirectly, through the bundled `@deepseek-ai/dsh-tool-come-here`, which owns the `come_here_memory` schema and confirmation contract.

#### KV Cache effect

The bundle itself adds no tokens; the mounted tool package documents its stable schema cost.
