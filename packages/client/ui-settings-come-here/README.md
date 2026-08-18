# @deepseek-ai/dsh-client-ui-settings-come-here

English | [中文](README.zh.md)

Graphical ComeHere migration wizard registered as a Web Settings section. It presents the import declaration, source and content checkboxes, a complete preview, explicit confirmation, progress, and a final per-item report.

## Model Experience

None, as the wizard is a browser-only Settings surface and registers no model-facing content.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Browser uploads accept individual Markdown files rather than directory archives.
- Import progress is phase-based; the current Host operation completes in one Remote request.
