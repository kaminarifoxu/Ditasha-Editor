"""DITASHA M1c isolated native prop export worker.
Must run inside the pinned, locally installed Blender 5.2 + Sollumz 2.9.
Never downloads dependencies, never writes back to the imported source.
All success claims require binary-file and reimport checks.
"""
import hashlib
import importlib
import json
import math
import sys
import traceback
from pathlib import Path

def _sha256(file):
    h = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def _check(result, stage):
    if "FINISHED" not in result:
        raise RuntimeError(stage + " did not finish")

def _import_source(bpy, source):
    if source.suffix.lower() == ".glb":
        _check(bpy.ops.import_scene.gltf(filepath=str(source)), "GLB import")
    elif source.suffix.lower() == ".fbx":
        _check(bpy.ops.import_scene.fbx(filepath=str(source), use_anim=False), "FBX import")
    elif source.suffix.lower() == ".obj":
        _check(bpy.ops.wm.obj_import(filepath=str(source)), "OBJ import")
    else:
        raise ValueError("Unsupported source format")
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and len(o.data.polygons)]
    if not meshes or len(meshes) > 256:
        raise ValueError("Source must contain 1..256 nonempty mesh objects")
    count = sum(len(o.data.polygons) for o in meshes)
    if count > 500_000:
        raise ValueError("Prop polygon limit exceeded")
    for obj in meshes:
        for v in obj.data.vertices:
            if not all(math.isfinite(c) and abs(c) < 100_000 for c in v.co):
                raise ValueError("Invalid mesh vertex")
    return meshes

def _import_addon():
    import bpy
    enabled = [name for name in bpy.context.preferences.addons.keys() if name.lower().endswith(".sollumz") or name.lower() == "sollumz"]
    if len(enabled) != 1:
        raise RuntimeError("Pinned Sollumz addon must be enabled exactly once")
    module = enabled[0]
    deps = importlib.import_module(module + ".dependencies")
    if not deps.IS_SZIO_NATIVE_AVAILABLE:
        raise RuntimeError("Windows PyMateria native binary provider missing")
    return module

def _shader_and_textures(bpy, mod, meshes, name):
    shader = importlib.import_module(mod + ".ydr.shader_materials").create_shader
    txd = bpy.context.scene.sz_txds.new_texture_dictionary(name=name)
    images = {}
    for obj in meshes:
        for slot in obj.material_slots:
            old = slot.material
            image = None
            if old and old.node_tree:
                candidates = [n.image for n in old.node_tree.nodes if n.type == "TEX_IMAGE" and n.image]
                if len(candidates) > 1:
                    raise ValueError("Multiple material image maps need manual shader conversion")
                if candidates:
                    image = candidates[0]
            if image is None:
                image = images.get("_generated_white")
                if image is None:
                    image = bpy.data.images.new(name + "_white", width=4, height=4, alpha=True)
                    image.pixels = [1.0, 1.0, 1.0, 1.0] * 16
                    image.pack()
                    images["_generated_white"] = image
            if image.size[0] <= 0 or image.size[1] <= 0 or image.size[0] > 8192 or image.size[1] > 8192:
                raise ValueError("Invalid diffuse texture dimensions")
            if image.name not in images:
                image.pack()
                images[image.name] = image
            material = shader("default.sps")
            diffuse_nodes = [n for n in material.node_tree.nodes if n.type == "TEX_IMAGE" and n.name == "DiffuseSampler"]
            if len(diffuse_nodes) != 1:
                raise RuntimeError("Sollumz default shader no longer exposes DiffuseSampler")
            diffuse_nodes[0].image = image
            slot.material = material
        if not obj.material_slots:
            # A source without material receives a simple compatible diffuse shader.
            material = shader("default.sps")
            image = images.get("_generated_white")
            if image is None:
                image = bpy.data.images.new(name + "_white", width=4, height=4, alpha=True)
                image.pixels = [1.0, 1.0, 1.0, 1.0] * 16
                image.pack()
                images["_generated_white"] = image
            nodes = [n for n in material.node_tree.nodes if n.type == "TEX_IMAGE" and n.name == "DiffuseSampler"]
            if len(nodes) != 1:
                raise RuntimeError("Sollumz shader diffuse node missing")
            nodes[0].image = image
            obj.data.materials.append(material)
    meshhelper = importlib.import_module(mod + ".tools.meshhelper")
    for obj in meshes:
        meshhelper.mesh_rename_uv_maps_by_order(obj.data)
        meshhelper.mesh_add_missing_uv_maps(obj.data)
        meshhelper.mesh_rename_color_attrs_by_order(obj.data)
        meshhelper.mesh_add_missing_color_attrs(obj.data)
    for image in dict.fromkeys(images.values()):
        if image.size[0] < 1 or image.size[1] < 1:
            raise ValueError("Invalid image")
        txd.new_texture(image)
    if not txd.textures:
        raise ValueError("YTD has no textures")
    return txd

def _make_collision(bpy, mod, meshes, project, mode):
    if mode == "none":
        return None
    if mode == "authored":
        raise ValueError("Authored collision requires a validated explicit collision input")
    from mathutils import Vector
    import bmesh
    helper = importlib.import_module(mod + ".tools.boundhelper")
    props = importlib.import_module(mod + ".sollumz_properties")
    coords = [obj.matrix_world @ vert.co for obj in meshes for vert in obj.data.vertices]
    if len(coords) < 4:
        raise ValueError("Too few source vertices for collision")
    if mode == "box":
        mins = [min(p[i] for p in coords) for i in range(3)]
        maxs = [max(p[i] for p in coords) for i in range(3)]
        center = Vector((mins[i] + maxs[i]) / 2 for i in range(3))
        extent = [max(0.001, maxs[i] - mins[i]) for i in range(3)]
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        collision_mesh = bpy.context.object
        collision_mesh.dimensions = extent
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    else:
        bpy.ops.mesh.primitive_cube_add(size=1)
        collision_mesh = bpy.context.object
        bm = bmesh.new()
        try:
            for coordinate in coords[:100_000]:
                bm.verts.new(coordinate)
            bm.verts.ensure_lookup_table()
            bmesh.ops.convex_hull(bm, input=bm.verts[:])
            bm.to_mesh(collision_mesh.data)
        finally:
            bm.free()
    collision_mesh.name = project + "_collision"
    composite = helper.convert_obj_to_composite(collision_mesh, props.SollumType.BOUND_GEOMETRYBVH)
    composite.name = project + '_col'
    return composite

def _export(bpy, mod, job, stream):
    meshes = _import_source(bpy, Path(job["source"]))
    from mathutils import Matrix
    scale = job.get("scale", [1, 1, 1])
    if (not isinstance(scale, list) or len(scale) != 3 or
            any(not isinstance(v, (int, float)) or not math.isfinite(v)
                or v < 0.01 or v > 100 for v in scale)):
        raise ValueError("Invalid scale in prop job")
    # Bake world transforms and user resize into each static mesh's vertices.
    # This preserves non-uniform scale, parent offsets and collision parity even
    # if a native exporter ignores object-level scale / parent transforms.
    # Preserve shared source geometry by making a copy before mutating it.
    xform = Matrix.Diagonal((float(scale[0]), float(scale[1]), float(scale[2]), 1.0))
    bpy.context.view_layer.update()
    original = {obj: obj.matrix_world.copy() for obj in meshes}
    for obj in meshes:
        baked = xform @ original[obj]
        obj.data = obj.data.copy()
        obj.data.transform(baked)
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    # Keep coordinates in Blender's native Z-up; no Three.js preview transform is applied.
    _shader_and_textures(bpy, mod, meshes, job["name"])
    helper = importlib.import_module(mod + ".tools.drawablehelper")
    drawable = helper.convert_objs_to_single_drawable(meshes)
    drawable.name = job["name"]
    collision = _make_collision(bpy, mod, meshes, job["name"], job["collision"])
    ytyp = bpy.context.scene.ytyps.add()
    ytyp.name = job["name"]
    arch = ytyp.new_archetype()
    arch.name = job["name"]
    arch.asset = drawable
    arch.texture_dictionary = job["name"]
    arch.physics_dictionary = job["name"] + '_col' if collision else ""
    arch.lod_dist = float(job["drawDistance"])
    if len(bpy.context.scene.ytyps) != 1:
        raise ValueError("Unexpected YTYP state")
    bpy.ops.object.select_all(action="DESELECT")
    # Full-scene export includes drawable, collision and scene YTYP/YTD.
    result = bpy.ops.sollumz.export_assets(
        directory=str(stream), direct_export=True, use_custom_settings=True,
        target_formats={"NATIVE"}, target_versions={"GEN8"},
        limit_to_selected=False, export_ytyps=True, export_ytds=True,
        export_ytyps_include="ALL", export_ytds_include="ALL",
        apply_transforms=False, mesh_domain="FACE_CORNER")
    _check(result, "Native Sollumz export")
    return {"meshes": len(meshes), "polygons": sum(len(o.data.polygons) for o in meshes)}

def _validate_roundtrip(bpy, job, stream):
    required = [job["name"] + ext for ext in [".ydr", ".ytd", ".ytyp"]]
    if job["collision"] != "none":
        required.append(job["name"] + "_col.ybn")
    for filename in required:
        file = stream / filename
        if not file.is_file() or file.stat().st_size < 32 or file.read_bytes()[:4] != b"RSC7":
            raise RuntimeError("Required native binary missing or invalid: " + filename)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    before = len(bpy.context.scene.objects)
    result = bpy.ops.sollumz.import_assets(
        directory=str(stream), files=[{"name": n} for n in required],
        use_custom_settings=True, split_by_group=True, textures_mode="PACK")
    _check(result, "Native binary reimport")
    if len(bpy.context.scene.objects) <= before:
        raise RuntimeError("Native resource roundtrip produced no geometry")
    if not any(getattr(o, "sollum_type", "") == "sollumz_drawable" for o in bpy.context.scene.objects):
        raise RuntimeError("Reimported native resource lacks Drawable")
    if job["collision"] != "none" and not any(getattr(o, "sollum_type", "") == "sollumz_bound_composite" for o in bpy.context.scene.objects):
        raise RuntimeError("Reimported resource lacks collision bound")
    return required

def main():
    import bpy
    if "--" not in sys.argv:
        raise ValueError("Missing job manifest argument")
    job_path = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
    job = json.loads(job_path.read_text(encoding="utf-8"))
    if job.get("schema") != 1 or job.get("edition") != "legacy" or not isinstance(job.get("source"), str):
        raise ValueError("Unsupported native prop job")
    if not isinstance(job.get("name"), str) or not job["name"].islower() or len(job["name"]) > 48:
        raise ValueError("Invalid native prop name")
    scale = job.get("scale", [1, 1, 1])
    if (not isinstance(scale, list) or len(scale) != 3 or
            any(not isinstance(v, (int, float)) or not math.isfinite(v)
                or v < 0.01 or v > 100 for v in scale)):
        raise ValueError("Invalid native prop scale")
    if job.get("collision") not in ("box", "convex", "none"):
        raise ValueError("Unsupported collision mode")
    stream = job_path.parent / "stream"
    stream.mkdir(exist_ok=False)
    module = _import_addon()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    stats = _export(bpy, module, job, stream)
    verified = _validate_roundtrip(bpy, job, stream)
    artifacts = []
    for filename in verified:
        file = stream / filename
        artifacts.append({"relativePath": "stream/" + filename, "bytes": file.stat().st_size, "sha256": _sha256(file)})
    report = {"schema": 1, "ok": True, "roundTrip": True, "assets": artifacts, "stats": stats}
    (job_path.parent / "native-report.json").write_text(json.dumps(report), encoding="utf-8")
    print("DITASHA_PROP_NATIVE_OK", flush=True)

if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(2)
