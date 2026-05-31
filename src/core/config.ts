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
	LogLevel,
	LEVEL_NAMES
} from './types.ts'

interface InternalConfig {
	enabled: boolean
	level: LogLevelValue
	format: LogFormat
	showTimestamps: boolean
	globalPrefix: string
	modules: Record<string, LogLevelValue>
	productionQuiet: boolean
}

type RuntimeProcess = {
	env?: Record<string, string | undefined>
	stdout?: { isTTY?: boolean }
}

function getRuntimeProcess(): RuntimeProcess | undefined {
	return (globalThis as typeof globalThis & { process?: RuntimeProcess }).process
}

const DEFAULTS: InternalConfig = Object.freeze({
	enabled: true,
	level: LogLevel.INFO,
	format: 'auto',
	showTimestamps: true,
	globalPrefix: '',
	modules: Object.freeze({}) as Record<string, LogLevelValue>,
	productionQuiet: false
})

let state: InternalConfig = {
	enabled: DEFAULTS.enabled,
	level: DEFAULTS.level,
	format: DEFAULTS.format,
	showTimestamps: DEFAULTS.showTimestamps,
	globalPrefix: DEFAULTS.globalPrefix,
	modules: { ...DEFAULTS.modules },
	productionQuiet: DEFAULTS.productionQuiet
}

/**
 * Whether the runtime looks like production: `NODE_ENV === 'production'`, or
 * stdout is not a TTY (typical for deployed servers, Workers, CI). Used only
 * when `productionQuiet` is enabled.
 *
 * @internal
 */
export function isProductionLike(): boolean {
	const runtimeProcess = getRuntimeProcess()
	if (!runtimeProcess) return true
	if (runtimeProcess.env && runtimeProcess.env['NODE_ENV'] === 'production') return true
	const stdout = runtimeProcess.stdout
	// No stdout, or non-TTY stdout, reads as production-like.
	return !stdout || !stdout.isTTY
}

/**
 * Legacy browser-aware production detector from the old Sketchpad logger.
 * Prefer `isProductionLike()` for server/runtime logging policy.
 */
export function isProduction(): boolean {
	const runtimeProcess = getRuntimeProcess()
	if (runtimeProcess?.env && runtimeProcess.env['NODE_ENV'] === 'production') {
		return true
	}
	if (typeof window !== 'undefined') {
		const hostname = window.location?.hostname ?? ''
		return hostname !== 'localhost' &&
			!hostname.includes('127.0.0.1') &&
			!hostname.includes('.local') &&
			!hostname.includes(':')
	}
	return isProductionLike()
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
	const env = getRuntimeProcess()?.env
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
	/**
	 * Set the global minimum log level.
	 *
	 * @param level - Log level.
	 */
	setLogLevel(level: LogLevelValue | LogLevelName): void {
		state.level = coerceLevel(level)
	},

	/** Get the current global minimum log level. */
	getLogLevel(): LogLevelValue {
		return state.level
	},

	/**
	 * Replace the per-module level map. Module name must match `new Logger(name)`.
	 *
	 * @param modules - Module level map.
	 */
	setModuleLevels(modules: Record<string, LogLevelValue | LogLevelName>): void {
		const coerced: Record<string, LogLevelValue> = {}
		for (const [ name, level ] of Object.entries(modules)) {
			coerced[name] = coerceLevel(level)
		}
		state.modules = coerced
	},

	/**
	 * Set the level for one module.
	 *
	 * @param moduleName - Module name.
	 * @param level - Log level.
	 */
	setModuleLevel(moduleName: string, level: LogLevelValue | LogLevelName): void {
		state.modules = { ...state.modules, [moduleName]: coerceLevel(level) }
	},

	/**
	 * When enabled, `debug` and `info` are silenced in production-like
	 * runtimes (see `isProductionLike`): `NODE_ENV === 'production'` or a
	 * non-TTY stdout. In dev (interactive TTY) it is a no-op, so libraries
	 * stay verbose locally and quiet in production without per-env wiring.
	 * Per-module level overrides still win, so you can force one module
	 * verbose even in production. Default: `false`.
	 *
	 * @param enabled - Whether the option is enabled.
	 */
	setProductionQuiet(enabled: boolean): void {
		state.productionQuiet = enabled
	},

	getProductionQuiet(): boolean {
		return state.productionQuiet
	},

	/**
	 * Output format. `'auto'` picks JSON when stdout is non-TTY (typical in production).
	 *
	 * @param format - Log format.
	 */
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

	/**
	 * Apply multiple options at once. Unknown keys are ignored.
	 *
	 * @param options - Options for this operation.
	 */
	configure(options: LoggerConfiguration): void {
		if (options.enabled !== undefined) state.enabled = options.enabled
		if (options.level !== undefined) state.level = options.level
		if (options.format !== undefined) state.format = options.format
		if (options.showTimestamps !== undefined) state.showTimestamps = options.showTimestamps
		if (options.globalPrefix !== undefined) state.globalPrefix = options.globalPrefix
		if (options.modules !== undefined) state.modules = { ...options.modules }
		if (options.productionQuiet !== undefined) state.productionQuiet = options.productionQuiet
	},

	/** Snapshot of the current config (defensively copied). */
	getConfig(): Required<LoggerConfiguration> {
		return {
			enabled: state.enabled,
			level: state.level,
			format: state.format,
			showTimestamps: state.showTimestamps,
			globalPrefix: state.globalPrefix,
			modules: { ...state.modules },
			productionQuiet: state.productionQuiet
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
			modules: { ...DEFAULTS.modules },
			productionQuiet: DEFAULTS.productionQuiet
		}
	}
}

// ===========================================================================
// Bare-function convenience API
//
// Thin wrappers over `LoggerConfig` so `@goobits/logger` is a drop-in for
// code written against loggers that expose top-level mutators. Behaviour is
// identical to calling the matching `LoggerConfig` method.
// ===========================================================================

/**
	 * Set the level for one module. Equivalent to `LoggerConfig.setModuleLevel`.
	 *
	 * @param moduleName - Module name.
	 * @param level - Log level.
	 */
export function setModuleLevel(moduleName: string, level: LogLevelValue | LogLevelName): void {
	LoggerConfig.setModuleLevel(moduleName, level)
}

/**
 * Set the global minimum level. Equivalent to `LoggerConfig.setLogLevel`.
 *
 * @param level - Log level.
 */
export function setGlobalLevel(level: LogLevelValue | LogLevelName): void {
	LoggerConfig.setLogLevel(level)
}

/** Reset logger configuration. Legacy alias for `LoggerConfig.reset()`. */
export function resetConfig(): void {
	LoggerConfig.reset()
}

/**
 * Legacy Sketchpad config snapshot shape.
 * Prefer `LoggerConfig.getConfig()` for structured Goobits config.
 */
export function getConfig(): {
	globalLevel: LogLevelName
	moduleOverrides: Record<string, LogLevelName>
	disabledModules: string[]
	isProduction: boolean
	levels: readonly LogLevelName[]
} {
	const config = LoggerConfig.getConfig()
	const moduleOverrides: Record<string, LogLevelName> = {}
	for (const [ moduleName, level ] of Object.entries(config.modules)) {
		moduleOverrides[moduleName] = levelNameForValue(level)
	}
	return {
		globalLevel: levelNameForValue(config.level),
		moduleOverrides,
		disabledModules: Object.entries(config.modules)
			.filter(([, level ]) => level >= LogLevel.NONE)
			.map(([ moduleName ]) => moduleName),
		isProduction: isProduction(),
		levels: LEVEL_NAMES
	}
}

/**
 * Silence a single module entirely (sets its level to `NONE`). Reverse with
 * `enableModule`.
 *
 * @param moduleName - module name value.
 */
export function disableModule(moduleName: string): void {
	LoggerConfig.setModuleLevel(moduleName, LogLevel.NONE)
}

/**
 * Remove a module's level override so it inherits the global level again.
 * Reverses `disableModule` (and any prior `setModuleLevel` for that module).
 *
 * @param moduleName - module name value.
 */
export function enableModule(moduleName: string): void {
	const { [moduleName]: _removed, ...rest } = state.modules
	state.modules = rest
}

/**
 * Internal: returns the effective level for a logger. Per-module override
 * wins over the global level. Used by the `Logger` class.
 *
 * @param moduleName - module name value.
 * @internal
 */
export function getEffectiveLevel(moduleName: string | null): LogLevelValue {
	// Explicit per-module override always wins, in either direction. This lets
	// a single module stay verbose even under productionQuiet.
	if (moduleName && state.modules[moduleName] !== undefined) {
		return state.modules[moduleName]
	}
	// productionQuiet floors the level at WARN in production-like runtimes,
	// so debug/info are dropped without affecting dev (interactive TTY).
	if (state.productionQuiet && isProductionLike() && state.level < LogLevel.WARN) {
		return LogLevel.WARN
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
	const runtimeProcess = getRuntimeProcess()
	if (!runtimeProcess) return 'human'
	const isTTY = Boolean(runtimeProcess.stdout?.isTTY)
	return isTTY ? 'human' : 'json'
}

/** @internal */
export function getInternalState(): Readonly<InternalConfig> {
	return state
}

function levelNameForValue(level: LogLevelValue): LogLevelName {
	if (level <= LogLevel.DEBUG) return 'DEBUG'
	if (level <= LogLevel.INFO) return 'INFO'
	if (level <= LogLevel.WARN) return 'WARN'
	if (level <= LogLevel.ERROR) return 'ERROR'
	return 'SILENT'
}
