import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LogContextKeys, withLogContextAsync, withRequestId } from '../src/context.js'
import { LoggerConfig } from '../src/core/config.js'
import { createLogger } from '../src/core/logger.js'

const captured: string[] = []
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
	captured.length = 0
	LoggerConfig.reset()
	LoggerConfig.setShowTimestamps(false)
	LoggerConfig.setFormat('json')

	logSpy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
		captured.push(String(line))
	})
})

afterEach(() => {
	logSpy.mockRestore()
	LoggerConfig.reset()
})

describe('withLogContextAsync', () => {
	it('makes context visible to sync log calls inside fn', async() => {
		const log = createLogger('api')
		await withLogContextAsync({ user_id: 'u1' }, () => {
			log.info('msg')
		})
		const parsed = JSON.parse(captured[0] ?? '{}')
		expect(parsed['user_id']).toBe('u1')
	})

	it('propagates across await boundaries', async() => {
		const log = createLogger('api')
		await withLogContextAsync({ user_id: 'u1' }, async() => {
			log.info('before')
			await new Promise(resolve => setTimeout(resolve, 0)) // test-shape: timing-probe - documented test timing behavior.
			log.info('after')
		})
		expect(captured).toHaveLength(2)
		const parsed1 = JSON.parse(captured[0] ?? '{}')
		const parsed2 = JSON.parse(captured[1] ?? '{}')
		expect(parsed1['user_id']).toBe('u1')
		expect(parsed2['user_id']).toBe('u1')
	})

	it('isolates context across concurrent calls (AsyncLocalStorage)', async() => {
		const log = createLogger('api')
		const linesByUser: Record<string, number> = {}

		await Promise.all([
			withLogContextAsync({ user_id: 'A' }, async() => {
				log.info('msg')
				await new Promise(resolve => setTimeout(resolve, 10)) // test-shape: timing-probe - documented test timing behavior.
				log.info('msg')
			}),
			withLogContextAsync({ user_id: 'B' }, async() => {
				log.info('msg')
				await new Promise(resolve => setTimeout(resolve, 5)) // test-shape: timing-probe - documented test timing behavior.
				log.info('msg')
			})
		])

		for (const line of captured) {
			const parsed = JSON.parse(line)
			const user = String(parsed['user_id'] ?? 'none')
			linesByUser[user] = (linesByUser[user] ?? 0) + 1
		}

		expect(linesByUser['A']).toBe(2)
		expect(linesByUser['B']).toBe(2)
		expect(linesByUser['none']).toBeUndefined()
	})

	it('per-call context wins over async-local context', async() => {
		const log = createLogger('api')
		await withLogContextAsync({ user_id: 'A' }, () => {
			log.info('msg', { user_id: 'B' })
		})
		const parsed = JSON.parse(captured[0] ?? '{}')
		expect(parsed['user_id']).toBe('B')
	})

	it('returns the fn return value', async() => {
		const result = await withLogContextAsync({ x: 1 }, () => 42)
		expect(result).toBe(42)
	})
})

describe('withRequestId', () => {
	it('adds request_id to every log call inside fn', async() => {
		const log = createLogger('api')
		await withRequestId('req-123', () => {
			log.info('msg')
		})
		const parsed = JSON.parse(captured[0] ?? '{}')
		expect(parsed[LogContextKeys.REQUEST_ID]).toBe('req-123')
	})

	it('merges with explicit context', async() => {
		const log = createLogger('api')
		await withRequestId('req-1', () => {
			log.info('msg', { user_id: 'u1' })
		})
		const parsed = JSON.parse(captured[0] ?? '{}')
		expect(parsed['request_id']).toBe('req-1')
		expect(parsed['user_id']).toBe('u1')
	})
})

describe('LogContextKeys', () => {
	it('exposes the documented standard keys', () => {
		expect(LogContextKeys.REQUEST_ID).toBe('request_id')
		expect(LogContextKeys.SESSION_ID).toBe('session_id')
		expect(LogContextKeys.USER_ID).toBe('user_id')
		expect(LogContextKeys.METHOD).toBe('method')
		expect(LogContextKeys.PATH).toBe('path')
		expect(LogContextKeys.OPERATION).toBe('operation')
		expect(LogContextKeys.COMPONENT).toBe('component')
		expect(LogContextKeys.BATCH_ID).toBe('batch_id')
		expect(LogContextKeys.DURATION_MS).toBe('duration_ms')
		expect(LogContextKeys.ERROR_CODE).toBe('error_code')
		expect(LogContextKeys.ERROR_TYPE).toBe('error_type')
		expect(LogContextKeys.STATUS_CODE).toBe('status_code')
	})
})
