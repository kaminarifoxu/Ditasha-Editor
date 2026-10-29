# Photo Booth

Open **Asset workshop → Photo Booth** for offline outfit photography. It is separate from Photo Studio (the image editor) and the existing three-angle Photoshoot dialog.

1. **+ Ped / tubuh**: choose your YDD together with its YTD, or a rigged GLB. Fullped component dictionaries assemble automatically. Add a matching YFT if the clothing files rely on its skeleton.
2. **+ Baju** / **+ Aksesori**: add local YDD/YDR/GLB pieces and their YTDs. Select drawables or hide body slots in the asset cards to avoid overlapping clothes. Use **+ Tekstur** to add dictionaries later.
3. Choose **Santai**, **Pose katalog**, **Melambaikan tangan**, **Langkah berjalan**, or **Dance ringan**. Play, pause, and scrub to freeze the desired frame. **Pose asli** restores bind pose.
4. Rigid accessories can follow an explicitly chosen body bone. Position offsets and scale are preview adjustments; matching skinned clothes use their own rig automatically.
5. Orbit/zoom, use front/back/fit controls, choose lighting, background and resolution. **Simpan PNG** captures the current posed frame, including transparent background when selected. The preview keeps the export aspect ratio.

Native GTA skinning uses bounded Legacy skeleton metadata, local bone transforms converted into the Three.js coordinate basis, the geometry's bone palette and normalized vertex weights. Drawables without their own skeleton may use the matching ped skeleton supplied in the session. The rig and source files remain unchanged. Built-in poses are procedural previews, not GTA game emote assets or cloth simulation. Incorrect/mismatched source rigs still need correction.

GLB animations embedded in the model are available in **Custom emote · YCD / GLB**. **+ Emote YCD / GLB** loads another embedded GLB clip; only tracks with matching node names are used. Compatible GLB bone tracks can also drive native GTA ped/clothing rigs; each drawable skeleton is bound separately within its own actor. This does not retarget arbitrary skeletons. Binary YCD support is described below. GLBs must embed all buffers and textures. A model without usable skin weights or rigid bone bindings remains static and shows a status explanation. No base game ped files or animation packs are redistributed.

Limits: 100 models (1 GB of model source files and 5 million vertices across the scene), 64 MB per model/GLB, the existing bounded YTD decoded-memory policy, and PNG resolutions up to 3000×4000. Sessions remain in memory while navigating workspaces. Clearing the booth releases scene resources. Animation stops while away from the booth.

Validation includes native bind/palette parsing, malformed-rig rejection, reversible vertex deformation, UI separation, native/GLB animation rendering, play/pause/scrubbing, outfit/accessory imports and transparent PNG export in the Windows Electron test. Actual GTA/FiveM rendering is not used by the booth.

Layout references: [CodeWalker Skeleton/Bone/DrawableGeometry](https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Drawable.cs). Original implementation; no upstream binary or ped assets are included.

## Multiple peds and local library (v1.50)

Import multiple peds, then select **Ped yang diatur** or **Atur emote ped ini** in a model card. Each ped keeps its own pose, GLB clip, speed, paused frame and playback state. **Putar semua** starts each ped's own emote; **Jeda semua** freezes the group. Position, yaw and scale are editable per ped. Procedural arm poses use the actor's orientation.

Clothing/accessories belong to the selected ped when imported. Change **Pemilik outfit / aksesori** to move a piece to another character. Rig fallback, bone targets and pose evaluation stay within that actor.

**Library lokal → Simpan scene & outfit** stores source model/texture/GLB animation files, ped transforms, individual emotes and outfit ownership in the application's IndexedDB. **Buka preset** restores the whole scene paused, retaining each ped's frame. Presets are capped at 512 MB and preserve the original files. Library storage is local to this DITASHA profile; it is not cloud sync. Native YCD imports are supported from v1.53 as described below.

## Detailed outfit categories (v1.51)

The outfit panel provides dedicated imports for tops/jackets, undershirts, pants/skirts, shoes, bags, vests/armor, torso/arms, masks, hair, hats/helmets, glasses, earrings, watches/bracelets, jewelry, decals and other items. Each model card has an editable category. Categories persist in local library presets; older presets remain readable.

**Folder outfit** imports supported model/texture files recursively through the folder picker. Choose automatic GTA slot detection or a category override. Random filenames can use the explicit category buttons. Category filtering and model-name search affect the list only; they do not hide meshes in the photo. Up to 100 models and 1,000 texture source files can be imported. Per-model input remains 64 MB; decoded textures remain bounded at 1 GB. Library source bundles remain capped at 512 MB.

## Height, skeleton recovery and diagnostics (v1.52)

**Tinggi grup ped · cm** adjusts the selected actor and all owned outfit pieces. **Naik / turun · cm** edits its vertical position (Three.js Y); Z is depth. These changes update scene transforms directly and preserve the camera, so auto-fit no longer cancels the visible size change. Use Fit tubuh explicitly when needed. The height measures the visible assembled group in bind pose; adding an outfit preserves an explicitly requested target height. Motion playback no longer rewrites a height/speed field while it is being typed.

Freemode YDD parts can contain valid skin weights without a skeleton. Compatible parts identified by `mp_m_freemode` / `mp_f_freemode` can now use an offline 128-bone reference. An embedded complete skeleton is preferred in automatic mode, followed by compatible actor-owned sources and the freemode reference. Identity matching uses bone names/tags when indices differ. Unsupported required indices remain diagnosed; weights and original files are not rewritten.

**Skeleton / acuan** allows explicit male/female freemode selection or **Dari file skeleton acuan**. Import a matching YFT/YDD/YDR with **+ Skeleton YFT / YDD**. Reference-only models provide skeleton metadata, are excluded from photography and vertex counts, and remain owned by the selected actor. Native source files, rig choice, height target and preview texture overrides are retained in library presets.

The built-in references contain only functional bone hierarchy/name/tag/local-transform metadata derived from the supplied rigged freemode examples. No source geometry, images, original game/mod resource files or animation pack is bundled. The five supplied halfped head examples were checked locally for finite vertex deformation with the recovered/embedded reference, including the two heads with no embedded skeleton. This does not replace checking a custom ped with its own author-provided skeleton.

Santai, Katalog and Pose asli are static poses. The **Berjalan**, **Dance** and **Lambaikan** shortcuts select and start a moving procedural preview. The per-ped playback clocks remain independent.

**Lihat masalah / Periksa masalah** lists skeleton and texture problems without filling the viewport footer with filenames. Missing texture pixels still require the matching YTD/image. A model card's **Tekstur diffuse semua mesh · preview** can explicitly select a loaded diffuse atlas when the source material name is wrong. This override changes the photo preview and saved scene preset, not native GTA/YTD exports.

## Native YCD emotes (v1.53)

**+ Emote YCD / GLB** accepts multiple files. Choose the ped, import `.ycd`, select the clip in **Clip**, then press **Putar**. Search filters by file/clip name and retains the current selected entry. Every actor retains its own chosen clip, speed, time and play/pause state; owned outfit skeletons are bound separately to the same clip. Library presets retain original YCD bytes and restore paused. There is no bundled emote catalogue: import your own files and save your scene to the local library.

The read-only decoder supports RSC7 Legacy version46 single-animation skeletal clips and all nine CW channel types: static quaternion/vector/float, raw, quantized, indirect-quantized, linear delta, and both cached quaternion encodings. Multiple sequence blocks, clip time ranges and playback rates are respected. Rotations are normalized and interpolated; position/rotation use the same GTA-to-preview coordinate basis as the skeleton reader. GTA bone tags bind tracks rather than assuming a particular bone-array ordering. Leaving an emote restores rest positions, scales and rotations.

Bounds: 100 emote files, 64 MB per file, 512 MB source total, 2,048 clips and 16 million decoded values per session; each dictionary is limited to 256 clips/animations, 600 seconds per animation, 16,384 frames, 2,048 bone tracks and eight million decoded channel values. Individual skeletal clips also have a two-million track/sample preview budget. Invalid files report their filename; other valid files in the same batch remain imported. Animation-list/blended clips report unsupported status and are not silently substituted with procedural dances. No YCD writing or game installation changes occur.

Limitations: only skeletal position/rotation tracks0/1 are applied. Root-motion extraction, UV/material effects, facial scalar tracks, game-triggered props, paired-emote actor synchronization, sound, cloth simulation and animation-list blending are not reproduced. Arbitrary GLB rigs without matching native GTA bone tags require a compatible GLB animation; this is not general retargeting. A custom ped must have usable skin weights and a compatible skeleton. Legacy YCD support does not imply support for encrypted or Enhanced resources.

Local input audit: the supplied `beachparty@hmanim.ycd` was read without changes: one `beachparty_clip`, 89 frames, duration2.9666667seconds, 384 bone/track entries, 256 position/rotation tracks mapped to each built-in freemode reference; 116 bone world positions changed at1.5seconds with finite matrices for both male and female. The source animation file is not committed, uploaded to CI or distributed. CI uses a synthetic two-bone YCD fixture for independent encoding, rendering, batch import, search, playback and library round-trip tests. This is Photo Booth preview validation, not an in-game guarantee.

Primary layout/channel implementation: [CodeWalker Clip.cs](https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Clip.cs), MIT Neodymium2016. The JavaScript adaptation includes the upstream notice in `ui/CODEWALKER-YCD-LICENSE.txt` packaged with the app.

## Ped placement, fullscreen and studio sets (v1.54)

Select **Pindah ped**, choose the character from the viewport **Ped** picker or click its visible mesh, then drag the X/Y/Z gizmo. The selected actor's frame moves with all owned outfits/accessories; every actor retains its own emote and placement. Orbit controls pause during gizmo dragging. **Snap 10 cm** constrains translation. Coordinates are bounded to ±100m and can also be edited in centimeters with **Kiri / kanan**, **Depan / belakang**, and **Naik / turun**. Per-asset offsets remain available for individual outfit adjustments.

**Layar penuh** expands the stage across the application window, with the actor/studio pickers, move tool, **Lihat semua ped**, and **Simpan PNG** still accessible. It uses the whole viewport aspect rather than leaving portrait side margins. Escape or the same button exits; navigating away also exits. **Lihat semua ped** frames visible actor/outfit geometry only, excluding the studio and transform helper. PNG export keeps the selected output resolution/aspect, temporarily fits the group when exporting from fullscreen, hides the gizmo and restores the preview camera afterward.

Three original offline photo studio scenes are built directly from geometry: **Studio Katalog** (warm curved cyclorama, architectural panels, softboxes), **Editorial Loft** (wood floor, window light panel, bench and plant), and **Neon Gallery** (dark curved backdrop, neon ring and accent strips). **Polos / grid** preserves the plain-background workflow. No external model packs, game environments, remote image services or AI generation are required. Studio sets remain anchored at world origin (fixed from v1.56). Studio geometry is outside the actors' stage and is excluded from ped limits and frame-fitting bounds. Directional light shadows ground models on the set floor. These scenes approximate studio lighting; they do not provide a path-traced renderer or physically simulated emissive light panels.

Transparent PNG hides studio/floor geometry. Studio ID, background, light level, transparency, grid and photo resolution are stored with each scene preset. Older presets without these settings remain valid. Procedural studio geometry/materials are disposed when changing sets. Windows UI regression checks exercise independent ped movement, all three set renderings, fullscreen sizing/Escape, and placement/studio persistence.

## Minimisable fullscreen emote player (v1.55)

Fullscreen now includes a floating **Emote player** with ped selection, pose/custom clip, clip search/import (YCD/GLB), quick poses, play/pause, group play/pause, speed and frame scrubbing. It reuses the actual live controls rather than copying state into a second player. The normal sidebar controls return to their original positions when leaving fullscreen or navigating away.

**Minimalkan** collapses the panel to a small bottom-corner bar with the selected ped/pose and play/pause. Emote clocks keep running. **Buka** or the toolbar **Emote player** restores the panel without resetting the selected actor, clip, speed or frame. The collapsed state is retained for the current session. The floating panel is UI only and is excluded from canvas PNG exports. The independent per-ped emote and outfit ownership behavior remains shared with the normal sidebar.

Windows host-driven UI checks cover changing the selected actor/custom GLB clip in fullscreen, continuing playback while minimized, pausing from the compact bar, restoring clip/speed, another actor retaining its pose, restoring controls on exit, and retaining minimized state on re-entry. Stable screenshots show the open Neon player and minimized Loft player.

## Stationary studio when moving peds (v1.56)

Removed automatic studio recentering/rescaling and key-light repositioning based on actor offsets. The studio, props, floor and lighting now keep fixed world transforms when moving a ped through the gizmo or centimeter fields, importing/removing models, or rebuilding outfits. Only the selected actor frame and its owned assets move. **Lihat semua ped** remains an explicit camera-fit operation; it does not relocate the studio.

The Windows GPU regression checks compare the pixel bounds of the original neon set's emissive landmarks before and after both an actual mouse gizmo drag and X/Z numeric edits, without refitting the camera. These background bounds must remain stationary while the selected actor's position changes.

## Vehicles, rotation, matte, shadows and locations (v1.57)

**+ Kendaraan** imports native Legacy YFT/YDR/YDD or embedded GLB as an independent scene object. Add the matching YTD/images through the same import batch or **+ Tekstur**. Vehicle objects own their transforms and texture scope; they are not attached to the currently selected ped. Existing YFT native drawable/fragment assembly is reused. Native car physics, driving, sirens, game shader parity and automatic seated-ped attachment are not added. Existing model/vertex/texture limits apply across the whole scene.

The viewport **Alat → Putar** enables a world-Y rotation gizmo for the selected object. **Rotasi Y · derajat** also accepts an exact heading, including vehicles; position/rotation and matte state persist in scene presets. Owned clothing continues to follow its ped. Studio and lights remain anchored when objects move or rotate; changing the shadow direction explicitly moves the key light around the fixed origin.

**Matte tubuh / wajah** is a reversible preview override on the selected ped and its owned parts: it removes Phong specular highlights or increases physical roughness and disables metallic/environment/clearcoat/sheen reflections. Vehicle paint is excluded. This affects surfaces across that ped, not just the face. Texture pixels and alpha/cutout are preserved; it does not reconstruct missing/incorrect source texture alpha. Original material values return when matte is unchecked. Reduce the existing light slider if the diffuse skin itself is too brightly lit.

**Bayangan** provides on/off, strength0–1 and key-light azimuth0–360degrees. These are saved with the studio preset; older presets keep their previous defaults. Shadows are preview approximations from one directional light, not path-traced lighting.

Seven original stylised offline 3D locations join the existing Catalogue/Loft/Neon sets: **Hood** (urban street, buildings, hoop), **Ruang tamu** (sofa, rug, table), **Kantor** (desks, monitors, shelves), **Kantor polisi** (briefing board, badge/signage), **Pantai** (sand, ocean, palms, umbrella), **Ruang tidur** (bed, cabinet, bedside lamp), and **Kamar mandi** (tiled wall, tub, sink, mirror, toilet). These are newly built procedural environments, not imported GTA maps or realistic scanned interiors. Their GPU resources, including generated sign textures, are disposed when switching studios.

**Simpan PNG** now opens an orientation/resolution dialog: Portrait1080×1350 or3000×4000, Landscape1920×1080 or4000×3000, Square2048×2048 or3000×3000. Confirm to export or cancel without exporting. When orientation differs from the preview, the camera temporarily fits all visible objects; the preview camera is restored afterward. The dialog works in fullscreen, and Escape cancels the dialog before exiting fullscreen. PNG still excludes UI and gizmos and supports transparent background.

Validation includes reversible Phong/physical matte with alpha unchanged; finite location geometry; independent vehicle actor ownership; vehicle/matte/shadow preset validation; Windows rendered ped/car heading changes, native YFT and GLB vehicle imports, shadow pixel changes, expanded scene preset restoration, portrait/landscape PNG dimensions and all seven location screenshots. CI vehicle geometry is a wholly synthetic box-body/wheel fixture; no user/game vehicle or ped assets are redistributed.

## Collapsible ped/outfit groups (v1.58)

The model list now groups each actor with its owned clothing, hair, accessories and reference skeleton files. Each group has a compact owner heading, source filename/file count, **Pilih** action and editable **Nama grup**. Vehicle objects and unattached parts keep independent groups. Changing an outfit's owner moves its card into the corresponding group; it does not infer ownership from ambiguous filenames.

Click a group heading to collapse/expand its file list. **Ciutkan semua / Buka semua** acts on the groups. Every individual file also has a collapsible detail card, so transforms/texture/owner fields stay out of the way until requested. Collapsing affects only the UI: meshes remain visible, outfit ownership and per-ped emotes do not change. Visibility still uses each card's explicit checkbox.

Selecting an actor opens and highlights its group; manually collapsed groups retain their state through other edits/rebuilds. Search/category changes reveal matching groups, preserving owner context. Group names are reflected in the actor picker, and group names/collapse states persist in saved scene presets. Per-file expansion is retained for the current session. Older presets without group metadata remain valid.

Windows UI tests verify grouped outfit reassignment, group labels, collapse-all without canvas changes, collapsed state across edits, group selection, retained part controls and label/collapse restoration from presets. Previous asset-list regressions now query actual file cards rather than assuming a flat DOM list.

## v1.59 — props and consistent landscape captures

- Booth preview defaults to 1920 × 1080 landscape. Full-window mode keeps the selected photo aspect, so preview and PNG share the same composition.
- Capture never auto-fits or moves the camera. Changing output orientation/resolution previews the new aspect before saving. Emotes pause when opening the export dialog. Use **Lihat semua ped** only when you want to refit explicitly.
- **+ Prop tangan** imports your own YDR/YDD/YFT/GLB as an owned accessory. Open its card and choose **Pegang · kanan/kiri**. A matching hand bone is required; props snap to the hand origin and follow animation. Adjust local XYZ offsets, XYZ rotation and scale to fit the grip. Presets preserve these values. This is rigid attachment, not finger IK or automatic two-handed grip.
- Searchable offline reference includes 12 GTA model identifiers with a link to the larger community list. Geometry and textures are not bundled or downloaded; export the desired YDR and companion YTD from your own game, then import them.
- Emote source-file limit increases from 100 to **2000**, in both live import and saved presets. Existing budgets remain: 64 MB/file, 512 MB total source, 2048 decoded clips, 16 million animation values; these may be reached before the file count.

## v1.60 — rigid prop attachment repair

- **+ Prop tangan** now snaps newly imported props to the selected ped's right hand automatically. GTA weapon/prop names beginning `w_`/`prop_` imported as accessories are recognized as props too. Pick left/right to reset the local grip offsets.
- Native prop skin weights never receive freemode recovery, ped poses or YCD tracks. Prop meshes stay rigid. GLB prop skeletons retain their own bind pose and are excluded from the ped emote library and mixers.
- A separate grip anchor follows the chosen hand's world matrix after every animation update, expressed in the actor frame once. Ped translation, yaw and scale are not applied twice. The prop skeleton cannot enter the ped mixer's subtree.
- Hand lookup checks all visible body/outfit skeleton sources belonging to the selected owner and supports GTA bone tags plus Mixamo hand aliases. Changing owner retains the chosen hand and local grip adjustments.
- Each prop card shows attachment status. Missing hands or missing owner are reported and the unbound prop is withheld from the photo rather than appearing as a successful floating attachment. Original source files are not changed.
- v1.59 presets containing an untouched prop (`auto`, no grip) migrate to right-hand attachment on load. Existing explicit grip position/rotation/scale is preserved. Imported props still require suitable model pivots and manual grip alignment; no finger IK is added.

## v1.61 — multi-file vehicle resources

- **+ Folder kendaraan** reads YFT/YDR/YDD/GLB models, YTD textures, `carcols.meta` and `carvariations.meta` from one extracted resource folder. Duplicate nested metadata copies are deduplicated. Explicit kit/model relationships group mod YFTs under their vehicle; ambiguous/unidentified models remain independent.
- A paired `_hi.yft` stays in the same group as an alternative, initially hidden. Enabling it disables the base model; enabling the base disables its HI alternative. They do not render on top of each other by default.
- Mod parts share the vehicle transform and texture owner. Unique imported mod slots are enabled; alternatives within one slot begin disabled and visibility choices are exclusive per slot. Stock faces fully weighted to a mod's `turnOffBones` are omitted in the preview; mixed-weight triangles are conservatively retained. Source geometry is never rewritten.
- **+ Part kendaraan** attaches manually selected models to the current vehicle when metadata is unavailable. Toggle parts and adjust local offsets/rotation/scale on their cards. Such manual additions do not guess native mod placement or stock-removal metadata.
- Vehicle groups/parts, visibility, mod slot and stock-bone metadata survive preset save/load. Model decode errors name the failed source file.
- Local audit of the uploaded GS resource: all five Legacy YFT files parse successfully through the current worker-job decoder. `gs.yft` and `gs_hi.yft` are identical; metadata explicitly associates frame, seat and tank parts with the GS mod kit. The prior index-buffer error did not reproduce with these exact bytes, so malformed-index validation is retained.

## v1.62 — replace ped YTD per model

Open a ped group, choose **Bagian untuk ganti YTD** (body/head, hair or clothing), then **Ganti YTD**. Each native model card also has **Ganti YTD bagian ini** and its current texture source names. This replaces texture sources owned by that model, preserving other model/ped scopes. Decoding and budget checks complete before committing; invalid YTDs retain the previous source and pixels. Camera framing and model placement remain unchanged. Presets retain the new source and owner.

Native YDD/YDR/YFT models are supported. GLB material replacement is not included. Internal map names normally match shader references; if a variant uses different names, choose the preview texture from the model card. A model-local YTD has priority over shared ped dictionaries for diffuse, normal and specular references. Original source files are not overwritten.

## v1.63 — BC5 textures and recoverable preset loading

- The native YTD reader now decodes ATI2 (`0x32495441`, BC5 UNORM) with independent red/green interpolation tables and opaque alpha. Blue stays zero; normal-map Z reconstruction remains in the existing surface shader. BC4 grayscale behavior is retained. Bounds checks reject truncated blocks. Unchanged BC5 native blocks are preserved by YTD export.
- Photo Booth preset loading no longer aborts for texture-loader warnings. Readable maps and all valid models restore; the issues panel lists skipped/corrupt entries, and the footer reports a partial load. Original texture source files remain in the preset, so future retries or **Ganti YTD** can recover them. Structural model/scene failures and memory limits still apply.
- The previous strict/atomic behavior of **Ganti YTD** is unchanged: invalid replacement files do not replace working textures.
- Validation includes known BC5 block values in both endpoint modes, clipped edge blocks, truncation rejection, unchanged YTD export, and a Windows preset round trip with a readable BC5 map plus an unsupported sibling map and another ped's YTD.

Codec layout reference: https://learn.microsoft.com/en-us/windows/uwp/graphics-concepts/block-compression

## v1.64 — imported GTA map studios

Use **+ ZIP studio / MLO** (multiple ZIPs supported) or **+ Folder studio**, then select a map in **Set photo studio** or the fullscreen studio selector. Every YMAP is a separate studio choice. The uploaded Sweetmaps resource contains eight maps; Gameroom contains one. Local audits assembled all nine maps with their supplied YDR/YTD dependencies and no missing-model/texture warnings. User map assets are imported locally, not bundled or published with the application.

- Native Legacy YMAP/YTYP META readers resolve archetype/model/texture hashes and entity position, orientation and scale. Static MLO base entities are expanded; only HD/orphan-HD map entities are included. Entity-set variants, game portals/timecycle/collision and game scripts are not simulated. Missing external GTA dependencies are reported instead of substituted.
- A selected map is rebased, centered on X/Z and grounded to its mesh bounds near the photo origin. It lives outside ped/vehicle actor frames and is excluded from Fit-all bounds, so moving actors does not move the studio. **Buka sisi kamera** clips the camera-facing side for interior photography; floor height and studio yaw are adjustable.
- Original source packs, selected map, clipping, floor height and yaw are saved in scene presets. Only the selected studio's geometry and textures are decoded/rendered; switching releases the previous studio's GPU resources. Transparent PNG hides the studio as before.
- Limits: 16 source packs, 2000 source files/512 MB total studio sources; the full preset bundle still has a 512 MB source limit including actors. Individual studio caps are 256 maps, 2048 rendered instances, four million vertices and 256 MB decoded textures. Large full-city maps should be split into photo-sized resources.
- ZIP extraction uses existing bounded CRC/path validation. Only YMAP/YTYP/YDR/YDD/YTD files are read. Lua/fxmanifest and other executable content are ignored. Imported materials use the existing preview renderer, not the complete GTA lighting/render pipeline.

Native META layout references: CodeWalker `Meta.cs`, `MetaTypes.cs`, `MetaNames.cs`, `YmapFile.cs`. Attribution and upstream permission notice are packaged in `CODEWALKER-META-LICENSE.txt`.

## v1.65 — preset Blob I/O repair

New library saves copy model, texture, animation and imported-studio sources into bounded 1 MB ArrayBuffer chunks instead of persisting disk-backed File/Blob references. Source bytes, names and ownership are reconstructed on load. The UI reports copy progress. The 512 MB preset limit remains unchanged.

The database upgrades in place to version 2 without deleting the original scene store. Existing version-1 Blob presets remain readable. A save stages source chunks and publishes the scene record only after all writes commit; a failed save keeps the previous preset and current scene. Failed staging, successful replacements and preset removal clean up their associated chunks. An application/process crash during staging can leave unreferenced chunks; no automatic destructive database reset is performed. Disk-full/permission failures remain possible and now give an actionable message; unreadable input sources name the affected file. Old presets whose source blobs were already lost cannot be reconstructed automatically.

Windows Chromium integration checks cover a real version-1 database upgrade, rejecting any Blob write while saving a multi-chunk source, exact source-byte recovery, simulated quota failure after a partial write, unreadable input recovery, replacement and deletion cleanup. Existing Photo Booth preset round trips also run through the new format.

## v1.66 — emote timing and compact import reports

YCD import isolates invalid clips instead of discarding valid siblings. Zero-length pose windows, zero-rate held poses and single-frame animations are supported. Native source windows may extend beyond the animation duration; source frames wrap using the native frame-position cadence instead of freezing at the last frame. Single-source ClipAnimationList records now use their declared duration and source window/rate. Newly supported lists are appended after existing single clips to preserve their previous numeric IDs in saved presets. Multi-source blends, facial scalar channels and game effects remain unsupported; original YCD files are not rewritten.

Non-RSC7 inputs are described as an unsupported/malformed/protected header rather than definitely encrypted. Failed files need the actual source bytes to diagnose. Import status shows counts with a link to the issues panel, capped at 200 detail rows plus an omitted-count row. The report survives scene rebuilds. Preset loading retains readable emotes when another source cannot decode and falls back to the relaxed pose for a missing selected clip while retaining source files.

Current studios are bounded static resources: 512 MB studio sources, four million rendered vertices and 2048 instances per selected map. A full GTA V world is not supported by this importer. It would need local-game RPF dependencies, area/LOD streaming, world-origin management and a different loading budget; raising these limits alone cannot provide it. Photo-sized exported locations are supported within existing limits.

Layout/timing reference: https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Clip.cs. Exact user emotes from screenshots were not supplied; timing/list regression tests use synthetic fixtures.

## v1.67 — GTA folder connection, viewport culling and emote grid

Settings → **Instalasi GTA V** validates and remembers a local game root, opens it in Explorer and scans names/metadata without changing game files or reading every archive into memory. Only approved native asset/RPF IDs can be read, in 1 MB ranges; changed files and links outside the selected root are refused. **Dari instalasi GTA V** in Photo Booth selects a loose YMAP resource directory or an OPEN RPF, then passes its source files through the existing bounded studio importer. Dependencies outside that directory/archive must still be included by the user. Nested RPF browsing, encrypted game archives, Enhanced resources and full-world area/LOD streaming remain unsupported. Connecting the installation does not make the complete base-game world available.

**Lewati objek studio di luar kamera** explicitly controls Three's per-camera frustum culling for static studio meshes, with an in-frame/total mesh counter. This skips main-camera draws behind/outside the frustum and recomputes on camera movement. It preserves offscreen shadow casters and does not touch animated ped bounds or hide objects via `visible=false`. This is not wall occlusion, geometry unloading or streaming. Static meshes already used Three's default frustum path; the new control makes that behavior explicit rather than claiming a new full-world renderer.

The Clip dropdown now opens a searchable three-column button grid, with the active emote highlighted. Lists over 90 items have page controls. Selection uses the existing native select as its internal state, preserving per-ped ownership, saved IDs and fullscreen reparenting. Arrow keys move through the grid; Escape closes it.
