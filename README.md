# @goobits/logger

Production-ready structured logger with a pluggable interface, AsyncLocalStorage context propagation, and module-scoped log levels. Drop-in implementation of the `Logger` interface used across the `@goobits/*` workspace — or supply your own (pino, winston, console) satisfying the same shape. Zero runtime dependencies.

## Highlights

- 🪶 **Zero runtime dependencies** — pure TypeScript, native `console.*` under the hood
- 🧩 **Pluggable interface** — implements the same `Logger` shape that `@goobits/security`, `@goobits/sitemap`, and friends accept. Swap freely.
- 🧵 **Async context propagation** — `withLogContextAsync` + `withRequestId` use `AsyncLocalStorage` so logs across `await` boundaries automatically carry request-scoped context
- 📐 **Per-module log levels** — verbose debug for one subsystem without flooding the rest
- 🎨 **Auto-formatting** — human-readable in dev terminals, single-line JSON in production (TTY-aware), or pick either explicitly
- 🔑 **Standard context keys** — `LogContextKeys.REQUEST_ID`, `.USER_ID`, `.OPERATION`, etc., so structured logs query consistently
- 📦 **ESM-only, TypeScript-native** — subpath exports for tree-shaking; runs on Node 22+, Bun, Deno, Cloudflare Workers
- 🛡️ **Safe serialization** — handles circular references, BigInt, and Error instances (with full `cause` chain) without crashing

## Requirements

- Node ≥22

## Install

`@goobits/logger` is distributed as a **git submodule with TypeScript source** — no build step, no `dist/`, no npm package. Consume it from a workspace whose bundler (Vite, esbuild, SvelteKit, Bun, Deno, etc.) handles `.ts` natively.

### Why source-only?

The package is built for `@goobits/*`-style consumers whose bundlers already compile `.ts` end-to-end. Shipping a pre-built `dist/` adds a build/version-dance step that buys nothing. Source-level distribution keeps fixes one diff away in either direction, and the consumer's existing typecheck/test pipeline sees real types through the boundary rather than `.d.ts` reconstructions.

### pnpm workspace (recommended)

```bash
# from your consumer repo root:
git submodule add git@github.com:goobits/logger.git packages/logger
```

```yaml
# pnpm-workspace.yaml
packages:
  - sites/*
  - packages/*
```

```jsonc
// your app's package.json
"dependencies": {
  "@goobits/logger": "workspace:*"
}
```

```bash
pnpm install
```

### Pinning a version

`workspace:*` always tracks the submodule's current HEAD. For production, pin to a tag:

```bash
cd packages/logger && git checkout v1.0.0 && cd ../..
git add packages/logger && git commit -m "chore: pin @goobits/logger to v1.0.0"
```

### Syncing from upstream

```bash
git submodule update --remote packages/logger
git add packages/logger && git commit -m "chore: bump @goobits/logger"
```

## At a glance

```ts
// core surface — Logger + factory + config
import { createLogger, LoggerConfig } from '@goobits/logger'

// AsyncLocalStorage context propagation (Node-only)
import { withRequestId, LogContextKeys } from '@goobits/logger/context'

// convenience helpers built on the pluggable interface
import { captureError, errorWithCause, logTiming } from '@goobits/logger/helpers'
```

## Basic use

```ts
import { createLogger } from '@goobits/logger'

const log = createLogger('checkout')

log.info('user signed in', { user_id: user.id })
log.warn('retrying payment', { attempt: 2 })
log.error('payment failed', { user_id: user.id, status_code: 500 })
log.debug('cache miss', { key: 'cart:42' })
```

The 4 methods (`debug`, `info`, `warn`, `error`) take `(message, context?)`. The context is merged into the log line as structured fields. The `Logger` interface is intentionally narrow so any implementation (this package, pino, winston, a no-op) is interchangeable.

## Pluggable with `@goobits/security` and `@goobits/sitemap`

The `Logger` type exported from this package is byte-identical to the interface expected by other `@goobits/*` packages. Pass an instance directly:

```ts
import { createLogger } from '@goobits/logger'
import { createCsrf } from '@goobits/security/csrf'
import { pingSearchEngines } from '@goobits/sitemap/ops'

const log = createLogger('app')

const csrf = createCsrf({ logger: log })
await pingSearchEngines('https://example.com/sitemap.xml', { engines: [...], logger: log })
```

## Using pino / winston as the underlying logger

The interface goes both ways. If you want pino's performance, transports, or formatters, use pino as your `Logger` — the helpers and security/sitemap packages still work:

```ts
import pino from 'pino'
import { errorWithCause, logTiming } from '@goobits/logger/helpers'
import { createCsrf } from '@goobits/security/csrf'

const log = pino()   // pino satisfies the same 4-method interface

const csrf = createCsrf({ logger: log })
await logTiming(log, 'db.findUser', () => db.users.findById(id))

try { await capture(order) }
catch (err) { errorWithCause(log, 'capture failed', err) }
```

## No built-in transports — and why

`@goobits/logger` writes to `console.*` and nothing else. There's no built-in file rotation, no Datadog/CloudWatch/Logflare destination, no buffering layer. The intent is to keep the surface narrow and lean on the surrounding ecosystem:

- **Production log shipping** — pipe stdout to your log collector (Cloudflare Workers Logs, CloudWatch, Datadog Agent, journald, Vector, etc.). The `json` format makes downstream parsing trivial.
- **Transports / custom destinations** — use pino (or any logger) as your `Logger` instance via the example above. Pino has a rich transport ecosystem.
- **Redaction / scrubbing** — the package logs whatever context you give it. Apply redaction at the call site, or wrap a redacting logger.

If you find yourself needing a feature this package lacks, the right answer is usually "use pino, route it through the same pluggable `Logger` interface, keep the helpers."

## Global configuration

```ts
import { LoggerConfig, LogLevel } from '@goobits/logger'

LoggerConfig.setLogLevel(LogLevel.DEBUG)
LoggerConfig.setModuleLevel('checkout', LogLevel.WARN)   // quiet just one module
LoggerConfig.setFormat('json')                            // force JSON (default is 'auto')
LoggerConfig.setGlobalPrefix('[app]')
```

Boot-time env vars also work:

```bash
LOG_LEVEL=DEBUG LOG_FORMAT=json node server.js
```

### Bare-function config API

For code that prefers top-level mutators (and as a drop-in for loggers that expose them), the common `LoggerConfig` operations are also exported as functions:

```ts
import { setGlobalLevel, setModuleLevel, disableModule, enableModule } from '@goobits/logger'

setGlobalLevel('WARN')           // global minimum
setModuleLevel('goo', 'DEBUG')   // verbose for one module
disableModule('noisy')           // silence one module (level NONE)
enableModule('noisy')            // remove the override, inherit global again
```

### `productionQuiet` — quiet in prod, verbose in dev

```ts
import { LoggerConfig } from '@goobits/logger'

LoggerConfig.setProductionQuiet(true)
```

When enabled, `debug`/`info` are dropped in production-like runtimes (`NODE_ENV === 'production'` or a non-TTY stdout) but stay visible in an interactive dev terminal — so a library can be chatty locally and quiet when deployed without wiring its own env check. Per-module overrides still win, so `setModuleLevel('goo', 'DEBUG')` keeps that module verbose even in production.

### Listing known modules

```ts
import { createLogger, getLoggerNames } from '@goobits/logger'

createLogger('checkout')
createLogger('search')
getLoggerNames() // ['checkout', 'search']
```

## `createErrorCollector` — bounded error history

Capture a rolling window of errors with context for later inspection (test assertions, error panels, crash reports). It does not log; pair it with a logger at the call site if you want both.

```ts
import { createErrorCollector } from '@goobits/logger'

const errors = createErrorCollector(100)        // keep the last 100
errors.collect(new Error('boom'), { route: '/checkout' })
errors.count()       // 1
errors.getEntries()  // [{ error, context: { route: '/checkout' }, timestamp }]
errors.clear()
```

## `child()` — extending base context

```ts
const log = createLogger('checkout')
const orderLog = log.child({ order_id: order.id })

orderLog.info('payment captured')   // context: { order_id: '...' }
orderLog.info('shipped', { carrier: 'ups' })
//   context: { order_id: '...', carrier: 'ups' }
```

## Async context propagation

The biggest reason to use this package over plain `console`: request-scoped context that flows automatically across `await` boundaries.

End-to-end SvelteKit example:

```ts
// src/hooks.server.ts
import { withRequestId } from '@goobits/logger/context'

export const handle = async ({ event, resolve }) => {
  const requestId = event.request.headers.get('x-request-id') ?? crypto.randomUUID()
  return withRequestId(requestId, () => resolve(event))
}
```

```ts
// src/routes/api/users/[id]/+server.ts
import { createLogger } from '@goobits/logger'
import { json } from '@sveltejs/kit'

const log = createLogger('api.users')

export const GET = async ({ params }) => {
  log.info('handling request')                       // ← request_id propagated automatically
  const user = await db.users.findById(params.id)
  log.info('user loaded', { user_id: user.id })      // ← still includes request_id
  return json(user)
}
```

Started with `LOG_LEVEL=DEBUG LOG_FORMAT=json node build`, a single request emits:

```json
{"timestamp":"2026-05-21T...","level":"info","module":"api.users","message":"handling request","request_id":"5a7b..."}
{"timestamp":"2026-05-21T...","level":"info","module":"api.users","message":"user loaded","request_id":"5a7b...","user_id":"u_42"}
```

The `request_id` flows from the hook through every nested `await` without being passed as a function argument — that's the whole point of the AsyncLocalStorage layer.

For richer context, use `withLogContextAsync`:

```ts
import { withLogContextAsync, LogContextKeys } from '@goobits/logger/context'

await withLogContextAsync(
  {
    [LogContextKeys.REQUEST_ID]: requestId,
    [LogContextKeys.USER_ID]: user.id,
    [LogContextKeys.OPERATION]: 'checkout.complete'
  },
  () => completeCheckout(order)
)
```

> Backed by `node:async_hooks` on Node 22+, Bun, and Deno. On runtimes without it (some edge environments, browsers), falls back to a single-slot context — correct for sequential code but loses isolation under concurrency.

## `errorWithCause` — logging errors with stack + cause chain

The `Logger.error` interface is intentionally 2-arg (`message, context?`) — same shape across every `@goobits/*` package. To log an `Error` with its stack and recursive `cause` chain without breaking that contract, use the helper:

```ts
import { errorWithCause } from '@goobits/logger/helpers'

try {
  await capturePayment(order)
} catch (err) {
  errorWithCause(log, 'capture failed', err, { order_id: order.id })
}
```

Emits:

```json
{
  "level": "error",
  "message": "capture failed",
  "error_type": "PaymentDeclinedError",
  "error_message": "card declined: insufficient funds",
  "error_stack": "PaymentDeclinedError: card declined...",
  "error_cause": { "error_type": "StripeError", "error_message": "..." },
  "order_id": "ord_42"
}
```

## `captureError` — deduped recoverable error capture

Use `captureError` when a failure is intentionally recoverable but should not be
invisible. It emits the first matching error as structured log output, optionally
records it in an `ErrorCollector`, and suppresses repeated captures with the same
fingerprint.

```ts
import { captureError } from '@goobits/logger/helpers'

try {
  await cleanupTempFile(path)
} catch (err) {
  captureError(log, 'temp cleanup failed', err, {
    level: 'warn',
    context: { operation: 'cleanup.tempFile', path }
  })
}
```

## `logTiming` — start/complete + duration

```ts
import { logTiming } from '@goobits/logger/helpers'

const user = await logTiming(log, 'db.findUser', () => db.users.findById(id))
```

Emits an `info` at start and a second `info` at complete with `duration_ms`. If `fn` throws, emits an `error` with `duration_ms` + error chain, then re-throws.

## Output formats

| Format | What it looks like | When |
|---|---|---|
| `human` | `[2026-05-21T...] [INFO] [checkout] user signed in {"user_id":"u_1"}` | Dev terminals (TTY stdout) |
| `json` | `{"timestamp":"2026-05-21T...","level":"info","module":"checkout","message":"user signed in","user_id":"u_1"}` | Production / log shipping (non-TTY stdout) |
| `auto` (default) | Picks `human` for TTY, `json` otherwise | Most setups |

Set via `LoggerConfig.setFormat(...)` or `LOG_FORMAT=json` at boot.

## Standard context keys

Use these to keep structured logs queryable across services:

```ts
import { LogContextKeys } from '@goobits/logger/context'

log.info('user signed in', {
  [LogContextKeys.USER_ID]: user.id,
  [LogContextKeys.SESSION_ID]: session.id,
  [LogContextKeys.METHOD]: 'POST',
  [LogContextKeys.PATH]: '/api/auth/login',
  [LogContextKeys.STATUS_CODE]: 200
})
```

Full key list: `REQUEST_ID`, `SESSION_ID`, `USER_ID`, `METHOD`, `PATH`, `OPERATION`, `COMPONENT`, `BATCH_ID`, `DURATION_MS`, `ERROR_CODE`, `ERROR_TYPE`, `STATUS_CODE`.

## Subpath exports

| Subpath | What's exported |
|---|---|
| `@goobits/logger` | `Logger` class + interface, `createLogger`, `noopLogger`, `LoggerConfig`, `LogLevel`, types |
| `@goobits/logger/context` | `withLogContextAsync`, `withRequestId`, `LogContextKeys`. Uses `node:async_hooks` (Node-only on the fast path). |
| `@goobits/logger/helpers` | `errorWithCause`, `logTiming` |

Root barrel intentionally excludes `/context` (Node-coupling) and `/helpers` (opt-in composition).

## Per-module runtime compatibility

| Module | Node ≥22 | Bun | Deno | Cloudflare Workers |
|---|---|---|---|---|
| `@goobits/logger` | ✅ | ✅ | ✅ | ✅ |
| `@goobits/logger/context` | ✅ | ✅ | ✅ | ⚠️ falls back to single-slot |
| `@goobits/logger/helpers` | ✅ | ✅ | ✅ | ✅ |

> Continuous integration exercises Node 22. Bun, Deno, and Cloudflare Workers are validated manually; if you hit a runtime-specific issue, please open an issue with the runtime version and a minimal repro.

## License

MIT — see [LICENSE](./LICENSE).
