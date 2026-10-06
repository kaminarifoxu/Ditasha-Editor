DITASHA Editor 1.12.0

- Apply PNG placed on the 3D surface to a real texture layer through UV projection, including separated UV islands. Resize, rotate and adjust opacity before applying; Undo/Redo and YTD export use the resulting texture.
- Transform rigid model parts by their hierarchical skeleton binding, correcting bone-local positions in vehicle wheels/mirrors. Static preview still does not emulate all GTA shaders or animated skinning.
- Add seam/orientation/back-face projection tests, skeleton hierarchy validation, and browser/Windows checks for baking and undo/redo.

DITASHA Editor 1.11.0

- Decode vehicle YTD A8 (0x1c), L8, A8L8 and XRGB formats with row-stride and buffer validation.
- Add multiple model imports and independent extra/livery YFT visibility/removal. Keep variants hidden until selected. Expose individual mesh controls within each Part.
- Retain secondary diffuse sampler references and UV2, and add per-mesh texture/UV assignment for static material preview. Inspect YFT physics child drawables separately with inherited shader bindings.
- Add PNG 3D surface stickers to Texture & Model with click placement, size, rotation, opacity and removal. Include decals in snapshots and Photoshoot without modifying the 2D texture. Decals are preview-only and are not baked into YTD.
- Validate synthetic vehicle resources and native renderer workflows, actual decal pixels, Photoshoot inclusion, invalid-file retention and portable update/restart. Specific user vehicle packs still require their original YFT/YTD files for verification; full GTA paint/glass/damage rendering and automatic bone attachment are not included.

Copyright © 2026 Ditasha-Workshop. Uicons by Flaticon.
