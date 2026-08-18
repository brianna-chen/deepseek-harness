import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {
  ComeHereDiscovery,
  ComeHereImportReport,
  ComeHereImportRequest,
  ComeHerePreview,
  ComeHerePreviewRequest,
} from '@deepseek-ai/dsh-api-remotes/client'
import { ComeHereSection, type ComeHereInjected } from './ComeHereSection.tsx'
import { en, zh, type ComeHereLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.comeHere': ComeHereLocaleKey
  }
}
const NS = 'settings.comeHere'
export const inject = ['slots', 'locale', 'remote', 'remote.comeHere']
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-come-here: dictionaries')
  const value = <T>(response: {
    readonly ok: boolean
    readonly value?: T
    readonly error?: { readonly code: string; readonly message: string }
  }): T => {
    if (!response.ok || response.value === undefined)
      throw new Error(response.error?.message ?? 'ComeHere request failed')
    return response.value
  }
  const injected = (): ComeHereInjected => ({
    discover: async request => value<ComeHereDiscovery>(await ctx.remote.comeHere.discover(request)),
    preview: async request => value<ComeHerePreview>(await ctx.remote.comeHere.preview(request)),
    importMemory: async request => value<ComeHereImportReport>(await ctx.remote.comeHere.importMemory(request)),
  })
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      { name: 'settings.section', id: 'come-here', order: 30, label: () => t('nav'), locale: NS, inject: injected },
      ComeHereSection,
    ),
  )
}
export type { ComeHerePreviewRequest, ComeHereImportRequest }
