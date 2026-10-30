"""Exercise the actual full Muto chain with a multi-part, already skinned GLB."""
import bpy, json, sys, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'electron'))
import half_ped, native_bridge as bridge
with tempfile.TemporaryDirectory() as directory:
    temp=Path(directory)
    for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
    objects=half_ped.reference_from_engine(bpy,'mp_m')
    arm=objects[0].find_armature()
    for obj in objects:
        layer=obj.data.uv_layers.new(name='UVMap')
        for loop in obj.data.loops:
            p=obj.data.vertices[loop.vertex_index].co;layer.data[loop.index].uv=(p.x+.5,p.z/2+.5)
        mat=obj.data.materials[0];mat.use_nodes=True
        image=bpy.data.images.new('FullPedDiffuse_'+obj.name,width=32,height=32,alpha=True)
        image.pixels[:]=[.5,.3,.2,1]*1024
        node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image
        mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    bpy.ops.object.select_all(action='DESELECT')
    arm.hide_set(False);arm.hide_viewport=False
    for obj in [arm,*objects]:obj.select_set(True)
    bpy.context.view_layer.objects.active=arm
    source=temp/'multi-part-skinned.glb'
    bpy.ops.export_scene.gltf(filepath=str(source),export_format='GLB',use_selection=True,export_animations=False)
    original=source.read_bytes()
    output=temp/'output';output.mkdir()
    report=bridge.run({'mode':'ped','source':str(source),'output':str(output),'name':'ditasha_full_test','pedOptions':{'reference':'mp_m','height':1.8}})
    print('FULL_PED_REPORT',json.dumps(report,ensure_ascii=True),flush=True)
    assert report['ok'],report
    assert report['rigging']['mesh']['parts']==len(objects),'Bone control helper was joined into the body'
    assert source.read_bytes()==original
    assert {'.yft','.ydd','.ytd','.ymt'}.issubset({f.suffix for f in output.rglob('*') if f.is_file()})
    assert (output/'preview.json').is_file() and (output/'ditasha-result.blend').is_file()
    assert report['quality']['unweighted']==report['quality']['overFour']==report['quality']['invalidWeights']==0
    print('PASS_FULL_PED_REAL_MULTI_PART_SKINNED_GLB',flush=True)
