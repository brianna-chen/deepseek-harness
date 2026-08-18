# @brianna-chen/dsh-host-memory-me

English | [中文](README.zh.md)

Host Remote gateway for Memory ME. It discovers documented Codex and Claude Code instruction and skill locations; previews content, line deltas, destination conflicts, and secret findings; and applies only an explicitly confirmed plan.

Conflict policies are skip, safe skill rename, replace with backup, and merge with optional edited content. Every successful write is verified, recorded in import history, and covered by an executable rollback manifest. The service can also export Harness instructions and skills as portable JSON. It never scans arbitrary home-directory trees or reads chats, cookies, logs, credentials, or platform databases. Browser input is bounded to 1 MiB per file and 5 MiB per request.

## Model Experience

None, as this Host migration service registers no model-facing prompt or schema; the separate tool package owns those effects.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Directory selection recognizes `AGENTS.md`, `CLAUDE.md`, and `SKILL.md`; arbitrary attachments inside a selected directory are not imported.
- Line deltas are a review aid, not a semantic equivalence judgment.
