/**
 * Standard semantic context keys. Use these constants instead of magic
 * strings when passing context to a logger or to
 * `withLogContextAsync` / `withRequestId`.
 *
 * @example
 * ```ts
 * import { LogContextKeys } from '@goobits/logger/context'
 * logger.info('user signed in', { [LogContextKeys.USER_ID]: user.id })
 * ```
 *
 * @module @goobits/logger/context
 */

export const LogContextKeys = Object.freeze({
	/** Correlation ID for a single request, propagated across logs. */
	REQUEST_ID: 'request_id',
	/** Persistent session identifier. */
	SESSION_ID: 'session_id',
	/** Authenticated user identifier. */
	USER_ID: 'user_id',
	/** HTTP method (GET / POST / PUT / DELETE / ...). */
	METHOD: 'method',
	/** Route or URL path. */
	PATH: 'path',
	/** Semantic operation name (e.g. `'db.query'`, `'send.email'`). */
	OPERATION: 'operation',
	/** Component or subsystem name. */
	COMPONENT: 'component',
	/** Batch identifier for grouped work. */
	BATCH_ID: 'batch_id',
	/** Duration in milliseconds (typically emitted by `logTiming`). */
	DURATION_MS: 'duration_ms',
	/** Machine-readable error code. */
	ERROR_CODE: 'error_code',
	/** Error class name or category. */
	ERROR_TYPE: 'error_type',
	/** HTTP status code. */
	STATUS_CODE: 'status_code'
} as const)

/** Type-safe key from the LogContextKeys constant. */
export type LogContextKey = (typeof LogContextKeys)[keyof typeof LogContextKeys]
