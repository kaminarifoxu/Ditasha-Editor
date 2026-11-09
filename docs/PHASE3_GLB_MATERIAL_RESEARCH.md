# Phase 3 Prop Creator — GLB to FiveM material fidelity research (2026-11-04)

## Reproduction from the user

The original GLB preview (`fredbear_plushie.glb`) showed multiple yellow, purple, black and other colored surfaces across six meshes. After export, DITASHA Texture & Model opened `fredbear.ydr` as an almost entirely white figure and opened `fredbear.ytd` with a single 4×4 white diffuse image. The native job had completed, which proves binary export/round-trip integrity **but not material fidelity**.

No original GLB was provided for a direct pixel-level or shader-node comparison. The likely material loss is independently visible in the previous `prop-native.py` implementation: for any source material without an image texture, the builder generated 4×4 white DDS pixels, ignoring the source Principled Base Color.

## External research

- [FiveM official asset tutorial](https://docs.fivem.net/docs/assets-manual/beginner-series/part-3/) explicitly calls for GTA-compatible shader materials, DDS maps, proper UV names, vertex colors and archetypes.
- [Sollumz Shader Setup](https://docs.sollumz.org/tutorials/creating-props/setting-up-sollumz-shaders) explains why base-color images need to be connected to `DiffuseSampler`, and why normal/specular textures require corresponding GTA shader parameters.
- [Khronos glTF Blender IO documentation](https://github.com/KhronosGroup/glTF-Blender-IO/blob/main/docs/blender_docs/scene_gltf2.rst) specifies that a glTF material may use a solid Principled Base Color **without an image**; an image may also be multiplied by a color factor. Both must survive conversion.
- [Blender color management](https://developer.blender.org/docs/features/render_pipeline/color_management/) distinguishes scene-linear float colors from sRGB bytes and highlights scene-linear float image buffers.
- [Sollumz UV issue #711](https://github.com/Sollumz/Sollumz/issues/711) documents earlier shader UV sampler mismatches, a separate fidelity risk when multiple UV maps are used.
- [Sollumz YTD documentation](https://github.com/Sollumz/wiki/blob/main/documentation/texture-dictionaries.md) explains YTD and embedded texture handling.
- [Reddit r/FiveM, SwisserDev converter post](https://www.reddit.com/r/FiveM/comments/1sccpzj/i_opensourced_a_cli_tool_that_converts_glb_files/) documents an alternative automated GLB→FiveM workflow; the [CLI repository](https://github.com/SwisserDev/swisser-convert) states that models are uploaded to a third-party cloud API, so it is not a local/private dependency and is not bundled into DITASHA.

## Changes on feature/phase3-creators

1. `electron/creators/prop_material.py` identifies simple glTF Principled Base Color factors, RGB colors, direct image textures, and constant color multiply chains; complex unsupported shader graphs fail with a clear error instead of substituting white.
2. `prop-native.py` converts solid colors into tinted generated diffuse DDS textures, and image textures into DDS with their material color factors. Shared images with different tints get distinct entries.
3. `prop_dds.py` applies scene-linear to sRGB conversion before quantizing RGB to 8-bit DDS and leaves alpha in linear 0..1.
4. `prop-build.cjs` stages the helper for external Blender execution and removes it from the finished resource.
5. Unit tests cover RGB solids, image+tint, unsupported nodes, isolated conversion, and regression compatibility.

## Out of scope / important limitations

This update targets **base-color parity**, not lossless GLB PBR reproduction. GTA V shader behavior is not identical to glTF metallic-roughness PBR; normal, metallic, roughness, specular, emissive, and advanced transparency/alpha materials require separate mapping, shader selection or explicit texture baking. Materials driven by procedural nodes should be baked in Blender instead of silently flattened. Multiple UV channels and texture-coordinate transforms require separate tests. Game lighting and vertex color shading also affect appearance.

## Acceptance plan

1. Export the original `fredbear_plushie.glb` again using the next Windows test build. Do not reuse previously white `fredbear.ytd`.
2. Open YTD and verify that its diffuse entries include the expected colored 4×4 palette (or larger image textures), not only one white texture.
3. Load the paired YDR and YTD simultaneously in Texture & Model, check that all six mesh materials refer to expected sampler names, and compare to GLB preview under similar lighting.
4. Check opacity, UV orientation, normals, collisions and in-game rendering in CodeWalker/FiveM.
5. If different, inspect the actual GLB material node graph, exported YDR/YTD and `native-report.json`; screenshots alone cannot establish exact binary or shader defects.

Do not merge to `main` until the real Blender/Sollumz conversion and FiveM appearance are verified.
