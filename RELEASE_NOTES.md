DITASHA Editor 1.7.0

- New GTA V Texture Viewer: YTD/DDS/images, searchable grid or list, thumbnail size, alpha backgrounds, exact original-size preview, zoom and selected/all PNG or RGBA DDS export.
- New GTA V Model Viewer: YFT/YDD/YDR static geometry, all available High/Medium/Low/Very-low LODs, drawable selection, individual model-part visibility, grid, wireframe, vertex points, geometry bounding boxes, camera presets and PNG snapshots.
- Read Legacy diffuse shader references and embedded textures. Match diffuse textures by name from embedded dictionaries or externally loaded YTD/images; add/remove external textures and show missing references.
- GTA V Explorer opens loose-file folders as well as RPF7/OIV/ZIP archives. Sort by name/type/size, browse folders, double-click files, inspect UTF-8 text or paged hex, and copy file names/relative paths.
- Dedicated Texture Viewer / Model Viewer buttons in Explorer. Same-name YTD files are loaded when opening folder/archive models. Local folders are read-only; original files stay unchanged.
- Create new OPEN RPF7 archives, including empty archives. Optional archive edit toggle. Nested stored RPF files are browsed through file slices rather than copying the entire archive.
- Canceled saves retain unsaved warnings. Existing editor, converter, clothing pack, donation and portable updater behavior retained.
- New format and production UI checks cover multiple LODs, diffuse references, embedded/external textures, part visibility, real WebGL rendering/PNG snapshots, folders, inspection and new archives.

Scope: GTA V Legacy only. These are independently implemented DITASHA features. The supplied OpenIV upload contains compiled binaries/configuration, no source files; OpenIV binaries, plugins and data are not bundled. No GTA IV, RDR or Max Payne support was added.

Remaining limits: AES/NG encrypted archives, Enhanced models, skeleton animation/skinning, bone/physics fragment transforms, collision editing, game shader fidelity and direct YFT/YDD/YDR mesh editing/export are unsupported. Complex vehicle fragments or skinned models can appear incomplete; geometry bounds are not game collision bounds. Only diffuse textures are mapped. Existing PNG/DDS/YTD texture formats and single-mip BGRA/RGBA export limits apply. Viewer/replacement inputs: 64 MB each, decoded texture data: 128 MB, model buffers: 2 million vertices / 6 million indices. Text/hex preview reads at most 1 MB; archive exports/extraction remain limited to 128 MB.

Copyright © 2026 Ditasha-Workshop.
