# `@deepseek-ai/dsh-tool-come-here`

English | [中文](README.zh.md)

Model-facing `come_here_memory` tool for server-side Codex and Claude Code memory migration. It exposes discovery, non-writing preview, and explicitly confirmed create-only import over the Host-owned ComeHere safety boundary. Browser uploads remain in Settings → ComeHere.

## Model Experience

### Tool schema

#### What the model sees

The generated [`come_here_memory` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-come-here). It directs the model to discover candidates, preview the exact selection, show that plan to the user, and obtain explicit approval before import.

#### Token effect

One fixed tool-schema cost on every request where the tool is visible. Calls and results remain in conversation history until compaction.

#### KV Cache effect

Prefix-stable while the schema and tool visibility remain unchanged.
