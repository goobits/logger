/**
 * @goobits/logger
 *
 * Production-ready structured logger with a pluggable interface. The
 * `Logger` type re-exported here matches the one expected by
 * `@goobits/security`, `@goobits/sitemap`, and any other workspace
 * package that accepts a `Logger` — use this package's `Logger` class
 * as a drop-in implementation, or supply your own (pino, winston,
 * console) satisfying the same shape.
 *
 * Subpath exports:
 *
 *   - `@goobits/logger`         — Logger class + factory + types + config
 *   - `@goobits/logger/context` — withLogContextAsync + LogContextKeys (Node-only)
 *   - `@goobits/logger/helpers` — errorWithCause + logTiming
 *
 * The root barrel intentionally does NOT re-export `/context` so non-Node
 * consumers don't pay the `node:async_hooks` import cost. The barrel also
 * does NOT re-export `/helpers` so consumers who only need the interface
 * type don't pull the helper chain.
 *
 * @module @goobits/logger
 */

export {
	LoggerConfig,
	getConfig,
	getEffectiveLevel,
	isProduction,
	resetConfig,
	disableModule,
	enableModule,
	setGlobalLevel,
	setModuleLevel
} from './core/config.js'
export { Logger, createLogger, getLoggerNames, logger, noopLogger } from './core/logger.js'
export { createErrorCollector } from './core/error-collector.js'
export {
	type ErrorCollector,
	type ScopedErrorCollector,
	type ErrorEntry
} from './core/error-collector.js'
export {
	type LogContext,
	type LogFormat,
	type Logger as LoggerInterface,
	type LogLevelName,
	type LogLevelValue,
	type LoggerConfiguration,
	type LoggerInstanceOptions,
	LEVEL_NAMES,
	LEVELS,
	LogLevel,
	LogLevels
} from './core/types.js'
