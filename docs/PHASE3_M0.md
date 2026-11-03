# Phase 3 M0 — Creator Foundation (experimental infrastructure)

This milestone adds disabled-by-default creator registration, an internal cancellable job queue, and staged artifact validation. It does **not** implement prop/weapon/freemode/tattoo/livery converters and does not modify the visible UI.

## Integration

- Main process: `electron/main.cjs` registers `registerCreators` with the existing trusted IPC guard.
- Preload: read-only `window.ditashaCreators.state()` reports disabled creator capabilities.
- Registry: no registered builders and all five feature flags false. Future M1+ changes must explicitly supply vetted handlers/capabilities; never expose raw command arguments or absolute paths over IPC.
- Jobs: private main-process workers; FIFO bounded queue, cancellation via AbortSignal, fail-safe closure on shutdown.
- Export: `validateArtifacts` checks existence, relative paths, duplicate names, regular files, size and SHA-256. `commitExport` uses a no-overwrite directory rename. Staging and destination must be on the same volume for atomic commit. Callers must generate a unique destination and provide validated staging files.

## Boundaries

Native creation and FiveM in-game verification are **not** included in M0. The job manager supports cooperative cancellation; each future native-process adapter must wire AbortSignal to child termination. The export commit is deliberately non-overwriting; future creators should do build -> validate -> round-trip -> commit, rather than committing before conversion passes.

## Regression policy

Keep the current UI, native build, weapon studio, character presets, Photo Booth, updater, and asset import paths unchanged. Default off for all new creator features. Run `npm test`, `npm run build:ui`, and Windows-specific EXE smoke tests before enabling a feature. Do not treat unit tests as GTA/FiveM runtime certification.
