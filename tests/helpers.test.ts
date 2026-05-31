import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LoggerConfig } from '../src/core/config.js'
import { createLogger, noopLogger } from '../src/core/logger.js'
import { errorWithCause, logTiming } from '../src/helpers.js'

const captured: Array<{ method: string; line: string }> = []
let logSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
	captured.length = 0
	LoggerConfig.reset()
	LoggerConfig.setShowTimestamps(false)
	LoggerConfig.setFormat('json')

	logSpy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
		captured.push({ method: 'log', line: String(line) })
	})
	errorSpy = vi.spyOn(console, 'error').mockImplementation((line: unknown) => {
		captured.push({ method: 'error', line: String(line) })
	})
})

afterEach(() => {
	logSpy.mockRestore()
	errorSpy.mockRestore()
	LoggerConfig.reset()
})

describe('errorWithCause', () => {
	it('serializes a plain Error', () => {
		const log = createLogger('m')
		errorWithCause(log, 'boom', new Error('nope'))
		expect(captured).toHaveLength(1)
		const parsed = JSON.parse(captured[0]?.line ?? '{}')
		expect(parsed.level).toBe('error')
		expect(parsed.message).toBe('boom')
		expect(parsed.error_type).toBe('Error')
		expect(parsed.error_message).toBe('nope')
		expect(typeof parsed.error_stack).toBe('string')
	})

	it('serializes the cause chain recursively', () => {
		const root = new Error('root reason')
		const wrapped = new Error('wrapped', { cause: root })
		const log = createLogger('m')
		errorWithCause(log, 'op failed', wrapped)

		const parsed = JSON.parse(captured[0]?.line ?? '{}')
		expect(parsed.error_message).toBe('wrapped')
		expect(parsed.error_cause).toBeDefined()
		expect(parsed.error_cause.error_message).toBe('root reason')
	})

	it('handles non-Error throws (string, number, plain object)', () => {
		const log = createLogger('m')

		errorWithCause(log, 'a', 'string error')
		expect(JSON.parse(captured[0]?.line ?? '{}').error_type).toBe('string')

		captured.length = 0
		errorWithCause(log, 'b', 42)
		expect(JSON.parse(captured[0]?.line ?? '{}').error_type).toBe('number')

		captured.length = 0
		errorWithCause(log, 'c', { code: 'ENOENT' })
		expect(JSON.parse(captured[0]?.line ?? '{}').error_type).toBe('object')
	})

	it('caller context wins over error fields on key conflict', () => {
		const log = createLogger('m')
		errorWithCause(log, 'msg', new Error('e'), { error_type: 'CustomCategory' })
		expect(JSON.parse(captured[0]?.line ?? '{}').error_type).toBe('CustomCategory')
	})

	it('works with the pluggable interface (noopLogger silently swallows)', () => {
		expect(() => errorWithCause(noopLogger, 'msg', new Error('e'))).not.toThrow()
		expect(captured).toHaveLength(0)
	})
})

describe('logTiming', () => {
	it('emits start + complete with duration_ms on success', async() => {
		const log = createLogger('m')
		const result = await logTiming(log, 'db.query', async() => {
			await new Promise(resolve => setTimeout(resolve, 5))
			return 42
		})
		expect(result).toBe(42)
		expect(captured).toHaveLength(2)

		const start = JSON.parse(captured[0]?.line ?? '{}')
		const end = JSON.parse(captured[1]?.line ?? '{}')

		expect(start.message).toBe('db.query start')
		expect(start.operation).toBe('db.query')
		expect(start.duration_ms).toBeUndefined()

		expect(end.message).toBe('db.query complete')
		expect(end.operation).toBe('db.query')
		expect(typeof end.duration_ms).toBe('number')
		expect(end.duration_ms).toBeGreaterThanOrEqual(0)
	})

	it('emits start + error with duration_ms + error chain on throw, then re-throws', async() => {
		const log = createLogger('m')
		await expect(
			logTiming(log, 'flaky', async() => {
				throw new Error('boom')
			})
		).rejects.toThrow('boom')

		expect(captured).toHaveLength(2)
		expect(captured[0]?.method).toBe('log')
		expect(captured[1]?.method).toBe('error')

		const err = JSON.parse(captured[1]?.line ?? '{}')
		expect(err.message).toBe('flaky failed')
		expect(err.operation).toBe('flaky')
		expect(typeof err.duration_ms).toBe('number')
		expect(err.error_message).toBe('boom')
	})

	it('passes through caller context to both lines', async() => {
		const log = createLogger('m')
		await logTiming(log, 'op', () => 'ok', { user_id: 'u1' })

		const start = JSON.parse(captured[0]?.line ?? '{}')
		const end = JSON.parse(captured[1]?.line ?? '{}')
		expect(start.user_id).toBe('u1')
		expect(end.user_id).toBe('u1')
	})

	it('works with a sync fn return value', async() => {
		const log = createLogger('m')
		const result = await logTiming(log, 'sync', () => 'hi')
		expect(result).toBe('hi')
	})
})
