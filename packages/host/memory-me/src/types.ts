export type MemoryMePlatform = 'codex' | 'claude-code' | 'harness'
export type MemoryMeScope = 'global' | 'project'
export type MemoryMeKind = 'instructions' | 'skill'
export type MemoryMeConflictResolution = 'skip' | 'rename' | 'replace' | 'merge'

export interface MemoryMeCandidate {
  readonly id: string
  readonly platform: MemoryMePlatform
  readonly scope: MemoryMeScope
  readonly kind: MemoryMeKind
  readonly source: string
  readonly name: string
  readonly size: number
  readonly destination: string
  readonly conflict: boolean
}

export interface MemoryMeDiscoverRequest {
  readonly platforms: readonly Exclude<MemoryMePlatform, 'harness'>[]
  readonly includeGlobal: boolean
  readonly includeProject: boolean
  readonly projectRoot?: string
}

export interface MemoryMeDiscovery {
  readonly candidates: readonly MemoryMeCandidate[]
  readonly warnings: readonly string[]
}

export interface MemoryMeUpload {
  readonly id: string
  readonly platform: Exclude<MemoryMePlatform, 'harness'>
  readonly scope: MemoryMeScope
  readonly fileName: string
  readonly relativePath: string
  readonly content: string
}

export interface MemoryMePreviewRequest {
  readonly discovery: MemoryMeDiscoverRequest
  readonly candidateIds: readonly string[]
  readonly uploads: readonly MemoryMeUpload[]
  readonly renameSkillConflicts: boolean
  readonly conflictResolutions?: Readonly<Record<string, MemoryMeConflictResolution>>
  readonly manualContents?: Readonly<Record<string, string>>
}

export interface MemoryMeSecretFinding {
  readonly line: number
  readonly kind: 'private-key' | 'credential' | 'api-token'
  readonly suggestion: string
}

export interface MemoryMePlanItem {
  readonly id: string
  readonly kind: MemoryMeKind
  readonly source: string
  readonly destination: string
  readonly action: 'create' | 'rename' | 'replace' | 'merge' | 'skip' | 'reject'
  readonly reason?: string
  readonly sourcePreview?: string
  readonly destinationPreview?: string
  readonly additions: number
  readonly deletions: number
  readonly secretFindings: readonly MemoryMeSecretFinding[]
}

export interface MemoryMePreview {
  readonly items: readonly MemoryMePlanItem[]
  readonly totalBytes: number
  readonly declaration: readonly string[]
}

export interface MemoryMeImportRequest extends MemoryMePreviewRequest {
  readonly confirmed: boolean
}

export interface MemoryMeImportResultItem extends MemoryMePlanItem {
  readonly status: 'imported' | 'skipped' | 'rejected' | 'failed'
  readonly verified: boolean
}

export interface MemoryMeImportReport {
  readonly id: string
  readonly createdAt: string
  readonly imported: number
  readonly skipped: number
  readonly rejected: number
  readonly failed: number
  readonly verified: number
  readonly items: readonly MemoryMeImportResultItem[]
  readonly rollbackManifest?: string
}

export interface MemoryMeRollbackRequest {
  readonly manifestPath: string
  readonly confirmed: boolean
}

export interface MemoryMeRollbackReport {
  readonly restored: number
  readonly removed: number
  readonly failed: readonly string[]
}

export interface MemoryMeHistoryRequest {
  readonly limit?: number
}

export interface MemoryMeHistory {
  readonly reports: readonly MemoryMeImportReport[]
}

export interface MemoryMeExportRequest {
  readonly includeGlobal: boolean
  readonly includeProject: boolean
  readonly projectRoot?: string
}

export interface MemoryMeExportItem {
  readonly kind: MemoryMeKind
  readonly source: string
  readonly relativePath: string
  readonly content: string
}

export interface MemoryMeExport {
  readonly generatedAt: string
  readonly items: readonly MemoryMeExportItem[]
}
