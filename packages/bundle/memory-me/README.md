# `@brianna-chen/dsh-memory-me`

English | [中文](README.zh.md)

Installable Memory ME 0.2 bundle for moving portable Codex and Claude Code memory into DeepSeek Harness and exporting Harness memory again. Its patch mounts the Host safety service, the model-facing `memory_me` tool, and the Settings → Memory ME graphical center.

Install it into a Web profile with:

```sh
dsh plugin --profile web add @brianna-chen/dsh-memory-me
dsh --profile web --dump-config
dsh --profile web
```

## Model Experience

Indirectly, through the bundled `@brianna-chen/dsh-tool-memory-me`, which owns the `memory_me` schema and confirmation contract.

#### KV Cache effect

The bundle itself adds no tokens; the mounted tool package documents its stable schema cost.
