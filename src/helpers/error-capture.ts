/**
 * Deduplicated error capture helper for recoverable/suppressed failures.
 *
 * @module @goobits/logger/helpers
 */

import type { ErrorCollector, ScopedErrorCollector } from '../core/error-collector.ts'
import type { LogContext, Logger } from '../core/types.ts'
import { errorWithCause, serializeError } from './error-cause.ts'

/** Severity used when emitting a captured error. */
export type ErrorCaptureLevel = 'error' | 'warn'

/** Result returned by {@link captureError}. */
export interface ErrorCaptureResult {
	/** True when this call emitted/collected the error. */
	readonly captured: boolean
	/** True when a prior capture with the same fingerprint was already seen. */
	readonly duplicate: boolean
	/** Stable fingerprint used for dedupe. */
	readonly fingerprint: string
}

/** Options accepted by {@link captureError}. */
export interface ErrorCaptureOptions {
	/** Extra structured context. Prefer flat, stable keys. */
	readonly context?: LogContext
	/** Optional bounded collector for after-the-fact inspection. */
	readonly collector?: ErrorCollector | ScopedErrorCollector
	/** Override the generated dedupe key when the caller has a stable operation id. */
	readonly dedupeKey?: string
	/** Logger level for recoverable failures. Default: `error`. */
	readonly level?: ErrorCaptureLevel
	/** Disable dedupe for one capture. Default: false. */
	readonly allowDuplicates?: boolean
}

const MAX_SEEN_FINGERPRINTS = 500
const seenFingerprints = new Set<string>()

/**
 * Capture a recoverable error once per fingerprint.
 *
 * This helper is for code that intentionally keeps going after a failure but
 * still needs the failure to be visible. It emits structured error fields via
 * the supplied logger and optionally records the same Error in a collector.
 *
 * @param logger - Logger compatible with the `@goobits/logger` interface.
 * @param message - Human-readable operation failure summary.
 * @param error - Thrown value.
 * @param options - Capture options.
 */
export function captureError(
	logger: Logger,
	message: string,
	error: unknown,
	options: ErrorCaptureOptions = {}
): ErrorCaptureResult {
	const context = options.context ?? {}
	const fingerprint = options.dedupeKey ?? createErrorFingerprint(message, error, context)
	const duplicate = !options.allowDuplicates && seenFingerprints.has(fingerprint)
	if (duplicate) {
		return { captured: false, duplicate: true, fingerprint }
	}

	if (!options.allowDuplicates) rememberFingerprint(fingerprint)

	if (options.level === 'warn') {
		logger.warn(message, { ...serializeError(error), ...context })
	} else {
		errorWithCause(logger, message, error, context)
	}

	collectError(options.collector, error, context)
	return { captured: true, duplicate: false, fingerprint }
}

/** Test-only: clear the process-local dedupe cache. */
export function _resetErrorCaptureForTests(): void {
	seenFingerprints.clear()
}

function rememberFingerprint(fingerprint: string): void {
	seenFingerprints.add(fingerprint)
	if (seenFingerprints.size <= MAX_SEEN_FINGERPRINTS) return
	const oldest = seenFingerprints.values().next().value as string | undefined
	if (oldest) seenFingerprints.delete(oldest)
}

function createErrorFingerprint(message: string, error: unknown, context: LogContext): string {
	const serialized = serializeError(error)
	const operation = context['operation'] ?? context['component'] ?? context['event'] ?? ''
	return stableStringify({
		message,
		operation,
		error_type: serialized['error_type'],
		error_message: serialized['error_message'] ?? serialized['error_value']
	})
}

function collectError(
	collector: ErrorCollector | ScopedErrorCollector | undefined,
	error: unknown,
	context: LogContext
): void {
	if (!collector) return
	const normalized = error instanceof Error ? error : new Error(String(error))
	if ('collect' in collector) collector.collect(normalized, context)
	else collector.record(normalized, context)
}

function stableStringify(value: unknown): string {
	if (!value || typeof value !== 'object') return JSON.stringify(value)
	if (Array.isArray(value)) return `[${ value.map(stableStringify).join(',') }]`
	const entries = Object.entries(value as Record<string, unknown>)
		.sort(([ a ], [ b ]) => a.localeCompare(b))
		.map(([ key, item ]) => `${ JSON.stringify(key) }:${ stableStringify(item) }`)
	return `{${ entries.join(',') }}`
}
