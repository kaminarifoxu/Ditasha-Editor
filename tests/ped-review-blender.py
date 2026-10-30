"""Run with Blender 5.2 Python or official bpy: python tests/ped-review-blender.py."""
import bpy
import importlib.util
import json
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
def load(name, file):
    spec = importlib.util.spec_from_file_location(name, root / 'electron' / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
review = load('review', 'ped_review.py')
bridge = load('bridge', 'native_bridge.py')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.types.Object.sollum_type = bpy.props.StringProperty(default='')
arm_data = bpy.data.armatures.new('ReviewSkeleton')
arm = bpy.data.objects.new('ReviewRig', arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, x in [('SKEL_L_Forearm', 0), ('SKEL_L_Thigh', 1)]:
    bone = arm_data.edit_bones.new(name)
    bone.head, bone.tail = (x, 0, 0), (x, 0, 1)
bpy.ops.object.mode_set(mode='OBJECT')
mesh = bpy.data.meshes.new('ReviewSkin')
mesh.from_pydata([(0, 0, 0), (.2, 0, 0), (0, 0, 1), (1, 0, 0), (1.2, 0, 0), (1, 0, 1)], [], [(0, 1, 2), (3, 4, 5)])
mesh.uv_layers.new(name='UVMap')
obj = bpy.data.objects.new('ReviewBody', mesh)
bpy.context.collection.objects.link(obj)
obj.sollum_type = 'sollumz_drawable_model'
obj.parent = arm
for name, indices in [('SKEL_L_Forearm', [0, 1, 2]), ('SKEL_L_Thigh', [3, 4, 5])]:
    obj.vertex_groups.new(name=name).add(indices, 1, 'REPLACE')
modifier = obj.modifiers.new('ActualSkinning', 'ARMATURE')
modifier.object = arm
material = bpy.data.materials.new('Skin')
material.use_nodes = True
node = material.node_tree.nodes.new('ShaderNodeTexImage')
node.name = 'DiffuseSampler'
node.image = bpy.data.images.new('SourceTexture', 2, 2, alpha=True)
node.image.pixels.foreach_set([.8, .2, .1, 1] * 4)
node.image.update()
mesh.materials.append(material)
arm_data.pose_position = 'REST'
bpy.context.view_layer.update()
original = {b.name: b.matrix_basis.copy() for b in arm.pose.bones}
with tempfile.TemporaryDirectory() as directory:
    output = Path(directory)
    native = output / 'existing.ydd'
    native.write_bytes(b'unchanged native export')
    audit = review.audit_rig([obj], bridge.mesh_levels)
    assert audit['unweighted'] == audit['overFour'] == audit['invalidWeights'] == 0
    result = review.create_pose_previews(bpy, [obj], output, bridge.preview_scene)
    assert [p['id'] for p in result['poses']] == ['rest', 'arms', 'legs'], result
    frames = {key: json.loads((output / filename).read_text()) for key, filename in [('rest', 'preview.json'), ('arms', 'preview-arms.json'), ('legs', 'preview-legs.json')]}
    positions = {key: frame['meshes'][0]['positions'] for key, frame in frames.items()}
    assert positions['rest'] != positions['arms'], 'Armature modifier did not deform the arm preview'
    assert positions['rest'] != positions['legs'], 'Armature modifier did not deform the leg preview'
    assert all(frame['triangles'] == 2 and len(frame['textures']) == 1 for frame in frames.values())
    assert arm_data.pose_position == 'REST'
    for bone in arm.pose.bones:
        assert all(abs(bone.matrix_basis[i][j] - original[bone.name][i][j]) < 1e-6 for i in range(4) for j in range(4))
    assert len(bpy.data.objects) == 2, 'Temporary evaluated objects leaked'
    assert native.read_bytes() == b'unchanged native export'
    def fail_arms(*args, **kwargs):
        if kwargs.get('filename') == 'preview-arms.json':
            raise ValueError('injected preview failure')
        return bridge.preview_scene(*args, **kwargs)
    failed = review.create_pose_previews(bpy, [obj], output, fail_arms)
    assert [p['id'] for p in failed['poses']] == ['rest', 'legs']
    assert failed['warnings'] and not (output / 'preview-arms.json').exists()
    assert arm_data.pose_position == 'REST'
    for bone in arm.pose.bones:
        assert all(abs(bone.matrix_basis[i][j] - original[bone.name][i][j]) < 1e-6 for i in range(4) for j in range(4))
print('PASS_REAL_BLENDER_PED_REVIEW', bpy.app.version_string)
