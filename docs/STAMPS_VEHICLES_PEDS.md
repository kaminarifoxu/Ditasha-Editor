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

For a complete humanoid GLB/FBX/OBJ, the existing **Rig ped** workflow provides Blender/Muto automatic skinning, source checks, evaluated arm/leg diagnostic poses, and staged native export. It is not an arbitrary clothing-to-existing-ped skinning tool. Full game-animation clip playback, procedural clothing generation and native arbitrary vehicle-part injection are not implemented in this update. They require further rig/material/native-export work and in-game validation.
