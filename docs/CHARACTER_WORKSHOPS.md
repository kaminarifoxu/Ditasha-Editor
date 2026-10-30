# Character and weapon workshops

## Persistent emotes

Photo Booth automatically stores successfully imported YCD/animated GLB sources in a local emote library and restores the catalog when Photo Booth opens in a later app session. Decoded animation tracks still use the bounded playback cache. Source files are stored as transactional 2 MB byte chunks with SHA-256 identities; duplicates are skipped. A failed local save is reported without discarding the active imported animation. Maximum: 2,000 files / 512 MB, 64 MB per file.

Import individual files, a folder, or a ZIP such as an RPEmotes resource. Only YCD/GLB sources are extracted; Lua is not evaluated and a Lua animation-name list cannot supply missing animations. `Simpan semua emote aktif` also saves emotes currently loaded from scene presets. `Kosongkan booth` resets the scene/session without deleting the saved emote library; restore through `Muat emote tersimpan`. Deleting the saved library requires its own confirmation. App data cleanup/uninstall options that remove user data also remove this library.

## Freemode characters in Photo Booth

Use **+ Karakter freemode → Folder komponen freemode**. Import an exported local GTA/FiveM folder with head/hair/body YDDs and matching YTDs, plus the freemode YFT when available. Choose male/female, a head, hair, texture dictionaries and optional body/outfit parts. Add the assembled character as **one actor** to a group photo, then choose its emote. Save the result through the existing scene/outfit library to retain the selected model sources.

Appearance JSON from illenium/fivem-appearance can select matching component drawable/texture numbers from the imported folder. Missing components require choosing the corresponding local model. Parent head blending, the game's facial sliders and head overlays are not reproduced offline; the UI states this. The app does not bundle Rockstar's complete model/texture library or infer missing skin textures. Original model UVs are retained.

## Halfped / head and separate hair

Open **Auto rig ped → Kepala / halfped & rambut**. Export a head, eyes/teeth as needed, and optional separate hair from Sims 4 Studio/Blender as GLB/FBX/OBJ or a Blender project. Import **head meshes only**; native Sims `.package` files and full-character automatic head segmentation are not supported.

Fit the head to the male/female reference, or keep its prepared placement. Adjust scale, rotation and offsets. Surface transfer interpolates up to four weights per vertex from the GTA reference head, including its available facial bones; the rigid option binds to `SKEL_Head`. Check head/jaw pose, other diagnostic poses and the walk preview. A nearest-surface transfer cannot guarantee correct expressions for every stylized face. Correct mouth, eyelids, eyes and neck seams in the included Blender project as needed.

Separate hair receives the head transform and optional hair offset/scale. It follows `SKEL_Head`; native hair uses a cutout shader. Hat squash bones, physics and automatic hat compatibility are not generated.

The installed Muto engine supplies the default weight reference. Its NPZ reference does not include original freemode UVs. To export an **actual freemode UV reference SVG**, choose a `.blend` containing one GTA armature and a weighted mesh named `head` with its original UV layer. Source head UV SVG is exported when present; the head's UVs are preserved, not replaced with a guessed freemode layout.

Output: skinned GLB, editable packed Blender project and available UV SVGs. Optional native YDDs replace the specified **existing** head/hair slots with embedded diffuse textures. Set the collection prefix and slot names to match the server's existing collection/YMT/halfped configuration. This does not register arbitrary new slots or modify illenium server files. Each YDD is reimported to validate UVs, textures and normalized skin weights before success. Test the final head, hair and expressions on the target FiveM server.

## Weapon design

AddonWeaponsBuilder now has settings, a large viewport and export columns like Logo Prop 3D. Import GLB/OBJ or native YDR/YDD with matching YTDs. Add GLB/model parts, position/rotate/scale them with the gizmo, choose a mesh, change color or add a PNG UV texture, adjust its UV placement and export the assembled textured GLB. Export the selected mesh UV layout or texture as PNG.

The reference picker lists common FiveM/GTA model names such as Pistol, Combat/AP Pistol, SMG and Carbine/Assault Rifle. Authentic game models must come from local files. The three included generic design blockouts are original sketches, not copies of those GTA models. Native import is a visual design conversion; do not expect an imported native weapon skeleton to survive through this static design route.

Game-ready weapon bones, magazine/muzzle positions, animations and metadata require Blender/Sollumz preparation. The existing DLC builder remains under the export panel for sources already prepared as GTA weapon assets; it does not convert arbitrary raw GLB into a functional game weapon.

## Implementation references

- [Sollumz: streamed ped components and separate YFT skeletons](https://docs.sollumz.org/tutorials/basic-clothes-editing).
- [Muto Ped Rig v0.3.2](https://github.com/B7Kompirine/muto-ped-rig/tree/v0.3.2): pinned local reference skeleton/body weights; head and facial transfer are reviewed against the installed data.
- [illenium-appearance](https://github.com/iLLeniumStudios/illenium-appearance): component/hair/head appearance structure; this offline editor does not execute its FiveM natives.

Tests use synthetic meshes/animation resources and the separately installed engine reference. Uploaded emote/head artwork is not committed or redistributed. The previously supplied RPEmotes pack was also checked privately for ZIP import and preservation across a complete local browser restart.
