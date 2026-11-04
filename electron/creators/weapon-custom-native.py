"""DITASHA Weapon Studio custom assembly -> native GTA V Legacy YDR/YTD.

Conservative donor-based converter. Imports a compatible rigged weapon YDR/YTD,
replaces its visible donor geometry with GLB assembly meshes, and binds those
meshes rigidly to an existing root weapon bone. Any failure to preserve native
geometry, UVs, textures or attachment bones aborts the export; does not claim
animation or FiveM gameplay compatibility.
"""
import bpy
import hashlib
import importlib
import json
import math
import sys
import traceback
from pathlib import Path
from mathutils import Matrix

ANCHORS={
    "muzzle":("WAPSupp","Gun_Muzzle","Muzzle","WAPMuzzle"),
    "magazine":("WAPClip","Gun_Magazine","Magazine","Clip"),
    "grip":("WAPGrip","Gun_Grip","Grip","Gun_Grip_IK"),
}
def load_module(filename, name):
    file=Path(__file__).resolve().with_name(filename)
    if not file.is_file():
        raise RuntimeError("Required staged module missing: "+filename)
    spec=importlib.util.spec_from_file_location(name,str(file))
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def addon():
    enabled=[key for key in bpy.context.preferences.addons.keys()
             if key.lower().endswith(".sollumz") or key.lower()=="sollumz"]
    if len(enabled)!=1:
        raise RuntimeError("Managed Sollumz must be enabled exactly once")
    module=enabled[0]
    deps=importlib.import_module(module+".dependencies")
    if not deps.IS_SZIO_NATIVE_AVAILABLE:
        raise RuntimeError("Native Sollumz provider is unavailable")
    return module

def check(result, message):
    if "FINISHED" not in result:raise RuntimeError(message+" did not finish")

def anchors(armature):
    all_bones={bone.name.lower():bone for bone in armature.data.bones}
    output={}
    for kind,choices in ANCHORS.items():
        matching=[all_bones[n.lower()] for n in choices if n.lower() in all_bones]
        if not matching:
            raise RuntimeError("Donor missing weapon "+kind+" attachment bone")
        bone=matching[0]
        world=armature.matrix_world@bone.matrix_local
        coords=[float(v) for v in world.translation]
        if any(not math.isfinite(v) or abs(v)>10000 for v in coords):
            raise RuntimeError("Invalid donor weapon "+kind+" transform")
        output[kind]={"name":bone.name,"position":coords}
    locations=[value["position"] for value in output.values()]
    if any(math.dist(locations[i],locations[j])<0.00001
           for i in range(len(locations)) for j in range(i+1,len(locations))):
        raise RuntimeError("Weapon attachment positions overlap unexpectedly")
    return output

def signature(path):
    h=hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda:stream.read(1024*1024),b""):
            h.update(block)
    return h.hexdigest()

def stats(meshes):
    return sum(len(mesh.data.polygons) for mesh in meshes)

def verify_meshes(meshes):
    if not meshes or len(meshes)>64:
        raise RuntimeError("Custom assembly must have 1..64 nonempty meshes")
    polygons=stats(meshes)
    if polygons<1 or polygons>500000:
        raise RuntimeError("Custom weapon exceeds the 500k polygon limit")
    for obj in meshes:
        if len(obj.data.uv_layers)==0:
            raise RuntimeError("Custom weapon '%s' has no UV map" % obj.name)
        for vertex in obj.data.vertices:
            if any(not math.isfinite(x) for x in vertex.co):
                raise RuntimeError("Custom weapon has invalid vertex coordinates")
    return polygons

def import_donor(source,stem):
    check(bpy.ops.sollumz.import_assets(
        directory=str(source),files=[{"name":stem+".ydr"},{"name":stem+".ytd"}],
        use_custom_settings=True,split_by_group=True,textures_mode="PACK"),"Donor import")
    armatures=[o for o in bpy.context.scene.objects if o.type=="ARMATURE" and len(o.data.bones)]
    if len(armatures)!=1:
        raise RuntimeError("Custom native export requires exactly one rigged donor armature")
    armature=armatures[0]
    donor=[o for o in bpy.context.scene.objects if o.type=="MESH" and len(o.data.polygons)]
    if not donor:
        raise RuntimeError("Donor has no drawable geometry")
    templates=[o for o in donor if any(m.type=="ARMATURE" and m.object==armature for m in o.modifiers)]
    if not templates:
        raise RuntimeError("Donor has no skinned drawable mesh attached to its skeleton")
    dictionary=[d for d in bpy.context.scene.sz_txds.texture_dictionaries
                if d.name.lower()==stem.lower()]
    if len(dictionary)!=1:
        raise RuntimeError("Donor must import one matching YTD dictionary")
    return armature, donor, templates[0], dictionary[0]

def prepare_custom(jobfile):
    source=jobfile.parent/"weapon-design.glb"
    if not source.is_file() or source.stat().st_size>64*1024*1024:
        raise RuntimeError("Missing or oversized staged custom GLB")
    existing=set(bpy.context.scene.objects)
    check(bpy.ops.import_scene.gltf(filepath=str(source)),"Custom GLB import")
    meshes=[o for o in bpy.context.scene.objects
            if o not in existing and o.type=="MESH" and len(o.data.polygons)]
    return meshes

def make_materials(addon_name, meshes, model, staging):
    material_spec=load_module("prop_material.py","ditasha_weapon_material").material_diffuse_spec
    dds_writer=load_module("prop_dds.py","ditasha_weapon_dds").image_to_dds
    shader=importlib.import_module(addon_name+".ydr.shader_materials").create_shader
    meshhelper=importlib.import_module(addon_name+".tools.meshhelper")
    dictionary=bpy.context.scene.sz_txds.new_texture_dictionary(name=model)
    cache={}
    white=None
    def palette_image():
        nonlocal white
        if white is None:
            white=bpy.data.images.new(model+"_solid",width=4,height=4,alpha=True)
            white.pixels=[1.0]*64
        return white
    for obj in meshes:
        if not obj.material_slots:
            raise RuntimeError("Custom weapon mesh '%s' must have a material" % obj.name)
        for slot in obj.material_slots:
            source=slot.material
            image,tint=material_spec(source)
            if image is None:image=palette_image()
            key=(image.as_pointer(),tuple(round(v,7) for v in tint))
            if key not in cache:
                if len(cache)>=256:raise RuntimeError("Too many weapon material textures")
                dest=staging/("%s_diff_%03d.dds"%(model,len(cache)))
                cache[key]=dds_writer(bpy,image,dest,tint=tint)
            material=shader("default.sps")
            nodes=[n for n in material.node_tree.nodes if n.name=="DiffuseSampler" and n.type=="TEX_IMAGE"]
            if len(nodes)!=1:raise RuntimeError("Missing GTA DiffuseSampler")
            nodes[0].image=cache[key]
            slot.material=material
        meshhelper.mesh_rename_uv_maps_by_order(obj.data)
        meshhelper.mesh_add_missing_uv_maps(obj.data)
        meshhelper.mesh_rename_color_attrs_by_order(obj.data)
        meshhelper.mesh_add_missing_color_attrs(obj.data)
    for image in cache.values():dictionary.new_texture(image)
    txd=importlib.import_module(addon_name+".ytd.ytdexport").create_txd_asset(dictionary)[0]
    if len(txd.textures)!=len(cache) or len(cache)==0:
        raise RuntimeError("Failed to serialize all custom material DDS textures")
    return dictionary,len(cache)

def replace_donor_visuals(armature, donor, template, customs):
    # The donor bone hierarchy and its native drawable parent objects remain.
    # Clone an actual GTA skinned donor mesh to retain the required Sollumz
    # mesh type/LOD/armature modifier configuration. Replace just mesh data.
    bone=next((b for b in armature.data.bones if b.parent is None),None)
    if bone is None:raise RuntimeError("Donor has no root weapon bone")
    model_parent=template.parent
    template_world=template.matrix_world.copy()
    pieces=[]
    for index,source in enumerate(customs):
        native=template.copy()
        native.data=source.data.copy()
        native.name="ditasha_custom_%03d"%index
        bpy.context.collection.objects.link(native)
        native.parent=model_parent
        native.matrix_world=template_world
        # Bake source GLB world transform in native donor template space.
        native.data.transform(template_world.inverted()@source.matrix_world)
        # The copied donor vertex groups retain name/index conventions, but
        # receive NEW weights over the newly imported mesh vertices.
        for group in list(native.vertex_groups):
            native.vertex_groups.remove(group)
        group=native.vertex_groups.new(name=bone.name)
        group.add(list(range(len(native.data.vertices))),1.0,"REPLACE")
        armature_modifiers=[m for m in native.modifiers if m.type=="ARMATURE"]
        if len(armature_modifiers)!=1:
            raise RuntimeError("Donor mesh has ambiguous armature modifiers")
        armature_modifiers[0].object=armature
        native.data.materials.clear()
        for mat in source.data.materials:native.data.materials.append(mat)
        pieces.append(native)
    # Remove all old donor visual meshes after the custom geometry is ready.
    for obj in donor:bpy.data.objects.remove(obj,do_unlink=True)
    for obj in customs:bpy.data.objects.remove(obj,do_unlink=True)
    return pieces

def export_native(addon_name,job,jobfile):
    source=Path(job["donorPath"])
    donor_name=job["donorModel"]
    target_name=job["modelName"]
    armature,donor,template,old_dict=import_donor(source,donor_name)
    original_anchors=anchors(armature)
    original_bones=len(armature.data.bones)
    customs=prepare_custom(jobfile)
    original_polygons=verify_meshes(customs)
    stage=jobfile.parent/"dds-cache"
    dictionary,texture_count=make_materials(addon_name,customs,target_name,stage)
    merged=replace_donor_visuals(armature,donor,template,customs)
    # No original donor textures are published in the custom YTD.
    bpy.context.scene.sz_txds.texture_dictionaries.remove(
        list(bpy.context.scene.sz_txds.texture_dictionaries).index(old_dict))
    # Rename only the native drawable root, not bones.
    drawable=[obj for obj in bpy.context.scene.objects
              if getattr(obj,"sollum_type","")=="sollumz_drawable"]
    if len(drawable)!=1:
        raise RuntimeError("Donor has ambiguous Sollumz drawable roots")
    drawable[0].name=target_name
    native_dir=jobfile.parent/"stream"
    native_dir.mkdir(exist_ok=False)
    check(bpy.ops.sollumz.export_assets(
        directory=str(native_dir),direct_export=True,use_custom_settings=True,
        target_formats={"NATIVE"},target_versions={"GEN8"},
        limit_to_selected=False,export_ytyps=False,export_ytds=True,
        export_ytds_include="ALL",apply_transforms=False,mesh_domain="FACE_CORNER"),"Native custom weapon export")
    files=[target_name+".ydr",target_name+".ytd"]
    artifacts=[]
    for name in files:
        file=native_dir/name
        if not file.is_file() or file.stat().st_size<64:
            raise RuntimeError("Native custom weapon asset missing: "+name)
        with file.open("rb") as handle:
            if handle.read(8)!=b"RSC7"+(13).to_bytes(4,"little"):
                raise RuntimeError("Invalid GTA Legacy RSC7 output "+name)
        artifacts.append({"name":name,"bytes":file.stat().st_size,"sha256":signature(file)})
    # Erase original scene to make round-trip verification independent.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.context.scene.sz_txds.texture_dictionaries.clear()
    check(bpy.ops.sollumz.import_assets(
        directory=str(native_dir),files=[{"name":n} for n in files],
        use_custom_settings=True,split_by_group=True,textures_mode="PACK"),"Custom weapon reimport")
    rigs=[o for o in bpy.context.scene.objects if o.type=="ARMATURE" and len(o.data.bones)]
    if len(rigs)!=1 or len(rigs[0].data.bones)!=original_bones:
        raise RuntimeError("Custom weapon rig lost donor skeleton on roundtrip")
    final_anchors=anchors(rigs[0])
    for kind in original_anchors:
        a,b=original_anchors[kind],final_anchors[kind]
        if a["name"]!=b["name"] or math.dist(a["position"],b["position"])>0.002:
            raise RuntimeError("Custom weapon "+kind+" bone moved in native roundtrip")
    final_meshes=[o for o in bpy.context.scene.objects if o.type=="MESH" and len(o.data.polygons)]
    final_polygons=stats(final_meshes)
    if final_polygons!=original_polygons:
        raise RuntimeError("Custom native YDR lost geometry: %d/%d polygons"%(final_polygons,original_polygons))
    for mesh in final_meshes:
        if not mesh.data.uv_layers:
            raise RuntimeError("Custom weapon lost UVs after YDR reimport")
    textures=[tex for txd in bpy.context.scene.sz_txds.texture_dictionaries
              for tex in txd.textures if tex.image is not None]
    if len(textures)!=texture_count:
        raise RuntimeError("Custom YTD texture count mismatched after reimport")
    return {
        "schema":1,"ok":True,"nativeRoundTrip":True,"donorModel":donor_name,
        "modelName":target_name,"customMeshCount":len(merged),
        "customPolygonCount":original_polygons,
        "roundTripPolygonCount":final_polygons,
        "textureCount":len(textures),
        "anchors":original_anchors,"anchorsAfter":final_anchors,
        "artifacts":artifacts,"gameTestPassed":None,
    }

def main():
    if "--" not in sys.argv:raise RuntimeError("Missing custom weapon job")
    jobfile=Path(sys.argv[sys.argv.index("--")+1]).resolve()
    job=json.loads(jobfile.read_text(encoding="utf-8"))
    if job.get("schema")!=1 or job.get("edition")!="legacy":
        raise RuntimeError("Invalid native weapon job")
    for field in ("donorModel","modelName"):
        value=job.get(field)
        if not isinstance(value,str) or not value.startswith("w_") or "/" in value or "\\" in value:
            raise RuntimeError("Invalid custom weapon model name")
    addon_name=addon()
    output=export_native(addon_name,job,jobfile)
    (jobfile.parent/"weapon-custom-report.json").write_text(
        json.dumps(output,indent=2),encoding="utf-8")
    print("DITASHA_CUSTOM_WEAPON_NATIVE_OK",flush=True)

if __name__=="__main__":
    try:main()
    except Exception:
        traceback.print_exc()
        sys.exit(2)
