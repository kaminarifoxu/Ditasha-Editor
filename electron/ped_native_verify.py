"""Native ped verification for the existing Muto + Blender/Sollumz export.

Read-only checks against the output files, then a *separate* Sollumz import
round-trip of native YDD files. Never modify the user's original donor YFT.
The YFT can be signature-checked here, but ped YFT ragdoll physics is not
round-tripped by Sollumz and must not be represented as verified.
"""
from pathlib import Path
import hashlib
import math

MAX_COUNT = 128
MAX_BYTES = 256 * 1024 * 1024

def native_inventory(root):
    root = Path(root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Native ped output directory is missing")
    entries = {}
    for file in root.rglob("*"):
        if file.is_symlink():
            raise ValueError("Native ped output has an unsafe symlink")
        if not file.is_file():
            continue
        ext = file.suffix.lower()
        if ext not in (".ydd", ".ytd", ".yft"):
            continue
        if file.is_symlink() or not file.resolve().is_relative_to(root):
            raise ValueError("Native ped output has unsafe symlink")
        if sum(len(v) for v in entries.values()) >= MAX_COUNT:
            raise ValueError("Native ped inventory has too many files")
        stat = file.stat()
        if stat.st_size < 64 or stat.st_size > MAX_BYTES:
            raise ValueError("Native ped file size is invalid: " + file.name)
        with file.open("rb") as stream:
            header = stream.read(8)
        if header[:4] != b"RSC7" or int.from_bytes(header[4:8], "little") != 13:
            raise ValueError("Native ped is not GTA V Legacy RSC7: " + file.name)
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        entries.setdefault(ext, []).append({
            "name": file.name, "relativePath": file.relative_to(root).as_posix(),
            "bytes": stat.st_size, "sha256": digest,
        })
    for ext in (".ydd", ".ytd", ".yft"):
        if not entries.get(ext):
            raise ValueError("Ped export lacks native " + ext)
    return entries

def inspect_skin(meshes, expected_bones=None):
    """Strictly examine per-vertex weights for an imported native ped mesh."""
    count = 0
    geometry = 0
    weighted = 0
    uv = 0
    armatures = {}
    for obj in meshes:
        if obj.type != "MESH" or not len(obj.data.polygons):
            continue
        geometry += 1
        if not obj.data.uv_layers:
            raise ValueError("Native YDD lost UV maps: " + obj.name)
        uv += 1
        arm = obj.find_armature()
        if arm is None:
            parent = obj.parent
            while parent is not None:
                if parent.type == "ARMATURE":
                    arm = parent
                    break
                parent = parent.parent
        if arm is None or not len(arm.data.bones):
            raise ValueError("Native YDD imported without a usable skeleton: " + obj.name)
        armatures[arm.name] = arm
        bone_names = {bone.name for bone in arm.data.bones}
        if expected_bones and not expected_bones.issubset(bone_names):
            raise ValueError("Native YDD lost expected original skeleton bones")
        groups = {grp.index: grp.name for grp in obj.vertex_groups}
        for vertex in obj.data.vertices:
            count += 1
            influences = [g.weight for g in vertex.groups if groups.get(g.group) in bone_names]
            if not influences or any(not math.isfinite(w) or w < 0 or w > 1.001 for w in influences):
                raise ValueError("Invalid or missing native ped vertex skin weights")
            positive = [w for w in influences if w > 1e-6]
            if not positive or len(positive) > 4 or abs(sum(positive) - 1.0) > 0.03:
                raise ValueError("Native ped vertex weights exceed 4 influences or are not normalized")
            weighted += 1
            if count > 1500000:
                raise ValueError("Ped skin verification exceeds vertex safety limit")
    if not geometry or weighted == 0:
        raise ValueError("No usable skinned native ped meshes")
    if len(armatures) != 1:
        raise ValueError("Native YDD has ambiguous or multiple skeletons")
    arm = next(iter(armatures.values()))
    head = next((bone for bone in arm.data.bones if bone.name.lower() in
                 ("skel_head", "head")), None)
    if head is None:
        raise ValueError("Native ped lacks SKEL_Head")
    location = arm.matrix_world @ head.matrix_local
    if any(not math.isfinite(float(v)) for v in location.translation):
        raise ValueError("Native ped has invalid head bone transform")
    return {"meshes": geometry, "vertices": count, "weightedVertices": weighted,
            "uvMeshes": uv, "bones": len(arm.data.bones),
            "headBone": head.name,
            "headLocation": [float(v) for v in location.translation]}

def verify_native_ped(bpy, output, source_bones=None):
    """Reimport native YDD from an empty scene to rule out false rig matches.

    This runs after preview creation and after the correction .blend was saved.
    Every YDD is reimported independently; never lend it a source-scene rig.
    """
    inventory = native_inventory(output)
    before = set(source_bones or ())
    if not before or "SKEL_Head" not in before:
        raise ValueError("Muto source GTA skeleton is missing required SKEL_Head")
    reports = []
    for entry in inventory[".ydd"]:
        for obj in list(bpy.data.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        source = Path(output) / entry["relativePath"]
        result = bpy.ops.sollumz.import_assets(
            directory=str(source.parent), files=[{"name": source.name}],
            use_custom_settings=True, split_by_group=True,
            dwd_import_external_skeleton="FROM_DIR", textures_mode="PACK",
        )
        if "FINISHED" not in result:
            raise ValueError("Sollumz failed to reimport exported YDD: " + entry["name"])
        imported = [obj for obj in bpy.data.objects if obj.type == "MESH"]
        current = inspect_skin(imported, before)
        current["filename"] = entry["relativePath"]
        reports.append(current)
    return {"schema": 1, "nativeYddRoundTrip": True,
            "nativeYftSignatureVerified": True, "nativeYftRagdollRoundTrip": False,
            "sourceSkeletonMatched": True,
            "rigs": reports, "files": inventory, "gameTestPassed": None}
