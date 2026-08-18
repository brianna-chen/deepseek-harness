import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { access, cp, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import type {} from 'zod'
import type {
  ComeHereCandidate,
  ComeHereDiscoverRequest,
  ComeHereDiscovery,
  ComeHereImportReport,
  ComeHereImportRequest,
  ComeHereImportResultItem,
  ComeHereKind,
  ComeHerePlanItem,
  ComeHerePlatform,
  ComeHerePreview,
  ComeHerePreviewRequest,
  ComeHereScope,
  ComeHereUpload,
} from './types.ts'

export type * from './types.ts'

const MAX_FILE_BYTES = 1_048_576
const MAX_IMPORT_BYTES = 5_242_880
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SECRET_MARKERS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*\S+/i,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
]

interface ResolvedItem {
  readonly plan: ComeHerePlanItem
  readonly content?: string
  readonly bundle?: string
}

const dshHome = (): string => resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh'))
const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
const hasSecret = (content: string): boolean => SECRET_MARKERS.some(pattern => pattern.test(content))
const projectRoot = (value: string | undefined): string => {
  if (value === undefined || !isAbsolute(value)) throw new Error('projectRoot must be an absolute path')
  return resolve(value)
}
const validateProjectRoot = async (root: string): Promise<void> => {
  const info = await lstat(root)
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error('projectRoot must be a real directory, not a symbolic link')
}
const target = (kind: ComeHereKind, scope: ComeHereScope, name: string, root?: string): string => {
  const base = scope === 'global' ? dshHome() : projectRoot(root)
  if (kind === 'instructions') return join(base, 'AGENTS.md')
  return scope === 'global' ? join(base, 'skills', name, 'SKILL.md') : join(base, '.dsh', 'skills', name, 'SKILL.md')
}
const skillName = (content: string, fallback: string): string => {
  const name = /^---\s*\n[\s\S]*?^name:\s*['"]?([^'"\s]+)['"]?\s*$/m.exec(content)?.[1] ?? fallback
  if (!SKILL_NAME.test(name)) throw new Error(`invalid skill name: ${name}`)
  return name
}

async function addFile(
  out: ComeHereCandidate[],
  platform: ComeHerePlatform,
  scope: ComeHereScope,
  kind: ComeHereKind,
  source: string,
  root?: string,
): Promise<void> {
  try {
    const info = await lstat(source)
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_FILE_BYTES) return
    const content = kind === 'skill' ? await readFile(source, 'utf8') : ''
    const name = kind === 'skill' ? skillName(content, basename(dirname(source))) : basename(source)
    const destination = target(kind, scope, name, root)
    out.push({
      id: `${platform}:${scope}:${kind}:${source}`,
      platform,
      scope,
      kind,
      source,
      name,
      size: info.size,
      destination,
      conflict: await exists(destination),
    })
  } catch {
    /* missing or malformed candidates are not portable memory */
  }
}

async function addSkills(
  out: ComeHereCandidate[],
  platform: ComeHerePlatform,
  scope: ComeHereScope,
  root: string,
  project?: string,
): Promise<void> {
  try {
    const rootInfo = await lstat(root)
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) return
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.isSymbolicLink())
        await addFile(out, platform, scope, 'skill', join(root, entry.name, 'SKILL.md'), project)
    }
  } catch {
    /* absent roots are valid empty state */
  }
}

async function discover(request: ComeHereDiscoverRequest): Promise<ComeHereDiscovery> {
  const candidates: ComeHereCandidate[] = []
  const root = request.includeProject ? projectRoot(request.projectRoot) : undefined
  if (root !== undefined) await validateProjectRoot(root)
  for (const platform of [...new Set(request.platforms)]) {
    if (request.includeGlobal && platform === 'codex') {
      const base = resolve(process.env.CODEX_HOME ?? join(homedir(), '.codex'))
      await addFile(candidates, platform, 'global', 'instructions', join(base, 'AGENTS.md'))
      await addSkills(candidates, platform, 'global', join(base, 'skills'))
    }
    if (request.includeGlobal && platform === 'claude-code') {
      const base = join(homedir(), '.claude')
      await addFile(candidates, platform, 'global', 'instructions', join(base, 'CLAUDE.md'))
      await addSkills(candidates, platform, 'global', join(base, 'skills'))
    }
    if (root !== undefined && platform === 'codex') {
      await addFile(candidates, platform, 'project', 'instructions', join(root, 'AGENTS.md'), root)
      await addSkills(candidates, platform, 'project', join(root, '.agents', 'skills'), root)
      await addSkills(candidates, platform, 'project', join(root, '.codex', 'skills'), root)
    }
    if (root !== undefined && platform === 'claude-code') {
      await addFile(candidates, platform, 'project', 'instructions', join(root, 'CLAUDE.md'), root)
      await addFile(candidates, platform, 'project', 'instructions', join(root, '.claude', 'CLAUDE.md'), root)
      await addSkills(candidates, platform, 'project', join(root, '.claude', 'skills'), root)
    }
  }
  return { candidates: candidates.sort((a, b) => a.source.localeCompare(b.source)), warnings: [] }
}

async function validateBundle(root: string): Promise<void> {
  let totalBytes = 0
  const visit = async (path: string): Promise<void> => {
    const info = await lstat(path)
    if (info.isSymbolicLink()) throw new Error('skill bundle contains a symbolic link')
    if (info.isDirectory()) {
      for (const entry of await readdir(path)) await visit(join(path, entry))
      return
    }
    if (!info.isFile()) throw new Error('skill bundle contains a non-file entry')
    if (info.size > MAX_FILE_BYTES) throw new Error('skill bundle contains a file larger than 1 MiB')
    totalBytes += info.size
    if (totalBytes > MAX_IMPORT_BYTES) throw new Error('skill bundle exceeds 5 MiB')
    if (hasSecret(await readFile(path, 'utf8'))) throw new Error('possible secret detected in skill bundle')
  }
  await visit(root)
}

async function renamed(destination: string): Promise<string> {
  const root = dirname(dirname(destination))
  const name = basename(dirname(destination))
  for (let index = 1; index <= 100; index += 1) {
    const path = join(root, `${name}-imported-${index}`, 'SKILL.md')
    if (!(await exists(path))) return path
  }
  throw new Error(`no free destination for ${name}`)
}

async function uploadItem(upload: ComeHereUpload, rename: boolean, root?: string): Promise<ResolvedItem> {
  const kind: ComeHereKind = upload.fileName === 'SKILL.md' ? 'skill' : 'instructions'
  const source = upload.relativePath || upload.fileName
  if (Buffer.byteLength(upload.content, 'utf8') > MAX_FILE_BYTES)
    return { plan: { id: upload.id, kind, source, destination: '', action: 'reject', reason: 'file exceeds 1 MiB' } }
  if (hasSecret(upload.content))
    return {
      plan: { id: upload.id, kind, source, destination: '', action: 'reject', reason: 'possible secret detected' },
    }
  let name = 'instructions'
  try {
    if (kind === 'skill') name = skillName(upload.content, 'uploaded-skill')
  } catch (error) {
    return {
      plan: { id: upload.id, kind, source, destination: '', action: 'reject', reason: (error as Error).message },
    }
  }
  let destination = target(kind, upload.scope, name, root)
  const conflict = await exists(destination)
  if (conflict && kind === 'skill' && rename) destination = await renamed(destination)
  const action = !conflict ? 'create' : kind === 'skill' && rename ? 'rename' : 'skip'
  return {
    plan: {
      id: upload.id,
      kind,
      source,
      destination,
      action,
      ...(action === 'skip' ? { reason: 'destination exists' } : {}),
    },
    content: upload.content,
  }
}

async function resolveItems(request: ComeHerePreviewRequest): Promise<ResolvedItem[]> {
  const snapshot = await discover(request.discovery)
  const found = new Map(snapshot.candidates.map(item => [item.id, item]))
  const items: ResolvedItem[] = []
  for (const id of [...new Set(request.candidateIds)]) {
    const item = found.get(id)
    if (item === undefined) {
      items.push({
        plan: {
          id,
          kind: 'instructions',
          source: id,
          destination: '',
          action: 'reject',
          reason: 'source is outside allowed roots',
        },
      })
      continue
    }
    let destination = item.destination
    const rename =
      request.skillConflictResolutions?.[id] === 'rename' ||
      (request.skillConflictResolutions?.[id] === undefined && request.renameSkillConflicts)
    if (item.conflict && item.kind === 'skill' && rename) destination = await renamed(destination)
    const action = !item.conflict ? 'create' : item.kind === 'skill' && rename ? 'rename' : 'skip'
    items.push({
      plan: {
        id,
        kind: item.kind,
        source: item.source,
        destination,
        action,
        ...(action === 'skip' ? { reason: 'destination exists' } : {}),
      },
      ...(item.kind === 'skill' ? { bundle: dirname(item.source) } : {}),
    })
  }
  for (const upload of request.uploads) {
    const rename =
      request.skillConflictResolutions?.[upload.id] === 'rename' ||
      (request.skillConflictResolutions?.[upload.id] === undefined && request.renameSkillConflicts)
    items.push(await uploadItem(upload, rename, request.discovery.projectRoot))
  }
  return items
}

export class ComeHereGateway extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'comeHere')
  }
  /** Return portable-memory candidates from supported exact roots. */
  @Remote('discover') async discover(request: ComeHereDiscoverRequest): Promise<ComeHereDiscovery> {
    return discover(request)
  }
  /** Return the complete non-writing confirmation plan. */
  @Remote('preview') async preview(request: ComeHerePreviewRequest): Promise<ComeHerePreview> {
    const totalBytes = request.uploads.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf8'), 0)
    if (totalBytes > MAX_IMPORT_BYTES) throw new Error('uploads exceed 5 MiB')
    return {
      items: (await resolveItems(request)).map(item => item.plan),
      totalBytes,
      declaration: [
        'Only selected instructions and skills are imported.',
        'Chats, credentials, cookies, tokens, logs, and databases are excluded.',
        'Existing Harness files are never overwritten.',
      ],
    }
  }
  /** Apply one explicitly confirmed create-only import. */
  @Remote('importMemory') async importMemory(request: ComeHereImportRequest): Promise<ComeHereImportReport> {
    if (!request.confirmed) throw new Error('explicit confirmation is required')
    const results: ComeHereImportResultItem[] = []
    const created: string[] = []
    for (const item of await resolveItems(request)) {
      if (item.plan.action === 'skip' || item.plan.action === 'reject') {
        results.push({ ...item.plan, status: item.plan.action === 'skip' ? 'skipped' : 'rejected' })
        continue
      }
      try {
        if (await exists(item.plan.destination)) {
          results.push({
            ...item.plan,
            action: 'skip',
            reason: 'destination appeared after preview',
            status: 'skipped',
          })
          continue
        }
        if (item.bundle !== undefined) await validateBundle(item.bundle)
        if (item.bundle !== undefined) {
          await mkdir(dirname(dirname(item.plan.destination)), { recursive: true })
          await cp(item.bundle, dirname(item.plan.destination), { recursive: true, errorOnExist: true, force: false })
        } else {
          const content = item.content ?? (await readFile(item.plan.source, 'utf8'))
          if (hasSecret(content)) {
            results.push({ ...item.plan, action: 'reject', reason: 'possible secret detected', status: 'rejected' })
            continue
          }
          await mkdir(dirname(item.plan.destination), { recursive: true })
          await writeFile(item.plan.destination, content, { encoding: 'utf8', flag: 'wx' })
        }
        created.push(item.plan.destination)
        results.push({ ...item.plan, status: 'imported' })
      } catch (error) {
        results.push({ ...item.plan, reason: (error as Error).message, status: 'failed' })
      }
    }
    let rollbackManifest: string | undefined
    if (created.length > 0) {
      rollbackManifest = join(
        dshHome(),
        'come-here',
        'rollbacks',
        new Date().toISOString().replace(/[:.]/g, '-'),
        'manifest.json',
      )
      await mkdir(dirname(rollbackManifest), { recursive: true })
      await writeFile(rollbackManifest, `${JSON.stringify({ created }, null, 2)}\n`, { flag: 'wx' })
    }
    return {
      imported: results.filter(item => item.status === 'imported').length,
      skipped: results.filter(item => item.status === 'skipped').length,
      rejected: results.filter(item => item.status === 'rejected').length,
      failed: results.filter(item => item.status === 'failed').length,
      items: results,
      ...(rollbackManifest === undefined ? {} : { rollbackManifest }),
    }
  }
}
export default ComeHereGateway
