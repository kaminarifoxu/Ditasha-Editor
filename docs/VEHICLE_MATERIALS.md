# Vehicle material preview — v1.35

DITASHA now uses separate roles for supported native material inputs. The code is an original Three.js approximation informed by the public format/role definitions in CodeWalker and Sollumz, not an embedded copy of their renderers.

| Input                                   | Preview behavior                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| DiffuseSampler / supported livery       | Existing sRGB image and alpha/layer handling                                        |
| BumpSampler / PlateBgBumpSampler        | Linear RG normal data; reconstruct positive Z, invert green for Three tangent space |
| bumpiness                               | Normal XY strength, clamped 0–20                                                    |
| SpecSampler RGB + specMapIntMask        | Linear RGB dot mask controlling highlight strength; mask components clamped 0–1     |
| specularIntensityMult                   | Highlight intensity, clamped 0–8                                                    |
| SpecSampler alpha × specularFalloffMult | Blinn-Phong shininess, clamped 1–2048                                               |

Defaults when a parameter is absent are bumpiness 1, specular intensity 0.2, falloff 80, mask (1,0,0). These are preview defaults, not claimed game values. Runtime paint colours, environment reflection/cubemaps, all shader-specific variants, dirt/damage and full detail blending remain outside this implementation. Scene GLB export does not bake these custom shader channel conversions; this change targets on-screen previews and Photoshoot. Surface materials without source UV1 remain diagnosed rather than being mapped arbitrarily.

## Using the new lookup

Open the vehicle and paired YTD as usual. Available normal/specular maps now apply automatically. Selecting one of these maps for editing preserves the base diffuse, and pixel edits refresh its linear preview map. Open **Material & livery**, choose a mesh, and read each role's source/status. The bottom status also counts meshes with active normal/specular maps. Missing map names remain in the dependency report and participate in automatic repair.

If an asset pack has parent dictionaries, choose its texture folder under **Auto texture repair**. Include its YTDs and plain XML vehicles.meta / gtxd.meta (or gtxd.xml / exported gtxd.ymt.xml / vehicles.meta.xml). For example:

```xml
<CVehicleModelInfo__InitDataList>
  <txdRelationships>
    <Item><parent>shared_vehicle</parent><child>mycar</child></Item>
  </txdRelationships>
</CVehicleModelInfo__InitDataList>
```

With mycar.yft open, a missing map can resolve from shared_vehicle.ytd. A nearer parent wins before a farther parent or unrelated exact-name candidate. Same-family ownership and an explicit manual choice for unowned references retain their existing priority. Multiple matches within the chosen parent remain ambiguous. Parent relationships identify source dictionaries; the XML does not contain image pixels.

This path reads selected files only. It does not parse binary YMT relationships, scan the GTA installation automatically, decrypt RPFs, implement all GTA model/dictionary aliases, or download missing assets. Session sources are not persisted across app restarts.

## Supplied-file audit

Counts are unique references in the default vehicle's highest LOD. Normal totals include the supported plate background normal sampler, which earlier BumpSampler-only counts excluded.

| Model       | Available normal / referenced | Available specular / referenced | Meshes with parsed native parameters |
| ----------- | ----------------------------: | ------------------------------: | -----------------------------------: |
| GT3RS       |                       25 / 26 |                         23 / 26 |                                   70 |
| Aventador   |                         2 / 4 |                          5 / 12 |                                   29 |
| Sanchezpol  |                         1 / 4 |                          4 / 12 |                                   14 |
| GMCEVP      |                         3 / 6 |                         22 / 27 |                                   97 |
| Polaleutian |                        8 / 12 |                         10 / 15 |                                   29 |
| SS2RB       |                       34 / 37 |                         33 / 33 |                                   58 |

These are source/parameter audit results, not an actual-vehicle GPU screenshot comparison. Windows GPU regression fixtures separately verify the material pipeline and selected XML parent lookup. The original missing diffuse references and empty Aventador layer are documented in VEHICLE_TEXTURE_AUDIT.md.

## Primary implementation references

- https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/Resources/Drawable.cs
- https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Core/GameFiles/GameFileCache.cs
- https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker/Rendering/Renderable.cs
- https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Shaders/BasicPS.hlsl
- https://github.com/Sollumz/Sollumz/blob/main/ydr/shader_materials.py
