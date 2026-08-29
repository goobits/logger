import { describe, expect, it, vi } from 'vitest'

import { createErrorCollector } from '../src/core/error-collector.js'

describe('error collector', () => {
	it('collects entries with context and an injected timestamp', () => {
		const clock = vi.fn(() => 1234)
		const errors = createErrorCollector(100, clock)
		errors.collect(new Error('boom'), { route: '/x' })

		expect(errors.count()).toBe(1)
		const [ entry ] = errors.getEntries()
		expect(entry?.error.message).toBe('boom')
		expect(entry?.context).toEqual({ route: '/x' })
		expect(entry?.timestamp).toBe(1234)
	})

	it('evicts the oldest entries beyond the cap', () => {
		const errors = createErrorCollector(2)
		errors.collect(new Error('a'))
		errors.collect(new Error('b'))
		errors.collect(new Error('c'))

		expect(errors.count()).toBe(2)
		expect(errors.getEntries().map(entry => entry.error.message)).toEqual([ 'b', 'c' ])
	})

	it('clears without mutating snapshots', () => {
		const errors = createErrorCollector()
		errors.collect(new Error('a'))
		const snapshot = errors.getEntries()
		errors.clear()

		expect(errors.count()).toBe(0)
		expect(snapshot).toHaveLength(1)
	})

	it('does not log while collecting', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		const errors = createErrorCollector()
		errors.collect(new Error('silent'))

		expect(errorSpy).not.toHaveBeenCalled()
		errorSpy.mockRestore()
	})
})
