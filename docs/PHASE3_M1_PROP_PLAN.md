# Phase 3 M1 — Prop & Collision Creator implementation plan

Status: **prepared, not implemented**. Target integration branch: `feature/phase3-creators`. The existing DITASHA UI must remain unchanged until optional tool controls are explicitly enabled. Main branch is out of scope.

## Verified M0 baseline

GitHub Actions [run 41734813148](https://github.com/kaminarifoxu/Ditasha-Editor/actions/runs/41734813148) completed successfully: `npm ci`, clothing-library test, `npm test`, `npm run build:ui`. This does **not** prove Windows packaging or in-game behavior. M0 code adds disabled creators, read-only trusted IPC, a bounded internal cooperative queue, artifact validation, and staged non-overwriting export. No creator native handler is enabled.

## Existing code to reuse

- `electron/main.cjs` and `electron/preload.cjs`: trusted IPC boundary; do not expose raw arbitrary filesystem paths or commands.
- `electron/creators/registry.cjs`, `job-manager.cjs`, `export-validation.cjs`: M0 registration, scheduling and export foundation.
- `electron/native-build.cjs`, native Blender/Sollumz setup and bridge: verified supported native operations; extend through a **new allowlisted prop mode** rather than copying process launch code.
- `src/app.js` / existing Three.js model viewer: reuse geometry/material/UV preview; keep camera and existing asset APIs unchanged.
- `src/asset-workshop-ui.js`: current non-destructive control grouping; creator UI must mount behind the existing workspace rather than replace IDs/nodes.
- `src/map-meta.js`: existing **read-only** Legacy YTYP/YMAP parser; use it for validation, not as an assumed YTYP writer.
- `src/resource.js`, resource-client and model-material resolver: adapt existing native decoding and texture matching.
- `electron/gta-tools.cjs`: ModDropV existing prop DLC path is **not** a full prop-native conversion; keep separate.

## Planned M1 increments

### M1a: Scope, capability negotiation and fixtures
1. Specify supported inputs: GLB, OBJ and FBX via verified local Blender importer; support pre-existing YDR only when backed by compatible native provider. Reject unverified Enhanced paths.
2. Add a `prop` capability probe to a native provider adapter; require supported exporter, collision writer and archetype encoder separately.
3. Define fixture corpus: cube with UV, multi-material chair, transparent prop, missing YTD reference, non-uniform scale, oversized invalid mesh, authored collision.
4. Define request schema: source asset token, target Legacy, project name, collision mode (none / box / convex / authored), max draw distance, LOD selections, output token. Strict numeric bounds and path-token lookup.

### M1b: Geometry, preview and collision
1. Normalize pivot, axes and units with explicit GTA Z-up <-> Three Y-up convention; record transforms rather than destructively editing originals.
2. Load input into existing 3D preview; overlay collision, drawable bounds and LOD ranges only when prop mode is active.
3. Support box and convex hull collisions; validate manifold geometry, finite vertices, degenerates, scale, and collision flags. Authored complex collisions require a supported provider.
4. Keep collision preview separate from native YBN serialization.

### M1c: Native export and packaging
1. Implement a prop-specific Blender bridge adapter that emits a manifest/report; do not trust exit code alone.
2. Export YDR/YTD/YBN/YTYP only when the pinned native provider reports that specific output supported. YTYP writer and GTA collision serialization must be independently verified.
3. Emit `fxmanifest.lua` and stream assets with necessary supported metadata references; don't generate YMAP placement silently.
4. Validate artifact paths and SHA256, re-import outputs and compare bounding boxes, material references and collisions where possible.
5. Build into a unique staging directory on the same filesystem as the final destination, then commit through M0 export transaction.

### M1d: UI integration and runtime QA
1. Add optional `Prop Creator` controls to the existing Asset Workshop, hidden unless the prop creator is flagged on and the required capabilities are ready.
2. Show an existing-style progress/status report and explicit unsupported-format diagnostics; expose cancellation, staged preview and export.
3. Test real FiveM props on a dedicated test server: spawn, collision, lod switching, resource restart/cleanup and transparency.
4. Keep prop flag off in production until the native round-trip and in-game test matrix passes.

## Explicit M0 hardening tasks before any creator export is enabled

- The queue is cooperative; the native adapter **must** pass AbortSignal to the spawned child and ensure the process tree stops and staging is cleaned up.
- Treat destination path as an approved user-selected output token, and guarantee unique reservation/exclusive commit; do not rely on a pre-rename existence check alone against concurrent writers.
- Extend artifact validation to refuse Windows reserved device names, trailing spaces/dots, file-system case collisions and unsafe reparse/symlink paths at every ancestor.
- Ensure same-volume staging and destination, and clarify reporting of EXDEV/permission failures without claiming a successful export.
- Define retention limits for job history, logs, staging and input bytes; M0's internal job map currently retains completed jobs until manager disposal.
- Explicitly fail closed for unsupported native formats and incomplete provider dependencies.

## Tests and release gates

- Unit: geometry units/orientation; finite bounds; collision and LOD parameters; invalid input; archetype reference validation.
- Security: IPC trust, path token scope, malformed paths, symlink and Windows device names, timeout and cancellation, concurrent export collision.
- Native: real Blender fixtures and supported native round-trip (YDR/YTD/YBN/YTYP).
- Regression: current YFT/YDD/YDR viewer, native ped rig, debadge, YMT, weapon studio, Photo Booth and File Manager; `npm test` and `npm run build:ui`.
- Windows: packaged portable and NSIS startup/smoke; ensure optional creator dependencies do not break offline launch.
- FiveM: test prop spawn, visibility, collision, material, LOD, removal after stopping resource and metadata loading.
- Exit criteria: no UI changes with the feature disabled, all existing suites green, validated native output, at least one accepted multi-material prop and one collision fixture in FiveM. No automatic merge.

## Suggested PR implementation sequence

PR1 schema/capabilities/fixtures; PR2 preview + collision modeling; PR3 native serializers + transactional export; PR4 optional UI mounting; PR5 Windows and FiveM acceptance. Commit to `feature/phase3-creators` (or short-lived branches targeting it), not directly to main.
