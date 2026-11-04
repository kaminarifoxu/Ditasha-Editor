"""DITASHA M2c: strict native weapon-source proof (Blender + Sollumz 2.9).

Accepts only a paired native GTA Legacy reference weapon .ydr/.ytd.
Does not convert an arbitrary GLB to a firearm or write to the source folder.
Checks named skeleton anchor positions, exports a disposable copy with the
managed Sollumz native writer, and reimports it to verify the same anchors.
"""
import bpy
import hashlib
import json
import math
import sys
import traceback
from pathlib import Path

ATTACHMENT_NAMES = {
    "muzzle": ("WAPSupp", "Gun_Muzzle", "Muzzle", "WAPMuzzle"),
    "magazine": ("WAPClip", "Gun_Magazine", "Magazine", "Clip"),
    "grip": ("WAPGrip", "Gun_Grip", "Grip", "Gun_Grip_IK"),
}
OPTIONAL_NAMES = {
    "optic": ("WAPScop", "Scope", "WAPScope"),
    "flashlight": ("WAPFlshLasr", "WAPFlsh", "Flashlight"),
    "suppressor": ("WAPSupp", "Suppressor"),
}

def digest(file):
    h = hashlib.sha256()
    with file.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def import_native(folder, names):
    result = bpy.ops.sollumz.import_assets(
        directory=str(folder), files=[{"name": n} for n in names],
        use_custom_settings=True, split_by_group=True, textures_mode="PACK"
    )
    if "FINISHED" not in result:
        raise RuntimeError("Sollumz could not import source YDR/YTD")

def inspect(reference):
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and len(o.data.polygons)]
    armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE" and len(o.data.bones)]
    if not meshes:
        raise RuntimeError("Imported native weapon contains no usable geometry")
    if not armatures:
        raise RuntimeError(
            "Weapon skeleton not found. M2c requires a real rigged native YDR donor; "
            "a visual GLB or unrigged prop is not a working GTA weapon"
        )
    all_bones = {}
    for obj in armatures:
        for bone in obj.data.bones:
            key = bone.name.lower()
            if key in all_bones:
                raise RuntimeError("Duplicate weapon bone name: " + bone.name)
            xyz = (obj.matrix_world @ bone.matrix_local).translation
            values = [float(v) for v in xyz]
            if not all(math.isfinite(v) and abs(v) < 10000 for v in values):
                raise RuntimeError("Invalid weapon bone transform: " + bone.name)
            all_bones[key] = {"name": bone.name, "position": values}
    anchors = {}
    for kind, candidates in ATTACHMENT_NAMES.items():
        found = [all_bones[name.lower()] for name in candidates if name.lower() in all_bones]
        if not found:
            raise RuntimeError(
                "Native weapon missing %s bone (%s); "
                "cannot verify grip/muzzle/magazine alignment"
                % (kind, ", ".join(candidates))
            )
        anchors[kind] = found[0]
    optional = {}
    for kind, candidates in OPTIONAL_NAMES.items():
        found = [all_bones[name.lower()] for name in candidates if name.lower() in all_bones]
        if found:
            optional[kind] = found[0]
    # Ensure reported anchors are not all at the same position.
    positions = [anchor["position"] for anchor in anchors.values()]
    for i in range(len(positions)):
        for j in range(i + 1, len(positions)):
            if sum((positions[i][k]-positions[j][k])**2 for k in range(3)) < 1e-10:
                raise RuntimeError("Weapon attachment anchor locations overlap unexpectedly")
    tex_count = sum(
        len(dictionary.textures)
        for dictionary in bpy.context.scene.sz_txds.texture_dictionaries
    )
    if tex_count < 1:
        raise RuntimeError("Weapon YTD contains no imported texture entries")
    return {"meshes": len(meshes), "boneCount": len(all_bones), "anchors": anchors,
            "optional": optional, "textureCount": tex_count, "boneNames": sorted(b["name"] for b in all_bones.values())[:256]}

def inspect_round_trip(path, before):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.sz_txds.texture_dictionaries.clear()
    names = [file.name for file in path.iterdir() if file.suffix.lower() in (".ydr",".ytd")]
    import_native(path, names)
    after = inspect(None)
    if after["boneCount"] != before["boneCount"]:
        raise RuntimeError("Weapon skeleton bone count changed during Sollumz round-trip")
    for kind, original in before["anchors"].items():
        current = after["anchors"][kind]
        if current["name"].lower() != original["name"].lower():
            raise RuntimeError("Weapon %s bone name changed on native round-trip" % kind)
        if math.dist(current["position"], original["position"]) > 0.002:
            raise RuntimeError("Weapon %s bone position drift exceeded 2 mm" % kind)
    if after["textureCount"] < 1:
        raise RuntimeError("Weapon YTD lost its textures after native round-trip")
    return after

def main():
    if "--" not in sys.argv:
        raise RuntimeError("Missing weapon job argument")
    job_path = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
    job = json.loads(job_path.read_text(encoding="utf-8"))
    if job.get("schema") != 1 or job.get("edition") != "legacy":
        raise RuntimeError("Unsupported native weapon job")
    source = Path(job["source"]).resolve()
    name = job["referenceModel"]
    if not isinstance(name, str) or not name.startswith("w_") or "/" in name or "\\" in name:
        raise RuntimeError("Invalid weapon reference model")
    native_files = [name + ".ydr", name + ".ytd"]
    for filename in native_files:
        if not (source / filename).is_file():
            raise RuntimeError("Missing native donor file " + filename)
    installed = list(bpy.context.preferences.addons.keys())
    if not any(item.lower().split(".")[-1] in ("sollumz", "sollumz_dev") for item in installed):
        raise RuntimeError("Managed Sollumz addon is not active")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    import_native(source, native_files)
    before = inspect(name)
    scratch = job_path.parent / "native-roundtrip"
    scratch.mkdir(exist_ok=False)
    exported = bpy.ops.sollumz.export_assets(
        directory=str(scratch), direct_export=True, use_custom_settings=True,
        target_formats={"NATIVE"}, target_versions={"GEN8"},
        limit_to_selected=False, export_ytyps=False, export_ytds=True,
        export_ytds_include="ALL", apply_transforms=False, mesh_domain="FACE_CORNER",
    )
    if "FINISHED" not in exported:
        raise RuntimeError("Sollumz native weapon export failed")
    artifacts = []
    for filename in native_files:
        file = scratch / filename
        if not file.is_file() or file.stat().st_size < 64:
            raise RuntimeError("Native weapon round-trip export missing " + filename)
        if file.read_bytes()[:4] != b"RSC7":
            raise RuntimeError("Native weapon round-trip has invalid RSC7 signature")
        artifacts.append({"name": filename, "bytes": file.stat().st_size, "sha256": digest(file)})
    after = inspect_round_trip(scratch, before)
    report = {
        "schema": 1, "ok": True, "nativeRoundTrip": True,
        "sourceModel": name, "before": before, "after": after, "artifacts": artifacts,
        "gameTestPassed": None,
    }
    (job_path.parent / "weapon-native-report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print("DITASHA_WEAPON_NATIVE_OK", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(2)
