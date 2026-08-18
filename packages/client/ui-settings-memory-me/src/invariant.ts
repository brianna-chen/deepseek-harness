import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@brianna-chen/dsh-client-ui-settings-memory-me'
export const name = 'client-ui-settings-memory-me-invariant'
export const inject = ['invariants']
/** No runtime invariant: this package owns one Settings contribution. */
const install: InvariantInstaller = () => {}
/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
