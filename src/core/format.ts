/**
 * Format a single log emission into a printable line. Two modes:
 *
 *  - `human`: `[2026-05-20T12:00:00.000Z] [INFO] [module] message {context}`
 *  - `json`:  `{"timestamp":"...","level":"info","module":"...","message":"...","key":"value"}`
 *
 * The auto-select decision happens upstream in `config.getActiveFormat()`
 * (TTY = human, non-TTY = json).
 *
 * @internal
 */

import type { LogContext, LogLevelName, LogLevelValue } from './types.js'
import { LogLevel } from './types.js'

const LEVEL_NAME_BY_VALUE: Record<number, LogLevelName> = {
	[LogLevel.DEBUG]: 'DEBUG',
	[LogLevel.INFO]: 'INFO',
	[LogLevel.WARN]: 'WARN',
	[LogLevel.ERROR]: 'ERROR',
	[LogLevel.NONE]: 'NONE'
}

export interface FormatInput {
	level: LogLevelValue
	moduleName: string | null
	message: string
	mergedContext: LogContext
	timestamp: string | null
	globalPrefix: string
}

function safeStringify(value: unknown): string {
	const seen = new WeakSet<object>()
	try {
		return JSON.stringify(value, (_key, v) => {
			if (typeof v === 'object' && v !== null) {
				if (seen.has(v)) return '[Circular]'
				seen.add(v)
			}
			if (typeof v === 'bigint') return v.toString()
			if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack }
			return v
		})
	} catch {
		return '[unserializable]'
	}
}

export function formatHuman(input: FormatInput): string {
	const parts: string[] = []
	if (input.timestamp) parts.push(`[${ input.timestamp }]`)
	const levelName = LEVEL_NAME_BY_VALUE[input.level] ?? 'INFO'
	parts.push(`[${ levelName }]`)
	if (input.globalPrefix) parts.push(input.globalPrefix)
	if (input.moduleName) parts.push(`[${ input.moduleName }]`)
	parts.push(input.message)
	const contextKeys = Object.keys(input.mergedContext)
	if (contextKeys.length > 0) parts.push(safeStringify(input.mergedContext))
	return parts.join(' ')
}

export function formatJson(input: FormatInput): string {
	const payload: Record<string, unknown> = {
		level: (LEVEL_NAME_BY_VALUE[input.level] ?? 'INFO').toLowerCase(),
		message: input.message
	}
	if (input.timestamp) payload['timestamp'] = input.timestamp
	if (input.moduleName) payload['module'] = input.moduleName
	if (input.globalPrefix) payload['prefix'] = input.globalPrefix
	for (const [ key, value ] of Object.entries(input.mergedContext)) {
		if (!(key in payload)) payload[key] = value
	}
	return safeStringify(payload)
}
