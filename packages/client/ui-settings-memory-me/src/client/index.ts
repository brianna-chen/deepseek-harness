import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {
  MemoryMeDiscovery,
  MemoryMeExport,
  MemoryMeExportRequest,
  MemoryMeHistory,
  MemoryMeHistoryRequest,
  MemoryMeImportReport,
  MemoryMeImportRequest,
  MemoryMePreview,
  MemoryMePreviewRequest,
  MemoryMeRollbackReport,
  MemoryMeRollbackRequest,
} from '@deepseek-ai/dsh-api-remotes/client'
import { MemoryMeSection, type MemoryMeInjected } from './MemoryMeSection.tsx'
import { en, zh, type MemoryMeLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.memoryMe': MemoryMeLocaleKey
  }
}
const NS = 'settings.memoryMe'
export const inject = ['slots', 'locale', 'remote', 'remote.memoryMe']
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-memory-me: dictionaries')
  const value = <T>(response: {
    readonly ok: boolean
    readonly value?: T
    readonly error?: { readonly code: string; readonly message: string }
  }): T => {
    if (!response.ok || response.value === undefined)
      throw new Error(response.error?.message ?? 'MemoryMe request failed')
    return response.value
  }
  const injected = (): MemoryMeInjected => ({
    discover: async request => value<MemoryMeDiscovery>(await ctx.remote.memoryMe.discover(request)),
    preview: async request => value<MemoryMePreview>(await ctx.remote.memoryMe.preview(request)),
    importMemory: async request => value<MemoryMeImportReport>(await ctx.remote.memoryMe.importMemory(request)),
    rollback: async request => value<MemoryMeRollbackReport>(await ctx.remote.memoryMe.rollback(request)),
    history: async request => value<MemoryMeHistory>(await ctx.remote.memoryMe.history(request)),
    exportMemory: async request => value<MemoryMeExport>(await ctx.remote.memoryMe.exportMemory(request)),
  })
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      { name: 'settings.section', id: 'memory-me', order: 30, label: () => t('nav'), locale: NS, inject: injected },
      MemoryMeSection,
    ),
  )
}
export type {
  MemoryMeExportRequest,
  MemoryMeHistoryRequest,
  MemoryMePreviewRequest,
  MemoryMeImportRequest,
  MemoryMeRollbackRequest,
}
