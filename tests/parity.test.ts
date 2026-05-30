import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	LoggerConfig,
	disableModule,
	enableModule,
	getEffectiveLevel,
	isProductionLike,
	setGlobalLevel,
	setModuleLevel
} from '../src/core/config.js'
import { createErrorCollector } from '../src/core/error-collector.js'
import { _resetLoggerRegistryForTests, createLogger, getLoggerNames } from '../src/core/logger.js'
import { LogLevel } from '../src/core/types.js'

beforeEach(() => {
	LoggerConfig.reset()
	_resetLoggerRegistryForTests()
})
afterEach(() => {
	LoggerConfig.reset()
	_resetLoggerRegistryForTests()
	vi.restoreAllMocks()
})

describe('logger registry', () => {
	it('records named modules and lists them in insertion order', () => {
		createLogger('alpha')
		createLogger('beta')
		createLogger('alpha') // dup name, still one entry
		expect(getLoggerNames()).toEqual([ 'alpha', 'beta' ])
	})

	it('does not record the module-less logger', () => {
		createLogger()
		expect(getLoggerNames()).toEqual([])
	})

	it('still returns a fresh instance per call (no dedup of identity)', () => {
		const a = createLogger('same')
		const b = createLogger('same')
		expect(a).not.toBe(b)
	})
})

describe('bare-function config API', () => {
	it('setModuleLevel + setGlobalLevel mirror LoggerConfig', () => {
		setGlobalLevel('ERROR')
		expect(getEffectiveLevel(null)).toBe(LogLevel.ERROR)
		setModuleLevel('verbose', 'DEBUG')
		expect(getEffectiveLevel('verbose')).toBe(LogLevel.DEBUG)
	})

	it('disableModule sets the module to NONE; enableModule clears the override', () => {
		disableModule('noisy')
		expect(getEffectiveLevel('noisy')).toBe(LogLevel.NONE)
		enableModule('noisy')
		// back to inheriting the global level
		expect(getEffectiveLevel('noisy')).toBe(LoggerConfig.getLogLevel())
	})
})

describe('productionQuiet', () => {
	// Drive production detection deterministically: NODE_ENV='production' is
	// production-like regardless of the test runner's stdout. The interactive
	// case overrides stdout.isTTY directly (it is undefined under vitest).
	const prevEnv = process.env['NODE_ENV']
	let restoreTTY: (() => void) | null = null

	function setTTY(value: boolean | undefined): void {
		const had = Object.prototype.hasOwnProperty.call(process.stdout, 'isTTY')
		const original = (process.stdout as { isTTY?: boolean }).isTTY
		Object.defineProperty(process.stdout, 'isTTY', { value, configurable: true })
		restoreTTY = () => {
			if (had) Object.defineProperty(process.stdout, 'isTTY', { value: original, configurable: true })
			else delete (process.stdout as { isTTY?: boolean }).isTTY
		}
	}

	afterEach(() => {
		if (prevEnv === undefined) delete process.env['NODE_ENV']
		else process.env['NODE_ENV'] = prevEnv
		restoreTTY?.()
		restoreTTY = null
	})

	it('is a no-op when disabled (default)', () => {
		process.env['NODE_ENV'] = 'production'
		setGlobalLevel('DEBUG')
		expect(getEffectiveLevel(null)).toBe(LogLevel.DEBUG)
	})

	it('floors level at WARN in production-like runtimes when enabled', () => {
		process.env['NODE_ENV'] = 'production'
		setGlobalLevel('DEBUG')
		LoggerConfig.setProductionQuiet(true)
		expect(isProductionLike()).toBe(true)
		expect(getEffectiveLevel(null)).toBe(LogLevel.WARN)
	})

	it('leaves per-module overrides verbose even under productionQuiet', () => {
		process.env['NODE_ENV'] = 'production'
		LoggerConfig.setProductionQuiet(true)
		setModuleLevel('debugme', 'DEBUG')
		expect(getEffectiveLevel('debugme')).toBe(LogLevel.DEBUG)
	})

	it('is a no-op in an interactive TTY even when enabled', () => {
		delete process.env['NODE_ENV']
		setTTY(true)
		setGlobalLevel('DEBUG')
		LoggerConfig.setProductionQuiet(true)
		expect(isProductionLike()).toBe(false)
		expect(getEffectiveLevel(null)).toBe(LogLevel.DEBUG)
	})
})

describe('error collector', () => {
	it('collects entries with context and a timestamp', () => {
		const clock = vi.fn(() => 1234)
		const errors = createErrorCollector(100, clock)
		errors.collect(new Error('boom'), { route: '/x' })
		expect(errors.count()).toBe(1)
		const [ entry ] = errors.getEntries()
		expect(entry?.error.message).toBe('boom')
		expect(entry?.context).toEqual({ route: '/x' })
		expect(entry?.timestamp).toBe(1234)
	})

	it('evicts oldest beyond the cap', () => {
		const errors = createErrorCollector(2)
		errors.collect(new Error('a'))
		errors.collect(new Error('b'))
		errors.collect(new Error('c'))
		expect(errors.count()).toBe(2)
		expect(errors.getEntries().map(e => e.error.message)).toEqual([ 'b', 'c' ])
	})

	it('clear() drops everything; getEntries is a copy', () => {
		const errors = createErrorCollector()
		errors.collect(new Error('a'))
		const snapshot = errors.getEntries()
		errors.clear()
		expect(errors.count()).toBe(0)
		expect(snapshot).toHaveLength(1) // snapshot not mutated by clear
	})

	it('does not emit a log line when collecting', () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		const errors = createErrorCollector()
		errors.collect(new Error('silent'))
		expect(errSpy).not.toHaveBeenCalled()
	})
})
