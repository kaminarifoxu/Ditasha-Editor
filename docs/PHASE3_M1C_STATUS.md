# DITASHA Editor Phase 3 — M1c Native Prop Export

Status: **experimental native implementation, automated code tests, NOT a certified FiveM runtime exporter**.

## Source modules

- `electron/creators/prop-native.py`: Blender 5.2 / Sollumz 2.9 / PyMateria worker. Imports GLB/OBJ/FBX, builds Sollumz Drawable and a basic default-shader YTD, constructs box or convex YBN collision, attaches a YTYP base archetype, uses the native Legacy exporter and then reimports the native files. Invalid or incomplete exports fail; the source asset is never saved over.
- `electron/creators/prop-build.cjs`: trusted-token-only native runner, pinned managed Blender, isolated same-volume staging, cryptographic checks, RSC7 checks and no-overwrite atomic resource directory commit. Builds `fxmanifest.lua`, `validation.json` and a binary-build report.
- `electron/creators/creator-ipc.cjs`: status/cancel/read-only job result channels and OS-dialog permission tokens; native creator remains **disabled by default**.
- `src/creators/prop-preview.js`: adds export controls only when experimental native mode is explicitly enabled; normal UI layout unchanged.
- `tests/prop-m1c.test.cjs`: Windows CI exercises Python syntax, native job argument routing, mocked binary reports, invalid signatures, missing reports, staging cleanup and source-preservation. **Mock tests are not evidence of real Sollumz or game behavior.**
- `scripts/smoke-prop-native.cjs`: Windows-only, explicit opt-in smoke against an installed managed Blender/Sollumz/PyMateria runtime, with a generated box OBJ fixture.

## Output layout

```text
ditasha_prop-ditasha-<unique>/
  fxmanifest.lua
  validation.json
  native-report.json
  stream/
    ditasha_prop.ydr
    ditasha_prop.ytd
    ditasha_prop.ytyp
    ditasha_prop_col.ybn
```

Collision filename uses `_col` to avoid Blender object-name conflict with the main Drawable. The YTYP physics dictionary references that name. Collision mode `none` omits YBN. `authored` mode is currently rejected.

## Opt-in experimental use

Launch the **development version only** with environment variable `DITASHA_EXPERIMENTAL_PROP_NATIVE=1`. The existing inspector displays a Prop preview and native export section. Select a source file and an output directory through the OS file picker; choose resource name, collision mode and draw distance; click Build. The worker reports failures without replacing previous exports.

For a controlled Windows binary smoke:

```powershell
node scripts/smoke-prop-native.cjs "C:\\Users\\YOUR_USER\\AppData\\Roaming\\DITASHA-Editor\\native-tools" "C:\\Temp\\ditasha-prop-smoke"
```

The first argument must point to the actual managed native runtime containing `ready.json`; the example location is illustrative and must be replaced with the real path. Do not use the test runner without explicitly accepting that it launches an installed local Blender process.

## Guardrails and real validation required

- A native export is only marked successful after the worker confirms every required YDR/YTD/YBN/YTYP resource has an RSC7 signature and Sollumz can reimport the files. **This condition has not been exercised against the actual pinned Windows PyMateria runtime in this environment.** Only the logic was exercised using mock files.
- A valid RSC7 header and successful Blender reimport do not certify rendering/collision in FiveM. Every target resource still requires an in-game spawn, material, collider, draw-distance and resource-restart test.
- The simple shader path supports one diffuse image per material; complex PBR, transparency, animated textures and unsupported multimap materials must be edited in Blender. Generated LOD guides and pivot guides in the UI are visual-only and not serialized to native LODs or pivots.
- Generated box/convex collision is a candidate approximation, not an in-game physics guarantee.
- Use only Windows managed Blender 5.2.2 with the pinned Sollumz 2.9.0 and PyMateria provider. Do not silently use a different binary or unverified external converter.
- Missing provider, malformed job, missing artifact, failed reimport, checksum mismatch or cancellation must leave no committed resource. Staging is removed by scoped cleanup.
- The existing `main` branch and normal interface are unaffected. Do not merge until the real Windows smoke, EXE packaging and FiveM runtime tests pass.

## Windows validation checklist

1. Run `npm ci`, `npm test`, `npm run build:ui` through GitHub Actions on Windows.
2. Perform `npm run build:win` and launch both portable and installer builds. This step is **not** performed by the ordinary Clothing Library V2 check workflow.
3. On an actual Windows PC with installed managed provider, run the synthetic cube smoke; inspect `validation.json` and verify the exported YDR/YTD/YBN/YTYP with CodeWalker.
4. Spawn the prop in a dedicated FiveM Legacy server. Check visuals, texture dictionary, YTYP registration and physics. Stop/restart resource and verify cleanup.
5. Repeat with textured multi-material GLB and one complex OBJ/FBX. Unsupported materials should fail clearly; do not replace missing textures with black.
