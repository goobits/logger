import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
	disableModule,
	enableModule,
	getEffectiveLevel,
	isProductionLike,
	LoggerConfig,
	setGlobalLevel,
	setModuleLevel
} from '../src/core/config.js'
import { LogLevel } from '../src/core/types.js'

beforeEach(() => LoggerConfig.reset())
afterEach(() => LoggerConfig.reset())

describe('LoggerConfig', () => {
	it('defaults to enabled, INFO, auto, timestamps on, no prefix', () => {
		const c = LoggerConfig.getConfig()
		expect(c.enabled).toBe(true)
		expect(c.level).toBe(LogLevel.INFO)
		expect(c.format).toBe('auto')
		expect(c.showTimestamps).toBe(true)
		expect(c.globalPrefix).toBe('')
		expect(c.modules).toEqual({})
	})

	it('setLogLevel accepts a numeric value', () => {
		LoggerConfig.setLogLevel(LogLevel.DEBUG)
		expect(LoggerConfig.getLogLevel()).toBe(LogLevel.DEBUG)
	})

	it('setLogLevel accepts a name string', () => {
		LoggerConfig.setLogLevel('WARN')
		expect(LoggerConfig.getLogLevel()).toBe(LogLevel.WARN)
	})

	it('setLogLevel throws on unknown level name', () => {
		expect(() => LoggerConfig.setLogLevel('VERBOSE' as 'DEBUG')).toThrow(/Unknown log level/)
	})

	it('setModuleLevel updates a single module entry', () => {
		LoggerConfig.setModuleLevel('foo', LogLevel.ERROR)
		expect(LoggerConfig.getConfig().modules['foo']).toBe(LogLevel.ERROR)
	})

	it('setModuleLevels replaces the whole map', () => {
		LoggerConfig.setModuleLevel('foo', LogLevel.ERROR)
		LoggerConfig.setModuleLevels({ bar: LogLevel.DEBUG, baz: 'WARN' })
		const c = LoggerConfig.getConfig()
		expect(c.modules['foo']).toBeUndefined()
		expect(c.modules['bar']).toBe(LogLevel.DEBUG)
		expect(c.modules['baz']).toBe(LogLevel.WARN)
	})

	it('configure() applies multiple options', () => {
		LoggerConfig.configure({
			enabled: false,
			level: LogLevel.WARN,
			format: 'json',
			showTimestamps: false,
			globalPrefix: '[svc]'
		})
		const c = LoggerConfig.getConfig()
		expect(c.enabled).toBe(false)
		expect(c.level).toBe(LogLevel.WARN)
		expect(c.format).toBe('json')
		expect(c.showTimestamps).toBe(false)
		expect(c.globalPrefix).toBe('[svc]')
	})

	it('configure() ignores undefined keys', () => {
		LoggerConfig.setLogLevel(LogLevel.ERROR)
		LoggerConfig.configure({ format: 'json' })
		expect(LoggerConfig.getLogLevel()).toBe(LogLevel.ERROR)
	})

	it('getConfig returns a defensively copied modules map', () => {
		LoggerConfig.setModuleLevel('a', LogLevel.DEBUG)
		const snap = LoggerConfig.getConfig()
		snap.modules['a'] = LogLevel.ERROR
		expect(LoggerConfig.getConfig().modules['a']).toBe(LogLevel.DEBUG)
	})

	it('reset() restores defaults', () => {
		LoggerConfig.configure({
			enabled: false,
			level: LogLevel.DEBUG,
			format: 'json',
			globalPrefix: '[x]',
			modules: { a: LogLevel.WARN }
		})
		LoggerConfig.reset()
		const c = LoggerConfig.getConfig()
		expect(c.enabled).toBe(true)
		expect(c.level).toBe(LogLevel.INFO)
		expect(c.format).toBe('auto')
		expect(c.globalPrefix).toBe('')
		expect(c.modules).toEqual({})
	})
})

describe('getEffectiveLevel', () => {
	it('falls back to global level when no module override', () => {
		LoggerConfig.setLogLevel(LogLevel.WARN)
		expect(getEffectiveLevel('any-module')).toBe(LogLevel.WARN)
		expect(getEffectiveLevel(null)).toBe(LogLevel.WARN)
	})

	it('uses module override when present', () => {
		LoggerConfig.setLogLevel(LogLevel.WARN)
		LoggerConfig.setModuleLevel('chatty', LogLevel.DEBUG)
		expect(getEffectiveLevel('chatty')).toBe(LogLevel.DEBUG)
		expect(getEffectiveLevel('other')).toBe(LogLevel.WARN)
	})
})

describe('functional config API', () => {
	it('sets global and module levels through the same config owner', () => {
		setGlobalLevel('ERROR')
		expect(getEffectiveLevel(null)).toBe(LogLevel.ERROR)
		setModuleLevel('verbose', 'DEBUG')
		expect(getEffectiveLevel('verbose')).toBe(LogLevel.DEBUG)
	})

	it('disables a module until its override is cleared', () => {
		disableModule('noisy')
		expect(getEffectiveLevel('noisy')).toBe(LogLevel.NONE)
		enableModule('noisy')
		expect(getEffectiveLevel('noisy')).toBe(LoggerConfig.getLogLevel())
	})
})

describe('productionQuiet', () => {
	const previousNodeEnv = process.env['NODE_ENV']
	let restoreTTY: (() => void) | null = null

	function setTTY(value: boolean | undefined): void {
		const hadValue = Object.prototype.hasOwnProperty.call(process.stdout, 'isTTY')
		const original = (process.stdout as { isTTY?: boolean }).isTTY
		Object.defineProperty(process.stdout, 'isTTY', { value, configurable: true })
		restoreTTY = () => {
			if (hadValue) {
				Object.defineProperty(process.stdout, 'isTTY', { value: original, configurable: true })
			} else {
				delete (process.stdout as { isTTY?: boolean }).isTTY
			}
		}
	}

	afterEach(() => {
		if (previousNodeEnv === undefined) delete process.env['NODE_ENV']
		else process.env['NODE_ENV'] = previousNodeEnv
		restoreTTY?.()
		restoreTTY = null
	})

	it('does not change the configured level when disabled', () => {
		process.env['NODE_ENV'] = 'production'
		setGlobalLevel('DEBUG')
		expect(getEffectiveLevel(null)).toBe(LogLevel.DEBUG)
	})

	it('floors the global level at WARN in production-like runtimes', () => {
		process.env['NODE_ENV'] = 'production'
		setGlobalLevel('DEBUG')
		LoggerConfig.setProductionQuiet(true)
		expect(isProductionLike()).toBe(true)
		expect(getEffectiveLevel(null)).toBe(LogLevel.WARN)
	})

	it('keeps explicit module overrides', () => {
		process.env['NODE_ENV'] = 'production'
		LoggerConfig.setProductionQuiet(true)
		setModuleLevel('debugme', 'DEBUG')
		expect(getEffectiveLevel('debugme')).toBe(LogLevel.DEBUG)
	})

	it('does not quiet an interactive TTY', () => {
		delete process.env['NODE_ENV']
		setTTY(true)
		setGlobalLevel('DEBUG')
		LoggerConfig.setProductionQuiet(true)
		expect(isProductionLike()).toBe(false)
		expect(getEffectiveLevel(null)).toBe(LogLevel.DEBUG)
	})
})
