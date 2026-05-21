/**
 * Global logger configuration. Holds the effective level, format, and
 * per-module overrides used by every `Logger` instance.
 *
 * The config is process-global by design: a single source of truth for
 * verbosity, mirroring how `process.env.LOG_LEVEL` works in pino/winston.
 * Tests can reset it via `LoggerConfig.reset()`.
 *
 * @module @goobits/logger
 */

import {
	type LogFormat,
	type LogLevelName,
	type LogLevelValue,
	type LoggerConfiguration,
	LogLevel
} from './types.js'

interface InternalConfig {
	enabled: boolean
	level: LogLevelValue
	format: LogFormat
	showTimestamps: boolean
	globalPrefix: string
	modules: Record<string, LogLevelValue>
}

const DEFAULTS: InternalConfig = Object.freeze({
	enabled: true,
	level: LogLevel.INFO,
	format: 'auto',
	showTimestamps: true,
	globalPrefix: '',
	modules: Object.freeze({}) as Record<string, LogLevelValue>
})

let state: InternalConfig = {
	enabled: DEFAULTS.enabled,
	level: DEFAULTS.level,
	format: DEFAULTS.format,
	showTimestamps: DEFAULTS.showTimestamps,
	globalPrefix: DEFAULTS.globalPrefix,
	modules: { ...DEFAULTS.modules }
}

function coerceLevel(level: LogLevelValue | LogLevelName): LogLevelValue {
	if (typeof level === 'number') return level
	const named = LogLevel[level]
	if (named === undefined) {
		throw new Error(`Unknown log level: ${ String(level) }. Expected one of: ${ Object.keys(LogLevel).join(', ') }`)
	}
	return named
}

function readBootEnv(): void {
	const env = typeof process !== 'undefined' ? process.env : undefined
	if (!env) return

	const envLevel = env['LOG_LEVEL']
	if (envLevel) {
		const normalized = envLevel.toUpperCase() as LogLevelName
		if (normalized in LogLevel) state.level = LogLevel[normalized]
	}

	const envFormat = env['LOG_FORMAT']
	if (envFormat === 'json' || envFormat === 'human' || envFormat === 'auto') {
		state.format = envFormat
	}
}

readBootEnv()

/**
 * Global configuration API. Mutations affect every `Logger` instance
 * created or in use across the process.
 */
export const LoggerConfig = {
	/** Set the global minimum log level. */
	setLogLevel(level: LogLevelValue | LogLevelName): void {
		state.level = coerceLevel(level)
	},

	/** Get the current global minimum log level. */
	getLogLevel(): LogLevelValue {
		return state.level
	},

	/** Replace the per-module level map. Module name must match `new Logger(name)`. */
	setModuleLevels(modules: Record<string, LogLevelValue | LogLevelName>): void {
		const coerced: Record<string, LogLevelValue> = {}
		for (const [ name, level ] of Object.entries(modules)) {
			coerced[name] = coerceLevel(level)
		}
		state.modules = coerced
	},

	/** Set the level for one module. */
	setModuleLevel(moduleName: string, level: LogLevelValue | LogLevelName): void {
		state.modules = { ...state.modules, [moduleName]: coerceLevel(level) }
	},

	/** Output format. `'auto'` picks JSON when stdout is non-TTY (typical in production). */
	setFormat(format: LogFormat): void {
		state.format = format
	},

	getFormat(): LogFormat {
		return state.format
	},

	setShowTimestamps(enabled: boolean): void {
		state.showTimestamps = enabled
	},

	getShowTimestamps(): boolean {
		return state.showTimestamps
	},

	setEnabled(enabled: boolean): void {
		state.enabled = enabled
	},

	getEnabled(): boolean {
		return state.enabled
	},

	setGlobalPrefix(prefix: string): void {
		state.globalPrefix = prefix
	},

	getGlobalPrefix(): string {
		return state.globalPrefix
	},

	/** Apply multiple options at once. Unknown keys are ignored. */
	configure(options: LoggerConfiguration): void {
		if (options.enabled !== undefined) state.enabled = options.enabled
		if (options.level !== undefined) state.level = options.level
		if (options.format !== undefined) state.format = options.format
		if (options.showTimestamps !== undefined) state.showTimestamps = options.showTimestamps
		if (options.globalPrefix !== undefined) state.globalPrefix = options.globalPrefix
		if (options.modules !== undefined) state.modules = { ...options.modules }
	},

	/** Snapshot of the current config (defensively copied). */
	getConfig(): Required<LoggerConfiguration> {
		return {
			enabled: state.enabled,
			level: state.level,
			format: state.format,
			showTimestamps: state.showTimestamps,
			globalPrefix: state.globalPrefix,
			modules: { ...state.modules }
		}
	},

	/** Reset to package defaults. Useful in tests. */
	reset(): void {
		state = {
			enabled: DEFAULTS.enabled,
			level: DEFAULTS.level,
			format: DEFAULTS.format,
			showTimestamps: DEFAULTS.showTimestamps,
			globalPrefix: DEFAULTS.globalPrefix,
			modules: { ...DEFAULTS.modules }
		}
	}
}

/**
 * Internal: returns the effective level for a logger. Per-module override
 * wins over the global level. Used by the `Logger` class.
 *
 * @internal
 */
export function getEffectiveLevel(moduleName: string | null): LogLevelValue {
	if (moduleName && state.modules[moduleName] !== undefined) {
		return state.modules[moduleName]
	}
	return state.level
}

/** @internal */
export function isEnabled(): boolean {
	return state.enabled
}

/** @internal */
export function getActiveFormat(): 'json' | 'human' {
	if (state.format === 'json' || state.format === 'human') return state.format
	// 'auto': JSON when stdout is non-TTY (production), human otherwise.
	if (typeof process === 'undefined') return 'human'
	const isTTY = Boolean(process.stdout && (process.stdout as { isTTY?: boolean }).isTTY)
	return isTTY ? 'human' : 'json'
}

/** @internal */
export function getInternalState(): Readonly<InternalConfig> {
	return state
}
