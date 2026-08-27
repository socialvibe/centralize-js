# Changelog

## v2.0.1
* [PI-3664](https://infillion.atlassian.net/browse/PI-3664): Restore case-insensitive `matchCondition()` operators
  * v2.0.0 dropped the `operator.toUpperCase()` normalization v1.1.4 did, so `matchCondition('key', 'not', value)` threw "Invalid operator" instead of matching. `container_core` calls `matchCondition(TXM_LOG_HISTORY, 'not', true)` while constructing its log history at module load, so the whole container failed to import. Operators are normalized again, and the new `MatchConditionOperatorInput` type accepts the lowercase forms alongside the canonical uppercase ones.

## v2.0.0
* [PI-3664](https://infillion.atlassian.net/browse/PI-3664): Modernize the toolchain (Node 24, TypeScript 7, `node:test`, GitHub Actions) and fix known bugs
  * **Breaking**: renamed the package to `@socialvibe/centralize`, published to GitHub Packages instead of the public npm registry as `centralize-js`. Consumers (e.g. `container_core`) need a coordinated follow-up update (dependency name, `.npmrc` registry auth, import sites).
  * **Breaking**: package is now native ESM (`"type": "module"`) with no CommonJS build.
  * Fixed: `ISender.send()` had an untyped/misnamed parameter; it's now `send(msg: IMessage): void`.
  * Fixed: `IReceiver` and the interceptor callback incorrectly shared one type. Split off a dedicated `IInterceptor` (`(msg: IMessage) => IMessage | null | undefined`), and `Stream.send()` now correctly stops calling later interceptors once one returns `null`/`undefined` (previously it kept invoking them, passing the falsy value through).
  * Fixed: substreams created via `matchAll()` and `matchCondition()` never detached from their parent stream once their last receiver was removed, unlike `matchLabels()` — a receiver/memory leak. All three now share the same detach-on-empty behavior.
  * Fixed: `MessageHub.send()` mutated the caller's message object to fill in a missing timestamp, and only checked for `undefined` rather than validating the value was an actual `Date`. It now sends a shallow copy with a fresh `Date` whenever `timestamp` isn't already a `Date` instance, and likewise defaults `labels` to `{}` when missing/`null` instead of letting a malformed message crash downstream label matching.
  * Fixed: `Stream.matchLabels(null)` crashed with a raw `TypeError` instead of the intended "no labels were provided" validation error.
  * Fixed: `Stream.send()`'s log-level filter treated a non-numeric `logLevel` as always passing the threshold (failing open); it now fails closed, filtering out messages whose `logLevel` isn't actually a number.
  * Fixed: `Stream.send()` only ignored an interceptor's return value of `null`/`undefined`; any other non-object return value (e.g. a caller mistakenly returning `false`) was forwarded to receivers as if it were a real message. It's now ignored, and the message from before that interceptor ran continues on to the next one.
  * Fixed: `Logger` crashed when given `null` for log levels; it now falls back to the default log levels, and throws if a given log level name would collide with one of `Logger`'s own members.
  * Changed: private class fields are now consistently prefixed with `_` (matching `Stream`'s existing convention) across `Logger` and `MessageHub`.
  * Changed: `Stream`'s `_parentStream` is now `Stream | undefined` (was `Stream | null`), matching the project's `undefined`-over-`null` convention; the constructor now throws if given a `parentStream` that isn't an actual `Stream` instance.
  * Changed: adopted `get`/`set` property accessors project-wide in place of `getX()`/`setX()` method pairs, since nothing in the codebase relied on their method-only traits (chaining, generics): `Stream.setLogLevel()` → `logLevel` (get/set), `Stream.hasReceivers()` → `hasReceivers` (protected get); `Logger.getLabels()`/`setLabels()` → `labels` (get/set), `Logger.getLogLevels()` → `logLevels` (get only).
  * Removed: `Logger.setLogLevels()` (public runtime reconfiguration of a logger's log levels) — an org-wide search across `container_core` and every other `socialvibe` repo found no consumer of it. A logger's log levels are now fixed for its lifetime, set only via its constructor / `createLogger()`.
  * Fixed: the public interfaces and types (`IMessage`, `ISender`, `IReceiver`, `IInterceptor`, `ILabels`, `ILogLevels`, `MatchConditionOperator`, `Stream`, `LogFunction`, `LogMethods`, `LoggerWithLevels`) weren't reachable by consumers even though `package.json` pointed at type declarations. They're now re-exported from the package entry point.
  * Added: `Logger`/`createLogger` are now generic over the configured log levels, so every log-level method (`.info()`, `.debug()`, custom levels, ...) is fully typed with no `any` in parameters or returns.
  * Changed: renamed `ILabel` to `ILabels`; label/message `value` fields are now typed `unknown` instead of `any`.
  * Changed: rewrote the test suite from Jest to Node's built-in `node:test` runner (no extra flags needed on Node 24); removed `jest`, `ts-jest`, and `babel-minify`/`rollup` (unused once there's no bundling step).
  * Changed: CI/CD moved from Travis to GitHub Actions — PRs run typecheck/build/test and a version+CHANGELOG check; merges to `master` publish to GitHub Packages and cut a GitHub release.
  * Changed: upgraded to TypeScript 7.x and target Node 24.
  * Changed: the PR CI workflow now publishes unit test results as a check run (via `dorny/test-reporter`) and a `junit.xml` artifact, using Node's built-in JUnit test reporter.
  * Changed: `.github/pull_request_template.md` now matches the `truex-bluescript-js` template.
  * Changed: flattened the outer `describe()` wrapper in each test file, since `dorny/test-reporter`'s JUnit parser doesn't handle nested test suites.
  * Changed: `.github/workflows/publish.yml` no longer runs `git tag`/`git push` before `gh release create` — `gh release create` already creates the tag as part of its flow.
  * Fixed: `StreamFilter` subclasses (`matchAll()`, `matchLabels()`, `matchCondition()`) attached to their parent stream eagerly in the constructor, even if the substream itself was never given a receiver, and could never reattach after a full detach. Attaching now happens on the first `addReceiver()` call instead, so it's symmetric with the existing detach-on-last-`removeReceiver()` behavior and substreams can be reattached.
  * Added: log level names must now be alphanumeric (`/^[a-zA-Z0-9]+$/`); `Logger` throws otherwise, in addition to the existing check for names colliding with `Logger`'s own members.
  * Added: `createLogger` is now re-exported from the package entry point alongside `LoggerClass`.
  * Fixed: `scripts/check-release.ts` required only *at least one* `## v<version>` heading in `CHANGELOG.md`; it now requires exactly one.
  * Added: `.github/workflows/ci.yml` now grants `permissions: contents: read, checks: write` so `dorny/test-reporter` can reliably create its check run.
  * Changed: `README.md`'s installation instructions now cover GitHub Packages authentication (`.npmrc` `_authToken` line and the required `read:packages` PAT scope).

## v1.1.4
* Last release published to npmjs.com as `centralize-js`, prior to this fork's modernization under PI-3664.
