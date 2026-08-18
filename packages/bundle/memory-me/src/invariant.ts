import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@brianna-chen/dsh-memory-me'
export const name = 'memory-me-bundle-invariant'
export const inject = ['invariants']
// No runtime invariant: this package only composes independently validated plugins.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
