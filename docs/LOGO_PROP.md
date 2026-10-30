# Logo → Prop 3D

Open **Asset workshop → Logo → Prop 3D** (also available from Home), then import a PNG, JPG or WebP. A transparent PNG is the best source. The original image is never overwritten.

Choose **Logo timbul** for a real silhouette extrusion, including enclosed holes and separate letter shapes, or **Papan persegi** for a rectangular sign. Set width in meters, thickness in centimeters, side/board color and detail. Drag the 3D preview to orbit; scroll to zoom. Both settings/export panels can minimize through the shared panel controls.

Background modes:

- **Pertahankan alpha asli:** keep the image's existing transparency.
- **Hapus warna dari tepi:** flood-fill the selected color connected to image edges; enclosed matching colors are retained.
- **Hapus warna di seluruh gambar:** remove that color anywhere, including enclosed letter backgrounds.

Click the image to sample the background color, then adjust tolerance and alpha threshold. This is flat-color removal, not semantic subject detection. The board composites transparent areas over the chosen board color. Tiny specks below two working-grid cells are excluded. Higher detail helps fine text, but cannot recover detail missing from the source.

## Export

Processed PNG and textured GLB export locally without Blender. Native GTA export uses the existing DITASHA **Windows Blender + Sollumz** engine. Choose an installed Blender configured with Sollumz's native provider, or explicitly press **Siapkan engine otomatis**. Automatic setup downloads the verified dependencies; it is not required for the live preview or PNG/GLB exports.

**Ekspor GTA / FiveM** asks for a destination and creates a new unique build directory. The `output` directory contains native `stream/<model>.ydr`, `stream/<model>_props.ytyp`, embedded diffuse/edge textures, `fxmanifest.lua`, `preview.lua`, an editable `ditasha-logo.blend`, source PNG and report. Source files remain untouched. Every native YDR is reimported to check geometry, UVs and embedded image availability before success is reported.

Copy the output folder into FiveM resources and `ensure` its folder name. The local command `/<model>_spawn` places one frozen test prop in front of the player; repeating replaces it, and stopping the resource deletes it. For permanent placement use the registered archetype in CodeWalker/YMAP or an existing MLO. In-game appearance and placement still require testing on the target server.

This generates decorative static props without collision. It does not generate MLO rooms/portals, reconstruct a sculpted object from a photograph, convert lettering to editable text, or infer depth within the artwork. Both cap faces use the image; side walls use the selected solid color. The native export uses GTA's default diffuse shader and silhouette geometry; semi-transparent artwork is not a glass/translucency workflow.

## Limits and checks

Input: 16 MB, 8192 pixels per side and 16 megapixels. Working texture: at most 2048 × 2048. Silhouette: up to 256 × 256, 512 loops, 16,000 contour points and 60,000 triangles. Width/height are bounded to 20 m, depth to 0.001–1 m. Highly noisy images should be cleaned or processed at lower detail. Source artwork and export settings remain in the workspace when switching pages, with an unsaved-change guard on image replacement and app close.

Tests cover color-connected removal, preservation of source pixels, holes via raycasts, separate islands, board geometry, UV orientation, IPC payload limits, actual UI import and PNG/GLB exports. Windows native checks export and reimport YDR/YTYP, verify embedded images and raycast through the resulting hole. Synthetic fixtures contain no uploaded artwork.
