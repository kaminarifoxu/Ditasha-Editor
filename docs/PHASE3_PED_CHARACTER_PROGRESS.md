# Phase 3 — Ped Workshop / Freemode Character Maker

**Scope:** Ped Workshop and Character Maker only. Work lives on `feature/phase3-creators`. Do not merge to `main` without owner approval.

## Implemented in this update

- A non-destructive inspection of imported freemode male/female packs for their matching **source YFT skeleton**, YDD body parts, hair mesh and matching YTD dictionaries. It never invents native bone IDs when the source rig is absent.
- Automatic same-pack inclusion of **head, hair, torso, hands, lower body and feet** where available, with the corresponding YTD files and matching freemode YFT when sending a character to Photo Booth.
- A clearly labeled **preview-only rigid hair→SKEL_Head fallback** in the existing auto-rig selector when `allowApproximate=true`, without mutating YDD skin weights or pretending it is native hair physics.
- Character Maker **Check matching skeleton & head/hair UV** diagnostics: head/hair geometry is decoded and inspected for UV completeness, non-finite coordinates, compatible YTD presence, and a source YFT.
- **Head/hair UV atlas offset and scale** controls in Character Maker. Applied *only* to that model's optional 3D preview, without rewriting YDD/YTD files or changing other preview modules by default.
- Skeleton policy `auto` / `strict`. Strict mode blocks Photo Booth handoff without a matching source YFT. Character saves remain possible so drafts are not lost.
- All these settings are stored in the existing `characters.json` preset database; legacy character presets lacking the new field load with defaults. Existing clothing and morph presets remain intact.

## Not implemented / not proven

- Real automatic conversion of arbitrary GLB/YDD geometry into **fully skinned native GTA freemode YDD/YFT** is **not** provided by this implementation. That requires a native rigging worker, verified bone palette mapping, vertex weights and a real source GTA freemode YFT.
- Rigid hair fallback is **not** facial animation, physics, or full correct weighting. Check the head position/shape on the desired freemode skeleton.
- Texture atlas calibration changes **preview UV sampling** and saved authoring preferences, not imported source files, FiveM game textures, or a native texture export.
- Model shape head blend remains the existing offline approximation; accurate GTA native head blend must be tested in FiveM.
- Actual ped emotes, animation accuracy, YDD native roundtrips and FiveM gameplay are not certified by unit tests.

## Verification

`tests/freemode-rig-audit.test.mjs` covers same-pack YFT selection, hair pairing, UV checks, safety, strict settings and the preview-only hair fallback. `tests/character-presets.test.cjs` covers settings persisted through a store reload and malformed settings rejection.

Do not modify the accepted Prop & Collision Creator code or UI, or Weapon Studio as a side effect. All legacy default preview behavior remains unchanged unless Character Maker explicitly passes a head/hair UV calibration.
