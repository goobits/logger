import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoggerConfig } from '../src/core/config.js'
import {
	_resetLoggerRegistryForTests,
	createLogger,
	getLoggerNames,
	Logger,
	noopLogger
} from '../src/core/logger.js'
import { LogLevel } from '../src/core/types.js'

const captured: Array<{ method: string; line: string }> = []
let logSpy: ReturnType<typeof vi.spyOn>
let warnSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>
let debugSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
	captured.length = 0
	LoggerConfig.reset()
	_resetLoggerRegistryForTests()
	LoggerConfig.setShowTimestamps(false)
	LoggerConfig.setFormat('human')

	logSpy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
		captured.push({ method: 'log', line: String(line) })
	})
	warnSpy = vi.spyOn(console, 'warn').mockImplementation((line: unknown) => {
		captured.push({ method: 'warn', line: String(line) })
	})
	errorSpy = vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
		captured.push({ method: 'error', line: String(line) })
	})
	debugSpy = vi.spyOn(console, 'debug').mockImplementation((line: unknown) => {
		captured.push({ method: 'debug', line: String(line) })
	})
})

afterEach(() => {
	logSpy.mockRestore()
	warnSpy.mockRestore()
	errorSpy.mockRestore()
	debugSpy.mockRestore()
	LoggerConfig.reset()
	_resetLoggerRegistryForTests()
})

describe('Logger', () => {
	it('emits info / warn / error / debug to the matching console method', () => {
		LoggerConfig.setLogLevel(LogLevel.DEBUG)
		const log = new Logger('test')

		log.debug('d')
		log.info('i')
		log.warn('w')
		log.error('e')

		const methods = captured.map(c => c.method)
		expect(methods).toEqual([ 'debug', 'log', 'warn', 'error' ])
	})

	it('omits debug below INFO (default level)', () => {
		const log = new Logger('test')
		log.debug('d')
		log.info('i')
		expect(captured.map(c => c.method)).toEqual([ 'log' ])
	})

	it('respects setEnabled(false)', () => {
		LoggerConfig.setEnabled(false)
		const log = new Logger('test')
		log.error('err')
		expect(captured).toHaveLength(0)
	})

	it('includes module name in human format', () => {
		const log = new Logger('checkout')
		log.info('signed in')
		expect(captured[0]?.line).toContain('[checkout]')
		expect(captured[0]?.line).toContain('signed in')
	})

	it('includes global prefix when set', () => {
		LoggerConfig.setGlobalPrefix('[app]')
		const log = new Logger('test')
		log.info('hello')
		expect(captured[0]?.line).toContain('[app]')
	})

	it('formats context as inline JSON in human mode', () => {
		const log = new Logger('test')
		log.info('msg', { user_id: 'u1', count: 5 })
		expect(captured[0]?.line).toContain('"user_id":"u1"')
		expect(captured[0]?.line).toContain('"count":5')
	})

	it('emits JSON format when configured', () => {
		LoggerConfig.setFormat('json')
		const log = new Logger('test')
		log.info('msg', { user_id: 'u1' })
		const parsed = JSON.parse(captured[0]?.line ?? '{}')
		expect(parsed).toMatchObject({
			level: 'info',
			module: 'test',
			message: 'msg',
			user_id: 'u1'
		})
	})

	it('respects per-module log level override', () => {
		LoggerConfig.setLogLevel(LogLevel.INFO)
		LoggerConfig.setModuleLevel('verbose', LogLevel.DEBUG)
		LoggerConfig.setModuleLevel('quiet', LogLevel.ERROR)

		const verbose = new Logger('verbose')
		const quiet = new Logger('quiet')

		verbose.debug('shown')
		quiet.info('hidden')
		quiet.error('shown')

		expect(captured).toHaveLength(2)
		expect(captured[0]?.line).toContain('shown')
		expect(captured[1]?.line).toContain('shown')
	})

	it('child() merges context with the parent', () => {
		const parent = new Logger('p', { context: { app: 'web' } })
		const child = parent.child({ feature: 'checkout' })

		child.info('msg', { user_id: 'u1' })

		expect(captured[0]?.line).toContain('"app":"web"')
		expect(captured[0]?.line).toContain('"feature":"checkout"')
		expect(captured[0]?.line).toContain('"user_id":"u1"')
	})

	it('isDebugEnabled / isInfoEnabled reflect the effective level', () => {
		LoggerConfig.setLogLevel(LogLevel.WARN)
		const log = new Logger('m')
		expect(log.isDebugEnabled()).toBe(false)
		expect(log.isInfoEnabled()).toBe(false)
		expect(log.isWarnEnabled()).toBe(true)
		expect(log.isErrorEnabled()).toBe(true)
	})

	it('isInfoEnabled returns false when globally disabled', () => {
		LoggerConfig.setEnabled(false)
		const log = new Logger('m')
		expect(log.isInfoEnabled()).toBe(false)
		expect(log.isErrorEnabled()).toBe(false)
	})

	it('createLogger() factory builds an equivalent instance', () => {
		const a = new Logger('test', { context: { k: 'v' } })
		const b = createLogger('test', { k: 'v' })
		a.info('x')
		b.info('x')
		expect(captured[0]?.line).toBe(captured[1]?.line)
	})

	it('noopLogger swallows every call', () => {
		noopLogger.debug('d')
		noopLogger.info('i')
		noopLogger.warn('w')
		noopLogger.error('e')
		expect(captured).toHaveLength(0)
	})

	it('safeStringify handles circular references without crashing', () => {
		const log = new Logger('test')
		const obj: Record<string, unknown> = { a: 1 }
		obj['self'] = obj
		expect(() => log.info('msg', { obj })).not.toThrow()
		expect(captured[0]?.line).toContain('[Circular]')
	})

	it('safeStringify handles BigInt without crashing', () => {
		const log = new Logger('test')
		expect(() => log.info('msg', { big: BigInt(42) })).not.toThrow()
		expect(captured[0]?.line).toContain('"42"')
	})

	it('safeStringify handles Error instances with name + message + stack', () => {
		const log = new Logger('test')
		const err = new Error('boom')
		log.info('msg', { err })
		const line = captured[0]?.line ?? ''
		expect(line).toContain('"name":"Error"')
		expect(line).toContain('"message":"boom"')
	})

	it('null moduleName produces no module bracket', () => {
		const log = new Logger()
		log.info('msg')
		expect(captured[0]?.line).not.toMatch(/\[\s*\]/)
	})
})

describe('logger registry', () => {
	it('lists unique named modules in insertion order', () => {
		createLogger('alpha')
		createLogger('beta')
		createLogger('alpha')
		expect(getLoggerNames()).toEqual([ 'alpha', 'beta' ])
	})

	it('does not record the module-less logger', () => {
		createLogger()
		expect(getLoggerNames()).toEqual([])
	})

	it('returns a fresh logger instance for repeated names', () => {
		expect(createLogger('same')).not.toBe(createLogger('same'))
	})
})
