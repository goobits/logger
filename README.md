<h1 align="center">@goobits/logger</h1>

<p align="center"><strong>A small structured logger with pluggable output, module levels, and optional async context.</strong></p>
<p align="center">Implement the shared Goobits Logger contract without forcing a third-party transport or a static Node built-in import on every consumer.</p>

<p align="center">
  <a href="#why-logger">Why Logger</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#public-surface">Public surface</a> ·
  <a href="#runtime-and-data-boundaries">Boundaries</a>
</p>

---

## Why Logger

`@goobits/logger` supplies the four-method `Logger` accepted by
`@goobits/security` and structurally compatible with `@goobits/sitemap`'s
narrower optional logger callbacks. It also provides one concrete logger,
process-global configuration, error collection, context propagation, and
focused helpers.

The concrete logger writes formatted output to `console.*`; the package ships no
file, cloud, buffering, or retention transport. Applications may instead supply
a structurally compatible pino, winston, or no-op implementation. Safe
serialization handles circular references, BigInt, and Error
name/message/stack without crashing; use `errorWithCause` when recursive causes
are required.

## Quick start

Requires Node.js 22 or newer. Consume this source-only package from a pinned Git
submodule in a TypeScript-aware pnpm workspace; it is not published to npm.

```bash
git submodule add https://github.com/goobits/logger.git packages/logger
pnpm install
```

Declare `"@goobits/logger": "workspace:*"` in the consuming package and include
the mounted path in `pnpm-workspace.yaml`. The committed submodule pointer owns
the exact source revision.

```ts
import { createLogger } from '@goobits/logger'

const log = createLogger('checkout')

log.info('order created', {
  request_id: 'req_123',
  order_id: 'order_456',
})
```

The shared interface is structurally compatible with application-owned
adapters for other logging libraries.

## Configuration

Global and per-module levels can be changed with the root configuration API.
`createErrorCollector()` uses a bounded default of 100 recent errors; the
legacy string-scoped overload is unbounded. Neither overload is a durable
transport or monitoring backend.

```ts
import { setGlobalLevel, setModuleLevel } from '@goobits/logger'

setGlobalLevel('INFO')
setModuleLevel('checkout', 'DEBUG')
```

Child loggers extend base context. Callers remain responsible for ensuring that
context is safe to record.

## Public surface

| Import | Responsibility |
| --- | --- |
| `@goobits/logger` | Logger class and interface, factories, levels, configuration, and error collection |
| `@goobits/logger/context` | `withLogContextAsync`, `withRequestId`, and context keys |
| `@goobits/logger/helpers` | `captureError`, `errorWithCause`, `logTiming`, and capture option/result types |

The public context helpers are absent from the root barrel. The concrete root
logger still reads the internal context store; on Node-shaped runtimes that
store dynamically loads `node:async_hooks`, while other runtimes avoid a static
Node import and use the fallback.

## Runtime and data boundaries

Async context uses `AsyncLocalStorage` on runtimes exposing a working
Node-compatible `node:async_hooks`; otherwise it uses a single-slot fallback.
The fallback is correct only for sequential work and cannot isolate concurrent
request contexts. Import `/context` only when that tradeoff is understood.

The logger records the context it receives. It does not infer which fields are
credentials, personal data, tokens, or secrets. Consumers own redaction before
calling it and own transport retention, access control, and delivery.

`captureError` deduplicates recoverable reporting in process memory. It does not
replace an error boundary, durable alerting, or process-level failure handling.

## Development

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

## License

[MIT](LICENSE) © [Goobits](https://github.com/goobits)
