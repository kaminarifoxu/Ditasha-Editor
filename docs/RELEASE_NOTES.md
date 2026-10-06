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
