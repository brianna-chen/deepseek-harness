import type { Context } from '@deepseek-ai/cordis'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type MemoryMeGateway from '@brianna-chen/dsh-host-memory-me'
import type { MemoryMeDiscoverRequest } from '@brianna-chen/dsh-host-memory-me/types'

export const name = 'tool-memory-me'
export const inject = ['tools', 'memoryMe']

const PARAMETERS = {
  action: {
    type: 'string',
    required: true,
    enum: ['discover', 'preview', 'import', 'history', 'export', 'rollback'],
    description: 'Discover, preview, import, list history, export Harness memory, or roll back a prior import.',
  },
  platforms: {
    type: 'array',
    items: { type: 'string', enum: ['codex', 'claude-code'] },
    description: 'Source platforms for discover, preview, and import.',
  },
  include_global: { type: 'boolean', description: 'Inspect global memory roots.' },
  include_project: { type: 'boolean', description: 'Inspect one explicit project root.' },
  project_root: { type: 'string', description: 'Absolute project root when project memory is included.' },
  candidate_ids: { type: 'array', items: { type: 'string' }, description: 'Candidate IDs returned by discover.' },
  conflict_resolution: {
    type: 'string',
    enum: ['skip', 'rename', 'replace', 'merge'],
    description: 'Default conflict policy. Replace and merge are backed up before writing.',
  },
  manifest_path: { type: 'string', description: 'Exact rollback manifest returned by import.' },
  confirmed: { type: 'boolean', description: 'Required for import and rollback after user approval.' },
} as const

const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue

export function apply(ctx: Context): void {
  const gateway = ctx.get('memoryMe') as MemoryMeGateway
  ctx.tools.register(defineTool({
    name: 'memory_me',
    description: 'Manage portable Codex, Claude Code, and DeepSeek Harness memory. Preview exact differences and secret findings before import. Never import, replace, merge, or roll back unless the user explicitly approves that exact operation.',
    parameters: PARAMETERS,
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      if (args.action === 'history') return json(await gateway.history({ limit: 20 }))
      if (args.action === 'export')
        return json(await gateway.exportMemory({
          includeGlobal: args.include_global ?? true,
          includeProject: args.include_project ?? false,
          ...(args.include_project ? { projectRoot: args.project_root } : {}),
        }))
      if (args.action === 'rollback') {
        if (args.confirmed !== true || args.manifest_path === undefined)
          throw new Error('rollback requires an exact manifest_path and explicit confirmation')
        return json(await gateway.rollback({ manifestPath: args.manifest_path, confirmed: true }))
      }
      const discovery: MemoryMeDiscoverRequest = {
        platforms: args.platforms ?? ['codex', 'claude-code'],
        includeGlobal: args.include_global ?? true,
        includeProject: args.include_project ?? false,
        ...(args.include_project ? { projectRoot: args.project_root } : {}),
      }
      if (args.action === 'discover') return json(await gateway.discover(discovery))
      const ids = args.candidate_ids ?? []
      const resolution = args.conflict_resolution ?? 'skip'
      const request = {
        discovery,
        candidateIds: ids,
        uploads: [],
        renameSkillConflicts: resolution === 'rename',
        conflictResolutions: Object.fromEntries(ids.map(id => [id, resolution])),
      }
      if (args.action === 'preview') return json(await gateway.preview(request))
      if (args.confirmed !== true) throw new Error('explicit confirmation is required after preview')
      return json(await gateway.importMemory({ ...request, confirmed: true }))
    },
    presentCall(args) {
      const mutates = args.action === 'import' || args.action === 'rollback'
      return {
        card: 'generic',
        title: `Memory ME ${args.action}`,
        kind: mutates ? 'edit' : 'read',
        rawInput: JSON.stringify(args),
      }
    },
  }))
}
