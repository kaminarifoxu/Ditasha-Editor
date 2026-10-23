# Stamps, vehicles and ped files

## Image and text stamps

Open a model and its YTD in **Texture & Model**, select the target diffuse texture, then open **Stamp**. Select Image (PNG, WebP or JPEG) or Text. For text, enter up to eight lines and choose a local font, color, bold or italic, then click Stamp.

Click and drag on the model to place the stamp. Drag the existing stamp to move it; controls change scale, rotation, opacity and projection depth. Plane suits logos and flat surfaces; Cylinder can help curved necks or arms. Select a text stamp in the list and use **Perbarui teks terpilih** to replace its text without adding a second UV layer. Save YTD to export the texture edits.

Projection follows triangles across separate UV islands that share the selected texture. Overlapping or mirrored UVs share pixels and therefore share the stamp. Separate texture atlases require separate stamps; this does not rewrite model UVs. Hidden/absent geometry cannot receive a stamp. Font availability depends on installed local fonts.

## Vehicle workshop

Select a mesh with **Pilih mesh di 3D** or the mesh list, then hide or restore that part. Native masked-resource export disables selected source triangles, preserving rig and collision; use the existing native Debadge workflow for material-face removal across LODs. Source geometry shared by visible and hidden LODs is rejected rather than corrupting the model.

The **Vehicle mods · import lokal** panel accepts a local YDD or YDR and optional YTDs. Choose Vehicle Part as category before importing. Position/rotate/scale the attachment and select its texture. Export attachment GLB separately, or export vehicle scene GLB to include it. These are static scene exports, not native injected YFT modifications. Local files are the model library; no GTA assets are downloaded or bundled.

**Strobo donor** remains the native lightbar route: select the target YFT and a compatible rigid siren donor, provide donor carcols and target vehicles/carvariations metadata, preview placement, then build a new output folder. The existing engine requires embedded donor lamp textures and rejects conflicting siren bones. The procedural lightbar in the viewer is a preview only.

## Ped files and attachments

In Model Viewer, open **Ped files** and import YDD/YFT/YTD/YMT together (up to 256 files, 127 MB total). YDD components are displayed together. If YDDs exist, the companion YFT is retained without rendering its skeleton as a second visible model. YMT is retained as original metadata; it is not decoded, regenerated or edited. **Save source bundle** exports exactly those imported bytes and filenames. It does not include later texture edits or added attachments and does not invent a manifest or missing metadata.

**Clothing & accessories** accepts one local YDD/YDR and its YTDs per import, up to eight attachments. Each has an independent drawable, texture, alpha and transform. Existing YDD hair workflows remain available. These attachments are static; GLB export preserves visual placement, not skinning or native clothing slots.

**Export rig source GLB** combines the currently visible base model and positioned attachments. Select that saved GLB in Rig ped to auto-skin the complete humanoid again. This creates a new full ped; it does not preserve the old skeleton, clothing slots or original weights. A suitable complete body in A/T-pose and engine setup are required.

For a complete humanoid GLB/FBX/OBJ, the existing **Rig ped** workflow provides Blender/Muto automatic skinning, source checks, evaluated arm/leg diagnostic poses, and staged native export. It is not an arbitrary clothing-to-existing-ped skinning tool. Full game-animation clip playback, procedural clothing generation and native arbitrary vehicle-part injection are not implemented in this update. They require further rig/material/native-export work and in-game validation.

## v1.41: native rigid parts, garment weights and moving review

### Native vehicle attachments

Open **Vehicle workshop → Inject donor parts**. Select the base target YFT, its paired `_hi.yft` beside it, a donor base YFT, and an output parent folder. Click **Analisis & preview donor**, select eligible parts, then adjust the native GTA X/Y/Z offset, scale and rotation. The preview gizmo follows the selected parts. Click **Build native** to create a new patch folder containing native YFTs, a manifest, the correction Blender project and a report. Keep the original vehicle resource/YTDs loaded before this patch.

The transfer preserves donor LOD meshes and native material references and binds the copied geometry to the target chassis/root. Donor inputs remain unchanged. Only rigid parts with native shaders, UVs and embedded image data are eligible. External textures, skinned/modified geometry, familiar moving/siren bones, unknown selections and conflicting texture names are rejected. Rename conflicting donor textures and embed them in Blender before retrying. This adds fixed visual accessories; it does not create collision, breakable parts, modkits or wheel/door/siren behavior. The dedicated siren-donor route remains separate. Test the patch in FiveM; Blender/native round-trip tests do not prove every third-party vehicle behaves correctly in-game.

### Per-garment skinning

Open **Auto rig ped → Skin clothing**. Choose a `.blend` template containing a single GTA-named armature (`SKEL_*`) and its already-skinned reference body. Reset its pose/action first. Choose an already fitted clothing GLB/FBX/OBJ and set the maximum distance from that body surface (default 0.25 m). Clothing must be aligned in the same rest pose and units; this operation transfers weights, it does not fit geometry automatically.

**Transfer weights & preview** computes nearest-triangle barycentric weights from the reference body, keeps the strongest four influences, normalizes them and binds the new clothing to the same skeleton. An out-of-range vertex rejects the transfer. Input template and garment files are never overwritten. Limits: one million reference vertices, two million reference triangles and 500,000 clothing vertices, with a 128 MB exported GLB cap.

Inspect the result in static arm/leg poses and the moving walk test before **Simpan clothing skinned**. Output is an actual skinned GLB plus a packed correction `.blend` and report. It is not a ready-to-stream YDD/YMT clothing resource: native ped shaders, embedded normal/specular maps, LODs, naming and clothing slots still need Sollumz export work. Nearest-surface transfer may need manual corrections around adjacent body parts, layered clothing or unusual proportions.

### Moving walk test

The rest preview for new full-ped rigs and garment transfers includes a procedural 1.4-second walk weight test where the rig exposes supported GTA limb bones. Play/Stop and 0.5×/1×/1.5× controls are in the preview toolbar. The actual Blender armature is evaluated at bounded keyframes; the viewer interpolates those frames. Stopping, loading another pose or leaving the workspace restores the static preview. Pose matrices and exported native assets are unchanged by the test.

Animation data is limited to 16 MB and 4–16 frames, with a 48 MB total preview cap. Very dense models may keep only static poses and a warning. This is a procedural diagnostic movement, not imported GTA YCD clip playback or an exported walk animation. Clothing generation and automatic native garment packaging remain future work.
