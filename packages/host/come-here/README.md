# @deepseek-ai/dsh-host-come-here

English | [中文](README.zh.md)

Host Remote gateway for the ComeHere Settings wizard. It discovers documented Codex and Claude Code instruction and skill locations, returns a non-writing preview, and applies an explicitly confirmed create-only import.

The gateway never scans arbitrary home-directory trees, reads platform databases, or overwrites Harness files. Browser uploads are bounded to 1 MiB per file and 5 MiB per request. Possible secrets are rejected before writing. Successful imports write a rollback manifest listing every created path.

## Model Experience

None, as this Host migration service registers no model-facing prompt or schema; the separate tool package owns those effects.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Browser uploads accept individual Markdown files rather than directory archives.
- Rollback is reported as a manifest and is not executed from the UI.
- Existing instructions are skipped rather than semantically merged.
