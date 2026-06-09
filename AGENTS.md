# `@goobits/logger` Agent Guide

Production-ready structured logger with a pluggable interface, AsyncLocalStorage context propagation, and module-scoped log levels. Notes here describe code that agents/contributors should follow when modifying this package.

---

## Quick reference

- **Category:** library (ESM-only, TypeScript)
- **Distribution:** git submodule consumed inside a pnpm workspace. Consumer bundlers (Vite/esbuild/SvelteKit) compile the `.ts` source directly — no build step, no `dist/`, no npm publish.
- **Primary stack:** TypeScript 5.9 + vitest. Zero runtime dependencies. Optional peer-dep: `typescript ^5`.
- **Runtime targets:** Node 22+, Bun, Deno, Cloudflare Workers. The `/context` subpath uses `node:async_hooks` (dynamic import; falls back to single-slot on non-Node runtimes).
- **Engines:** Node `>=22`

## Commands

```bash
pnpm install
pnpm typecheck      # tsc --noEmit (src + tests)
pnpm test           # vitest run
pnpm test:watch     # vitest
pnpm test:coverage  # vitest run --coverage
```

## Architecture

```
src/
├── index.ts            # barrel: Logger + LoggerConfig + types
├── core/
│   ├── types.ts        # Logger interface, LogContext, LogLevel
│   ├── logger.ts       # Logger class + createLogger + noopLogger
│   ├── config.ts       # Global LoggerConfig state + per-module levels
│   └── format.ts       # @internal: human + json formatters
├── context.ts          # barrel
├── context/
│   ├── async-context.ts # withLogContextAsync + withRequestId
│   ├── keys.ts         # LogContextKeys constants
│   └── store.ts        # @internal: AsyncLocalStorage store with fallback
├── helpers.ts          # barrel
└── helpers/
    ├── error-cause.ts  # errorWithCause
    └── timing.ts       # logTiming
```

`package.json#exports` points directly at `./src/*.ts`. There is no build step. Consumers' bundlers (Vite/esbuild/SvelteKit) compile the `.ts` source as part of their own pipeline.

The root barrel intentionally does NOT re-export `/context` (Node-only) or `/helpers` (composition utilities). Consumers explicitly opt into those subpaths.

## Interface compatibility — the load-bearing invariant

The `Logger` interface here is intentionally identical to the one defined in `@goobits/security` and `@goobits/sitemap`:

```ts
interface Logger {
	debug(message: string, context?: LogContext): void
	info(message: string, context?: LogContext): void
	warn(message: string, context?: LogContext): void
	error(message: string, context?: LogContext): void
}
```

DO NOT change the method shapes (e.g., adding a 3rd argument to `error`). Doing so would break interop — `@goobits/security` and `@goobits/sitemap` would no longer accept a `@goobits/logger` instance, and consumers would have to write adapter glue. If new functionality is needed, ship it as a separate helper (see `errorWithCause` in `helpers/`).

## Code style

- Tabs, single quotes, no semicolons
- Strict TypeScript (`tsconfig.json` enables `noUncheckedIndexedAccess`, `noUnusedLocals`, etc.)
- All exports named; no default exports
- Pure functions where possible; mutable state limited to `LoggerConfig` (deliberately global, like pino/winston)

## Security rules (do not bypass)

- The `safeStringify` serializer must handle circular references, BigInt, and Error instances. Tests cover all three. Don't replace it with `JSON.stringify(value)` without restoring those guards.
- `withLogContextAsync` MUST use the `AsyncLocalStorage` path on Node-shaped runtimes (concurrency-correct). The single-slot fallback is only acceptable when `node:async_hooks` is genuinely unavailable. Confirm via `getCurrentLogContext()` lookups under concurrent tests.
- The package logs whatever context is passed to it. Redaction is the consumer's responsibility — see `@goobits/security/audit` for a redaction-applying wrapper if you need automatic stripping. Don't add a redaction layer to this package without an explicit feature request.
- When this package's deps change in `package.json`, verify their licenses remain permissive (MIT / Apache 2.0 / BSD). No GPL-ish copyleft deps.

## Where to look

- Public API barrel: `src/index.ts`
- Per-capability subpath barrel: `src/<name>.ts`
- Implementation: `src/<name>/*.ts`
- Tests: `tests/<topic>.test.ts`
- Types-strict config: `tsconfig.json`

## Definition of Done

- `pnpm typecheck` passes with no errors (covers `src/` and `tests/`)
- `pnpm test` passes with no failing assertions
- Every entry in `package.json#exports` points at an existing `src/*.ts` file
- No `dist/`, `node_modules/`, `.DS_Store`, or `*.tsbuildinfo` tracked
- README + CHANGELOG updated for any user-facing change
- The `Logger` interface shape (4 methods, 2 args each) is unchanged
- New deps reviewed for license compatibility (permissive only)

## Shared-Folder Git

- Shared macOS/Linux checkouts should use `core.filemode=false`; chmod-only changes will not be noticed reliably.
- When a script must be executable, run `git update-index --chmod=+x path/to/script.sh` and include that in the commit.
