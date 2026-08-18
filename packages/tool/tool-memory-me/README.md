# `@brianna-chen/dsh-tool-memory-me`

English | [中文](README.zh.md)

Model-facing `memory_me` tool for Codex, Claude Code, and DeepSeek Harness memory management. It exposes discovery, non-writing preview, confirmed import, history, export, and confirmed rollback over the Host-owned Memory ME safety boundary. Browser file and directory selection remain in Settings → Memory ME.

## Model Experience

### Tool schema

#### What the model sees

The generated [`memory_me` schema](../../../docs/tool-catalog.md#brianna-chendsh-tool-memory-me). It directs the model to preview exact differences and obtain explicit approval before import or rollback; history and export remain read-only.

#### Token effect

One fixed tool-schema cost on every request where the tool is visible. Calls and results remain in conversation history until compaction.

#### KV Cache effect

Prefix-stable while the schema and tool visibility remain unchanged.
