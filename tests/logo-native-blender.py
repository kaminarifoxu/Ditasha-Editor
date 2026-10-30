"""Real native YDR/YTYP export, import, embedded texture and silhouette test."""
import bpy
import base64
import copy
import numpy as np
import json
import sys
import tempfile
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'electron'))
import native_bridge as bridge
import logo_prop
assert bridge.engine_info(bpy)['native']
job=json.loads((root/'release/qa/logo-native-fixture.json').read_text())
def check_case(job, w, h, opaque=False):
 with tempfile.TemporaryDirectory() as directory:
    output=Path(directory)
    source=output/'input.png';source.write_bytes(base64.b64decode(job['logo']['texture']))
    image=bpy.data.images.load(str(source),check_existing=False)
    image.scale(w,h)
    if opaque:
        values=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(values)
        values[3::4]=1;image.pixels.foreach_set(values)
    image.filepath_raw=str(source);image.file_format='PNG';image.save()
    bpy.data.images.remove(image)
    original=source.read_bytes()
    job=copy.deepcopy(job);job['logo']['texture']=base64.b64encode(original).decode('ascii')
    # Keep physical aspect ratio independent of the padded native texture.
    job['logo']['positions'][2::3]=[z*h/w for z in job['logo']['positions'][2::3]]
    result=logo_prop.run(bpy,job,output)
    assert result['roundTrip'] and result['embeddedTextures']>=2,result
    size=max(4,1<<(max(w,h)-1).bit_length())
    assert result['sourceTextureSize']==[w,h] and result['nativeTextureSize']==[size,size],result
    assert source.read_bytes()==original and (output/'logo-source.png').read_bytes()==original
    scale=(w/size,h/size);offset=((size-w)//2/size,(size-h)//2/size)
    diffuse_seen=False

    for suffix in ['.ydr','_props.ytyp']:
        assert (output/'stream'/('ditasha_test_logo'+suffix)).read_bytes()[:4]==b'RSC7'
    before=set(bpy.data.objects)
    status=bpy.ops.sollumz.import_assets(directory=str(output/'stream'),files=[{'name':'ditasha_test_logo.ydr'}],use_custom_settings=True,textures_mode='PACK')
    imported=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    assert 'FINISHED' in status and imported
    hit=False
    for obj in imported:
        assert obj.data.uv_layers and len(obj.data.vertices)>3
        tree=BVHTree.FromPolygons([v.co for v in obj.data.vertices],[tuple(p.vertices) for p in obj.data.polygons])
        assert tree.ray_cast(Vector((0,-2,0)),Vector((0,1,0)))[0] is None,'Logo hole was filled'
        if tree.ray_cast(Vector((.8,-2,.8*h/w)),Vector((0,1,0)))[0] is not None:hit=True
        for material in obj.data.materials:
            image=material.node_tree.nodes['DiffuseSampler'].image
            image.pixels[:4];assert image.has_data
            if '_diffuse' not in image.name: continue
            diffuse_seen=True
            assert tuple(image.size)==(size,size),(image.name,image.size[:])
            # Sample via remapped UVs after native reimport, not source PNG.
            def sample(u,v):
                x=min(size-1,int((u*scale[0]+offset[0])*size))
                y=min(size-1,int((v*scale[1]+offset[1])*size))
                return image.pixels[(y*size+x)*4:(y*size+x)*4+4]
            top,bottom=sample(.25,.75),sample(.25,.25)
            assert top[0]>.7 and top[2]<.2 and top[3]>.9,top
            assert bottom[2]>.7 and bottom[0]<.2 and bottom[3]>.9,bottom
            center=sample(.5,.5)
            assert center[3]>.9 if opaque else center[3]<.05,center
            for value in obj.data.uv_layers[0].data:
                u,v=value.uv
                assert offset[0]-1e-5<=u<=offset[0]+scale[0]+1e-5,(u,offset,scale)
                assert offset[1]-1e-5<=v<=offset[1]+scale[1]+1e-5,(v,offset,scale)

    assert hit,'Visible logo geometry was lost'
    assert diffuse_seen,'No embedded diffuse tested'
    bpy.context.scene.ytyps.clear()
    status=bpy.ops.sollumz.import_assets(directory=str(output/'stream'),files=[{'name':'ditasha_test_logo_props.ytyp'}],use_custom_settings=True,textures_mode='PACK')
    assert 'FINISHED' in status and any(len(y.archetypes) for y in bpy.context.scene.ytyps),'Native archetype missing'
    assert 'DLC_ITYP_REQUEST' in (output/'fxmanifest.lua').read_text()
    assert (output/'ditasha-logo.blend').exists()
    print('PASS_LOGO_NATIVE_YDR_YTYP_TEXTURES_AND_HOLE',w,h,opaque,bpy.app.version_string,result)

for w,h,opaque in [(32,32,False),(1254,1254,False),(1024,576,True),(65,129,False),(512,512,True)]:
    check_case(job,w,h,opaque)
