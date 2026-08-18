import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import type ComeHereGateway from '@deepseek-ai/dsh-host-come-here'
import type { ComeHereDiscoverRequest } from '@deepseek-ai/dsh-host-come-here/types'

export const name = 'tool-come-here'
export const inject = ['tools', 'comeHere']

const PARAMETERS = {
  action: { type: 'string', required: true, enum: ['discover', 'preview', 'import'], description: 'discover lists candidates; preview returns a non-writing plan; import applies an explicitly confirmed create-only plan.' },
  platforms: { type: 'array', required: true, items: { type: 'string', enum: ['codex', 'claude-code'] }, description: 'Source platforms to inspect.' },
  include_global: { type: 'boolean', required: true, description: 'Inspect the selected platforms global memory roots.' },
  include_project: { type: 'boolean', required: true, description: 'Inspect one explicit remote project root.' },
  project_root: { type: 'string', description: 'Absolute project root; required when include_project is true.' },
  candidate_ids: { type: 'array', items: { type: 'string' }, description: 'Exact candidate IDs returned by discover. Required for preview and import.' },
  rename_skill_conflicts: { type: 'boolean', description: 'Rename conflicting skills instead of skipping them. Instructions are never renamed.' },
  confirmed: { type: 'boolean', description: 'Must be true for import, after the user has reviewed the preview.' },
} as const

export function apply(ctx: Context): void {
  const gateway = ctx.get('comeHere') as ComeHereGateway
  ctx.tools.register(defineTool({
    name: 'come_here_memory',
    description: 'Discover, preview, or explicitly import portable Codex and Claude Code instructions and skills into DeepSeek Harness. Always call preview and show it to the user before import. Never set confirmed unless the user explicitly approves that exact plan.',
    parameters: PARAMETERS,
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const discovery: ComeHereDiscoverRequest = {
        platforms: args.platforms,
        includeGlobal: args.include_global,
        includeProject: args.include_project,
        ...(args.include_project ? { projectRoot: args.project_root } : {}),
      }
      if (args.action === 'discover') return JSON.parse(JSON.stringify(await gateway.discover(discovery))) as JsonValue
      const request = {
        discovery,
        candidateIds: args.candidate_ids ?? [],
        uploads: [],
        renameSkillConflicts: args.rename_skill_conflicts ?? false,
      }
      if (args.action === 'preview') return JSON.parse(JSON.stringify(await gateway.preview(request))) as JsonValue
      if (args.confirmed !== true) throw new Error('explicit confirmation is required after preview')
      return JSON.parse(JSON.stringify(await gateway.importMemory({ ...request, confirmed: true }))) as JsonValue
    },
    presentCall(args) {
      return { card: 'generic', title: `ComeHere ${args.action}`, kind: args.action === 'import' ? 'edit' : 'read', rawInput: JSON.stringify(args) }
    },
  }))
}
