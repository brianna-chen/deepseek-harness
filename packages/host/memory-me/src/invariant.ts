import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@brianna-chen/dsh-host-memory-me'
export const name = 'host-memory-me-invariant'
export const inject = ['invariants']
/** No runtime invariant: each request is validated at its filesystem operation. */
const install: InvariantInstaller = () => {}
/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
