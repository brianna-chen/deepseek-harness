import { useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import type {
  ComeHereCandidate,
  ComeHereConflictResolution,
  ComeHereDiscoverRequest,
  ComeHereDiscovery,
  ComeHereImportReport,
  ComeHereImportRequest,
  ComeHereImportResultItem,
  ComeHerePlatform,
  ComeHerePreview,
  ComeHerePreviewRequest,
  ComeHereUpload,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './ComeHereSection.module.css'

export interface ComeHereInjected {
  discover(request: ComeHereDiscoverRequest): Promise<ComeHereDiscovery>
  preview(request: ComeHerePreviewRequest): Promise<ComeHerePreview>
  importMemory(request: ComeHereImportRequest): Promise<ComeHereImportReport>
}
export type ComeHereProps = PropsRuntime<'settings.section'> &
  PropsLocale<'settings.comeHere'> &
  InjectFace<ComeHereInjected>
type Stage = 'source' | 'select' | 'conflict' | 'confirm' | 'importing' | 'complete'
const stages: readonly Stage[] = ['source', 'select', 'conflict', 'confirm', 'importing', 'complete']
const stageLabels = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const

export function ComeHereSection(props: ComeHereProps): ReactNode {
  const { t } = props
  const [stage, setStage] = useState<Stage>('source')
  const [platforms, setPlatforms] = useState<ComeHerePlatform[]>(['codex', 'claude-code'])
  const [includeGlobal, setGlobal] = useState(true)
  const [includeProject, setProject] = useState(false)
  const [projectRoot, setProjectRoot] = useState('')
  const [discovery, setDiscovery] = useState<ComeHereDiscovery>({ candidates: [], warnings: [] })
  const [selected, setSelected] = useState<string[]>([])
  const [uploads, setUploads] = useState<ComeHereUpload[]>([])
  const [resolutions, setResolutions] = useState<Record<string, ComeHereConflictResolution>>({})
  const [plan, setPlan] = useState<ComeHerePreview>()
  const [confirmed, setConfirmed] = useState(false)
  const [report, setReport] = useState<ComeHereImportReport>()
  const [manifests, setManifests] = useState<string[]>([])
  const [error, setError] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentItem, setCurrentItem] = useState('')
  const request = useMemo<ComeHereDiscoverRequest>(
    () => ({ platforms, includeGlobal, includeProject, ...(includeProject ? { projectRoot } : {}) }),
    [platforms, includeGlobal, includeProject, projectRoot],
  )
  const stageIndex = stages.indexOf(stage)
  const togglePlatform = (platform: ComeHerePlatform): void => {
    setPlatforms(current =>
      current.includes(platform) ? current.filter(item => item !== platform) : [...current, platform],
    )
  }
  const previewRequest = (
    nextResolutions: Readonly<Record<string, ComeHereConflictResolution>> = resolutions,
  ): ComeHerePreviewRequest => ({
    discovery: request,
    candidateIds: selected,
    uploads,
    renameSkillConflicts: false,
    skillConflictResolutions: nextResolutions,
  })
  const scan = async (): Promise<void> => {
    setError(false)
    setProgress(8)
    try {
      const result = await props.discover(request)
      setDiscovery(result)
      setSelected(result.candidates.map(item => item.id))
      setProgress(24)
      setStage('select')
    } catch {
      setError(true)
      setProgress(0)
    }
  }
  const files = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const chosen = [...(event.currentTarget.files ?? [])]
    const next: ComeHereUpload[] = []
    for (const [index, file] of chosen.entries())
      next.push({
        id: `upload:${Date.now()}:${index}`,
        platform: platforms[0] ?? 'codex',
        scope: includeProject ? 'project' : 'global',
        fileName: file.name,
        relativePath: file.webkitRelativePath,
        content: await file.text(),
      })
    setUploads(next)
  }
  const findConflicts = async (): Promise<void> => {
    setError(false)
    setProgress(38)
    try {
      const next = Object.fromEntries([
        ...discovery.candidates
          .filter(item => item.conflict && item.kind === 'skill')
          .map(item => [item.id, 'skip'] as const),
        ...uploads.map(item => [item.id, 'skip'] as const),
      ])
      setResolutions(next)
      setPlan(await props.preview(previewRequest(next)))
      setProgress(48)
      setStage('conflict')
    } catch {
      setError(true)
    }
  }
  const confirmPlan = async (): Promise<void> => {
    setError(false)
    setProgress(58)
    try {
      setPlan(await props.preview(previewRequest()))
      setConfirmed(false)
      setProgress(66)
      setStage('confirm')
    } catch {
      setError(true)
    }
  }
  const runImport = async (): Promise<void> => {
    if (!confirmed || plan === undefined) return
    setStage('importing')
    setProgress(70)
    setError(false)
    setManifests([])
    const results: ComeHereImportResultItem[] = []
    const rollbackManifests: string[] = []
    try {
      for (const [index, item] of plan.items.entries()) {
        setCurrentItem(item.source)
        const one = await props.importMemory({
          discovery: request,
          candidateIds: selected.includes(item.id) ? [item.id] : [],
          uploads: uploads.filter(upload => upload.id === item.id),
          renameSkillConflicts: false,
          skillConflictResolutions: resolutions,
          confirmed: true,
        })
        results.push(...one.items)
        if (one.rollbackManifest !== undefined) rollbackManifests.push(one.rollbackManifest)
        setProgress(70 + Math.round(((index + 1) / plan.items.length) * 30))
      }
      const count = (status: ComeHereImportResultItem['status']): number =>
        results.filter(item => item.status === status).length
      setReport({
        imported: count('imported'),
        skipped: count('skipped'),
        rejected: count('rejected'),
        failed: count('failed'),
        items: results,
        ...(rollbackManifests[0] === undefined ? {} : { rollbackManifest: rollbackManifests[0] }),
      })
      setManifests(rollbackManifests)
      setProgress(100)
      setStage('complete')
    } catch {
      setError(true)
      setStage('confirm')
      setProgress(66)
    }
  }
  const reset = (): void => {
    setStage('source')
    setDiscovery({ candidates: [], warnings: [] })
    setSelected([])
    setUploads([])
    setResolutions({})
    setPlan(undefined)
    setReport(undefined)
    setManifests([])
    setConfirmed(false)
    setError(false)
    setProgress(0)
    setCurrentItem('')
  }
  const candidateRow = (item: ComeHereCandidate): ReactNode => (
    <label className={css.item} key={item.id}>
      <input
        type="checkbox"
        checked={selected.includes(item.id)}
        onChange={() => {
          setSelected(current =>
            current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id],
          )
        }}
      />
      <span>
        <strong>{item.name}</strong>
        <small>{item.source}</small>
      </span>
      {item.conflict ? <em>{t('conflictBadge')}</em> : null}
    </label>
  )
  const conflicts = plan?.items.filter(item => item.action === 'skip' && item.reason === 'destination exists') ?? []
  return (
    <div className={css.root}>
      <header>
        <h2>{t('title')}</h2>
        <p>{t('intro')}</p>
      </header>
      <ol className={css.stepper}>
        {stages.map((item, index) => (
          <li key={item} data-state={index < stageIndex ? 'done' : index === stageIndex ? 'active' : 'pending'}>
            <span>{index < stageIndex ? '✓' : index + 1}</span>
            <small>{t(stageLabels[index] ?? 'source')}</small>
          </li>
        ))}
      </ol>
      <section className={css.notice}>
        <h3>{t('declaration')}</h3>
        <ul>
          <li>{t('declaration1')}</li>
          <li>{t('declaration2')}</li>
          <li>{t('declaration3')}</li>
        </ul>
      </section>
      <div className={css.progress} aria-label={t('progress')} aria-valuenow={progress} role="progressbar">
        <span style={{ width: `${progress}%` }} />
      </div>
      {error ? (
        <p role="alert" className={css.error}>
          {t('error')}
        </p>
      ) : null}
      {stage === 'source' ? (
        <section>
          <h3>{t('source')}</h3>
          <div className={css.options}>
            <label>
              <input
                type="checkbox"
                checked={platforms.includes('codex')}
                onChange={() => {
                  togglePlatform('codex')
                }}
              />
              {t('codex')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={platforms.includes('claude-code')}
                onChange={() => {
                  togglePlatform('claude-code')
                }}
              />
              {t('claude')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeGlobal}
                onChange={(event) => {
                  setGlobal(event.currentTarget.checked)
                }}
              />
              {t('global')}
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeProject}
                onChange={(event) => {
                  setProject(event.currentTarget.checked)
                }}
              />
              {t('project')}
            </label>
          </div>
          {includeProject ? (
            <input
              className={css.path}
              value={projectRoot}
              placeholder={t('projectPath')}
              onChange={(event) => {
                setProjectRoot(event.currentTarget.value)
              }}
            />
          ) : null}
          <label className={css.upload}>
            {t('upload')}
            <input
              type="file"
              accept=".md,text/markdown"
              multiple
              onChange={(event) => {
                void files(event)
              }}
            />
          </label>
          <div className={css.actions}>
            <button
              type="button"
              disabled={
                platforms.length === 0 ||
                (!includeGlobal && !includeProject) ||
                (includeProject && projectRoot.length === 0)
              }
              onClick={() => void scan()}
            >
              {progress === 8 ? t('scanning') : t('scan')}
            </button>
          </div>
        </section>
      ) : null}
      {stage === 'select' ? (
        <section>
          <h3>{t('select')}</h3>
          <p className={css.hint}>{t('selectHint')}</p>
          <div className={css.list}>
            {discovery.candidates.map(candidateRow)}
            {discovery.candidates.length === 0 && uploads.length === 0 ? <p>{t('empty')}</p> : null}
            {uploads.map(item => (
              <div className={css.item} key={item.id}>
                <span>
                  <strong>{item.fileName}</strong>
                  <small>{item.relativePath || t('browserUpload')}</small>
                </span>
              </div>
            ))}
          </div>
          <div className={css.actions}>
            <button type="button" className={css.secondary} onClick={reset}>
              {t('back')}
            </button>
            <button
              type="button"
              disabled={selected.length === 0 && uploads.length === 0}
              onClick={() => void findConflicts()}
            >
              {t('next')}
            </button>
          </div>
        </section>
      ) : null}
      {stage === 'conflict' && plan ? (
        <section>
          <h3>{t('conflictTitle')}</h3>
          <p className={css.hint}>{conflicts.length === 0 ? t('noConflicts') : t('conflictHint')}</p>
          <div className={css.list}>
            {conflicts.map(item => (
              <div className={css.conflict} key={item.id}>
                <span>
                  <strong>{item.source}</strong>
                  <small>{item.destination}</small>
                </span>
                {item.kind === 'skill' ? (
                  <div className={css.choice}>
                    <label>
                      <input
                        type="radio"
                        name={`resolution-${item.id}`}
                        checked={resolutions[item.id] !== 'rename'}
                        onChange={() => {
                          setResolutions(current => ({ ...current, [item.id]: 'skip' }))
                        }}
                      />
                      {t('skip')}
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`resolution-${item.id}`}
                        checked={resolutions[item.id] === 'rename'}
                        onChange={() => {
                          setResolutions(current => ({ ...current, [item.id]: 'rename' }))
                        }}
                      />
                      {t('rename')}
                    </label>
                  </div>
                ) : (
                  <em>{t('skipOnly')}</em>
                )}
              </div>
            ))}
          </div>
          <div className={css.actions}>
            <button
              type="button"
              className={css.secondary}
              onClick={() => {
                setStage('select')
                setProgress(24)
              }}
            >
              {t('back')}
            </button>
            <button type="button" onClick={() => void confirmPlan()}>
              {t('next')}
            </button>
          </div>
        </section>
      ) : null}
      {stage === 'confirm' && plan ? (
        <section>
          <h3>{t('confirmTitle')}</h3>
          <div className={css.review}>
            <span>
              {t('reviewSelected')}
              <strong>{plan.items.length}</strong>
            </span>
            <span>
              {t('reviewWrites')}
              <strong>
                {plan.items.filter(item => item.action === 'create' || item.action === 'rename').length}
              </strong>
            </span>
            <span>
              {t('reviewSkipped')}
              <strong>{plan.items.filter(item => item.action === 'skip' || item.action === 'reject').length}</strong>
            </span>
          </div>
          <ul className={css.plan}>
            {plan.items.map(item => (
              <li key={item.id} data-action={item.action}>
                <strong>{item.action}</strong>
                <span>{item.source}</span>
                <small>{item.destination || item.reason}</small>
              </li>
            ))}
          </ul>
          <label className={css.confirm}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => {
                setConfirmed(event.currentTarget.checked)
              }}
            />
            {t('confirm')}
          </label>
          <div className={css.actions}>
            <button
              type="button"
              className={css.secondary}
              onClick={() => {
                setStage('conflict')
                setConfirmed(false)
                setProgress(48)
              }}
            >
              {t('back')}
            </button>
            <button type="button" disabled={!confirmed} onClick={() => void runImport()}>
              {t('import')}
            </button>
          </div>
        </section>
      ) : null}
      {stage === 'importing' ? (
        <section className={css.busy}>
          <h3>{t('importing')}</h3>
          <p>{currentItem}</p>
          <progress value={progress} max="100" />
          <small>{progress}%</small>
        </section>
      ) : null}
      {stage === 'complete' && report ? (
        <section>
          <h3>{t('complete')}</h3>
          <div className={css.summary}>
            <span>
              {t('imported')}: {report.imported}
            </span>
            <span>
              {t('skipped')}: {report.skipped}
            </span>
            <span>
              {t('rejected')}: {report.rejected}
            </span>
            <span>
              {t('failed')}: {report.failed}
            </span>
          </div>
          {manifests.length > 0 ? (
            <details>
              <summary>
                {t('rollback')} ({manifests.length})
              </summary>
              <ul>
                {manifests.map(path => (
                  <li key={path}>
                    <code>{path}</code>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <ul className={css.plan}>
            {report.items.map(item => (
              <li key={item.id} data-action={item.status}>
                <strong>{item.status}</strong>
                <span>{item.source}</span>
                <small>{item.destination || item.reason}</small>
              </li>
            ))}
          </ul>
          <div className={css.actions}>
            <button type="button" onClick={reset}>
              {t('reset')}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
