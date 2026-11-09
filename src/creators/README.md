# Prop & Collision Creator — DITASHA Editor

**Status: User-approved baseline / maintenance freeze — 2026-11-04**

This README records the current Phase 3 **Prop & Collision Creator** as the accepted reference implementation on `feature/phase3-creators`.

> **Change control:** Do not modify, redesign, refactor, replace, or reorganize the Prop & Collision Creator **code or UI** unless the project owner explicitly requests that change. Do not silently alter this tool while working on unrelated DITASHA Editor features. Do not merge this branch into `main` without explicit authorization. This is a project working agreement, not an automated GitHub branch protection rule.

## Purpose

Create FiveM/GTA V Legacy prop resources from supported 3D sources in a dedicated workspace, using DITASHA's managed Blender/Sollumz native pipeline, while keeping **Texture & Model** independent.

## Existing experience (preserve)

1. Open **Asset workshop → Prop & Collision Creator** in the sidebar.
2. Import or drag and drop a `.glb`, `.obj`, or `.fbx` file.
3. View the model in the dedicated Three.js 3D viewport. Frame and reset the camera as needed.
4. Inspect the bounds, pivot coordinates, collision guide (`none`, `box`, or `convex`) and LOD-distance guides.
5. Resize the model with X/Y/Z scale values, optionally locked to uniform scaling, and reset to 1×.
6. Under **FiveM export**, check the managed engine, select the source file and destination folder, supply a resource name and draw distance, then click **Export to FiveM**. Native jobs can be cancelled.

Preview bounds, pivot and LOD guides are **inspection aids** and are not themselves proof that native collision, pivot placement, or full native LOD generation works.

## Current implementation

| Area | Primary files |
| --- | --- |
| Workspace and preview | `src/creators/prop-workspace.js`, `src/creators/prop-preview.js`, `src/creators/prop-entry.js` |
| Isolated workspace styling | `ui/prop-creator.css` |
| Trusted IPC and file grants | `electron/creators/creator-ipc.cjs`, `electron/creators/asset-tokens.cjs` |
| Request validation and safe packaging | `electron/creators/prop-schema.cjs`, `electron/creators/prop-build.cjs`, `electron/creators/export-validation.cjs` |
| Blender/Sollumz export | `electron/creators/prop-native.py`, `electron/creators/prop-provider.cjs` |
| Material and DDS processing | `electron/creators/prop_material.py`, `electron/creators/prop_dds.py` |
| Native YTD compatibility check | `electron/creators/ytd-compat.cjs` |
| Regression tests | `tests/prop-*.test.cjs`, `tests/prop-*.test.mjs` |

## Intended native resource output

```text
<resource-name>-ditasha-<unique-id>/
  fxmanifest.lua
  native-report.json
  validation.json
  stream/
    <resource-name>.ydr
    <resource-name>.ytd
    <resource-name>.ytyp
    <resource-name>_col.ybn   # omitted when collision is "none"
```

The native worker checks its outputs and attempts round-trip reimport. Export is isolated in a temporary staging directory and must not overwrite the original source or an existing output directory.

**Limitations:** A successful local export does **not** prove that the model renders, has perfect materials, or collides as expected in FiveM. Complex glTF materials, alpha, normals, metallic/roughness, multiple UV channels and actual FiveM runtime compatibility require separate verification. The material color preservation work is recorded in [PHASE3_GLB_MATERIAL_RESEARCH.md](../../docs/PHASE3_GLB_MATERIAL_RESEARCH.md).

## Stable-baseline policy

- **Preserve the current appearance, layout, controls, labels, navigation and behavior.**
- **Preserve existing source code** unless a specific change is explicitly requested by the owner.
- For any approved future change, work on `feature/phase3-creators` or another explicitly approved feature branch. Do not merge into `main` by default.
- Document what changed, why it changed, and how it was verified.
- Run available regression tests and Windows EXE checks after any owner-approved change.
- Do not treat an unrequested dependency upgrade, cleanup or refactor as permission to modify this creator.

## Additional notes

- Earlier milestone implementation: [PHASE3_M1C_STATUS.md](../../docs/PHASE3_M1C_STATUS.md). Some historical statements in that milestone document describe earlier experimental stages rather than today's accepted UI.
- Material investigation and remaining limitations: [PHASE3_GLB_MATERIAL_RESEARCH.md](../../docs/PHASE3_GLB_MATERIAL_RESEARCH.md).
- This commit **adds documentation only**. It does not change executable code, interface files, or the native conversion pipeline.
