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
