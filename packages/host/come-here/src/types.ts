export type ComeHerePlatform = 'codex' | 'claude-code'
export type ComeHereScope = 'global' | 'project'
export type ComeHereKind = 'instructions' | 'skill'
export interface ComeHereCandidate {
  readonly id: string
  readonly platform: ComeHerePlatform
  readonly scope: ComeHereScope
  readonly kind: ComeHereKind
  readonly source: string
  readonly name: string
  readonly size: number
  readonly destination: string
  readonly conflict: boolean
}
export interface ComeHereDiscoverRequest {
  readonly platforms: readonly ComeHerePlatform[]
  readonly includeGlobal: boolean
  readonly includeProject: boolean
  readonly projectRoot?: string
}
export interface ComeHereDiscovery {
  readonly candidates: readonly ComeHereCandidate[]
  readonly warnings: readonly string[]
}
export interface ComeHereUpload {
  readonly id: string
  readonly platform: ComeHerePlatform
  readonly scope: ComeHereScope
  readonly fileName: string
  readonly relativePath: string
  readonly content: string
}
export type ComeHereConflictResolution = 'skip' | 'rename'
export interface ComeHerePreviewRequest {
  readonly discovery: ComeHereDiscoverRequest
  readonly candidateIds: readonly string[]
  readonly uploads: readonly ComeHereUpload[]
  readonly renameSkillConflicts: boolean
  readonly skillConflictResolutions?: Readonly<Record<string, ComeHereConflictResolution>>
}
export interface ComeHerePlanItem {
  readonly id: string
  readonly kind: ComeHereKind
  readonly source: string
  readonly destination: string
  readonly action: 'create' | 'rename' | 'skip' | 'reject'
  readonly reason?: string
}
export interface ComeHerePreview {
  readonly items: readonly ComeHerePlanItem[]
  readonly totalBytes: number
  readonly declaration: readonly string[]
}
export interface ComeHereImportRequest extends ComeHerePreviewRequest {
  readonly confirmed: boolean
}
export interface ComeHereImportResultItem extends ComeHerePlanItem {
  readonly status: 'imported' | 'skipped' | 'rejected' | 'failed'
}
export interface ComeHereImportReport {
  readonly imported: number
  readonly skipped: number
  readonly rejected: number
  readonly failed: number
  readonly items: readonly ComeHereImportResultItem[]
  readonly rollbackManifest?: string
}
