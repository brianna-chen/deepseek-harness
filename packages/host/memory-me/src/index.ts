import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { access, cp, lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type {} from 'zod'
import type {
  MemoryMeCandidate,
  MemoryMeConflictResolution,
  MemoryMeDiscoverRequest,
  MemoryMeDiscovery,
  MemoryMeExport,
  MemoryMeExportItem,
  MemoryMeExportRequest,
  MemoryMeHistory,
  MemoryMeHistoryRequest,
  MemoryMeImportReport,
  MemoryMeImportRequest,
  MemoryMeImportResultItem,
  MemoryMeKind,
  MemoryMePlanItem,
  MemoryMePlatform,
  MemoryMePreview,
  MemoryMePreviewRequest,
  MemoryMeRollbackReport,
  MemoryMeRollbackRequest,
  MemoryMeScope,
  MemoryMeSecretFinding,
  MemoryMeUpload,
} from './types.ts'

export type * from './types.ts'

const MAX_FILE_BYTES = 1_048_576
const MAX_IMPORT_BYTES = 5_242_880
const PREVIEW_CHARS = 4_000
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface ResolvedItem {
  readonly plan: MemoryMePlanItem
  readonly content?: string
  readonly bundle?: string
}

interface RollbackEntry {
  readonly destination: string
  readonly backup?: string
}

interface RollbackManifest {
  readonly version: 1
  readonly createdAt: string
  readonly entries: readonly RollbackEntry[]
}

const isRollbackManifest = (value: unknown): value is RollbackManifest => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (record.version !== 1 || !Array.isArray(record.entries)) return false
  return record.entries.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false
    const candidate = entry as Record<string, unknown>
    return typeof candidate.destination === 'string'
      && (candidate.backup === undefined || typeof candidate.backup === 'string')
  })
}

const memoryHome = (): string => resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh'))
const stateRoot = (): string => join(memoryHome(), 'memory-me')
const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const projectRoot = (value: string | undefined): string => {
  if (value === undefined || !isAbsolute(value)) throw new Error('projectRoot must be an absolute path')
  return resolve(value)
}

const validateProjectRoot = async (root: string): Promise<void> => {
  const info = await lstat(root)
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error('projectRoot must be a real directory, not a symbolic link')
}

const target = (kind: MemoryMeKind, scope: MemoryMeScope, name: string, root?: string): string => {
  const base = scope === 'global' ? memoryHome() : projectRoot(root)
  if (kind === 'instructions') return join(base, 'AGENTS.md')
  return scope === 'global' ? join(base, 'skills', name, 'SKILL.md') : join(base, '.dsh', 'skills', name, 'SKILL.md')
}

const skillName = (content: string, fallback: string): string => {
  const name = /^---\s*\n[\s\S]*?^name:\s*['"]?([^'"\s]+)['"]?\s*$/m.exec(content)?.[1] ?? fallback
  if (!SKILL_NAME.test(name)) throw new Error(`invalid skill name: ${name}`)
  return name
}

const scanSecrets = (content: string): MemoryMeSecretFinding[] => {
  const findings: MemoryMeSecretFinding[] = []
  for (const [index, line] of content.split('\n').entries()) {
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line))
      findings.push({ line: index + 1, kind: 'private-key', suggestion: 'Remove the private key before import.' })
    if (/\b(?:api[_-]?key|access[_-]?token|secret)\s*[:=]\s*\S+/i.test(line))
      findings.push({ line: index + 1, kind: 'credential', suggestion: 'Replace the value with an environment variable.' })
    if (/\bsk-[A-Za-z0-9_-]{20,}\b/.test(line))
      findings.push({ line: index + 1, kind: 'api-token', suggestion: 'Remove or rotate this token before import.' })
  }
  return findings
}

const previewText = (content: string): string => content.slice(0, PREVIEW_CHARS)
const lineDelta = (source: string, destination: string): { additions: number; deletions: number } => {
  if (source === destination) return { additions: 0, deletions: 0 }
  const sourceLines = source.split('\n')
  const destinationLines = destination.split('\n')
  const sourceSet = new Set(sourceLines)
  const destinationSet = new Set(destinationLines)
  return {
    additions: sourceLines.filter(line => !destinationSet.has(line)).length,
    deletions: destinationLines.filter(line => !sourceSet.has(line)).length,
  }
}

async function addFile(
  out: MemoryMeCandidate[],
  platform: Exclude<MemoryMePlatform, 'harness'>,
  scope: MemoryMeScope,
  kind: MemoryMeKind,
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
    // Missing, oversized, or malformed candidates are not portable memory.
  }
}

async function addSkills(
  out: MemoryMeCandidate[],
  platform: Exclude<MemoryMePlatform, 'harness'>,
  scope: MemoryMeScope,
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
    // An absent skills root is a valid empty state.
  }
}

async function discover(request: MemoryMeDiscoverRequest): Promise<MemoryMeDiscovery> {
  const candidates: MemoryMeCandidate[] = []
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
    if (scanSecrets(await readFile(path, 'utf8')).length > 0)
      throw new Error('possible secret detected in skill bundle')
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

const resolutionFor = (request: MemoryMePreviewRequest, id: string): MemoryMeConflictResolution =>
  request.conflictResolutions?.[id] ?? (request.renameSkillConflicts ? 'rename' : 'skip')

async function planItem(
  id: string,
  kind: MemoryMeKind,
  source: string,
  initialDestination: string,
  sourceContent: string,
  conflict: boolean,
  resolution: MemoryMeConflictResolution,
  manualContent?: string,
): Promise<{ plan: MemoryMePlanItem; content: string }> {
  let destination = initialDestination
  let content = manualContent ?? sourceContent
  let destinationContent = ''
  if (conflict) destinationContent = await readFile(destination, 'utf8')
  if (conflict && resolution === 'rename' && kind === 'skill') destination = await renamed(destination)
  if (conflict && resolution === 'merge') {
    content = manualContent ?? `${destinationContent.trimEnd()}\n\n<!-- Imported by Memory ME -->\n${sourceContent.trim()}\n`
  }
  const secretFindings = scanSecrets(content)
  const action = secretFindings.length > 0
    ? 'reject'
    : !conflict
      ? 'create'
      : resolution === 'rename' && kind === 'skill'
        ? 'rename'
        : resolution
  const delta = lineDelta(content, destinationContent)
  return {
    plan: {
      id,
      kind,
      source,
      destination,
      action,
      ...(secretFindings.length > 0 ? { reason: 'possible secret detected; remove or redact it before import' } : {}),
      ...(action === 'skip' ? { reason: 'destination exists' } : {}),
      sourcePreview: previewText(content),
      destinationPreview: previewText(destinationContent),
      ...delta,
      secretFindings,
    },
    content,
  }
}

async function uploadItem(upload: MemoryMeUpload, request: MemoryMePreviewRequest): Promise<ResolvedItem> {
  const recognizedInstructions = upload.fileName === 'AGENTS.md' || upload.fileName === 'CLAUDE.md'
  const kind: MemoryMeKind = upload.fileName === 'SKILL.md' ? 'skill' : 'instructions'
  const source = upload.relativePath || upload.fileName
  if (!recognizedInstructions && kind !== 'skill')
    return {
      plan: {
        id: upload.id,
        kind,
        source,
        destination: '',
        action: 'reject',
        reason: 'directory import accepts AGENTS.md, CLAUDE.md, and SKILL.md',
        additions: 0,
        deletions: 0,
        secretFindings: [],
      },
    }
  if (Buffer.byteLength(upload.content, 'utf8') > MAX_FILE_BYTES)
    return {
      plan: {
        id: upload.id,
        kind,
        source,
        destination: '',
        action: 'reject',
        reason: 'file exceeds 1 MiB',
        additions: 0,
        deletions: 0,
        secretFindings: [],
      },
    }
  let name = 'instructions'
  try {
    if (kind === 'skill') name = skillName(upload.content, basename(dirname(source)) || 'uploaded-skill')
  } catch (error) {
    return {
      plan: {
        id: upload.id,
        kind,
        source,
        destination: '',
        action: 'reject',
        reason: (error as Error).message,
        additions: 0,
        deletions: 0,
        secretFindings: [],
      },
    }
  }
  const destination = target(kind, upload.scope, name, request.discovery.projectRoot)
  const conflict = await exists(destination)
  const resolved = await planItem(
    upload.id,
    kind,
    source,
    destination,
    upload.content,
    conflict,
    resolutionFor(request, upload.id),
    request.manualContents?.[upload.id],
  )
  return { plan: resolved.plan, content: resolved.content }
}

async function resolveItems(request: MemoryMePreviewRequest): Promise<ResolvedItem[]> {
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
          additions: 0,
          deletions: 0,
          secretFindings: [],
        },
      })
      continue
    }
    const sourceContent = await readFile(item.source, 'utf8')
    const resolved = await planItem(
      id,
      item.kind,
      item.source,
      item.destination,
      sourceContent,
      item.conflict,
      resolutionFor(request, id),
      request.manualContents?.[id],
    )
    items.push({
      plan: resolved.plan,
      content: resolved.content,
      ...(item.kind === 'skill' && request.manualContents?.[id] === undefined ? { bundle: dirname(item.source) } : {}),
    })
  }
  for (const upload of request.uploads) items.push(await uploadItem(upload, request))
  return items
}

const safeId = (): string => new Date().toISOString().replace(/[:.]/g, '-')

async function copyBackup(destination: string, backup: string): Promise<void> {
  const info = await lstat(destination)
  if (info.isSymbolicLink()) throw new Error('destination is a symbolic link')
  await mkdir(dirname(backup), { recursive: true })
  if (info.isDirectory()) await cp(destination, backup, { recursive: true, errorOnExist: true, force: false })
  else await cp(destination, backup, { errorOnExist: true, force: false })
}

async function exportSkillRoot(root: string, prefix: string, out: MemoryMeExportItem[]): Promise<void> {
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue
      const source = join(root, entry.name, 'SKILL.md')
      if (!(await exists(source))) continue
      out.push({ kind: 'skill', source, relativePath: join(prefix, entry.name, 'SKILL.md'), content: await readFile(source, 'utf8') })
    }
  } catch {
    // Missing export roots are valid.
  }
}

export class MemoryMeGateway extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'memoryMe')
  }

  @Remote('discover') async discover(request: MemoryMeDiscoverRequest): Promise<MemoryMeDiscovery> {
    return discover(request)
  }

  @Remote('preview') async preview(request: MemoryMePreviewRequest): Promise<MemoryMePreview> {
    const totalBytes = request.uploads.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf8'), 0)
    if (totalBytes > MAX_IMPORT_BYTES) throw new Error('uploads exceed 5 MiB')
    return {
      items: (await resolveItems(request)).map(item => item.plan),
      totalBytes,
      declaration: [
        'Only selected instructions and skills are imported.',
        'Secrets, symbolic links, oversized files, chats, cookies, logs, and databases are excluded.',
        'Replace and merge create restorable backups and require explicit confirmation.',
      ],
    }
  }

  @Remote('importMemory') async importMemory(request: MemoryMeImportRequest): Promise<MemoryMeImportReport> {
    if (!request.confirmed) throw new Error('explicit confirmation is required')
    const id = safeId()
    const rollbackRoot = join(stateRoot(), 'rollbacks', id)
    const results: MemoryMeImportResultItem[] = []
    const entries: RollbackEntry[] = []
    for (const [index, item] of (await resolveItems(request)).entries()) {
      if (item.plan.action === 'skip' || item.plan.action === 'reject') {
        results.push({
          ...item.plan,
          status: item.plan.action === 'skip' ? 'skipped' : 'rejected',
          verified: false,
        })
        continue
      }
      try {
        const destinationExists = await exists(item.plan.destination)
        if (destinationExists && item.plan.action !== 'replace' && item.plan.action !== 'merge') {
          results.push({ ...item.plan, action: 'skip', reason: 'destination changed after preview', status: 'skipped', verified: false })
          continue
        }
        let backup: string | undefined
        if (destinationExists) {
          backup = join(rollbackRoot, 'backups', String(index))
          const backupSource = item.bundle === undefined ? item.plan.destination : dirname(item.plan.destination)
          await copyBackup(backupSource, backup)
          await rm(backupSource, { recursive: true, force: true })
        }
        if (item.bundle !== undefined) {
          await validateBundle(item.bundle)
          await mkdir(dirname(dirname(item.plan.destination)), { recursive: true })
          await cp(item.bundle, dirname(item.plan.destination), { recursive: true, errorOnExist: true, force: false })
        } else {
          const content = item.content ?? (await readFile(item.plan.source, 'utf8'))
          if (scanSecrets(content).length > 0) throw new Error('possible secret detected')
          await mkdir(dirname(item.plan.destination), { recursive: true })
          await writeFile(item.plan.destination, content, { encoding: 'utf8', flag: 'wx' })
        }
        entries.push({ destination: item.plan.destination, ...(backup === undefined ? {} : { backup }) })
        const verified = item.bundle !== undefined
          ? await exists(item.plan.destination)
          : await readFile(item.plan.destination, 'utf8') === item.content
        results.push({ ...item.plan, status: 'imported', verified })
      } catch (error) {
        results.push({ ...item.plan, reason: (error as Error).message, status: 'failed', verified: false })
      }
    }
    let rollbackManifest: string | undefined
    if (entries.length > 0) {
      rollbackManifest = join(rollbackRoot, 'manifest.json')
      await mkdir(dirname(rollbackManifest), { recursive: true })
      const manifest: RollbackManifest = { version: 1, createdAt: new Date().toISOString(), entries }
      await writeFile(rollbackManifest, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
    }
    const report: MemoryMeImportReport = {
      id,
      createdAt: new Date().toISOString(),
      imported: results.filter(item => item.status === 'imported').length,
      skipped: results.filter(item => item.status === 'skipped').length,
      rejected: results.filter(item => item.status === 'rejected').length,
      failed: results.filter(item => item.status === 'failed').length,
      verified: results.filter(item => item.verified).length,
      items: results,
      ...(rollbackManifest === undefined ? {} : { rollbackManifest }),
    }
    await mkdir(join(stateRoot(), 'history'), { recursive: true })
    await writeFile(join(stateRoot(), 'history', `${id}.json`), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
    return report
  }

  @Remote('rollback') async rollback(request: MemoryMeRollbackRequest): Promise<MemoryMeRollbackReport> {
    if (!request.confirmed) throw new Error('explicit rollback confirmation is required')
    const manifestPath = resolve(request.manifestPath)
    const rollbackBase = resolve(join(stateRoot(), 'rollbacks'))
    if (relative(rollbackBase, manifestPath).startsWith('..')) throw new Error('manifest is outside Memory ME rollback storage')
    const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (!isRollbackManifest(manifest)) throw new Error('invalid rollback manifest')
    let restored = 0
    let removed = 0
    const failed: string[] = []
    for (const entry of [...manifest.entries].reverse()) {
      try {
        const destinationRoot = basename(entry.destination) === 'SKILL.md' ? dirname(entry.destination) : entry.destination
        await rm(destinationRoot, { recursive: true, force: true })
        if (entry.backup !== undefined) {
          await mkdir(dirname(destinationRoot), { recursive: true })
          await cp(entry.backup, destinationRoot, { recursive: true, errorOnExist: true, force: false })
          restored += 1
        } else removed += 1
      } catch (error) {
        failed.push(`${entry.destination}: ${(error as Error).message}`)
      }
    }
    return { restored, removed, failed }
  }

  @Remote('history') async history(request: MemoryMeHistoryRequest): Promise<MemoryMeHistory> {
    const limit = Math.min(Math.max(request.limit ?? 20, 1), 100)
    try {
      const names = (await readdir(join(stateRoot(), 'history'))).filter(name => name.endsWith('.json')).sort().reverse()
      const reports: MemoryMeImportReport[] = []
      for (const name of names.slice(0, limit))
        reports.push(JSON.parse(await readFile(join(stateRoot(), 'history', name), 'utf8')) as MemoryMeImportReport)
      return { reports }
    } catch {
      return { reports: [] }
    }
  }

  @Remote('exportMemory') async exportMemory(request: MemoryMeExportRequest): Promise<MemoryMeExport> {
    const items: MemoryMeExportItem[] = []
    if (request.includeGlobal) {
      const instructions = join(memoryHome(), 'AGENTS.md')
      if (await exists(instructions))
        items.push({ kind: 'instructions', source: instructions, relativePath: 'AGENTS.md', content: await readFile(instructions, 'utf8') })
      await exportSkillRoot(join(memoryHome(), 'skills'), 'skills', items)
    }
    if (request.includeProject) {
      const root = projectRoot(request.projectRoot)
      await validateProjectRoot(root)
      const instructions = join(root, 'AGENTS.md')
      if (await exists(instructions))
        items.push({ kind: 'instructions', source: instructions, relativePath: 'AGENTS.md', content: await readFile(instructions, 'utf8') })
      await exportSkillRoot(join(root, '.dsh', 'skills'), join('.dsh', 'skills'), items)
    }
    return { generatedAt: new Date().toISOString(), items }
  }
}

export default MemoryMeGateway
