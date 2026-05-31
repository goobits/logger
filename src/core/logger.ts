/**
 * Logger class — a production-grade implementation of the pluggable
 * `Logger` interface. Wraps `console.*` under the hood, with structured
 * formatting (JSON or human), module-scoped levels, and context
 * propagation via `child()`.
 *
 * @module @goobits/logger
 */

import { getCurrentLogContext } from '../context/store.ts'
import { getActiveFormat, getEffectiveLevel, getInternalState, isEnabled } from './config.ts'
import { formatHuman, formatJson } from './format.ts'
import {
	type LogContext,
	type Logger as LoggerInterface,
	type LoggerInstanceOptions,
	LogLevel,
	type LogLevelValue } from './types.ts'

function emit(
	level: LogLevelValue,
	moduleName: string | null,
	message: string,
	mergedContext: LogContext,
	extraArgs: unknown[]
): void {
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
	if (level === LogLevel.ERROR) console.error(line, ...extraArgs)
	else if (level === LogLevel.WARN) console.warn(line, ...extraArgs)
	else if (level === LogLevel.DEBUG) console.debug(line, ...extraArgs)
	else console.log(line, ...extraArgs)
}

function isRecord(value: unknown): value is LogContext {
	return Boolean(value) &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		!(value instanceof Error)
}

function normalizeArgs(args: unknown[]): {
	message: string
	context: LogContext | undefined
	extraArgs: unknown[]
} {
	const [ first, ...rest ] = args
	const message = typeof first === 'string' ? first : String(first)
	if (rest.length === 0) {
		return { message, context: undefined, extraArgs: [] }
	}
	if (rest.length === 1 && isRecord(rest[0])) {
		return { message, context: rest[0], extraArgs: [] }
	}
	return { message, context: undefined, extraArgs: rest }
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

	/**
	 * Creates a Logger instance.
	 *
	 * @param moduleName - module name.
	 * @param options - options.
	 */
	constructor(moduleName?: string | null, options: LoggerInstanceOptions = {}) {
		this.moduleName = moduleName ?? null
		this.baseContext = options.context ?? {}
	}

	private compose(context: LogContext | undefined): LogContext {
		const asyncContext = getCurrentLogContext()

		// Precedence: per-call > base > async-local.
		return { ...asyncContext, ...this.baseContext, ...(context ?? {}) }
	}

	/**
	 * Name.
	 */
	get name(): string {
		return this.moduleName ?? ''
	}

	/**
	 * Debug.
	 *
	 * @param args - args.
	 */
	debug(...args: unknown[]): void {
		const { message, context, extraArgs } = normalizeArgs(args)
		emit(LogLevel.DEBUG, this.moduleName, message, this.compose(context), extraArgs)
	}

	/**
	 * Info.
	 *
	 * @param args - args.
	 */
	info(...args: unknown[]): void {
		const { message, context, extraArgs } = normalizeArgs(args)
		emit(LogLevel.INFO, this.moduleName, message, this.compose(context), extraArgs)
	}

	/**
	 * Warn.
	 *
	 * @param args - args.
	 */
	warn(...args: unknown[]): void {
		const { message, context, extraArgs } = normalizeArgs(args)
		emit(LogLevel.WARN, this.moduleName, message, this.compose(context), extraArgs)
	}

	/**
	 * Error.
	 *
	 * @param args - args.
	 */
	error(...args: unknown[]): void {
		const { message, context, extraArgs } = normalizeArgs(args)
		emit(LogLevel.ERROR, this.moduleName, message, this.compose(context), extraArgs)
	}

	/**
	 * Create a child logger with an extended base context. The child
	 * inherits the parent's module name and merges the parent's context
	 * with `additionalContext`.
	 *
	 * @param additionalContext - additional context value.
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
	 * Registry of module names seen by `createLogger`. Used for introspection
	 * via {@link getLoggerNames}; it does NOT change instance identity —
	 * `createLogger('x')` still returns a fresh `Logger` each call.
	 */
const moduleNames = new Set<string>()

/**
 * Factory: create a logger with a module name and optional base context.
 * Equivalent to `new Logger(moduleName, { context })`; provided for
 * callers who prefer a function over `new`.
 *
 * Named loggers record their module name for {@link getLoggerNames}.
 *
 * @param moduleName - module name value.
 * @param context - Runtime context.
 */
export function createLogger(moduleName?: string, context: LogContext = {}): Logger {
	if (moduleName) moduleNames.add(moduleName)
	return new Logger(moduleName ?? null, { context })
}

/**
 * Names of every module passed to {@link createLogger} so far, in insertion
 * order. Useful for tooling that wants to list or configure levels for all
 * known modules. Pair with `LoggerConfig.setModuleLevel` / `setModuleLevel`.
 */
export function getLoggerNames(): string[] {
	return Array.from(moduleNames)
}

/** Test-only: forget all recorded module names. Not part of the public API. */
export function _resetLoggerRegistryForTests(): void {
	moduleNames.clear()
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
