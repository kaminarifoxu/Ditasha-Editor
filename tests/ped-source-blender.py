"""Real import/preview checks: run with official bpy 5.2.2 or Blender Python."""
import bpy
import hashlib
import importlib.util
import json
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('bridge', root / 'electron/native_bridge.py')
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
spec = importlib.util.spec_from_file_location('review', root / 'electron/ped_review.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
bpy.ops.wm.read_factory_settings(use_empty=True)
with tempfile.TemporaryDirectory() as directory:
    base = Path(directory)
    image = bpy.data.images.new('Source pixels', 2, 2, alpha=True)
    image.pixels.foreach_set([.8, .1, .2, 1] * 4)
    image.filepath_raw = str(base / 'skin.png')
    image.file_format = 'PNG'
    image.save()
    mesh = bpy.data.meshes.new('SourceMesh')
    mesh.from_pydata([(0, 0, 0), (1, 0, 0), (0, 0, 1.8)], [], [(0, 1, 2)])
    uv = mesh.uv_layers.new()
    for loop, value in zip(uv.data, [(0, 0), (1, 0), (0, 1)]):
        loop.uv = value
    obj = bpy.data.objects.new('damaged_body_is_still_a_source_mesh', mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    material = bpy.data.materials.new('SourceSkin')
    material.use_nodes = True
    tex = material.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = image
    principled = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    material.node_tree.links.new(tex.outputs['Color'], principled.inputs['Base Color'])
    mesh.materials.append(material)
    # Material lookup follows the shader link, never an unrelated normal image.
    normal_tex = material.node_tree.nodes.new('ShaderNodeTexImage')
    normal_tex.image = bpy.data.images.new('Unrelated image', 1, 1)
    assert bridge.source_image_node(material) == tex
    principled.inputs['Base Color'].default_value = (.4, .8, .2, 1)
    assert abs(bridge.source_color(material)[0] - .4) < 1e-5
    principled.inputs['Base Color'].default_value = (1, 1, 1, 1)
    obj.scale = (2, 1, 1)
    bpy.context.view_layer.update()
    q = review.audit_source(bpy, [obj], bridge.source_image_node)
    assert q['unappliedTransforms'] == [obj.name]
    assert q['dimensionsMeters'] == [2, 0, 1.8], q
    obj.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(filepath=str(base / 'source.glb'), export_format='GLB')
    bpy.ops.export_scene.fbx(filepath=str(base / 'source.fbx'), use_selection=True)
    bpy.ops.wm.obj_export(filepath=str(base / 'source.obj'), export_selected_objects=True)
    snapshots = {p: hashlib.sha256(p.read_bytes()).digest() for p in base.iterdir() if p.is_file()}
    for extension in ('glb', 'fbx', 'obj'):
        output = base / ('preview-' + extension)
        output.mkdir()
        result = bridge.run({'mode': 'ped_preview', 'source': str(base / ('source.' + extension)), 'output': str(output)})
        assert result['ok'], result
        assert not result['engine']['sollumz'] and not result['engine']['muto']
        q = result['sourceQuality']
        assert q['meshes'] == 1 and q['vertices'] == 3 and q['triangles'] == 1, q
        assert not q['missingUV'] and not q['missingTextures'], q
        data = json.loads((output / 'preview.json').read_text())
        assert data['source'] is True and data['triangles'] == 1
        assert len(data['textures']) == 1, (extension, q)
        assert any(data['meshes'][0]['uvs']), 'UVs were lost'
        assert all(p.suffix not in ('.blend', '.ydd', '.yft', '.ytd', '.ymt') for p in output.iterdir())
    for path, digest in snapshots.items():
        assert hashlib.sha256(path.read_bytes()).digest() == digest, 'Source changed: ' + str(path)
    # Missing images, UVs and mirrored transforms remain diagnostic, never auto-fixed.
    loaded = next(o for o in bpy.data.objects if o.type == 'MESH')
    loaded.data.uv_layers.remove(loaded.data.uv_layers[0])
    loaded.scale.x = -1
    mat = loaded.data.materials[0]
    bridge.source_image_node(mat).image = None
    bpy.context.view_layer.update()
    q = review.audit_source(bpy, [loaded], bridge.source_image_node)
    assert q['missingUV'] and q['missingTextures'] and q['negativeScale'], q
    invalid = base / 'unsupported.blend'
    invalid.write_bytes(b'not an accepted model')
    try:
        review.import_source(bpy, invalid)
        raise AssertionError('Unsupported extension accepted')
    except ValueError:
        pass
print('PASS_REAL_BLENDER_PED_SOURCE', bpy.app.version_string)
