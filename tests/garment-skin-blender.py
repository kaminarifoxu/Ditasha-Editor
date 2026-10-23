"""Real Blender transfer, evaluated motion, GLB skin attributes, and source-file preservation."""
import bpy
import sys
import json
import tempfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'electron'))
import garment_skin as skin
import ped_review as review
import native_bridge as bridge
from mathutils import Matrix
bpy.ops.wm.read_factory_settings(use_empty=True)
arm_data = bpy.data.armatures.new('GTAReference')
arm = bpy.data.objects.new('GTAReference', arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, x in [('SKEL_L_Thigh',0),('SKEL_R_Thigh',1),('SKEL_L_Forearm',2)]:
    bone = arm_data.edit_bones.new(name); bone.head=(x,0,0); bone.tail=(x,0,1)
bpy.ops.object.mode_set(mode='OBJECT')
mesh = bpy.data.meshes.new('ReferenceBody')
mesh.from_pydata([(0,0,0),(1,0,0),(0,0,1),(1,0,1)],[],[(0,1,2),(1,3,2)])
mesh.uv_layers.new(name='UVMap')
body = bpy.data.objects.new('ReferenceBody',mesh); bpy.context.collection.objects.link(body)
body.parent = arm
body.vertex_groups.new(name='SKEL_L_Thigh').add([0,2],1,'REPLACE')
body.vertex_groups.new(name='SKEL_R_Thigh').add([1,3],1,'REPLACE')
body.modifiers.new('ReferenceSkin','ARMATURE').object = arm
material = bpy.data.materials.new('GarmentColor'); material.diffuse_color=(.2,.7,.3,1); material.use_nodes=True
body.data.materials.append(material)
with tempfile.TemporaryDirectory() as directory:
    temp = Path(directory)
    reference = temp/'reference.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(reference))
    reference_bytes = reference.read_bytes()
    garment_mesh = mesh.copy()
    garment = bpy.data.objects.new('NewClothing',garment_mesh); bpy.context.collection.objects.link(garment)
    garment.location.y = -.025
    armature, quality = skin.skin_garments(bpy,[body],[garment],.1)
    assert quality['vertices'] == 4 and armature == arm
    assert quality['maxDistanceMeters'] < .026
    for vertex in garment.data.vertices:
        assert len(vertex.groups) <= 4 and abs(sum(g.weight for g in vertex.groups)-1) < 1e-6
    assert garment.find_armature() == arm
    # Invalid placement must leave all previous weights intact.
    saved_weights = [[(g.group,g.weight) for g in v.groups] for v in garment.data.vertices]
    garment.location.y = -10
    bpy.context.view_layer.update()
    try: skin.skin_garments(bpy,[body],[garment],.1)
    except ValueError: pass
    else: raise AssertionError('Unfitted garment accepted')
    assert saved_weights == [[(g.group,g.weight) for g in v.groups] for v in garment.data.vertices]
    garment.location.y = -.025
    # Export a clean, unrigged source and exercise the full template-import job.
    garment.modifiers.clear(); garment.vertex_groups.clear(); garment.parent = None
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT'); garment.select_set(True)
    source = temp/'clothing.glb'
    bpy.ops.export_scene.gltf(filepath=str(source),export_format='GLB',use_selection=True)
    source_bytes = source.read_bytes()
    output = temp/'output'; output.mkdir()
    result = skin.run(bpy,{'reference':str(reference),'source':str(source),'maxDistance':.1},output,review,bridge.preview_scene)
    imported_clothing = [obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.name.startswith('NewClothing')]
    assert len(imported_clothing) == 1
    assert result['transferQuality']['vertices'] == len(imported_clothing[0].data.vertices)
    assert 4 <= result['transferQuality']['vertices'] <= 6, result['transferQuality']
    for vertex in imported_clothing[0].data.vertices:
        assert 1 <= len(vertex.groups) <= 4 and abs(sum(g.weight for g in vertex.groups) - 1) < 1e-6
    assert 'motion' in result['preview'], result
    glb = (output/'ditasha-clothing-skinned.glb').read_bytes()
    import struct
    length, chunk_type = struct.unpack_from('<II',glb,12)
    model = json.loads(glb[20:20+length])
    assert model.get('skins'), 'Export lost actual skinning'
    assert len(model['meshes']) == 1, 'Reference body leaked into garment export'
    assert all('JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes'] for mesh in model['meshes'] for p in mesh['primitives'])
    frame = json.loads((output/'preview.json').read_text())
    assert len(frame['motion']['frames']) >= 4
    assert len(set(frame['motion']['frames'])) > 1, 'Walk test did not deform skin'
    assert reference.read_bytes() == reference_bytes and source.read_bytes() == source_bytes
    assert not (output/'preview-motion-tmp.json').exists()
print('PASS_REAL_GARMENT_SKIN_AND_MOTION',bpy.app.version_string)
