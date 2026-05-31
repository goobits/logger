/**
 * Error collector — captures a bounded history of errors with their context
 * and timestamp, for after-the-fact inspection (test assertions, error
 * dashboards, crash reports). Independent of the logging pipeline: collecting
 * an error does NOT emit a log line, and logging does NOT auto-collect. Wire
 * the two together at the call site if you want both.
 *
 * @module @goobits/logger
 */

import { createLogger } from './logger.ts'
import type { LogContext } from './types.ts'

/** A recorded error with the context and time it was collected. */
export interface ErrorEntry {
	readonly error: Error
	readonly context: LogContext
	readonly timestamp: number
}

/** Bounded, in-memory error history. Returned by {@link createErrorCollector}. */
export interface ErrorCollector {

	/**
 * Record an error with optional structured context.
 *
 * @param error - Error value.
 * @param context - Runtime context.
 */
	collect(error: Error, context?: LogContext): void

	/** All recorded entries, oldest first (defensively copied). */
	getEntries(): ErrorEntry[]

	/** Number of entries currently retained. */
	count(): number

	/** Drop all recorded entries. */
	clear(): void
}

/** Legacy scoped collector shape from the old Sketchpad logger. */
export interface ScopedErrorCollector {

	/**
	 * Record an error with optional structured context.
	 *
	 * @param error - Error value.
	 * @param context - Runtime context.
	 */
	record(error: Error, context?: LogContext): void

	/** Emit a grouped summary and keep entries available for callers. */
	flush(): void

	/** Drop all recorded entries. */
	clear(): void

	/** Recorded entries, oldest first. */
	readonly entries: readonly ErrorEntry[]

	/** Number of recorded entries. */
	readonly count: number

	/** Human-readable collection scope. */
	readonly scope: string
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
	 * @param maxEntries - max entries value.
	 * @param now - now value.
	 * @example
	 *   const errors = createErrorCollector()
	 *   errors.collect(new Error('boom'), { route: '/checkout' })
	 *   errors.count() // 1
	 */
export function createErrorCollector(maxEntries?: number, now?: () => number): ErrorCollector

/**
 * Creates error collector.
 *
 * @param scope - scope.
 * @param loggerName - logger name.
 */
export function createErrorCollector(scope: string, loggerName?: string): ScopedErrorCollector

/**
 * Creates error collector.
 *
 * @param first - first.
 * @param second - second.
 */
export function createErrorCollector(
	first: number | string = DEFAULT_MAX_ENTRIES,
	second: (() => number) | string = () => Date.now()
): ErrorCollector | ScopedErrorCollector {
	if (typeof first === 'string') {
		return createScopedErrorCollector(first, typeof second === 'string' ? second : 'error-collector')
	}
	const maxEntries = first
	const now = typeof second === 'function' ? second : () => Date.now()
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

function createScopedErrorCollector(scope: string, loggerName: string): ScopedErrorCollector {
	const entries: ErrorEntry[] = []

	return {
		record(error: Error, context: LogContext = {}): void {
			entries.push({ error, context, timestamp: Date.now() })
		},
		flush(): void {
			if (entries.length === 0) return

			const grouped = new Map<string, ErrorEntry[]>()
			for (const entry of entries) {
				const key = String(entry.context['type'] || entry.error.name || 'Error')
				grouped.set(key, [ ...(grouped.get(key) ?? []), entry ])
			}

			const parts: string[] = []
			for (const [ type, group ] of grouped) {
				const details = group.map(entry => entry.context['layer'] || entry.error.message).join(', ')
				parts.push(`${ type } (${ group.length }): ${ details }`)
			}

			createLogger(loggerName).warn(`${ scope }: ${ entries.length } error(s)\n  ${ parts.join('\n  ') }`)
		},
		clear(): void {
			entries.length = 0
		},
		get entries(): readonly ErrorEntry[] {
			return entries
		},
		get count(): number {
			return entries.length
		},
		get scope(): string {
			return scope
		}
	}
}
