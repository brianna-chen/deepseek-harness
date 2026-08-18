# @brianna-chen/dsh-client-ui-settings-memory-me

English | [中文](README.zh.md)

Graphical Memory ME center registered as a Web Settings section. It supports file and directory selection, per-item conflict policy, editable merge content, before/after previews, secret warnings, explicit confirmation, progress, verified reports, executable rollback, history, and portable Harness export.

## Model Experience

None, as the wizard is a browser-only Settings surface and registers no model-facing content.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Directory selection imports recognized memory Markdown files rather than arbitrary directory contents.
- Import progress is phase-based because the Host commits one reviewed plan atomically at the request boundary.
