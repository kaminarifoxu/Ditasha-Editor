# M1b read-only Blender capability inspection. No asset is written.
# Use the same registered add-on lookup as native_bridge.py / engine_info().
import bpy
import json
import importlib

enabled = list(bpy.context.preferences.addons.keys())
sollumz = next((name for name in enabled
                if name.lower().split(".")[-1] in ("sollumz", "sollumz_dev")), None)

def has_operator(namespace, operator):
    try:
        return bool(getattr(getattr(bpy.ops, namespace), operator).get_rna_type())
    except (AttributeError, RuntimeError, TypeError):
        return False

importers = [
    extension for extension, available in (
        ("glb", has_operator("import_scene", "gltf")),
        ("obj", has_operator("wm", "obj_import")),
        ("fbx", has_operator("import_scene", "fbx")),
    ) if available
]
native = False
if sollumz:
    try:
        native = bool(importlib.import_module(
            sollumz + ".dependencies").IS_SZIO_NATIVE_AVAILABLE)
    except (ImportError, AttributeError):
        native = False

payload = {
    "schema": 1,
    "blenderVersion": list(bpy.app.version[:3]),
    "sollumzLoaded": bool(sollumz),
    "nativeProviderAvailable": native,
    "importers": importers,
}
print("DITASHA_PROP_PROBE=" + json.dumps(payload, separators=(",", ":")), flush=True)
