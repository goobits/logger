/**
 * Type definitions for the pluggable logger interface and its concrete
 * configuration shape. The `Logger` interface here is intentionally
 * identical to the one exposed by `@goobits/security` and `@goobits/sitemap`
 * — any logger that satisfies it (this package, pino, winston, console)
 * works as a drop-in dependency for those packages.
 *
 * @module @goobits/logger
 */

/** Arbitrary structured context attached to a log call. */
export type LogContext = Record<string, unknown>

/**
 * Pluggable logger interface. Every method takes a message + optional
 * context object. Any caller satisfying this shape can be passed to
 * `@goobits/security`, `@goobits/sitemap`, or any other workspace package
 * that accepts a `Logger`.
 */
export interface Logger {
	debug(message: string, context?: LogContext): void
	info(message: string, context?: LogContext): void
	warn(message: string, context?: LogContext): void
	error(message: string, context?: LogContext): void
}

/** Numeric log levels, in increasing severity. `NONE` disables output. */
export const LogLevel = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
	NONE: 4
} as const

/** Numeric value of a `LogLevel`. */
export type LogLevelValue = (typeof LogLevel)[keyof typeof LogLevel]

/** String name of a `LogLevel`. */
export type LogLevelName = keyof typeof LogLevel

/** Format selection for log output. */
export type LogFormat = 'json' | 'human' | 'auto'

/** Configuration shape for the global `LoggerConfig` API. */
export interface LoggerConfiguration {
	/** Master on/off switch. Default: `true`. */
	enabled?: boolean
	/** Default level for loggers that don't have a module-specific override. Default: `LogLevel.INFO`. */
	level?: LogLevelValue
	/** Output format. `'auto'` picks `'json'` when stdout is not a TTY, else `'human'`. Default: `'auto'`. */
	format?: LogFormat
	/** Include an ISO-8601 timestamp on each line. Default: `true`. */
	showTimestamps?: boolean
	/** Prefix prepended to every log line (e.g., `'[app]'`). Default: empty. */
	globalPrefix?: string
	/** Per-module level overrides. Module names match `new Logger(name)` argument. */
	modules?: Record<string, LogLevelValue>
}

/** Options accepted by `new Logger(...)` and `createLogger(...)`. */
export interface LoggerInstanceOptions {
	/** Base context merged into every emission from this logger and its children. */
	context?: LogContext
}
