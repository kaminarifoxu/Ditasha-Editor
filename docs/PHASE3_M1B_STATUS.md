# Phase 3 M1b — Trusted grants, native inspection and Prop preview

Status: **experimental preview complete at source level; native GTA exporter unavailable**.

## Architecture

- `electron/creators/asset-tokens.cjs`: short-lived UUID grants generated only for a user-selected file/directory. Tokens encode no real paths. Input selection is limited to GLB/OBJ/FBX and bounded file size; output grants permit existing directories only. Grants are scoped by type, rechecked against the resolved canonical path and inode, expired/revocable and limited in count. During Windows filesystem testing, verify inode consistency on actual NTFS before permitting export.
- `electron/creators/creator-ipc.cjs`: trusted IPC `ditasha:prop-pick` and `ditasha:prop-revoke`; invokes native selection dialogs. Both fail closed if the prop creator is not available. The backend still exposes read-only `ditasha:creators-state`; the preload exports token-only methods, never raw paths.
- `electron/creators/prop-probe.py` and `prop-provider.cjs`: use the native managed Blender installation, run a bundled read-only probe with script auto-execution disabled, report observed importer/add-on availability, and **always** mark drawable/collision/archetype export writers unavailable until actual supported output round trips are validated. Installing Blender/Sollumz alone does not prove compatibility.
- `src/creators/prop-preview.js`: adds scene overlay guides using the existing Three.js model and scene. Shows world-space bounds, pivot axes, box or sampled convex hull preview and LOD threshold circles. Authored collision remains marked unsupported for preview. These are *visual guides* and do not produce a YBN.
- `src/app.js`: opt-in mount inside the existing editor's inspector, no extra WebGL renderer and no rearrangement of existing controls. The preview is hidden by default. Developer opt-in: set `DITASHA_EXPERIMENTAL_PROP_PREVIEW=1` **before launch**, which reveals preview guide controls only. The backend still refuses file picker and native export while no verified writer exists.

## Scope and limitations

The app **does not yet** import GLB/OBJ/FBX through a new Prop Creator workflow; model inspection reuses the existing viewer's loaded Three.js model. The new frontend guides do not modify source geometry or write GTA assets. No claim is made that authored collisions, LOD generation, YDR/YBN/YTYP serializing, or in-game resource testing is complete.

The token issue/revoke IPC deliberately remains locked until a verified provider is enabled; the internal token-store functions can be tested independently. Provider probing can be invoked by the future trusted worker; it is **not** currently a user-facing download/install operation.

## Regression and verification

- `tests/prop-m1b.test.cjs`: token scope, expiry, replacement, provider report format and mocked installed Blender manifest. Mocked binary is for security/logic verification, not real Blender capability certification.
- `tests/prop-preview.test.mjs`: finite bounds, collision preview, LOD guides, disposal, unchanged underlying model and invalid parameters.
- Existing `tests/creators-foundation.test.cjs` asserts trusted picker IPC fails closed when disabled.
- Existing `npm test` and `npm run build:ui` must pass. Packaged Windows EXE smoke and real FiveM fixtures remain outstanding.

## Next (M1c)

Validate provider versions and actually export synthetic GLB/OBJ/FBX to YDR and suitable collisions to YBN and archetypes to YTYP. Require round-trip reimport, metadata consistency, temporary staged output and game tests before changing native writer capability flags. Only then unlock selected file permissions and native exports. Do not merge into `main` until validation.
