import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { loadBaselineInstructions } from '@deepseek-ai/dsh-agent-instructions'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillFileSystem from '@deepseek-ai/dsh-skill-filesystem'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import MemoryMeGateway from '../src/index.ts'
import type { MemoryMePlatform } from '../src/types.ts'

const roots: string[] = []
const contexts: Context[] = []
const originalHome = process.env.HOME
const originalCodexHome = process.env.CODEX_HOME
const originalDshHome = process.env.DSH_HOME

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  if (originalHome === undefined) delete process.env.HOME
  else process.env.HOME = originalHome
  if (originalCodexHome === undefined) delete process.env.CODEX_HOME
  else process.env.CODEX_HOME = originalCodexHome
  if (originalDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalDshHome
})

interface SourceCase {
  readonly platform: Exclude<MemoryMePlatform, 'harness'>
  readonly instructionName: 'AGENTS.md' | 'CLAUDE.md'
  readonly sourceDirectory: 'codex' | '.claude'
  readonly probe: string
  readonly skillName: string
}

const cases: readonly SourceCase[] = [
  { platform: 'codex', instructionName: 'AGENTS.md', sourceDirectory: 'codex', probe: 'CODEX_MEMORY_271828', skillName: 'codex-memory-probe' },
  { platform: 'claude-code', instructionName: 'CLAUDE.md', sourceDirectory: '.claude', probe: 'CLAUDE_MEMORY_314159', skillName: 'claude-memory-probe' },
]

describe.each(cases)('MemoryMe $platform runtime memory', (source) => {
  it('imports source memory into the instruction renderer and skill registry', async () => {
    const root = await mkdtemp(join(tmpdir(), `memory-me-${source.platform}-`))
    roots.push(root)
    const sourceHome = join(root, 'home'); const dshHome = join(root, 'dsh'); const project = join(root, 'project')
    const sourceRoot = join(sourceHome, source.sourceDirectory); const skillRoot = join(sourceRoot, 'skills', source.skillName)
    await mkdir(skillRoot, { recursive: true }); await mkdir(join(project, '.git'), { recursive: true })
    await writeFile(join(sourceRoot, source.instructionName), `Remember this exact probe: ${source.probe}\n`)
    await writeFile(join(skillRoot, 'SKILL.md'), `---\nname: ${source.skillName}\ndescription: Runtime probe ${source.probe}\n---\n\nUse ${source.probe} when asked for the imported skill probe.\n`)
    process.env.HOME = sourceHome; process.env.CODEX_HOME = join(sourceHome, 'codex'); process.env.DSH_HOME = dshHome

    const gatewayContext = new Context(); contexts.push(gatewayContext); await gatewayContext.plugin(MemoryMeGateway)
    const gateway = gatewayContext.get('memoryMe') as MemoryMeGateway
    const discovery = { platforms: [source.platform], includeGlobal: true, includeProject: false }
    const found = await gateway.discover(discovery)
    expect(found.candidates.map(item => [item.platform, item.kind, item.name])).toEqual([
      [source.platform, 'instructions', source.instructionName],
      [source.platform, 'skill', source.skillName],
    ])
    const request = { discovery, candidateIds: found.candidates.map(item => item.id), uploads: [], renameSkillConflicts: false }
    const report = await gateway.importMemory({ ...request, confirmed: true })
    expect(report).toMatchObject({ imported: 2, skipped: 0, rejected: 0, failed: 0 })

    const rendered = await loadBaselineInstructions({ cwd: project, dshHome, maxBytes: 65_536 })
    expect(rendered?.text).toContain(source.probe)
    expect(rendered?.text).toContain('Instructions from: $DSH_HOME/AGENTS.md')

    const skillContext = new Context(); contexts.push(skillContext)
    await skillContext.plugin(SkillRegistry)
    await skillContext.plugin(SkillFileSystem, { dshHome, agentsHome: join(root, 'agents'), watch: false })
    expect((await skillContext.skills.list({ cwd: project })).map(skill => skill.name)).toContain(source.skillName)
    expect((await skillContext.skills.get(source.skillName, { cwd: project }))?.content).toContain(source.probe)

    expect(await readFile(join(sourceRoot, source.instructionName), 'utf8')).toBe(`Remember this exact probe: ${source.probe}\n`)
  })
})
