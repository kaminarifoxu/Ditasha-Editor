# Phase 3 M0 hardening and M1a implementation status

Target branch: `feature/phase3-creators`; UI unchanged; all new creator flags remain disabled. No native prop exporter has been enabled.

## M0 hardening completed in source

- Bounded job retention (`maxHistory`), bounded queue, finite task timeout, abort signaling, error snapshot.
- `electron/creators/native-process.cjs`: new private process supervisor with argv-only spawn, process-tree termination upon AbortSignal/timeout, bounded captured log, and guarded `ditasha-stage-*` cleanup.
- `electron/creators/export-validation.cjs`: Windows-safe relative filenames, device-name/trailing-dot/trailing-space rejection, symlink ancestor checks, SHA256/byte checks, directory-level exclusive lock and non-overwriting staged rename. Export directories must be siblings on the same volume.
- Tests for Windows path traversal, symlink ancestors, locked destinations, cancellation, timeout, bounded retention and cleanup.

### Important boundaries

The native supervisor has not replaced the existing ped/vehicle build runner. It is an adapter for future creator jobs; current functionality remains unchanged. AbortSignal cancellation is cooperative until the creator-specific native runner uses the supervisor. The advisory exclusive lock prevents concurrent DITASHA creator exports targeting the same destination; external programs that disregard that lock remain outside its guarantee. A crash can leave a stale lock requiring safe user-guided recovery. Cleanup is scoped to fresh creator staging directories and must be called by future creator worker `finally` blocks. Do not delete arbitrary project directories.

## M1a implemented

- `electron/creators/prop-schema.cjs`: strict versioned request schema for Legacy GLB/OBJ/FBX; name, asset token, collision mode, draw distance and ordered LOD constraints.
- `probePropCapabilities`: fail-closed negotiation for native drawable, collision and archetype writers, plus importer formats. Native provider flags are NOT assumed available.
- `resolvePropInput`: scope-checked input/output token lookup (internal service; no renderer path/command interface).
- `tests/prop-schema.test.cjs`: invalid input, unsupported Enhanced/YDR, capability fail-closed, and token-scope tests.
- `tests/fixtures/phase3-prop-corpus.json`: fixture *requirements*. Actual binary fixture assets and native round-trip tests are later M1 work.

## Remaining before M1b/M1c

1. Implement a trusted main-process asset token issue/revoke store with path realpath checks, size limits and strict `kind` grants. Never expose a raw filesystem resolver to renderer.
2. Probe actual pinned native provider versions and run importer/exporter self-tests; capability flags must be derived from successful verification, not caller input.
3. Create physical synthetic GLB/OBJ/FBX fixtures.
4. Integrate native supervisor with the new prop worker and cleanup in `finally`; expose only controlled status via IPC.
5. Add collision visualization and explicit coordinate conventions in the current Asset Workshop only after functionality is verified.
6. Run Windows EXE build and manual FiveM asset tests before declaring production readiness.

## CI

Run `npm ci`, `npm test`, `npm run build:ui`. Windows packaging and FiveM runtime are separate gates. Refer to the latest GitHub Actions workflow rather than treating this document as a CI success claim.
