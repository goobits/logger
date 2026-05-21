/**
 * Time an operation and emit two log lines:
 *
 *   - `info`  at start: `<operation> start`
 *   - `info`  at end:   `<operation> complete` with `duration_ms` context
 *
 * For operations that throw, emits an `error` with `duration_ms` and the
 * error fields (via `errorWithCause`) before re-throwing.
 *
 * @example
 * ```ts
 * const log = createLogger('api')
 *
 * const user = await logTiming(log, 'db.findUser', async () => {
 *   return db.users.findById(id)
 * })
 * ```
 *
 * @module @goobits/logger/helpers
 */

import type { LogContext, Logger } from '../core/types.js'
import { LogContextKeys } from '../context/keys.js'
import { errorWithCause } from './error-cause.js'

function now(): number {
	if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
		return performance.now()
	}
	return Date.now()
}

/**
 * Time `fn` and log start/complete (or error) with `duration_ms`.
 *
 * @param logger The target logger.
 * @param operation Operation name; emitted in the log message and as
 *   `operation` context.
 * @param fn Sync or async function to time.
 * @param context Extra context merged into both start + end log lines.
 */
export async function logTiming<T>(
	logger: Logger,
	operation: string,
	fn: () => Promise<T> | T,
	context: LogContext = {}
): Promise<T> {
	const baseContext: LogContext = { ...context, [LogContextKeys.OPERATION]: operation }
	logger.info(`${ operation } start`, baseContext)
	const startedAt = now()
	try {
		const result = await fn()
		const durationMs = Math.round(now() - startedAt)
		logger.info(`${ operation } complete`, { ...baseContext, [LogContextKeys.DURATION_MS]: durationMs })
		return result
	} catch (error) {
		const durationMs = Math.round(now() - startedAt)
		errorWithCause(logger, `${ operation } failed`, error, { ...baseContext, [LogContextKeys.DURATION_MS]: durationMs })
		throw error
	}
}
