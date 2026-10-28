# Halfped UV and texture preview

The Texture & Model editor and File Manager preview repeat textures across integer UV tiles. Negative UV coordinates are valid and are preserved. The UV guide and 3D stamp projector translate whole triangles into the base atlas, including triangles crossing a tile boundary, without wrapping vertices individually or changing source geometry. UV-less meshes are skipped by the guide. Repeated UV ranges are bounded to 64 tiles per triangle.

A missing diffuse sampler is a separate asset issue. Compare the YDD sampler name with the names inside its companion YTD; renaming the external YTD alone does not rename an internal texture. Manual preview overrides do not repair exported assets. Correct the explicit reference or internal texture name on a copy and revalidate the resource before using it in game.

Validation for the supplied five-head example found five readable UV sets, three with negative coordinates, and one mismatched diffuse reference. A corrected copy of that model changed its reference from `daanujs` to the existing texture `5`; its geometry, UVs, embedded images and all supplied YTD bytes were preserved. User assets are not included in this repository. Five real pairs passed diffuse lookup and UV guide checks locally; in-game rendering remains untested.

Regression tests cover negative and positive tiles, repeated seams, invalid/range-limited UVs, mixed UV-less meshes, and pixel-equivalent 3D projection across negative tiles and both edges of the atlas.

## Brow and lash alpha (v1.46)

Native `ped_hair_cutout_alpha` and `ped_default_cutout` shaders now keep their cutout settings ahead of head/body texture-name heuristics in Texture & Model and File Manager. The same atlas can render skin as solid and brow/lash cards with texture alpha. Preview overrides remain explicit, reset restores shader defaults, and source pixels/export bytes are unchanged. A Windows GPU smoke test compares the same low-alpha head atlas on skin and hair-card shaders and checks manual override/reset.
