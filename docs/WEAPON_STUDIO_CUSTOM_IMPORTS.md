# Weapon Studio — Custom Model & Native Weapon Workflow

This is the **Weapon Studio** workspace in DITASHA Editor. The navigation label replaces **AddonWeaponsBuilder** while retaining the existing AddonWeaponsBuilder engine under Weapon Studio's **Build DLC** tools.

## Import choices

| Button | Files | Behavior |
| --- | --- | --- |
| + Custom weapon (GLB / OBJ) | GLB, OBJ (or YDR/YDD with YTD) | Replaces the current editable 3D weapon design, after checking unsaved work |
| + Add prop / GLB / YDR part | GLB, OBJ, YDR, YDD; optionally matching YTD | Adds a separate editable 3D part to the existing model (e.g., optic, barrel or grip cosmetic) |
| + Import YDR + YTD weapon | Matching YDR/YDD + YTD selected together | Imports an existing GTA model and its textures for preview and visual design |
| + PNG texture / UV | PNG/JPG/WebP | Replaces the selected preview material texture |
| Save GLB | GLB | Saves the combined *editable visual design*, including its added parts and positions |

3D part transformations (move, rotate, resize) and textures apply to the **visual assembly**, not directly to the source GTA YDR/YTD. The existing importer keeps original files unchanged and the GLB save retains the edited design.

## Native weapon export limitations

The **Native GTA / FiveM weapon build (M2c)** still requires an existing supported, rigged GTA V Legacy weapon donor folder containing paired original native YDR and YTD files. Its Blender/Sollumz verifier checks named native bones and attachment positions; AddonWeaponsBuilder packages verified GTA input. It **does not automatically graft edited GLB/prop parts from the Weapon Studio viewport into the native donor YDR**, nor create an automatically rigged GTA firearm from a plain GLB.

Likewise, an RPF-only GTA weapon DLC is not a ready-to-run FiveM resource. A FiveM resource is offered only when complete loose stream resources and metadata are verified; real FiveM firing, reloading and attachments require a separate in-game test.

## Stability policy

The project owner approved Prop & Collision Creator and explicitly instructed not to change its code or UI without a new request. This Weapon Studio update does **not** change the Prop & Collision Creator implementation or interface. Work remains on `feature/phase3-creators`, with no merge to `main`.
