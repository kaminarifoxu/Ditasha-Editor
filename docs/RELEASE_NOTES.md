# v1.34.0 preview — Preserve vehicle glass alpha and dictionary ownership

Vehicle bucket-1 glass, badges, decals, dashboard/emissive and related verified presets now retain continuous alpha when passing through the shared ped material controls in Vehicle Workshop / Model Viewer and Texture & Model. Previously these controls reset such materials to cutout, making partially transparent windows opaque. Transparent File Manager and Debadge surfaces no longer write depth and use the vehicle alpha cutoff. Opaque vehicle paint remains opaque; ped cutout defaults and explicit material overrides remain available. Photoshoot clones preserve the material defaults.

The supplied GT3RS glass_clear map decodes as 64×64 with alpha 115/255 at every pixel. Its texture was available: the opaque appearance was caused by preview material settings. Removing four shared YTD entries in the user's OpenIV screenshot leaves the model visually textured with only gt3rs.ytd listed; those four entries are not established as necessary to reproduce this particular screenshot. No claim is made about OpenIV cache behavior.

Loading multiple YTDs, adding another YTD manually, dropping it into Vehicle Workshop, and automatic repair now retain identically named maps from different dictionaries. Only the same dictionary/name pair is refreshed. Previously global name-only replacement deleted the vehicle-owned map when a later shared dictionary contained the same name. Decoded-memory accounting retains unrelated dictionaries rather than pretending their maps were released. Existing source ownership/native-hash matching selects the model's own map.

Validation adds a shared-YTD name collision with model-owned pixels preserved, same-dictionary refresh, and vehicle alpha defaults surviving Photoshoot cloning. Windows GPU/UI checks compare alpha-115 glass against an explicit opaque override, verify the editor's blend default, and preserve green base / blue livery pixels after loading a conflicting shared map. The six original base YFT/YTD pairs were audited again with unchanged hashes and missing-reference lists.

Limits: this fixes two app defects. It does not recreate genuinely absent image data, generate blank Aventador livery pixels, or reproduce the entire GTA/OpenIV material, lighting and reflection pipeline. The missing dependencies documented in docs/VEHICLE_TEXTURE_AUDIT.md still require their original images or a deliberate manual material binding. Source YFT/YTD files are not modified.

# v1.33.0 preview — Audited vehicle layers and reusable shared texture sources

The supplied Sanchezpol, Polaleutian, Aventador, GT3RS, GMCEVP and SS2RB pairs were audited locally. All 441 YTD textures decoded without entry warnings, including GT3RS's 653 MB decoded dictionary. Available high variants parsed too. Source files were not rewritten or bundled. The full list of missing references and how to repeat the audit is in docs/VEHICLE_TEXTURE_AUDIT.md.

Polaleutian uses vehicle_paint4 with polaleutian_sign_1 in DiffuseSampler2 on UV2. Four complete-vehicle meshes reference that layer; the previous paint3-only allowlist ignored it. The shared static layer implementation now supports paint4, paint4_enveff, paint4_emissive, paint5_enveff, paint6/enveff and paint7/enveff, whose declared primary/secondary UVs match the existing implementation. It is shared by Model/Vehicle Viewer, Texture & Model, Debadge, File Manager and Photoshoot. Paint8/9 layouts are not guessed; full game lighting, worn/snow/emissive simulation and GLB baking remain outside this layer preview. License-plate materials resolve PlateBgSampler for their static background, without pretending to generate registration characters.

Auto texture repair adds **Tambah shared YTD**. Selected YTD files augment the current session's metadata search library and are available to subsequent vehicles. Only matching required maps are decoded into each model's existing 1 GB budget. Model-owned matches are preserved, a selected vehshare.ytd is preferred for known shared GTA references when appropriate, and ambiguous candidates remain reported. No arbitrary filesystem scan or online texture download occurs; YTDs inside RPF must be extracted first. Library limits and session lifetime remain as in v1.31/v1.32.

The preview separates absent shared GTA/parent maps, absent asset/parent maps and runtime screen references in **Sumber tekstur yang dibutuhkan**. It also reports a fully transparent layer: the supplied Aventador's avent_sign_1 is 152×152 with every alpha zero, so it cannot display livery pixels. Actual missing tyres, decals, light and interior maps still require their real shared or asset dictionary. Placeholder data is not presented as recovered textures.

Copied high filenames such as ss2rb_hi(1).yft now belong to ss2rb(1).ytd while retaining separation from (2) copies. Regression coverage adds supported layer-family resolution, license-plate sampler selection, transparent-layer detection, dictionary-copy ownership and shared library merging/precedence. Windows GPU/UI coverage adds a paint4 livery with a genuinely absent shared base, repairing that base from a selected shared YTD, preserving both visible layers, and automatically reusing that source for another vehicle. Existing editor, vehicle, rig/native, creative and IDE checks continue to run.

# v1.32.0 preview — Larger YTD budgets, native dictionary keys and compact vehicle controls

The decoded texture budget increases from 512 MB to 1,024 MB, and compressed YTD input from 64 MB to 256 MB in the editor, Model/Vehicle Viewer, auto repair, converter and File Manager preview reader. Other resource/image input caps remain 64 MB; decoded resources retain dimension, pixel-buffer, version and memory validation. The YTD resource cap is 768 MB and native graphics write cap 512 MB. Converter/ZIP export caps are unchanged. Loaded-texture controls display external decoded memory use and limits.

Model/Vehicle Viewer first indexes YTD metadata. If an entire dictionary does not fit, it decodes only primary and recognized livery maps referenced by the supplied drawables/LODs, at their original resolution. An oversized set of required maps still reports a budget error. Extra textures are not silently resized. Adding textures accounts for existing external maps, including the memory released by replacements.

TextureDictionary's native lookup hash is now retained independently of a texture's display name, including embedded dictionaries. Material resolution and auto repair accept exact native dictionary keys as well as the existing normalized-name/name-hash matches and dictionary ownership rules. A renamed label no longer makes an otherwise matching native-key map inaccessible. Ambiguous sources remain manual choices.

Vehicle preview loading and auto repair now decode valid selected dictionary entries even when another entry has an unsupported format or corrupt pixel data. The failing entry is named in the warnings/report. Full YTD editing/export remains strict: it does not silently drop unreadable entries from a saved asset. This change handles specific read/relink failure modes, not missing source files or every GTA shader. Screenshot-only Sanchezpol / Aleutian cases cannot be verified without their YFT/YTD files. Previously supplied GS, Demon and SS2RB still have genuinely absent references, as documented in v1.31/v1.30; none of those source files are rewritten.

Vehicle / Model Viewer controls use a wider responsive sidebar. File actions and automatic repair appear first; extra models/fragments, visible parts and loaded textures use collapsible sections with bounded scroll areas. Extra rows keep their checkbox/name and small remove action together, with transform controls inside the same row card. Scene Studio starts collapsed below the primary vehicle controls. Existing control IDs, handlers, manual bindings, Photoshoot and native tools remain in place.

Validation adds native-key/display-name mismatch plus a corrupt unused entry, readable-map retention with original bytes preserved, auto-repair lookup through the native key, and full-resolution selective decoding from a 1,088 MB logical dictionary. Windows GPU coverage checks visible base/livery pixels for the partly broken keyed dictionary and checks sidebar organization and limit labels. Existing vehicle, ped/rig, file browsing, creative engines, embedded IDE and package checks continue to run.

# v1.31.0 preview — Automatic local texture repair

Model / Vehicle Viewer can search a user-selected folder, including subfolders, for missing primary diffuse and supported livery references. Choose **Auto texture repair → Pilih folder tekstur** once; the folder index is reused for subsequent models and LOD / drawable changes during the current app session. **Cari yang hilang** retries explicitly; **Hentikan** cancels between worker jobs. Re-select the folder after adding/changing its files. Removing a loaded texture disables automatic search so it stays removed.

YTD metadata is indexed in the resource worker without allocating RGBA pixels. Only matched texture names are decoded into the remaining 512 MB model texture budget. DDS / PNG / JPEG / WebP filenames are also indexed. Matching uses exact normalized names or native name hashes, preferring the model's own dictionary. Multiple matching dictionaries are listed for manual selection via **+ Textures**; approximate names, normal/specular maps and arbitrary other images are not substituted as diffuse maps. Loaded maps retain source paths in the report.

Search reads only files granted by the folder picker, does not modify source assets, and does not download game textures. Extract YTDs from RPF archives first. Limits: 1,000 candidate files / 2 GB compressed per folder selection, 64 MB per file, 100,000 indexed entries, existing 384 MB resource and 512 MB decoded pixel limits. Corrupt/unsupported/oversized files and failed decodes are reported. Cancellation does not attach a partial repair. The index is session-only; preview relinking does not rewrite an exported vehicle or pack missing dictionaries into game resources.

Supplied GS was inspected against its YTD: primary reference `Detail_Base` is absent from the supplied dictionary. Some shaders have only normal/specular references and no diffuse sampler; this search cannot reconstruct a material's missing diffuse reference or implement every GTA shader. The existing Demon / SS2RB missing names likewise require their actual source textures. A successful livery does not imply that every shared texture is available.

Validation covers metadata-only indexing, selective decode under the remaining memory budget, exact/hash matches, dictionary ownership, ambiguous names, corrupt files, cancellation, source preservation and folder limits. Windows UI/GPU regression adds folder repair with visible base/livery pixels, automatic reuse on another model, ambiguity reporting without binding, no retry loop and subsequent manual texture selection.

# v1.30.0 preview — Vehicle liveries on UV2 and empty native mesh placeholders

Vehicle paint3-family previews retain the primary diffuse on UV1 and resolve the livery sampler separately on UV2: DiffuseSampler2 for vehicle_paint3/vehicle_paint3_enveff and DiffuseSampler3 for vehicle_paint3_lvr. The livery is alpha-composited over the primary colour; its alpha does not turn opaque vehicle paint into transparent geometry. Unrecognized shaders are not guessed. Existing dictionary ownership/hash-name resolution, texture budgets, full-resolution pixels and manual material replacement remain in place.

The shared livery preview is used by Model/Vehicle Viewer, Texture & Model, direct Debadge, File Manager and Photoshoot clones. Viewer status reports loaded external texture counts and active livery mesh counts; material details identify the resolved livery and UV2 availability. Missing referenced liveries are reported alongside missing primary textures. Loaded texture rows identify their dictionary. This is a static preview of the verified paint3 family, not an implementation of all GTA paint, dirt, lighting or livery-variant systems. Custom shader layers are not baked into GLB material exports.

Native geometry records containing both zero vertices and zero indices are skipped as empty placeholders instead of rejecting an otherwise readable model. Nonempty/mismatched buffers, invalid indices, unsupported vertex layouts and existing geometry budgets retain their validation.

The supplied Demon material uses vehicle_paint3 with demon_sign_1 in DiffuseSampler2, which is present in demon.ytd. The supplied SS2RB has the same livery arrangement with tc_ss2_sign_1 plus an empty native geometry record that previously aborted parsing. Both original/base and high files were inspected locally without rewriting them. Some primary/shared texture names requested by Demon really are absent from its supplied YTD and remain reported; the preview does not manufacture missing source textures.

Regression coverage includes a native dual-sampler/two-UV fixture, dictionary ownership and shader allowlisting, cloning/removal of the livery shader, empty placeholders versus corrupt buffer pairs, and actual Windows GPU pixels before/after adding a YTD, transparent livery/base separation, manual override recovery, Texture & Model and Photoshoot. Existing editor/native/rig/creative/IDE and packaging checks continue to run.

References: https://github.com/Sollumz/wiki/blob/main/documentation/fragments.yft/vehicle-shaders.md and https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Shaders/BasicPS.hlsl. DITASHA's Three.js layer implementation is original; CodeWalker shader binaries are not bundled.

# v1.29.0 preview — Inspect source models before rigging

Auto Rig adds **Periksa & preview model sumber**. Blender imports GLB, FBX or OBJ without running Muto, fitting a skeleton, changing weights, saving a Blender project or exporting game resources. The report shows mesh/vertex/triangle counts, existing armatures, world-space dimensions interpreted through scene units, missing UVs, unreadable base-color images, unapplied local rotation/scale, mirrored transforms and near-zero-area triangles. Object/material names are available in expandable details. A/T-pose, anatomy and suitability for rigging still need visual review.

Source preview supports directly connected Principled base-color images, UV-map selection and base-color factors. Lazy Blender image buffers are read before classifying an image as missing; unrelated normal-map/image nodes are never chosen as diffuse textures. Complex material graphs are explicitly simplified, and untextured materials are listed separately from unreadable images. Preview budgets remain 250,000 triangles, 32 thumbnails at most 512px and 48 MB JSON; source resolution is unchanged.

Source previews never enable ped Save or pose tests. Selecting a new source invalidates previous preview/report tokens; a staged rig locks source replacement until saved/discarded. Source preview temporary files are removed on the next job. Completed previews lead the workspace; source settings remain accessible below them.

Validation includes real Blender 5.2.2 GLB/FBX/OBJ export/import/preview round trips without Sollumz/Muto, readable textures and UVs, transform/dimension diagnostics, missing-image/UV/mirror detection, source-byte preservation and absence of game/project exports. IPC tests cover source selection, stale tokens, temporary cleanup and refusing source-preview saves; renderer checks cover source reports, stage separation, source changes and the subsequent rig/review/save flow. Existing rig-pose/native/editor/creative/IDE checks remain in place.

See docs/PED_WORKFLOW.md and docs/NATIVE_BUILD.md.

# v1.28.0 preview — Guided ped rig review and deformation tests

Auto Rig exposes Muto's actual reference-body choices (Automatic/Male/Female), target height (0 or 0.5–3 m), finger/face detail, hand/face templates and head-attached parts. All choices retain the GTA humanoid skeleton; female reference weights are not a different arbitrary skeleton import. Options are validated in IPC and applied after model import as well, so a scene-changing GLB cannot silently revert them. Native LOD generation and multi-body weight voting remain enabled.

The result reports weighted vertex counts, unweighted vertices, >4 influences, normalization/invalid-weight issues and missing UV, diffuse textures or LOD coverage. Static arm and leg stress poses are evaluated by Blender's actual armature modifiers and exposed alongside the initial pose. Each pose uses a separate bounded preview file, preserving source resolution/export quality and the viewing camera on pose switches. Bone matrices and pose mode are restored even if a pose fails; pose tests never re-export game resources. Save stays disabled until the selected preview loads successfully.

A token-guarded correction-project export copies the generated .blend through a Save dialog. A recoverable failed rig can offer its project without being marked as a successful ped export. Images are packed where available; packing failures are reported. Copying or canceling a correction project does not commit/discard the staged game resource. Manual marker, weight-paint, material and LOD corrections are performed in Blender and require a subsequent export.

Validation includes real Blender 5.2.2 (official bpy) armature deformation, distinct arm/leg geometry, shared preview textures, bone/pose restoration on success/failure, evaluated-object cleanup and unchanged native sentinel bytes; rig-option validation, remaining opaque IPC tokens, pose allowlists and relocation after saving; and renderer checks for option forwarding, quality reporting, delayed/failed pose loads, save gating, recovery and correction-project copying. Existing editor/native/creative/IDE checks continue to run. This is not in-game animation certification for an arbitrary user model.

See docs/PED_WORKFLOW.md and docs/NATIVE_BUILD.md. Tutorial sources were reviewed through available descriptions and chapter lists; full subtitle access was rate-limited. The workflow is implemented with DITASHA's pinned Muto/Sollumz engine rather than assuming every manual tutorial step is automated.

# v1.27.2 preview — Complete YFT vehicle and wheel assembly

The default YFT drawable now includes readable pristine physics children instead of displaying the vehicle body alone. Wheels retain per-child placement matrices plus the physics position offset, right-side orientation, inherited shader bindings and root default pose. Empty wheel drawable placeholders reuse the appropriate available front/rear wheel geometry at their own placement; shared drawable pointers no longer collapse distinct wheel instances. Individual pristine/damaged inspection choices remain available, and damaged alternatives are excluded from the default assembly.

The shared parser supplies Texture & Model, Model viewer, Photoshoot, File Manager and native vehicle preview consumers. Part numbers remain distinct within the assembled view. Native geometry/index identities remain intact; the input resource is not rewritten by preview assembly. Debadge component bounds are cached by positioned vertex buffers so different instances of a shared wheel do not inherit another wheel's focus bounds. Existing native geometry/assembled-instance budgets still apply, and damaged/unreadable children produce warnings without discarding a readable body.

Validation includes a six-wheel synthetic fragment with empty placeholders, shared donor pointers, front/rear selection, right-wheel orientation, native position offset, root default pose, unchanged input bytes and placement-specific component bounds. Windows renderer checks exercise the complete default view, individual fragment choices, Photoshoot and Texture & Model. The previously supplied GS base/high YFT files also parse into complete assemblies with their four readable wheel-related fragments and no warnings. The armored vehicle in the new screenshot has not been supplied as YFT/YTD, so that exact vehicle remains unverified.

Layout/transform references: https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Frag.cs and https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker/Rendering/Renderer.cs and https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker/Rendering/Renderable.cs. Implementation is original DITASHA JavaScript; CodeWalker binaries are not bundled.

# v1.27.1 preview — Large vehicle YTD support

Fixes the app-side “Decoded texture limit: 128 MB” rejection for large vehicle dictionaries. YTD decoding now permits up to 512 MB of RGBA pixels; the editor accounts for already-open workspace textures before allocating another dictionary. Model viewer and Debadge use the same bounded texture budget. Compressed input remains limited to 64 MB, individual textures to 16 megapixels, and other model/archive limits are unchanged.

Texture-strip and YTD-import thumbnails are at most 96 px. Full-resolution canvases/layers are created only for textures selected for editing, without resizing source pixels. YTD saving retains original native bytes, compression and mipmaps for unchanged textures; only edited textures are appended as lossless RGBA with one mip. The native graphics address range remains capped at 256 MB and complete YTD resources at 384 MB. Other export formats keep their existing size limits.

Regression coverage includes a synthetic three-texture 4K DXT1 dictionary (192 MB decoded), remaining-budget/512 MB rejection, thumbnail allocation, source resolution, texture switching, editing, export/reopen and exact preservation of untouched compressed mip chains. The user's screenshot was inspected; bearcat.ytd itself was not supplied, so exact file-specific verification is pending.

# v1.27.0 preview — Explorer layout and source-preserving tattoo projection

Replaces the stretched Workshop toolbar cards with compact control rows. Camera actions no longer stretch every group to their height. File Manager uses a familiar Explorer arrangement: folder tree, tabs, address/search row, compact commands, direct-folder browsing by default, and a right-hand preview pane. Asset category and recursive filters move into an optional Filter menu; the native Files launcher stays in the overflow menu. Selection survives switching between list and grid. PNG/JPG/WebP previews remain, and YTD/DDS texture selection plus interactive Legacy YDD/YDR/YFT model previews are now available directly in the pane.

Tattoo has a cylindrical projection mode for necks/arms, based on fitted local curvature and arc length rather than a tangent-plane face cutoff. The temporary preview uses the same rasterizer as the committed texture. The original texture resolution is retained by default; 2K/4K upscaling is optional. A raw-RGBA compositing path preserves untouched source bytes, including RGB beneath zero/low alpha, during projection-only edits. Skin mode blends tattoo ink into RGB while retaining the source alpha channel. Manual paint/transform edits invalidate that fast path after an undo snapshot.

Native authored Float3/Half4/RGBA8 SNORM normals are retained, including rigid bone transforms, instead of always recomputing shading at split UV vertices. The texture editor resolves named diffuse materials independently, so editing the skin atlas does not replace unrelated eye/teeth/hair maps when matching bindings exist. Preview uses raw RGBA GPU textures.

Tests cover source pixel preservation and YTD export/reopen, curved neck projection beyond 90 degrees, original native normals, compact toolbar height, ordinary folder browsing, image/YTD/3D preview, sorting, and existing editor/native engine workflows. The supplied screenshots were reviewed; the exact custom head/tattoo assets have not been supplied, so exact placement and in-game results on that model remain unverified.

# v1.26.0 preview — Files navigation and continuous tattoo projection

The internal File Manager is rebuilt around Files-style navigation: folder tabs (within the scanned root), back/forward history, clickable breadcrumbs, a bounded folder tree, category quick access, list/grid layouts with local image thumbnails, details toggle, and name/type/size/modified ordering applied before pagination. Existing native classification, reviewed sorting plans, streamed copies, source protection, cancellation and editor opening remain available.

DITASHA connects to installed Files Community stable/preview/dev through its registered command protocol. **Buka di Files** opens the active authorized folder in the real native Files application; **Dapatkan Files** opens the official download page if it is missing. Files is WinUI/C#, not an embeddable Electron web engine. This does not bundle/rebrand upstream Files, auto-install it, or replace the system file manager. The embedded browser is DITASHA code inspired by Files navigation.

Tattoo projection defaults to all visible meshes sharing the clicked mesh's diffuse texture and a deeper adjustable volume, avoiding a cut at mesh boundaries and curved neck surfaces. Single-mesh and explicit shared-atlas modes remain available. The temporary decal now applies the same front/back face test as UV baking. Both previews and baking use the same target set and volume.

New baking resolution options retain the original size or increase the atlas to at least 2K (default)/4K without downsampling an already larger texture. PNG source pixels remain unchanged for subsequent edits. Resolution scaling and artwork insertion share one undo checkpoint. Texture compositing uses high quality resampling, and the 3D editor uses mipmapped, anisotropic filtering. Upsizing increases tattoo sampling density; it cannot recover lost detail in a low-resolution skin source.

The supplied cropped screenshot was inspected, but its original tattoo PNG and matching ped YDD/YTD were not provided. Synthetic curved-neck, separated-mesh, UV seam and alpha tests cover the repaired pipeline; exact placement on that asset and in-game appearance still need those files.

Validation adds native Files protocol/absence/authorized-folder tests, ordering/tree tests, multi-mesh and curved-neck regression tests, 2K baking/undo UI checks, actual folder copy plus grid/tab/navigation checks, and responsive screenshots at 800/1024/1500 px.

# v1.25.1 preview — Asset Workshop control layout

Asset Workshop controls now use spaced action groups instead of a single compressed icon strip. The shared 2D/3D shelf groups Paint, Transform, Layer, History/Zoom, Model/Camera and Canvas controls; important paint/transform actions show text labels. Groups wrap in place at smaller widths, with a bounded scrollable shelf so the editing surfaces remain usable.

Model and vehicle viewers separate files/textures, preview/LOD, parts/visibility and loaded textures. GTA Explorer actions are grouped into Open/Inspect, Copy/Extract and Modify Archive. Side panels use consistent field spacing, readable action labels and minimum 36px buttons. Converter formats use a two-column grid; clothing, rigging, donor strobo and debadge share roomier action rows and field grids. Existing control nodes, IDs, event handlers and document state are preserved.

Validation includes toolbar collision/overflow checks and screenshots at 800/1024/1500px, existing 2D/3D, model, archive, converter, clothing, native rig/strobo, debadge and export checks, and packaged runtime verification.

# v1.25.0 preview — Expressive studio UI and motion

DITASHA has a richer shared desktop/web shell: ink-blue panels, warm gold actions, violet design studios, teal office tools, deeper surfaces, stronger toolbar groups and clearer navigation states. Both Midnight and Light themes use the shared palette.

Home now has a responsive canvas illustration, a gently floating geometric form, Design / Video & motion / Office filters, quick workspace links and elevated studio cards. Transitions use 100–400 ms motion tokens; the decoration runs only on Home. Settings → Tampilan → Animasi can reduce motion, and the operating system reduced-motion preference is always honored. The creative engine contents retain their own original interfaces; this release restyles DITASHA's shared shell and tool panels.

Design references supplied by the user were reviewed through GitHub. Motion-system and design-token guidance from https://github.com/Owl-Listener/designer-skills was applied to original DITASHA CSS/markup. The other repositories are ChatGPT app scaffolding, a chat UI, broad skill collections and web design book examples; their unrelated authentication/AI/application code is not integrated. No new runtime service or network-dependent visual asset was added.

Validation covers existing editor workflows, responsive home layouts at 800/1024/1500 px, filtering, keyboard workspace search, themes, session navigation, reduced motion, packaged creative engines and embedded IDE dependencies.

# v1.24.1 preview — Photoshoot framing and vehicle materials

- Fit each camera angle to visible indexed geometry, instead of a shared sphere. Hidden parts, unused vertices and collapsed badge triangles no longer make the subject smaller.
- Add a single-view layout and 50–300% zoom with an explicit crop notice. Empty title/caption areas give space back to the model.
- Treat the remaining standard opaque vehicle shader presets as solid surfaces. Diffuse alpha in paint, detail, cloth and tire shader data no longer makes those surfaces disappear. Glass, badges and decals retain alpha.
- Prevent the ped alpha panel from overwriting opaque vehicle materials with its default eyebrow cutout; reset now restores each material's own default.
- Upload viewer RGBA textures directly to the GPU, preserving RGB under zero alpha instead of losing it through Canvas premultiplication.
- Retain shader identity even when no texture parameters are present. Show viewer texture/geometry warnings in Photoshoot.
- The supplied GS image was reviewed. Its exact vehicle YFT/YTD was not supplied, so this does not establish that every missing part on that specific motorcycle is repaired. Physics fragment assembly and shared GTA textures absent from supplied files are not synthesized.
- Material preset reference: https://github.com/Sollumz/szio/blob/main/src/szio/gta5/Shaders.xml (bucket 0 vehicle presets).

# v1.24.0 preview

- Replaced Blender-dependent debadge with direct Legacy YFT preview and connected-part selection. Click separate badge geometry, highlight it, focus it, preview it hidden, undo/redo selections, and export using the original YFT filename.
- Native export changes only selected index entries into degenerate visual triangles. It preserves rig, collision, vertices, materials, textures, header/pointers and unselected buffers. Shared/overlapping index buffers, unreadable geometry and removing an entire LOD are guarded.
- Base and `_hi.yft` files can be reviewed together, with explicit drawable/LOD selection. Separate LODs are not guessed or edited automatically. YTD textures and the currently open vehicle can be reused.
- Debadge no longer calls Sollumz's YFT importer, avoiding the pre-preview import traceback shown in the reported failure. Other Blender operations retain their importer; full error reports can now be expanded or saved without overflowing a narrow status column.

# v1.22.0 preview

- Add Canvas Studio with blend modes, manual hide/reveal masks, alignment, optional position snapping, and portable layer/mask projects. Existing texture editing and GTA exports remain available.
- Add Scene Studio to Texture & Model and Model/Vehicle Viewer: move/rotate/scale gizmos, object selection, local/world axes, snapping, numeric transforms, undo/redo, camera FOV, lighting presets, PNG backdrops, and scene projects.
- Replace the duplicate vehicle transform panel with Scene Studio. Vehicle transforms now preserve independent scale axes. Clean snapshot exports exclude gizmos.
- Keep source assets and GTA formats separate from preview scene transforms. No AI runtime, provider, credentials, or third-party ArtCraft assets are included. See [MANUAL_STUDIO.md](MANUAL_STUDIO.md).

# v1.21.0 preview

- Add a desktop File Manager with folder navigation, recursive search, category filters, image preview, and links to the texture/model editor and GTA V Explorer.
- Preview asset sorting destinations before copying. Group images by format, recognized clothing/hair by component and collection, and vehicle models with recognized texture companions.
- Stream copies into a unique output folder, preserving original filenames and source hierarchy. Report failures and cancellation without modifying source files.
- Add File Manager to the homepage, workspace search, and Discord Activity. See [FILE_MANAGER.md](FILE_MANAGER.md) for usage and classification limits.

# v1.20.1 preview

- Fix the main-process error when Electron destroys the embedded IDE before the main window closes. Clear the active view before cleanup and tolerate missing/destroyed web contents.
- Load one automatic YTD companion for Explorer previews, prioritizing a matching ped component and texture index. Alternative skins remain available through the dictionary selector.
- Check YTD decoded memory against the remaining budget before allocating texture buffers. Retain the 128 MB cap.
- Show valid Explorer model geometry even when an external texture fails, with an actionable warning and usable controls.

# 1.20.0

- Embed Debadge and Strobo directly in Vehicle Workshop and give Auto Rig an inline workspace. Ped results are staged with a 3D preview before an explicit Save; original inputs stay unchanged.
- Keep texture, model, view and mode controls in a stable shared toolbar for both 2D and 3D. Add color sampling, undoable layer fill, center alignment and direct transform/duplicate shortcuts.
- Remove Texture Viewer from navigation; open archive textures directly in the editor. Converter formats are icon buttons instead of a dropdown.
- Reorganize GTA V Explorer with the file list and 3D preview side by side. Auto-load nearby dictionaries, normalize texture references and support hashed texture names. External/absent texture references still require the correct YTD or image.
- Share the active project/asset name in Discord Activity with a sharing toggle and optional manual project name. Never transmit full folder paths.

# 1.19.1

- Fix the embedded IDE failing with ERR_MODULE_NOT_FOUND / cookie in the portable Windows app: explicitly package the engine dependency folder skipped by electron-builder. Compare every packaged engine file and start the real packaged workbench in Windows CI.
- Add Download & set up for Blender 5.2.2 LTS, Sollumz 2.9.0 and Muto Ped Rig 0.3.2, with verified downloads, progress, cancellation/retry, and an isolated persistent Blender profile. Sollumz installs its pinned szio/PyMateria dependencies directly from their providers.
- Add a step-by-step Auto Rig guide inside the dialog. Existing manual Blender selection remains available.

DITASHA Editor 1.18.1 — Fixed editor toolbar and discoverable previews

- Keep document tabs and Edit 2D / Edit 3D controls in one full-width top bar. Switching modes changes the panels below without moving the tabs or controls.
- Automatically open inline 3D preview on a single click of a YFT/YDD/YDR file in GTA V Explorer, including folder sources. Keep the Explorer workspace and file list visible.
- Add a persistent Code editor entry in the sidebar. Open the offline Monaco editor without selecting a text file first; create a Lua file or open local UTF-8 text/JSON/XML/meta/scripts. Binary YFT/YTD assets remain viewer inputs rather than editable code.
- Save standalone and folder documents as file copies, track successful exports, and preserve unsaved-buffer confirmation when opening another file or starting a new one.
- Verify toolbar position across modes, single-click model preview, standalone editor entry/local file opening, discard cancellation and archive export round trips.

DITASHA Editor 1.18.0 — Inline Explorer preview and offline code editor

- Open YFT/YDD/YDR models directly inside GTA V Explorer, keeping the file list and current workspace visible. Double-click a model or use Model viewer; orbit, zoom, change LOD and inspect parts without switching pages.
- Pair a matching YTD automatically or choose another dictionary in the preview toolbar and reload the selected model. The existing model viewer, resource worker and GPU preview settings are reused.
- Add an offline Monaco code editor (the editor component used by VS Code) for Lua, JS/TS, JSON, XML/meta, configuration and text files. Double-click a supported text file or choose Edit code / text. This is not the complete VS Code application: extensions, terminals and script execution are not included.
- Apply text edits to the in-memory archive, then Save archive copy; the source archive is never overwritten. Folder files can be edited for export as a separate file copy only. Track unsaved buffers and confirm before discarding them.
- Limit text documents to 2 MB and valid UTF-8; reject binary/NUL data and preserve UTF-8 BOM. Bundle editor assets, worker and Microsoft MIT/third-party notices locally.
- Add browser and Windows Electron smoke checks for inline preview, code editing, cancel/discard behavior and byte-level exported RPF round trips, alongside existing viewer and updater regression tests.

DITASHA Editor 1.17.1 — Workspace redesign and Discord Activity

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
DITASHA Editor 1.19.0 — Home and minimal studio workspace

- Open on a dedicated homepage with six workspace shortcuts, real files from the active document tab, direct file reopening, and drag-and-drop import.
- Add workspace search with Ctrl K. The DITASHA logo returns Home without reloading or discarding the current session.
- Simplify the navigation rail: keep the editor, GTA V Explorer, Vehicle Workshop and code workspace directly accessible; group extra tools in an expandable section and move preview performance into Settings.
- Refresh dark/light palettes, panels, controls, dialogs and splash screen with restrained sakura accents, clearer spacing and consistent borders. Preserve document tabs and the stable 2D/3D toolbar.
- Add an isolated embedded Code - OSS workbench host with a bundled, SHA-256-verified VSCodium MIT server-web engine. The IDE starts on entering its workspace and does not promise Microsoft-only extensions or services. Keep Monaco quick editing and archive save workflows available.
- Add Windows checks for homepage layout at 1500/1024/800 px, workspace search and navigation, loaded-file preservation, light theme, and existing editor/viewer workflows. Real-engine tests are separate from UI tests.
