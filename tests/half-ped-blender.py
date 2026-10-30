"""Real head/hair transfer on the installed reference, native YDD and GLB reimport."""
import bpy,json,sys,tempfile
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'electron'))
import native_bridge as bridge
import half_ped,ped_review
assert bridge.engine_info(bpy)['native']
with tempfile.TemporaryDirectory() as directory:
    temp=Path(directory)
    for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
    reference=half_ped.reference_from_engine(bpy,'mp_m')
    head=next(o for o in reference if 'head' in o.name)
    uv=head.data.uv_layers.new(name='UVMap')
    for loop in head.data.loops:
        p=head.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(p.x*3+.5,p.z-.4)
    template=temp/'reference.blend';bpy.ops.wm.save_as_mainfile(filepath=str(template))
    reference_bytes=template.read_bytes()
    bpy.ops.object.select_all(action='DESELECT')
    source=head.copy();source.data=head.data.copy();bpy.context.collection.objects.link(source)
    world=source.matrix_world.copy();source.parent=None;source.matrix_world=world
    for modifier in list(source.modifiers):source.modifiers.remove(modifier)
    source.vertex_groups.clear();source.select_set(True);bpy.context.view_layer.objects.active=source
    # A non-square transparent diffuse exercises the new texture path too.
    material=bpy.data.materials.new('TestHead');material.use_nodes=True
    image=bpy.data.images.new('NonSquareFace',width=65,height=33,alpha=True);image.pixels[:]=[.8,.2,.1,1]*(65*33)
    node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
    material.node_tree.links.new(node.outputs['Color'],material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    source.data.materials.clear();source.data.materials.append(material)
    input_file=temp/'head.glb';bpy.ops.export_scene.gltf(filepath=str(input_file),export_format='GLB',use_selection=True,export_animations=False)
    input_bytes=input_file.read_bytes()
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.1,location=(0,0,.79))
    hair=bpy.context.object;hair.name='SeparateHair'
    hair_file=temp/'hair.glb';bpy.ops.export_scene.gltf(filepath=str(hair_file),export_format='GLB',use_selection=True,export_animations=False)
    hair_bytes=hair_file.read_bytes()
    options={'enabled':True,'gender':'mp_m','fit':False,'weights':'surface','scale':1,'offset':[0,0,0],'rotation':[0,0,0],'hairScale':1,'hairOffset':[0,0,0],'native':True,'headSlot':'head_046_r','hairSlot':'hair_000_u'}
    job={'source':str(input_file),'reference':str(template),'hair':str(hair_file),'headOptions':options,'maxDistance':.12}
    output=temp/'output';output.mkdir()
    result=half_ped.run(bpy,job,output,ped_review,bridge.preview_scene)
    assert result['halfPed'] and result['referenceUvAvailable'] and len(result['nativeHead'])==2,result
    assert template.read_bytes()==reference_bytes and input_file.read_bytes()==input_bytes and hair_file.read_bytes()==hair_bytes
    assert (output/'uv-head-source.svg').is_file() and (output/'uv-freemode-reference.svg').is_file()
    for item in result['nativeHead']:
        assert (output/item['file']).read_bytes()[:4]==b'RSC7'
        assert item['verified']['lodMeshes']>=3,item
    rest=json.loads((output/'preview.json').read_text());moved=json.loads((output/'preview-head.json').read_text())
    head_rest=[m['positions'] for m in rest['meshes'] if m['name']==source.name]
    head_moved=[m['positions'] for m in moved['meshes'] if m['name']==source.name]
    # Imported source names can acquire Blender suffixes, but a real head pose must change geometry.
    assert rest['meshes']!=moved['meshes'],'Head pose did not deform the real result'
    assert rest['textures'],'Skinned source textures missing from preview'
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(output/'ditasha-halfped.glb'))
    imported=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    assert imported and all(o.find_armature() for o in imported)
    for obj in imported:
        assert obj.data.uv_layers
        for vertex in obj.data.vertices:
            weights=[g.weight for g in vertex.groups if g.weight>1e-6]
            assert weights and len(weights)<=4 and abs(sum(weights)-1)<.02
    second=temp/'female';second.mkdir();job.pop('reference');job.pop('hair');options.update({'native':False,'fit':True,'gender':'mp_f','weights':'rigid'})
    female=half_ped.run(bpy,job,second,ped_review,bridge.preview_scene)
    assert female['halfPed'] and not female['referenceUvAvailable'] and (second/'ditasha-halfped.glb').is_file()
    print('PASS_HALF_PED_NATIVE_HEAD_HAIR_UV_WEIGHTS_POSE_AND_FEMALE_REFERENCE')
