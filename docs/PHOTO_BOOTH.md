# Photo Booth

Open **Asset workshop → Photo Booth** for offline outfit photography. It is separate from Photo Studio (the image editor) and the existing three-angle Photoshoot dialog.

1. **+ Ped / tubuh**: choose your YDD together with its YTD, or a rigged GLB. Fullped component dictionaries assemble automatically. Add a matching YFT if the clothing files rely on its skeleton.
2. **+ Baju** / **+ Aksesori**: add local YDD/YDR/GLB pieces and their YTDs. Select drawables or hide body slots in the asset cards to avoid overlapping clothes. Use **+ Tekstur** to add dictionaries later.
3. Choose **Santai**, **Pose katalog**, **Melambaikan tangan**, **Langkah berjalan**, or **Dance ringan**. Play, pause, and scrub to freeze the desired frame. **Pose asli** restores bind pose.
4. Rigid accessories can follow an explicitly chosen body bone. Position offsets and scale are preview adjustments; matching skinned clothes use their own rig automatically.
5. Orbit/zoom, use front/back/fit controls, choose lighting, background and resolution. **Simpan PNG** captures the current posed frame, including transparent background when selected. The preview keeps the export aspect ratio.

Native GTA skinning uses bounded Legacy skeleton metadata, local bone transforms converted into the Three.js coordinate basis, the geometry's bone palette and normalized vertex weights. Drawables without their own skeleton may use the matching ped skeleton supplied in the session. The rig and source files remain unchanged. Built-in poses are procedural previews, not GTA game emote assets or cloth simulation. Incorrect/mismatched source rigs still need correction.

GLB animations embedded in the model are available in **Clip GLB**. **+ Animasi GLB** loads another embedded GLB clip; only tracks with matching node names are used. This does not retarget arbitrary skeletons or load binary YCD. GLBs must embed all buffers and textures. A model without usable skin weights or rigid bone bindings remains static and shows a status explanation. No base game ped files or animation packs are redistributed.

Limits: 20 models, 64 MB per model/GLB, the existing bounded YTD decoded-memory policy, and PNG resolutions up to 3000×4000. Sessions remain in memory while navigating workspaces. Clearing the booth releases scene resources. Animation stops while away from the booth.

Validation includes native bind/palette parsing, malformed-rig rejection, reversible vertex deformation, UI separation, native/GLB animation rendering, play/pause/scrubbing, outfit/accessory imports and transparent PNG export in the Windows Electron test. Actual GTA/FiveM rendering is not used by the booth.

Layout references: [CodeWalker Skeleton/Bone/DrawableGeometry](https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Drawable.cs). Original implementation; no upstream binary or ped assets are included.

## Multiple peds and local library (v1.50)

Import multiple peds, then select **Ped yang diatur** or **Atur emote ped ini** in a model card. Each ped keeps its own pose, GLB clip, speed, paused frame and playback state. **Putar semua** starts each ped's own emote; **Jeda semua** freezes the group. Position, yaw and scale are editable per ped. Procedural arm poses use the actor's orientation.

Clothing/accessories belong to the selected ped when imported. Change **Pemilik outfit / aksesori** to move a piece to another character. Rig fallback, bone targets and pose evaluation stay within that actor.

**Library lokal → Simpan scene & outfit** stores source model/texture/GLB animation files, ped transforms, individual emotes and outfit ownership in the application's IndexedDB. **Buka preset** restores the whole scene paused, retaining each ped's frame. Presets are capped at 512 MB and preserve the original files. Library storage is local to this DITASHA profile; it is not cloud sync. Binary YCD is still unsupported in Photo Booth; use compatible GLB clips for now.
