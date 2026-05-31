/**
 * Internal: an AsyncLocalStorage-backed context store shared by the
 * `Logger` class (which reads it on every emission) and the
 * `withLogContextAsync` / `withRequestId` helpers (which write to it).
 *
 * On runtimes without `node:async_hooks` (browsers, some edge runtimes),
 * the store falls back to a single-slot module-scoped context. This
 * preserves the API surface but loses cross-async-boundary correctness;
 * use the explicit `context` parameter on Logger methods on those
 * runtimes.
 *
 * @internal
 */

import type { LogContext } from '../core/types.ts'

type Store = LogContext

interface AsyncLocalStorageLike<T> {
	getStore(): T | undefined
	run<R>(value: T, fn: () => R): R
}

type AsyncHooksModule = {
	AsyncLocalStorage: new <T>() => AsyncLocalStorageLike<T>
}

type NodeProcessGlobal = {
	versions?: {
		node?: string
	}
}

function dynamicImport(specifier: string): Promise<unknown> {
	return import(/* @vite-ignore */ specifier)
}

function canLoadNodeAsyncHooks(): boolean {
	const processLike = (globalThis as { process?: NodeProcessGlobal }).process
	return typeof processLike?.versions?.node === 'string'
}

let asyncStore: AsyncLocalStorageLike<Store> | null = null
let fallbackStore: Store = {}

async function tryLoadAsyncLocalStorage(): Promise<void> {
	if (asyncStore !== null) return
	if (!canLoadNodeAsyncHooks()) return
	try {
		// Dynamic import so non-Node bundles don't fail to resolve the path.
		const mod = (await dynamicImport('node:async_hooks')) as AsyncHooksModule
		asyncStore = new mod.AsyncLocalStorage<Store>()
	} catch {
		asyncStore = null
	}
}

// Eagerly attempt to load on Node-shaped runtimes so the first
// withLogContextAsync call doesn't pay the import cost twice.
void tryLoadAsyncLocalStorage()

/**
 * Get the currently active log context, merging any AsyncLocalStorage
 * value with the fallback single-slot. Empty object if nothing is set.
 *
 * @internal
 */
export function getCurrentLogContext(): LogContext {
	if (asyncStore) {
		const value = asyncStore.getStore()
		if (value) return value
	}
	return fallbackStore
}

/**
 * Run `fn` with `context` merged into the current log context (which
 * appears on every `Logger.*` call inside that callback). On Node,
 * uses `AsyncLocalStorage` so propagation works across `await`
 * boundaries and timers. On other runtimes, uses a single-slot
 * fallback (less correct under concurrency).
 *
 * @param context - Runtime context.
 * @param fn - Function to call.
 * @internal
 */
export async function runWithContext<T>(context: LogContext, fn: () => Promise<T> | T): Promise<T> {
	await tryLoadAsyncLocalStorage()
	const merged: Store = { ...getCurrentLogContext(), ...context }

	if (asyncStore) {
		return asyncStore.run(merged, () => Promise.resolve(fn()))
	}

	// Fallback: single-slot, save/restore around the call.
	const previous = fallbackStore
	fallbackStore = merged
	try {
		return await fn()
	} finally {
		fallbackStore = previous
	}
}

/** Reset to empty. For tests. @internal */
export function clearLogContext(): void {
	fallbackStore = {}
	// AsyncLocalStorage entries are scoped to their `run()` callback;
	// nothing to clear globally.
}
