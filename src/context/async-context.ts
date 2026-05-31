/**
 * Run an async function with extra log context attached. Every `Logger.*`
 * call inside `fn` (and across any `await` it makes) automatically
 * receives the merged context, without having to thread it manually.
 *
 * Backed by `AsyncLocalStorage` on Node 22+, Bun, and Deno. On runtimes
 * without `node:async_hooks` (some edge environments, browsers), falls
 * back to a single-slot context — which is correct for sequential code
 * but loses isolation across concurrent requests. For
 * concurrency-correctness, target a runtime with AsyncLocalStorage.
 *
 * @example
 * ```ts
 * import { withLogContextAsync, withRequestId, LogContextKeys } from '@goobits/logger/context'
 * import { createLogger } from '@goobits/logger'
 *
 * const log = createLogger('api')
 *
 * await withRequestId(crypto.randomUUID(), async () => {
 *   log.info('handling request')        // <-- includes request_id automatically
 *   await doWork()
 *   log.info('done')                    // <-- still includes request_id
 * })
 * ```
 *
 * @module @goobits/logger/context
 */

import type { LogContext } from '../core/types.ts'
import { LogContextKeys } from './keys.ts'
import { runWithContext } from './store.ts'

/**
 * Run `fn` with `context` merged into the current async-local log context.
 * Every `Logger.*` call inside `fn` (including across `await` boundaries)
 * receives the merged context automatically.
 *
 * @param context - Runtime context.
 * @param fn - Function to call.
 */
export async function withLogContextAsync<T>(context: LogContext, fn: () => Promise<T> | T): Promise<T> {
	return runWithContext(context, fn)
}

/**
 * Convenience wrapper that sets a `request_id` for the duration of `fn`.
 * Equivalent to `withLogContextAsync({ [LogContextKeys.REQUEST_ID]: id }, fn)`.
 *
 * @param id - Identifier to use.
 * @param fn - Function to call.
 */
export async function withRequestId<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
	return runWithContext({ [LogContextKeys.REQUEST_ID]: id }, fn)
}
