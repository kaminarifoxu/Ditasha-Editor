# M1b read-only Blender capability inspection. No asset is written.
import bpy, json
names = {addon.__name__ for addon in bpy.context.preferences.addons}
ops = bpy.ops
payload = {
  "schema": 1,
  "blenderVersion": list(bpy.app.version[:3]),
  "sollumzLoaded": any("sollumz" in name.lower() for name in names),
  "importers": [
    ext for ext, present in [
      ("glb", hasattr(ops.import_scene, "gltf")),
      ("obj", hasattr(ops.wm, "obj_import")),
      ("fbx", hasattr(ops.import_scene, "fbx")),
    ] if present
  ],
}
print("DITASHA_PROP_PROBE=" + json.dumps(payload, separators=(",", ":")))
