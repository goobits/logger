# Changelog

All notable changes to `@goobits/logger` are documented here. The format adheres to [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-21

Initial public release.

### Added

- ESM-only TypeScript-native package, distributed via git submodule (consumed as TS source by the host's bundler — no build step, no `dist/`)
- Subpath exports:
  - `@goobits/logger` — `Logger` class, `createLogger`, `noopLogger`, types, `LoggerConfig`
  - `@goobits/logger/context` — `withLogContextAsync`, `withRequestId`, `LogContextKeys` (Node-only; uses `node:async_hooks`)
  - `@goobits/logger/helpers` — `errorWithCause`, `logTiming`
- `Logger` interface matches the pluggable shape used by `@goobits/security` and `@goobits/sitemap` — instances are drop-in dependencies for those packages
- `Logger` class with:
  - Module name + base context
  - `child(additionalContext)` for context inheritance
  - `isDebugEnabled` / `isInfoEnabled` / `isWarnEnabled` / `isErrorEnabled` helpers
  - Per-module level resolution via `LoggerConfig.setModuleLevel`
- `LoggerConfig` global configuration:
  - `setLogLevel` / `setFormat` / `setEnabled` / `setShowTimestamps` / `setGlobalPrefix`
  - `setModuleLevel` / `setModuleLevels` for per-module overrides
  - `configure(options)` for bulk updates
  - `reset()` for tests
  - Boot-time `LOG_LEVEL` / `LOG_FORMAT` env vars honored automatically
- Output formats:
  - `human` — `[timestamp] [LEVEL] [module] message {context}`
  - `json` — single-line JSON for production log ingestion
  - `auto` — JSON when stdout is non-TTY, human otherwise
- `AsyncLocalStorage`-backed context propagation:
  - `withLogContextAsync(context, fn)` — merges context into every nested log call
  - `withRequestId(id, fn)` — shorthand for the common request-ID pattern
  - Falls back to a single-slot context on runtimes without `node:async_hooks`
- `LogContextKeys` — standard semantic keys (request_id, session_id, user_id, method, path, operation, component, batch_id, duration_ms, error_code, error_type, status_code)
- `errorWithCause(logger, message, error, context?)` — log an Error with `error_type` / `error_message` / `error_stack` / recursive `error_cause` fields without breaking the 2-arg `Logger.error` interface contract
- `logTiming(logger, operation, fn, context?)` — emit start + complete (or error) lines with `duration_ms`
- `safeStringify` handles circular references, BigInt, and Error instances without crashing
- Zero runtime dependencies; ESM-only; targets Node 22+, Bun, Deno, Cloudflare Workers (the `/context` subpath uses `node:async_hooks` via dynamic import, with a single-slot fallback on runtimes that don't expose it)
- Comprehensive test suite (vitest) covering Logger, config, formatting, context propagation, helpers
