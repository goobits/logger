/**
 * Logger class — a production-grade implementation of the pluggable
 * `Logger` interface. Wraps `console.*` under the hood, with structured
 * formatting (JSON or human), module-scoped levels, and context
 * propagation via `child()`.
 *
 * @module @goobits/logger
 */

import { getCurrentLogContext } from '../context/store.js'
import { getActiveFormat, getEffectiveLevel, getInternalState, isEnabled } from './config.js'
import { formatHuman, formatJson } from './format.js'
import {
	type LogContext,
	type LogLevelValue,
	type Logger as LoggerInterface,
	type LoggerInstanceOptions,
	LogLevel
} from './types.js'

function emit(level: LogLevelValue, moduleName: string | null, message: string, mergedContext: LogContext): void {
	if (!isEnabled()) return
	if (level < getEffectiveLevel(moduleName)) return

	const state = getInternalState()
	const timestamp = state.showTimestamps ? new Date().toISOString() : null
	const input = {
		level,
		moduleName,
		message,
		mergedContext,
		timestamp,
		globalPrefix: state.globalPrefix
	}
	const line = getActiveFormat() === 'json' ? formatJson(input) : formatHuman(input)

	// Route by severity. We intentionally use console.* so consumers can
	// redirect via standard test/console capture mechanisms.
	if (level === LogLevel.ERROR) console.error(line)
	else if (level === LogLevel.WARN) console.warn(line)
	else if (level === LogLevel.DEBUG) console.debug(line)
	else console.log(line)
}

/**
 * Logger — accepts a module name and an optional base context, both of
 * which are merged into every emission. Implements the pluggable
 * `Logger` interface (compatible with `@goobits/security`,
 * `@goobits/sitemap`, and any other workspace package that accepts a
 * `Logger`).
 *
 * Threading context: `withLogContextAsync` (from `@goobits/logger/context`)
 * makes the current async-local context available to every `Logger`
 * instance automatically. No need to wire it through manually.
 */
export class Logger implements LoggerInterface {
	private readonly moduleName: string | null
	private readonly baseContext: LogContext

	constructor(moduleName?: string | null, options: LoggerInstanceOptions = {}) {
		this.moduleName = moduleName ?? null
		this.baseContext = options.context ?? {}
	}

	private compose(context: LogContext | undefined): LogContext {
		const asyncContext = getCurrentLogContext()
		// Precedence: per-call > base > async-local.
		return { ...asyncContext, ...this.baseContext, ...(context ?? {}) }
	}

	debug(message: string, context?: LogContext): void {
		emit(LogLevel.DEBUG, this.moduleName, message, this.compose(context))
	}

	info(message: string, context?: LogContext): void {
		emit(LogLevel.INFO, this.moduleName, message, this.compose(context))
	}

	warn(message: string, context?: LogContext): void {
		emit(LogLevel.WARN, this.moduleName, message, this.compose(context))
	}

	error(message: string, context?: LogContext): void {
		emit(LogLevel.ERROR, this.moduleName, message, this.compose(context))
	}

	/**
	 * Create a child logger with an extended base context. The child
	 * inherits the parent's module name and merges the parent's context
	 * with `additionalContext`.
	 */
	child(additionalContext: LogContext): Logger {
		return new Logger(this.moduleName, {
			context: { ...this.baseContext, ...additionalContext }
		})
	}

	/** Returns true if `DEBUG` would be emitted for this logger's module. */
	isDebugEnabled(): boolean {
		return isEnabled() && LogLevel.DEBUG >= getEffectiveLevel(this.moduleName)
	}

	/** Returns true if `INFO` would be emitted for this logger's module. */
	isInfoEnabled(): boolean {
		return isEnabled() && LogLevel.INFO >= getEffectiveLevel(this.moduleName)
	}

	/** Returns true if `WARN` would be emitted for this logger's module. */
	isWarnEnabled(): boolean {
		return isEnabled() && LogLevel.WARN >= getEffectiveLevel(this.moduleName)
	}

	/** Returns true if `ERROR` would be emitted for this logger's module. */
	isErrorEnabled(): boolean {
		return isEnabled() && LogLevel.ERROR >= getEffectiveLevel(this.moduleName)
	}
}

/**
 * Factory: create a logger with a module name and optional base context.
 * Equivalent to `new Logger(moduleName, { context })`; provided for
 * callers who prefer a function over `new`.
 */
export function createLogger(moduleName?: string, context: LogContext = {}): Logger {
	return new Logger(moduleName ?? null, { context })
}

/**
 * A module-less default `Logger` instance — convenience for casual logging
 * sites that don't need a module-scoped name. Equivalent to `new Logger()`.
 *
 * Prefer `createLogger('my-module')` in library / framework code where the
 * module name aids filtering. The default `logger` is best for one-off
 * scripts, small utilities, and consumer code that already files its calls
 * under another organizational key (request id, action name).
 */
export const logger = new Logger()

/**
 * A no-op logger that swallows every call. Use this as the default for
 * factories where silent operation is preferred over forced output.
 */
export const noopLogger: LoggerInterface = Object.freeze({
	debug(): void {},
	info(): void {},
	warn(): void {},
	error(): void {}
})
