import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@brianna-chen/dsh-tool-memory-me'
export const name = 'tool-memory-me-invariant'
export const inject = ['invariants']
// No runtime invariant: tool registration is validated by its required services.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
