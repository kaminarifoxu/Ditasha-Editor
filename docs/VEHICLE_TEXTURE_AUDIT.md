# Vehicle texture audit — 2026-10-18

The six supplied base YFT/YTD pairs were read locally without rewriting source files. All 441 textures across the six YTDs decoded without entry warnings, including GT3RS's 653 MB decoded dictionary. Counts below refer to the default complete vehicle's highest available LOD; missing references are the union of parsed LODs/choices. This is a parser/material-source audit, not an in-game comparison.

| Model       | YTD textures | Decoded MB | Supported layer meshes | Missing references |
| ----------- | -----------: | ---------: | ---------------------: | -----------------: |
| sanchezpol  |           22 |          9 |                      2 |                 11 |
| polaleutian |           43 |         53 |                      4 |                  7 |
| nm_avent    |           34 |         24 |                      2 |                 11 |
| gt3rs       |          150 |        653 |                      2 |                  8 |
| gmcevp      |           63 |        233 |                      6 |                  3 |
| ss2rb(1)    |          129 |        233 |                      8 |                  3 |

## Confirmed app changes

- Polaleutian uses `vehicle_paint4` with `polaleutian_sign_1` in `DiffuseSampler2`. Four complete-vehicle meshes reference that layer. The previous paint3-only resolver ignored it. Paint4, paint4_enveff, paint4_emissive, paint5_enveff, paint6/enveff and paint7/enveff now resolve their supported second diffuse layer on UV2. Paint8/9 are not guessed because their primary UV layouts differ.
- Aventador's `avent_sign_1` is a 152×152 image whose alpha is zero at every pixel. A blank layer cannot display a livery. Preview diagnostics now identify fully transparent layers separately from missing maps.
- A shared YTD can be added to the session search library through **Auto texture repair → Tambah shared YTD**. Metadata is retained for subsequent vehicles; only required maps are decoded. A selected `vehshare.ytd` is preferred for known common GTA references when no model-owned source exists; model-owned and embedded choices remain protected, and ambiguous candidates remain explicit.
- Copied filenames such as `ss2rb_hi(1).yft` retain ownership of `ss2rb(1).ytd` without confusing them with `(2)` versions.

The four supplied high variants (SS2RB, GMCEVP, GT3RS, Aventador) also parsed with no warnings.

License-plate materials now resolve their actual `PlateBgSampler` on UV1 for the static plate background. Game-generated glyph/font composition remains outside this static preview.

## Real source dependencies

Missing references below are absent from the supplied paired YTD, not decode failures. For common GTA maps, add extracted `vehshare.ytd` / appropriate parent dictionaries from the user's game or asset pack. Other absent addon maps require their actual source dictionary; an unrelated normal/specular map is not substituted. Runtime render targets may have no static image until the game generates them. No missing pixels are manufactured and no game files are downloaded.

### sanchezpol

- Shared GTA / parent dictionary: `vehicle_generic_tyrewallblack`, `vehicle_generic_detail2`, `vehicle_generic_smallspecmap`, `vehicle_generic_carbon`, `vehicle_generic_sirens`.
- Game runtime screen: `script_rt_dials_sportbk`.
- Asset / parent dictionary: `black3`, `sportsbike_hd_detail`, `vermelho`, `laranja`, `blue_glass`.

### polaleutian

- Shared GTA / parent dictionary: `vehicle_generic_smallspecmap`, `vehicle_generic_detail2`, `vehicle_generic_glasswindows2`, `vehicle_generic_tyrewallblack`, `vehicle_generic_doorshut`, `plate01`.
- Asset / parent dictionary: `black`.

### nm_avent

- Shared GTA / parent dictionary: `vehicle_generic_smallspecmap`.
- Asset / parent dictionary: `black`, `decal_brakes`, `detail_emblem`, `plastic_detail`, `decal_bull`, `decal_lamborghini`, `decal_aventador`, `detail_decal`, `decal_lp`, `decal_emblem`.
- Fully transparent layer: `avent_sign_1`.

### gt3rs

- Asset / parent dictionary: `square`, `interior_d`, `badge_d`, `light_diff2`, `light_diff`, `antennachrome`, `blackplastic`, `rimlogo`.

### gmcevp

- Shared GTA / parent dictionary: `plate02`, `vehicle_generic_detail2`.
- Asset / parent dictionary: `lights_front_alfa_`.

### ss2rb(1)

- Asset / parent dictionary: `fer_badge_001_diff`, `fer_emblem_002_nrml2`, `488gtb_001_glos`.

## Repeating the audit

Run `node scripts/audit-vehicle-textures.mjs <folder> <model stems...>` on local files. It emits source SHA-256, metadata budgets, recognized layer references, transparent layers and categorized missing names. It does not modify input assets. The script uses the app parser and resolver and does not require Blender, network access or the uploaded assets in the repository.

Sampler/UV reference: https://github.com/Sollumz/szio/blob/main/src/szio/gta5/Shaders.xml. Layer composition reference: https://github.com/dexyfex/CodeWalker/blob/master/CodeWalker.Shaders/BasicPS.hlsl. DITASHA's implementation is original; no game textures, CodeWalker shader binaries or uploaded model assets are bundled.
