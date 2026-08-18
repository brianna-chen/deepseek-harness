import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import MemoryMeGateway from '@brianna-chen/dsh-host-memory-me'
import * as ToolMemoryMe from '../src/index.ts'

const roots: string[] = []
const contexts: Context[] = []
const originalCodexHome = process.env.CODEX_HOME
const originalDshHome = process.env.DSH_HOME

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  if (originalCodexHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = originalCodexHome
  if (originalDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalDshHome
})

describe('memory_me tool', () => {
  it('requires preview-visible IDs and explicit confirmation before a create-only import', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tool-memory-me-'))
    roots.push(root)
    process.env.CODEX_HOME = join(root, 'codex')
    process.env.DSH_HOME = join(root, 'dsh')
    await mkdir(process.env.CODEX_HOME, { recursive: true })
    await writeFile(join(process.env.CODEX_HOME, 'AGENTS.md'), '# Tool probe\n')
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(MemoryMeGateway)
    await ctx.plugin(ToolMemoryMe)
    let counter = 0
    const call = (args: unknown) => ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId(`memory-me-${++counter}`),
      name: 'memory_me',
      arguments: args,
    })
    const base = { platforms: ['codex'], include_global: true, include_project: false }
    const discovered = await call({ action: 'discover', ...base })
    const discovery = JSON.parse(discovered.content[0]?.type === 'text' ? discovered.content[0].text : '{}') as {
      candidates: Array<{ id: string }>
    }
    expect(discovery.candidates).toHaveLength(1)
    const candidate_ids = discovery.candidates.map(item => item.id)
    const preview = await call({ action: 'preview', ...base, candidate_ids })
    const previewBlock = preview.content[0]
    expect(previewBlock?.type).toBe('text')
    if (previewBlock?.type === 'text') expect(previewBlock.text).toContain('"action": "create"')
    const denied = await call({ action: 'import', ...base, candidate_ids, confirmed: false })
    expect(denied.isError).toBe(true)
    const imported = await call({ action: 'import', ...base, candidate_ids, confirmed: true })
    expect(imported).toMatchObject({ isError: false })
    expect(await readFile(join(root, 'dsh', 'AGENTS.md'), 'utf8')).toBe('# Tool probe\n')
  })
})
