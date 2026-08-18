# Agent Note: ComeHere graphical memory import

Status: implemented

[中文](2026-08-18-come-here-memory-import.zh.md) | English

## Problem

Developers moving from Codex or Claude Code need a deliberate way to bring portable instructions and skills into DeepSeek Harness. Copying entire configuration trees is unsafe because those trees can also contain credentials, logs, chats, caches, and platform-specific state. A command-only workflow also gives weak feedback before, during, and after a migration.

## Decision

ComeHere is a Settings section backed by a dedicated Host Remote service. It supports exact-root server discovery and explicit browser Markdown uploads. The UI presents guidance and a data-use declaration, lets the user select platforms, scopes, and individual candidates, previews every resulting action, requires a final confirmation, displays phase progress, and returns a per-item completion report with a rollback manifest for created paths.

The Host owns the safety invariant. It imports only instructions and skill bundles from known roots, applies per-file and total size limits, rejects likely secrets and symbolic links, and never overwrites an existing Harness file. Instruction conflicts are skipped; skill conflicts can be renamed only when the user selects that option. Preview is non-writing, and import re-resolves the request so a destination created after preview is still skipped.

## Alternatives considered

**Run the existing skill as a text-only wizard.** Rejected because the requested experience needs native selection, progress, and a durable report.

**Upload or copy complete platform directories.** Rejected because platform homes mix portable memory with credentials and unrelated private state.

**Overwrite conflicts after confirmation.** Rejected because create-only behavior is easier to audit and makes the generated rollback manifest truthful.

## Consequences

The web bundle gains one Host plugin and one client Settings plugin. The wizard follows six visible nodes—source, selection, conflict resolution, confirmation, per-item import progress, and report—and preserves user choices when moving backward. Each selected item is applied as a bounded Remote operation so progress reflects completed items; the final report aggregates their exact outcomes and rollback manifests. Browser uploads accept individual Markdown files, while full skill bundles are imported through server-side discovery so bundle-relative resources remain intact.

Deterministic runtime tests cover Codex and Claude Code separately. Each case imports a unique instruction and skill probe, verifies the probe reaches the Harness instruction renderer and filesystem skill registry, and confirms the source instruction remains unchanged. These tests establish runtime visibility without depending on nondeterministic model output.
