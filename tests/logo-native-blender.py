"""Real native YDR/YTYP export, import, embedded texture and silhouette test."""
import bpy
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
with tempfile.TemporaryDirectory() as directory:
    output=Path(directory)
    result=logo_prop.run(bpy,job,output)
    assert result['roundTrip'] and result['embeddedTextures']>=2,result
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
        if tree.ray_cast(Vector((.8,-2,.8)),Vector((0,1,0)))[0] is not None:hit=True
        for material in obj.data.materials:
            image=material.node_tree.nodes['DiffuseSampler'].image
            image.pixels[:4];assert image.has_data
    assert hit,'Visible logo geometry was lost'
    bpy.context.scene.ytyps.clear()
    status=bpy.ops.sollumz.import_assets(directory=str(output/'stream'),files=[{'name':'ditasha_test_logo_props.ytyp'}],use_custom_settings=True,textures_mode='PACK')
    assert 'FINISHED' in status and any(len(y.archetypes) for y in bpy.context.scene.ytyps),'Native archetype missing'
    assert 'DLC_ITYP_REQUEST' in (output/'fxmanifest.lua').read_text()
    assert (output/'ditasha-logo.blend').exists()
    print('PASS_LOGO_NATIVE_YDR_YTYP_TEXTURES_AND_HOLE',bpy.app.version_string,result)
