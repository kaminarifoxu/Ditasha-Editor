# Run with Blender and an enabled Sollumz add-on; no user assets are required.
import bpy,importlib,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('native_bridge',Path(__file__).resolve().parents[1]/'electron/native_bridge.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
engine=m.engine_info(bpy)
if not engine['sollumz']:
    raise RuntimeError('Enable Sollumz in Blender before running this geometry smoke test.')
from mathutils import Vector

def arm(name, siren=False):
    data=bpy.data.armatures.new(name);ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.sollum_type='sollumz_fragment';bpy.context.view_layer.objects.active=ob;ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');root=data.edit_bones.new('chassis');root.head=(0,0,0);root.tail=(0,1,0)
    if siren:
        b=data.edit_bones.new('siren1');b.head=(.25,0,1);b.tail=(.25,.1,1);b.parent=root
    bpy.ops.object.mode_set(mode='OBJECT');ob.select_set(False)
    draw=bpy.data.objects.new(name+'_draw',None);bpy.context.collection.objects.link(draw);draw.sollum_type='sollumz_drawable';draw.parent=ob
    return ob,draw

def mesh(name,parent):
    data=bpy.data.meshes.new(name);data.from_pydata([(0,0,0),(1,0,0),(0,1,0),(1,1,0)],[],[(0,1,2),(1,3,2)]);ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);ob.parent=parent;ob.sollum_type='sollumz_drawable_model';return ob

target,draw=arm('target');badge=mesh('body',draw);material=bpy.data.materials.new('vehicle_badges');other=bpy.data.materials.new('paint');badge.data.materials.append(material);badge.data.materials.append(other);badge.data.polygons[1].material_index=1
shared=badge.copy();shared.name='shared_body';bpy.context.collection.objects.link(shared);shared.parent=draw
import tempfile,json
from pathlib import Path
material.use_nodes=True
node=material.node_tree.nodes.new('ShaderNodeTexImage');node.name='DiffuseSampler'
image=bpy.data.images.new('preview_test',width=2,height=2);image.pixels[:]=[0,1,0,1]*4;node.image=image
with tempfile.TemporaryDirectory() as output:
    stats=m.preview_scene(bpy,target,output)
    data=json.loads((Path(output)/'preview.json').read_text())
    assert stats['triangles']==4
    assert len(data['textures'])==1 and any(e['texture']==0 for e in data['meshes'])
    import base64
    image_path=Path(output)/'test-map.png';image_path.write_bytes(base64.b64decode(data['textures'][0]))
    loaded=bpy.data.images.load(str(image_path));assert loaded.pixels[1]>.9, list(loaded.pixels[:4])
    bpy.data.images.remove(loaded)
    assert image.size[:]==(2,2), 'Preview must not resize source image' 
    assert sum(len(e['positions'])//9 for e in data['meshes'] if e['candidate']=='body')==1, 'Preview must highlight badge faces only, not the paint face'
    assert sum(len(e['positions'])//9 for e in data['meshes'] if not e['candidate'])==2
    assert len(badge.data.polygons)==2, 'Preview must not edit source geometry'
from types import SimpleNamespace
with tempfile.TemporaryDirectory() as output:
    stats = m.preview_scene(bpy, SimpleNamespace(children_recursive=[badge, shared]), output)
    assert stats['triangles'] == 4
    assert (Path(output) / 'preview.json').is_file()
print('PASS_PED_PREVIEW_GEOMETRY')
print('PASS_BADGE_PREVIEW_GEOMETRY')
assert len(m.badge_candidates(target))==2
assert m.debadge(target,['body'])==1
assert len(badge.data.polygons)==1 and badge.data.polygons[0].material_index==1
assert len(shared.data.polygons)==2, 'Unselected shared data must remain unchanged'
print('PASS_BADGE_GEOMETRY')
donor,ddraw=arm('donor',True);lamp=mesh('light',ddraw)
helper=importlib.import_module(engine['sollumz']+'.tools.blenderhelper');helper.add_child_of_bone_constraint(lamp,donor,'siren1')
with tempfile.TemporaryDirectory() as output:
    stats=m.preview_scene(bpy,target,output,donor)
    data=json.loads((Path(output)/'preview.json').read_text())
    lights=[e for e in data['meshes'] if e['kind']=='donor']
    assert len(lights)==1 and lights[0]['name']=='light'
    assert stats['triangles']==5
print('PASS_SIREN_PREVIEW_GEOMETRY')
result=m.transfer_sirens(bpy,target,donor,{'offset':[0,0,.5],'scale':2})
bpy.context.view_layer.update()
clone=next(o for o in draw.children if o!=badge and o!=shared and any(getattr(c,'subtarget','')=='siren1' for c in o.constraints))
from mathutils import Matrix
for i,v in enumerate(lamp.data.vertices):
    expected=Matrix.Translation(Vector((0,0,.5))) @ Matrix.Scale(2,4) @ lamp.matrix_world @ v.co
    actual=clone.matrix_world @ clone.data.vertices[i].co
    assert (expected-actual).length<.0001,(expected,actual)
print('PASS_PREVIEW_NATIVE_POSITION_MATCH')
assert result['bones']==['siren1'] and result['parts']==1
assert abs(target.data.bones['siren1'].head_local.z-2.5)<.001
assert any(c.target==target and c.subtarget=='siren1' for o in draw.children for c in o.constraints if hasattr(c,'target'))
try:m.transfer_sirens(bpy,target,donor,{'offset':[0,0,0],'scale':1})
except ValueError:pass
else:raise AssertionError('Existing siren must be rejected')
print('PASS_SIREN_TRANSFER',result)
