# DITASHA Editor Phase 3 — M2: Advanced Weapon Builder

**Scope:** Reuse the existing Weapon Studio / AddonWeaponsBuilder and evolve it into a validated FiveM weapon creator, without changing the accepted Prop & Collision Creator baseline.

**Status:** M2a readiness audit and M2b non-destructive skeleton/attachment guide editor implemented. Native GTA weapon export not yet implemented or verified.

## Frozen baseline

The user approved the Prop & Collision Creator on 2026-11-04 and explicitly requested no changes to its code or UI without further permission. Its README is `src/creators/README.md`. Do **not** modify `src/creators/prop-*`, `electron/creators/prop-*`, `ui/prop-creator.css`, `electron/creators/ytd-compat.cjs`, or its workspace route as an incidental part of M2.

Use `feature/phase3-creators` until a different branch is requested. Do not merge to `main` unless requested.

## Existing code to reuse

- `src/weapon-studio.js`: Three.js scene, TransformControls, GLB/OBJ/YDR/YTD local imports, original generic reference sketches, UV and material editing, GLB export.
- `src/gta-tools-ui.js` and `electron/gta-tools.cjs`: existing AddonWeaponsBuilder integration for **already prepared GTA-compatible** assets and DLC metadata. Do not claim it can turn a raw GLB directly into a functioning GTA firearm.
- `electron/native-build.cjs`, native setup and Blender/Sollumz: managed local toolchain. Reuse supervised and safe execution rather than starting unapproved arbitrary executables.
- `electron/creators/job-manager.cjs`, `export-validation.cjs`: bounded queues, cancellation, staging and no-overwrite output validation.

## M2a — implemented

- `src/creators/weapon-readiness.js`: read-only inspection of weapon meshes, vertex finiteness, UVs, textures, skeleton presence, bounds and reference hints.
- Weapon Studio shows a collapsible **FiveM weapon readiness (M2a)** panel. It **does not modify existing part geometry, materials, texture editing, GLB export or DLC generation**.
- `tests/weapon-readiness.test.mjs`: empty assembly, generic sketch, invalid vertices and reference table regression coverage.

The report deliberately says `design-preview-only` for a valid Three.js design. Skeleton, muzzle position, grip alignment, animation and GTA native metadata are **not** certified by the presence of a visual preview.

## M2b — implemented foundation: skeleton and attachment guides

1. Reuses local Weapon Studio imports and examines available Three.js bone and named-part hierarchies. **Native GTA bone IDs are not currently decoded or verified.**
2. Offers a collapsible weapon-only inspector for muzzle, grip, magazine, slide, optic, flashlight and suppressor guides, with 3D preview markers and safe numerical position/rotation controls.
3. Detects duplicate node names, missing skeletons, nonuniform transforms and attachment candidates. Invalid or empty sources produce diagnostics rather than an invented skeleton.
4. Saves/loads versioned `.weapon-guides.json` authoring projects with strict validation, bounded sizes, and no source overwrites. These JSON files are **not** native GTA attachments.
5. Tests cover hierarchy detection, schema rejection, non-destructive helper overlays and GTA reference continuity.

**Remaining M2b+ work:** native weapon YDR/YFT skeleton/bone ID extraction, real attachment alignment for a matched GTA reference weapon, explicit project-to-native bindings, and verified FiveM behavior. This M2b implementation does not certify animations or produce a weapon resource.

## M2c — planned: verified native export

1. Derive a **tested native weapon exporter** supported by the managed Blender/Sollumz toolchain, or explicitly require a working source GTA weapon skeleton; do not blindly reuse prop YDR conversion as a weapon builder.
2. Verify native model parts, YTD texture names, skeleton/bones and weapon reference IDs.
3. Generate and validate the necessary FiveM resource/weapon metadata from an allowlisted supported template; do not invent unsupported weapon archetypes.
4. Round-trip native files through a real provider. Validate checksums, bounds, component names and templates. Preserve source files.
5. Test in a disposable Windows / FiveM staging environment, including animations, grip, muzzle flash, projectiles, attachments and switching weapons.

## M2d — packaging and release gates

- `npm ci`, `npm test`, `npm run build:ui`, dedicated Windows Electron smoke.
- Real managed Blender/Sollumz and AddonWeaponsBuilder integration tests.
- Portable Windows EXE build and launch, then actual FiveM runtime verification.
- No claims of a fully functional FiveM weapon until those gates pass.
- Do not merge to `main` without explicit approval.
