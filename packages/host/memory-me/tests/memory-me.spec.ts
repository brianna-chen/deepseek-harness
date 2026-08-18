import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import MemoryMeGateway from '../src/index.ts'

const contexts: Context[] = []
const roots: string[] = []
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

async function harness(): Promise<{ gateway: MemoryMeGateway; root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'memory-me-'))
  roots.push(root)
  process.env.CODEX_HOME = join(root, 'codex')
  process.env.DSH_HOME = join(root, 'dsh')
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(MemoryMeGateway)
  return { gateway: ctx.get('memoryMe') as MemoryMeGateway, root }
}

describe('MemoryMeGateway', () => {
  it('discovers, previews, and imports selected Codex memory without overwriting', async () => {
    const { gateway, root } = await harness()
    await mkdir(join(root, 'codex', 'skills', 'demo'), { recursive: true })
    await writeFile(join(root, 'codex', 'AGENTS.md'), '# Instructions\n')
    await writeFile(join(root, 'codex', 'skills', 'demo', 'SKILL.md'), '---\nname: demo\n---\n# Demo\n')
    const discovery = { platforms: ['codex'] as const, includeGlobal: true, includeProject: false }
    const found = await gateway.discover(discovery)
    expect(found.candidates).toHaveLength(2)

    const request = {
      discovery,
      candidateIds: found.candidates.map(item => item.id),
      uploads: [],
      renameSkillConflicts: false,
    }
    expect((await gateway.preview(request)).items.map(item => item.action)).toEqual(['create', 'create'])
    const report = await gateway.importMemory({ ...request, confirmed: true })
    expect(report).toMatchObject({ imported: 2, skipped: 0, rejected: 0, failed: 0 })
    expect(await readFile(join(root, 'dsh', 'AGENTS.md'), 'utf8')).toBe('# Instructions\n')
    expect(await readFile(join(root, 'dsh', 'skills', 'demo', 'SKILL.md'), 'utf8')).toContain('name: demo')

    const second = await gateway.importMemory({ ...request, confirmed: true })
    expect(second).toMatchObject({ imported: 0, skipped: 2 })
  })

  it('rejects secrets and symbolic links before copying a skill bundle', async () => {
    const { gateway, root } = await harness()
    const skill = join(root, 'codex', 'skills', 'unsafe')
    await mkdir(skill, { recursive: true })
    await writeFile(join(skill, 'SKILL.md'), '---\nname: unsafe\n---\n')
    await symlink('/etc/hosts', join(skill, 'outside'))
    const discovery = { platforms: ['codex'] as const, includeGlobal: true, includeProject: false }
    const found = await gateway.discover(discovery)
    const request = {
      discovery,
      candidateIds: found.candidates.map(item => item.id),
      uploads: [],
      renameSkillConflicts: false,
      confirmed: true,
    }
    expect(await gateway.importMemory(request)).toMatchObject({ imported: 0, failed: 1 })

    const upload = {
      id: 'upload',
      platform: 'codex' as const,
      fileName: 'AGENTS.md',
      relativePath: 'AGENTS.md',
      content: 'api_key=very-secret-value',
      scope: 'global' as const,
    }
    const preview = await gateway.preview({
      discovery,
      candidateIds: [],
      uploads: [upload],
      renameSkillConflicts: false,
    })
    expect(preview.items[0]).toMatchObject({ action: 'reject' })
    expect(preview.items[0]?.reason).toContain('possible secret detected')
    expect(preview.items[0]?.secretFindings).toHaveLength(1)
  })

  it('requires an explicit confirmation and rejects a symlinked project root', async () => {
    const { gateway, root } = await harness()
    const discovery = { platforms: ['codex'] as const, includeGlobal: false, includeProject: false }
    await expect(
      gateway.importMemory({ discovery, candidateIds: [], uploads: [], renameSkillConflicts: false, confirmed: false }),
    ).rejects.toThrow('explicit confirmation')
    await mkdir(join(root, 'project'))
    await symlink(join(root, 'project'), join(root, 'project-link'))
    await expect(
      gateway.discover({
        platforms: ['codex'],
        includeGlobal: false,
        includeProject: true,
        projectRoot: join(root, 'project-link'),
      }),
    ).rejects.toThrow('symbolic link')
  })

  it('applies conflict choices per skill instead of using one global switch', async () => {
    const { gateway, root } = await harness()
    await mkdir(join(root, 'codex', 'skills', 'demo'), { recursive: true })
    await writeFile(join(root, 'codex', 'skills', 'demo', 'SKILL.md'), '---\nname: demo\n---\n# Source\n')
    await mkdir(join(root, 'dsh', 'skills', 'demo'), { recursive: true })
    await writeFile(join(root, 'dsh', 'skills', 'demo', 'SKILL.md'), '---\nname: demo\n---\n# Existing\n')
    const discovery = { platforms: ['codex'] as const, includeGlobal: true, includeProject: false }
    const found = await gateway.discover(discovery)
    const id = found.candidates[0]!.id
    const preview = await gateway.preview({
      discovery,
      candidateIds: [id],
      uploads: [],
      renameSkillConflicts: false,
      conflictResolutions: { [id]: 'rename' },
    })
    expect(preview.items[0]).toMatchObject({ action: 'rename' })
    expect(preview.items[0]?.destination).toContain('demo-imported-1')
  })

  it('previews differences, replaces with backup, records history, exports, verifies, and rolls back', async () => {
    const { gateway, root } = await harness()
    await mkdir(join(root, 'codex'), { recursive: true })
    await mkdir(join(root, 'dsh'), { recursive: true })
    await writeFile(join(root, 'codex', 'AGENTS.md'), '# New memory\n')
    await writeFile(join(root, 'dsh', 'AGENTS.md'), '# Existing memory\n')
    const discovery = { platforms: ['codex'] as const, includeGlobal: true, includeProject: false }
    const found = await gateway.discover(discovery)
    const id = found.candidates[0]!.id
    const request = {
      discovery,
      candidateIds: [id],
      uploads: [],
      renameSkillConflicts: false,
      conflictResolutions: { [id]: 'replace' as const },
    }
    const preview = await gateway.preview(request)
    expect(preview.items[0]).toMatchObject({ action: 'replace', additions: 1, deletions: 1 })
    const report = await gateway.importMemory({ ...request, confirmed: true })
    expect(report).toMatchObject({ imported: 1, verified: 1 })
    expect(await readFile(join(root, 'dsh', 'AGENTS.md'), 'utf8')).toBe('# New memory\n')
    expect((await gateway.history({ limit: 10 })).reports[0]?.id).toBe(report.id)
    expect((await gateway.exportMemory({ includeGlobal: true, includeProject: false })).items[0]).toMatchObject({
      relativePath: 'AGENTS.md',
      content: '# New memory\n',
    })
    expect(report.rollbackManifest).toBeDefined()
    const rollback = await gateway.rollback({ manifestPath: report.rollbackManifest ?? '', confirmed: true })
    expect(rollback).toEqual({ restored: 1, removed: 0, failed: [] })
    expect(await readFile(join(root, 'dsh', 'AGENTS.md'), 'utf8')).toBe('# Existing memory\n')
  })
})
