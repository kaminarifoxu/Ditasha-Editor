# Manual Canvas & Scene Studio

This update adapts the manual authoring workflows discussed in ArtCraft to DITASHA's existing Electron/Three.js editor. It does not bundle ArtCraft, its AI integrations, models, backend services, branding, or third-party artwork. The implementation is written for DITASHA and remains offline.

Design references: [ArtCraft README](https://github.com/storytold/artcraft), its [transform modes](https://github.com/storytold/artcraft/blob/main/frontend/libs/components/pagescene/src/lib/actions/setTransformMode.ts), [transform transactions](https://github.com/storytold/artcraft/blob/main/frontend/libs/components/pagescene/src/lib/engine/editor/actions/TransformAction.ts), and [canvas toolbar organization](https://github.com/storytold/artcraft/blob/main/frontend/libs/components/moodboard/src/lib/canvas/FloatingToolbar.tsx). No code or media from those files is copied into this implementation.

## Canvas Studio

Open a texture/image in **Texture & Model**. The **Canvas Studio** panel adds:

- Normal, multiply, screen, overlay, darken, lighten, and difference blending.
- **Mask · sembunyikan** and **Mask · pulihkan**. Paint with the current brush size; masks affect the composite without changing the source image. Undo/redo also restores masks. **Hapus mask** restores the original layer appearance.
- Layer locking, six alignment controls, optional 8-pixel snapping for drag movement (Alt bypasses snapping), and optional canvas layer selection. Existing rotation handles, crop, brush, eraser, opacity, duplication, and layer order remain usable.
- **Simpan proyek 2D** writes a JSON project containing all layer images, crop/transform data, masks, blend modes, visibility, and locks. **Buka proyek 2D** validates the document and opens it in a new tab, preserving the old workspace.

PNG/YTD exports use the composited result, including blends and masks. A canvas project contains the current 2D texture, not the original YTD dictionary or the loaded GTA model. Keep those source assets separately.

Canvas projects are limited to 64 layers, 64 MB of JSON, and 128 MB of decoded source/mask pixels combined. Individual images retain the 16-megapixel limit. PNG headers and project metadata are checked before decoding or changing the workspace.

## Scene Studio

Scene Studio appears in the existing Texture & Model, Model Viewer, Vehicle Workshop, and embedded Explorer model preview. It replaces the duplicate vehicle mesh transform panel while preserving vehicle export/project compatibility.

1. Open a model, choose a mesh from **Objek**, or click the mesh in the viewport.
2. Choose **Geser**, **Putar**, or **Skala**. Drag the gizmo or edit individual numeric axes. W/E/R work while the viewport has focus. Choose World/Local axes and enable optional translation/rotation/scale snapping.
3. Use **Undo 3D**, **Redo 3D**, **Reset objek**, or the visibility button. Non-uniform scaling is supported.
4. Adjust FOV, Neutral/Warm/Cool lighting, intensity, and background color. Add a PNG/JPG/WebP backdrop, then position it like another scene object.
5. **Simpan scene** saves transforms, visibility, camera, lighting, backdrops, and the current vehicle-workshop state where applicable. **Buka scene** requires the same source model, drawable/LOD and extra objects. Model files and textures stay separate; the project does not embed or generate new GTA resources.

Backdrops are limited to eight, downsampled to at most 2048 pixels on the longest edge, with at most 16 megapixels combined. Scene JSON is limited to 64 MB. Gizmos are omitted from snapshot PNG exports.

Preview transforms are not written back to native YDD/YFT rig, collision, or mesh data. The existing vehicle GLB export includes its transformed meshes; native debadge export retains its existing triangle-masking behavior. Scene projects preserve the currently rendered objects/LOD, so inspect them before exporting or using assets in-game.
