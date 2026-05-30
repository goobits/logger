/**
 * Helper for emitting an error log with an attached `Error` (and its
 * `cause` chain) without breaking the 2-arg `Logger.error` interface
 * contract.
 *
 * The `Logger` interface is intentionally `(message, context?)` — 2
 * arguments only — so that any consumer (`@goobits/security`,
 * `@goobits/sitemap`, pino, winston) satisfies the same shape. When you
 * want to log an Error, use this helper: it stringifies the Error into a
 * structured context block and passes a single context object to the
 * underlying `logger.error()`.
 *
 * @example
 * ```ts
 * try { await doWork() }
 * catch (err) { errorWithCause(log, 'doWork failed', err, { operation: 'doWork' }) }
 * ```
 *
 * @module @goobits/logger/helpers
 */

import type { LogContext, Logger } from '../core/types.js'

function serializeError(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		const out: Record<string, unknown> = {
			error_type: error.name,
			error_message: error.message
		}
		if (error.stack) out['error_stack'] = error.stack
		if ('cause' in error && error.cause !== undefined) {
			out['error_cause'] = serializeError(error.cause)
		}
		return out
	}
	return { error_type: typeof error, error_value: error }
}

/**
 * Emit `logger.error(message, context)` with the `error` stringified into
 * structured fields (`error_type`, `error_message`, `error_stack`,
 * recursively `error_cause`).
 *
 * @param logger The target logger.
 * @param message Human-readable headline.
 * @param error The thrown value. Stringified regardless of type.
 * @param context Additional context merged after the error fields (so
 *   caller-supplied keys win on conflict).
 */
export function errorWithCause(
	logger: Logger,
	message: string,
	error: unknown,
	context: LogContext = {}
): void {
	logger.error(message, { ...serializeError(error), ...context })
}
