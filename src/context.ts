/**
 * AsyncLocalStorage-backed context propagation for `@goobits/logger`.
 *
 * Import from this subpath when you need cross-async-boundary context
 * propagation. On runtimes without `node:async_hooks`, falls back to a
 * single-slot context (correct for sequential code).
 *
 * Intentionally NOT in the root barrel — the `node:async_hooks` import
 * lives behind a dynamic import in `context/store.ts`, but pulling the
 * subpath at all may unnecessarily inflate non-Node bundles.
 *
 * @module @goobits/logger/context
 */

export { withLogContextAsync, withRequestId } from './context/async-context.ts'
export { type LogContextKey, LogContextKeys } from './context/keys.ts'
