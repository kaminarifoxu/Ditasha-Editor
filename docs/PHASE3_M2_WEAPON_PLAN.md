# DITASHA Editor Phase 3 — M2: Advanced Weapon Builder

**Scope:** Reuse the existing Weapon Studio / AddonWeaponsBuilder and evolve it into a validated FiveM weapon creator, without changing the accepted Prop & Collision Creator baseline.

**Status:** M2a and M2b implemented. M2c GTA Legacy **verified-source** native pipeline is implemented behind a separate Weapon Studio panel; actual Windows Blender/Sollumz and FiveM runtime results are not yet certified.

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

## M2c — verified-source native export implementation

1. Weapon Studio contains a separate **Native GTA / FiveM weapon build (M2c)** panel. It requires a GTA Legacy **flat source directory** containing a matched `w_pi_pistol.ydr` / `w_pi_pistol.ytd` pair (or another explicitly allowlisted donor). It will **not** turn a raw GLB or unrigged sketch into a functioning weapon.
2. The existing managed Blender 5.2/Sollumz 2.9 native importer reads the pair, verifies geometry, textures, bone hierarchy and non-overlapping muzzle/grip/magazine named anchor positions, exports a **disposable** native YDR/YTD pair, reimports it, and compares bone count and anchor position drift (maximum 2 mm). The original YDR/YTD remains unchanged.
3. The existing verified AddonWeaponsBuilder 2.0 CLI builds a GTA V Legacy weapon DLC from the prepared donor. DITASHA re-verifies the installed CLI's SHA-256 hashes and uses `awbctl verify` for RPF7 archives before allowing a successful result.
4. Safe export uses scoped OS directory grants, 20-minute grant lifetime, bounded worker queue, cancellation, sibling staging, artifact SHA-256 validation, exclusive reservation, and no-overwrite commit. Failed or interrupted jobs remove their staging.
5. **Conditional FiveM output:** if AddonWeaponsBuilder also generates a complete, non-ambiguous loose set of `weapons.meta`, `weaponarchetypes.meta`, `weaponanimations.meta` and matching Legacy YDR/YTD, DITASHA can assemble a `FiveM-resource/` folder. An RPF-only DLC **is not a FiveM resource**; the UI reports it as GTA DLC only. No generated package is labeled game-tested.
6. New regression tests validate native report schema, bone/anchor parity, directory grants, strict request rules, unsafe output rejection, staged AWB simulations, conditional FiveM packaging and cancellation/failure cleanup.

**Honest scope:** Native weapon geometry creation from arbitrary GLB, source model re-rigging, automatic native bone placement, GTA animation editing, and conversion of packed RPF archives into FiveM loose resources remain outside this implementation. Prepared donor models are required. A successful native round-trip is not equivalent to successful GTA/FiveM runtime operation. Real Blender/AWB and in-game tests are still required.

## M2d — packaging and release gates

- `npm ci`, `npm test`, `npm run build:ui`, dedicated Windows Electron smoke.
- Real managed Blender/Sollumz and AddonWeaponsBuilder integration tests.
- Portable Windows EXE build and launch, then actual FiveM runtime verification.
- No claims of a fully functional FiveM weapon until those gates pass.
- Do not merge to `main` without explicit approval.
