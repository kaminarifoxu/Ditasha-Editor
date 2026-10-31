# DITASHA Offline Freemode Morph Engine (Option B)

This implementation runs inside the Electron/Three.js Character Maker with **no FiveM process**.

## Implemented

- Non-destructive editable YDD mesh preview, with preserved original vertex positions.
- Morph target pipeline with 20 `feature:N` channels (`N` 0–19) and two base parent channels.
- Linear weighted blending of vertex deltas, normals and bounds recomputation.
- Strict same-topology validation: the mesh vertex count must match the morph pack.
- Import per-session JSON morph packs directly in Character Maker. Invalid packs show an error rather than falsely reporting success.
- If no calibrated morph pack is loaded, the UI offers the earlier *approximate* mesh deform preview, clearly labeled as such.

## Morph pack format

A morph pack is geometry-dependent and is **not** generated from a regular freemode YDD automatically. It must be calibrated or derived from genuine, topology-matched neutral / target meshes.

```json
{
  "version": 1,
  "vertexCount": 123,
  "targets": [
    { "key": "feature:0", "deltas": [0.0, 0.0, 0.0] },
    { "key": "parent:first", "deltas": [0.0, 0.0, 0.0] },
    { "key": "parent:second", "deltas": [0.0, 0.0, 0.0] }
  ]
}
```

All `deltas` must contain **3 × vertexCount** finite floating-point numbers, in the exact vertex order of the source YDD. The values shown above illustrate the format only; they are intentionally not usable for `vertexCount=123`.

## Not yet equal to GTA V

Rockstar's actual freemode head blend uses proprietary face shape data, inheritance rules and skin/material blending that ordinary YDD/YTD/YFT input does not provide. The current morph engine is functional but cannot reproduce the exact GTA head blend without calibrated morph targets, correct head topology, material/overlay layers, and a separately verified skin-blend implementation.

The save and JSON import/export pipelines preserve FiveM appearance values but **do not export mutated YDD meshes**. Photo Booth currently receives preset appearance metadata, and its renderer does not yet consume this morph pack for the actor.

No exact GTA visual fidelity is claimed before comparative visual testing.
