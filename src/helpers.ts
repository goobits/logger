/**
 * Convenience wrappers built on the core `Logger` interface. None of
 * these define new state; they are pure helpers that compose with any
 * `Logger` (this package, pino, winston, console, no-op).
 *
 * @module @goobits/logger/helpers
 */

export { errorWithCause } from './helpers/error-cause.js'
export { logTiming } from './helpers/timing.js'
