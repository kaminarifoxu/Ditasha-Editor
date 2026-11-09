# Phase 3 — Ped Workshop Native Auto-Rigging and Verification

**Branch:** `feature/phase3-creators` · **Status:** Native validation implemented; real freemode end-to-end sample validation still needed.

## Existing native pipeline retained

The existing **Rig ped** workspace already uses managed **Blender 5.2.2, Muto Ped Rig, and Sollumz**. It accepts humanoid GLB/OBJ/FBX, fits GTA freemode-style armatures, generates skin weights, and attempts export of a full FiveM add-on ped resource. The export should include native YDD (drawable dictionary), YFT (fragment/skeleton), YTD (texture dictionary), YMT metadata and `fxmanifest.lua`.

This update does **not** replace that rigging algorithm or manufacture a new skeleton simply by relabeling vertex indices.

## New native verification gates

After Muto exports the ped and after the correction .blend and the separate pose previews are saved:

1. Reject rigged Blender meshes with missing/invalid weights, more than 4 bone influences, weights outside normalization tolerance, or absent/ambiguous armatures.
2. Read each native YDD/YFT/YTD from the staged resource and require authentic GTA V Legacy `RSC7` signatures, correct version, bounded sizes and SHA-256 manifests.
3. Clear the original Blender source scene and **reimport each generated YDD independently** using the managed Sollumz native importer. Enable auto-discovery of its matching external native skeleton YFT when available.
4. Examine the actual imported mesh's UV maps, normalized vertex weights, presence of a compatible skeleton and `SKEL_Head`. Imported vertices cannot borrow the original source-scene armature.
5. Where imported meshes have recognizable `head` and `hair` names, inspect their world-space bounding-box centers and fail if their centers differ by more than 0.65 m. If these components are not recognizable, label their alignment **unchecked**, not successful.
6. Before permitting **Save result ped**, independently verify the native manifest hashes and that every native YTD can be indexed by the existing DITASHA YTD reader with at least one readable texture entry.

**Failure means the staged result cannot be approved as a successful native export.** The source and donor files remain unchanged; the .blend correction project may remain available.

## Known limitations

- Sollumz native YDD reimport is a genuine file-format check. It is **not** proof that native ped YFT ragdoll/collision physics are valid: Sollumz's older documentation explicitly marks ped YFT physics as unsupported. This update verifies native YFT signatures but does not claim a YFT physics round-trip.
- A source-matched, actual original GTA freemode YFT and bone mappings are still essential to verify hair movement, head alignment and proper emote animation. Muto's freemode template does not automatically prove compatibility with any arbitrary donor YFT or character.
- Hair and head meshes with nonstandard names are reported as alignment unverified. Native UV maps may be present while the atlas or UV island orientation is visually wrong. Visual calibration and real FiveM gameplay checks remain essential.
- The existing Character Maker head/hair UV controls affect its preview and saved presets only. They do not rewrite native YDD/YTD UV coordinates.
- Real user sample conversion, facial rig weights, emotes/T-poses, hair collision and fiveM spawn/reload tests **are not yet confirmed** by unit tests or Windows packaging checks.

## Tests and protection

- `tests/ped-native-verify.test.cjs`: Python syntax, RSC7 file inventory and strict weighted-skin audit.
- `tests/ped-native-report.test.cjs`: native report schema, SHA-256 checks and YTD texture-index gate.
- `tests/native-build.test.cjs`: staged ped workflow and validation-aware save regression.
- Existing Ped Workshop and Character Maker tests plus full `npm test`, UI build and Windows Actions tests.

**Frozen scope:** This work modifies only native ped workflow, native verification, Ped Workshop reporting, and their tests/docs. It does not change approved Prop & Collision Creator or Weapon Studio code/UI, nor merge `main`.
