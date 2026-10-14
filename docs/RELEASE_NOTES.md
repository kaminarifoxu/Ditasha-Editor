DITASHA Editor 1.17.0 — Workspace redesign and Discord Activity

- Replace horizontal navigation with a dedicated left workspace rail, collapsing to accessible icons on smaller desktop windows. Keep Vehicle workshop immediately after GTA V Explorer; move Rig ped, GPU controls and Settings into the rail.
- Restyle the editor, file/layer panels, converter, clothing builder, viewers, Explorer, vehicle studio, native build dialogs, photoshoot, update/unsaved dialogs and loading screen with a consistent visual system.
- Add persistent Midnight/Light themes and Comfortable/Compact density settings. Preserve document controls, file exports and 3D tools; fix legacy small-window rules that displaced panels and actions.
- Add local Discord Rich Presence over desktop IPC: startup connection, active-workspace updates, session timestamp, reconnect, ping/pong, bounded frames, throttling and clearing on disable/exit. File names, paths, Discord tokens and account data are not published by this integration.
- Add Settings for Application ID, Activity toggle, workspace visibility, connection status and setup instructions. No Discord application ID is bundled yet; create a DITASHA Editor application in Discord Developer Portal and enter its public ID once. A publisher can set package.json discordApplicationId for future builds.
- Verify workspace/theme/preferences, existing editor/viewer/native preview workflows, and Discord framing/settings/lifecycle with simulated peers. Windows CI also exercises real local named-pipe transport. A live Discord profile cannot be verified until an Application ID is configured.

DITASHA Editor 1.16.1 — Extra drawable texture matching

- Resolve source YTD names correctly for extra/livery drawable labels that include a drawable suffix. Cover duplicate-name collisions in both base and extra models.
- Includes the native 3D preview and material improvements below.

DITASHA Editor 1.16.0 — Texture binding and native 3D placement

- Scope embedded textures to their own drawable and prefer the matching source YTD when external dictionaries contain duplicate names. Expose the resolved binding and per-mesh UV/alpha/U/V-flip controls; keep known vehicle paint/body shaders opaque instead of treating paint masks as transparency.
- Add actual Blender-imported 3D geometry to Debadge analysis. Click a badge to select its native object candidate, highlight only badge material faces, and compare a preview with the selected badges hidden.
- Add native donor-lamp previews for Strobo. Place the actual rigid siren parts on a clicked target surface or drag their translation gizmo; synchronize GTA X/Y/Z offsets and scale with the native build request. Keep the gizmo at the donor lamp center while preserving engine coordinates.
- Bound preview geometry to 250,000 triangles, 32 texture thumbnails at 512px, and 48 MB. Read preview output through opaque, trusted IPC tokens. Preserve the source models and image pixels.
- Verify texture/dictionary collisions, shader metadata, real 3D candidate picking and donor placement, build payload offsets, and Blender geometry/thumbnail/transform agreement. Existing native engine requirements and donor restrictions still apply; user assets and in-game native output have not been verified end-to-end.

DITASHA Editor 1.15.1 — Dedicated vehicle workspace

- Add Vehicle workshop immediately after GTA V Explorer, with a larger shared vehicle preview and its own mesh/transform, badge masking, lightbar preview and export controls.
- Move vehicle editing controls out of the general Model viewer. Keep loaded models, textures and edits when switching workspaces, including after vehicle imports.
- Add direct Debadge native and Strobo donor shortcuts inside the vehicle workspace; retain Rig ped in the application header.
- Verify navigation order, workspace isolation, model persistence, native-operation shortcuts and existing offline workflows. Native engine requirements and export limitations from 1.15.0 still apply.

DITASHA Editor 1.15.0 — Native engine bridge

- Add Game build with a separately installed Blender/Sollumz/Muto engine: dependency probe, file pickers, background jobs, progress logs, cancellation, timeout and isolated output folders.
- Route humanoid GLB/FBX/OBJ through Muto's marker → skeleton → weights → GTA rest → validation → addon-resource pipeline. Current templates require Blender 5.x; 5.2 is recommended.
- Analyze badge/emblem candidates and remove selected material faces across LOD meshes with shared-data isolation before Sollumz native export.
- Transfer compatible rigid siren parts/bones from a donor YFT and create linked carcols/carvariations/vehicles metadata and a patch manifest. Reject skinned/missing-texture donors and bone/tag conflicts.
- Test metadata, job validation and candidate-selection UI; verify rigging (128 bones, four-weight maximum) and selective badge/siren geometry operations using real Blender.

Requirements/limits: Blender and the GPL add-ons are installed separately; native binary output requires Sollumz's Windows provider. Native binary export and in-game behavior have not yet been verified end-to-end on user assets. Siren donor transfer supports a constrained rigid/embedded-texture workflow, not every vehicle. Read docs/NATIVE_BUILD.md before use.

DITASHA Editor 1.14.0 — Offline studio

- Add Livery studio with six manual slots, stripe/checker/chevron/text, transparent PNG import, drag/numeric transforms, manual UV rectangles, an editable 2D/3D texture layer, PNG ZIP exports and JSON projects.
- Add Vehicle workshop with mesh picking/transforms, badge-name candidates, static lightbar preview, visible-scene GLB exports and vehicle project JSON.
- Export visually masked native YFT/YDD/YDR by collapsing selected mesh indices, preserving resource layout/bones/physics and refusing partial shared buffers. Original files are not overwritten. Check each drawable/LOD explicitly and test in game.
- Add GPU quality profiles and renderer diagnostics, bounded preview resolution, on-demand rendering, context-loss notification, and queued resource workers with timeouts for model/YTD decoding and native masking.
- Test native resource preservation and YFT round trips, worker YTD export hydration, UV bounds, preview pixel budgets, and the actual offline studio workflow alongside existing viewer/updater checks.

Limits: UV slots are mapped manually. Added parts, mesh transforms and lightbars are exported to GLB/project only; no new YFT siren bones, carcols or game-ready modkit are generated. AI generation is deferred. See docs/OFFLINE_STUDIO.md for the full workflow and limits.

DITASHA Editor 1.13.1

- Hide the previously baked layer from the temporary 3D material while moving/resizing/rotating the tattoo. This prevents doubled opaque tattoo previews; preserve the saved 2D layer until synchronization or restore it on cancellation.
- Project onto the mesh clicked by the user, use interpolated surface normals, alpha-weighted bilinear PNG sampling and UV-edge texel padding. Disable mipmaps on the editing texture to reduce atlas-edge bleeding; enable supported anisotropic filtering.
- Compact the tattoo panel with separate action rows, an ellipsized file list, exact numeric size/rotation/opacity controls and collapsible instructions.
- Test transparent-edge sampling, UV gutters, a curved neck UV wrap seam and low-opacity preview regression alongside the Windows viewer/update tests.

DITASHA Editor 1.13.0

- Automatically project placed PNG/tattoo into a real UV layer. Move it by dragging the selected tattoo or clicking Pindahkan tattoo and a new surface point. Update the same layer after movement, size, rotation or opacity changes; removal deletes its active texture layer, with Undo/Redo support.
- Add Edit 2D/Edit 3D layouts. The 3D layout gives the model more space and retains a live 2D canvas. Texture selection is required for automatic projection; annotations retain their original target texture.
- Support legacy BC7 YTD textures (FourCC 20374342) and BC7 FourCC DDS with bounded decoding and RGBA export. Raise per-import model selection to 64 files within existing drawable/vertex budgets.

DITASHA Editor 1.12.0

- Apply PNG placed on the 3D surface to a real texture layer through UV projection, including separated UV islands. Resize, rotate and adjust opacity before applying; Undo/Redo and YTD export use the resulting texture.
- Transform rigid model parts by their hierarchical skeleton binding, correcting bone-local positions in vehicle wheels/mirrors. Static preview still does not emulate all GTA shaders or animated skinning.
- Keep Photoshoot rendering when the reusable dialog is closed and reopened before a delayed close event is delivered.
- Add seam/orientation/back-face projection tests, skeleton hierarchy validation, and browser/Windows checks for baking and undo/redo.

DITASHA Editor 1.11.0

- Decode vehicle YTD A8 (0x1c), L8, A8L8 and XRGB formats with row-stride and buffer validation.
- Add multiple model imports and independent extra/livery YFT visibility/removal. Keep variants hidden until selected. Expose individual mesh controls within each Part.
- Retain secondary diffuse sampler references and UV2, and add per-mesh texture/UV assignment for static material preview. Inspect YFT physics child drawables separately with inherited shader bindings.
- Add PNG 3D surface stickers to Texture & Model with click placement, size, rotation, opacity and removal. Include decals in snapshots and Photoshoot without modifying the 2D texture. Decals are preview-only and are not baked into YTD.
- Validate synthetic vehicle resources and native renderer workflows, actual decal pixels, Photoshoot inclusion, invalid-file retention and portable update/restart. Specific user vehicle packs still require their original YFT/YTD files for verification; full GTA paint/glass/damage rendering and automatic bone attachment are not included.

Copyright © 2026 Ditasha-Workshop. Uicons by Flaticon.
