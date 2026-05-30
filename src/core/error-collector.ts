/**
 * Error collector — captures a bounded history of errors with their context
 * and timestamp, for after-the-fact inspection (test assertions, error
 * dashboards, crash reports). Independent of the logging pipeline: collecting
 * an error does NOT emit a log line, and logging does NOT auto-collect. Wire
 * the two together at the call site if you want both.
 *
 * @module @goobits/logger
 */

import type { LogContext } from './types.js'

/** A recorded error with the context and time it was collected. */
export interface ErrorEntry {
	readonly error: Error
	readonly context: LogContext
	readonly timestamp: number
}

/** Bounded, in-memory error history. Returned by {@link createErrorCollector}. */
export interface ErrorCollector {
	/** Record an error with optional structured context. */
	collect(error: Error, context?: LogContext): void
	/** All recorded entries, oldest first (defensively copied). */
	getEntries(): ErrorEntry[]
	/** Number of entries currently retained. */
	count(): number
	/** Drop all recorded entries. */
	clear(): void
}

/** Default cap on retained entries; oldest are evicted past this. */
const DEFAULT_MAX_ENTRIES = 100

/**
 * Create an error collector that retains up to `maxEntries` of the most
 * recent errors (default 100). When the cap is exceeded the oldest entry is
 * evicted, so the collector never grows unbounded.
 *
 * `timestamp` is read from `Date.now()` at collection time. Pass a clock via
 * `now` for deterministic tests.
 *
 * @example
 *   const errors = createErrorCollector()
 *   errors.collect(new Error('boom'), { route: '/checkout' })
 *   errors.count() // 1
 */
export function createErrorCollector(
	maxEntries: number = DEFAULT_MAX_ENTRIES,
	now: () => number = () => Date.now()
): ErrorCollector {
	const cap = Math.max(1, Math.floor(maxEntries))
	const entries: ErrorEntry[] = []

	return {
		collect(error: Error, context: LogContext = {}): void {
			entries.push({ error, context, timestamp: now() })
			if (entries.length > cap) entries.shift()
		},
		getEntries(): ErrorEntry[] {
			return entries.slice()
		},
		count(): number {
			return entries.length
		},
		clear(): void {
			entries.length = 0
		}
	}
}
