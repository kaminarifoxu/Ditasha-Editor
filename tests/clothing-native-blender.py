"""Real generator → skin → native YDD → reimport, plus actual YCD XML evaluation."""
import bpy
import importlib
import json
import sys
import tempfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'electron'))
import native_bridge as bridge
import garment_skin as skin
import ped_review as review
import native_dds
engine = bridge.engine_info(bpy)
assert engine['native'] and engine['sollumz']
for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
data = bpy.data.armatures.new('GTA'); arm = bpy.data.objects.new('GTA',data)
bpy.context.collection.objects.link(arm); bpy.context.view_layer.objects.active=arm; arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
base=data.edit_bones.new('SKEL_ROOT');base.head=(0,0,0);base.tail=(0,0,.2)
for name,x in [('SKEL_L_Thigh',0),('SKEL_R_Thigh',1)]:
    bone=data.edit_bones.new(name);bone.head=(x,0,0);bone.tail=(x,0,1);bone.parent=base
bpy.ops.object.mode_set(mode='OBJECT')
helper=importlib.import_module(engine['sollumz']+'.tools.drawablehelper')
for bone in arm.data.bones: helper.set_recommended_bone_properties(bone)
mesh=bpy.data.meshes.new('BodySurface')
mesh.from_pydata([(0,0,0),(1,0,0),(0,0,1),(1,0,1)],[],[(0,1,2),(1,3,2)])
uv=mesh.uv_layers.new(name='UVMap')
for loop in mesh.loops: uv.data[loop.index].uv=(mesh.vertices[loop.vertex_index].co.x,mesh.vertices[loop.vertex_index].co.z)
body=bpy.data.objects.new('Body',mesh);bpy.context.collection.objects.link(body);body.parent=arm
body.vertex_groups.new(name='SKEL_L_Thigh').add([0,2],1,'REPLACE')
body.vertex_groups.new(name='SKEL_R_Thigh').add([1,3],1,'REPLACE')
body.modifiers.new('Skin','ARMATURE').object=arm
with tempfile.TemporaryDirectory() as directory:
    temp=Path(directory); reference=temp/'body.blend'
    import numpy as np
    rgba=np.zeros((8,8,4),dtype=np.uint8)
    rgba[:4]=[255,0,0,255];rgba[4:]=[0,0,255,128];rgba[0,0,3]=0
    dds=temp/'alpha-orientation.dds';dds.write_bytes(native_dds.encode_dds(rgba))
    decoded=bpy.data.images.load(str(dds),check_existing=False)
    bottom=decoded.pixels[:4]
    assert decoded.has_data and decoded.size[:]==(8,8),(decoded.has_data,decoded.size[:],bottom)
    assert bottom[2]>.95 and abs(bottom[3]-128/255)<.02,bottom
    assert decoded.pixels[(7*8)*4+3]<.02,'DDS alpha/orientation lost'
    bpy.data.images.remove(decoded)
    bpy.ops.wm.save_as_mainfile(filepath=str(reference))
    original=reference.read_bytes()
    channels = '<Item><Type value="QuantizeFloat"/><Quantum value="0.001"/><Offset value="0"/><Values>' + ' '.join(str(i*.01) for i in range(30)) + '</Values></Item>'
    channels += '<Item><Type value="StaticFloat"/><Value value="0"/></Item>'*2
    clip=temp/'test.ycd.xml'
    clip.write_text('<ClipDictionary><Clips><Item><Hash>ditasha_clip</Hash><Name>pack:/ditasha_clip.clip</Name><Type value="Animation"/><Unknown30 value="0"/><Tags/><Properties/><AnimationHash>ditasha_anim</AnimationHash><StartTime value="0"/><EndTime value="1"/><Rate value="1"/></Item></Clips><Animations><Item><Hash>ditasha_anim</Hash><Unknown10 value="0"/><FrameCount value="30"/><SequenceFrameLimit value="31"/><Duration value="1"/><Unknown1C>hash_00000000</Unknown1C><BoneIds><Item><BoneId value="0"/><Track value="0"/><Unk0 value="0"/></Item></BoneIds><Sequences><Item><Hash>hash_00000000</Hash><FrameCount value="30"/><SequenceData><Item><Channels>'+channels+'</Channels></Item></SequenceData></Item></Sequences></Item></Animations></ClipDictionary>')
    clip_original=clip.read_bytes()
    output=temp/'output';output.mkdir()
    job={'reference':str(reference),'maxDistance':.1,'clip':str(clip),'clipIndex':0,
         'clothing':{'source':'generate','body':'Body','lower':0,'upper':1,'gap':.005,'color':[.1,.3,.8],
                     'native':True,'slot':'mp_m_freemode_01^jbib_000_u'}}
    result=skin.run(bpy,job,output,review,bridge.preview_scene)
    assert result['generated'] and result['nativeClothing'],result
    assert result['nativeClothing']['verified']['lodMeshes'] >= 3,result
    assert result['preview']['motion']['kind']=='gta-ycd-xml',result
    preview=json.loads((output/'preview.json').read_text())
    assert len(set(preview['motion']['frames'])) > 1,'YCD did not move the actual rig'
    native=output/result['nativeClothing']['file']
    assert native.read_bytes()[:4]==b'RSC7'
    before=set(bpy.data.objects)
    status=bpy.ops.sollumz.import_assets(directory=str(native.parent),files=[{'name':native.name}],use_custom_settings=True,textures_mode='PACK')
    assert 'FINISHED' in status
    imported=[obj for obj in bpy.data.objects if obj not in before and obj.type=='MESH']
    assert imported,'Native reimport has no geometry'
    assert any(obj.find_armature() for obj in imported),'Native reimport lost skeleton binding'
    for obj in imported:
        assert obj.data.uv_layers
        coordinates={tuple(round(v,4) for v in value.uv) for value in obj.data.uv_layers[0].data}
        assert len(coordinates)>=3,coordinates
        assert len(list(bridge.mesh_levels(obj))) >= 3
        diffuse=obj.data.materials[0].node_tree.nodes.get('DiffuseSampler')
        if diffuse and diffuse.image: diffuse.image.pixels[:4]
        assert diffuse and diffuse.image and diffuse.image.has_data,'Native embedded diffuse did not round-trip'
        color=diffuse.image.pixels[:4]
        assert color[0]>.05 and color[2]>.7 and color[0]<color[1]<color[2],color
        for vertex in obj.data.vertices:
            assert vertex.groups and abs(sum(g.weight for g in vertex.groups)-1)<.02
    assert reference.read_bytes()==original and clip.read_bytes()==clip_original
    assert not (output/'preview-clip-tmp.json').exists()
    print('PASS_GENERATED_NATIVE_CLOTHING_AND_YCD_XML',bpy.app.version_string)
