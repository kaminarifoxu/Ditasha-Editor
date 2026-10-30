"""DITASHA's rig review. Diagnostic poses never modify exported ped resources."""
import math
from pathlib import Path
import json

POSES = (
    ('rest', 'Pose awal', {}),
    ('arms', 'Uji lengan', {'SKEL_L_UpperArm': (0, 0, -.25), 'SKEL_R_UpperArm': (0, 0, .25),
                          'SKEL_L_Forearm': (1.0, 0, 0), 'SKEL_R_Forearm': (-1.0, 0, 0)}),
    ('legs', 'Uji kaki', {'SKEL_L_Thigh': (-.45, 0, 0), 'SKEL_L_Calf': (.8, 0, 0),
                        'SKEL_R_Thigh': (.35, 0, 0), 'SKEL_R_Calf': (.1, 0, 0)}),
)


def import_source(bpy, filename):
    file = Path(filename)
    if file.suffix.lower() == '.glb':
        result = bpy.ops.import_scene.gltf(filepath=str(file))
    elif file.suffix.lower() == '.fbx':
        result = bpy.ops.import_scene.fbx(filepath=str(file))
    elif file.suffix.lower() == '.blend':
        with bpy.data.libraries.load(str(file),link=False) as (source,target):
            if len(source.objects)>2000: raise ValueError('Proyek sumber maksimal 2000 objek.')
            target.objects=list(source.objects)
        for obj in target.objects:
            if obj is not None and obj.name not in bpy.context.scene.objects: bpy.context.collection.objects.link(obj)
        result={'FINISHED'}
    elif file.suffix.lower() == '.obj':
        result = bpy.ops.wm.obj_import(filepath=str(file))
    else:
        raise ValueError('Pilih GLB, FBX, OBJ atau proyek Blender.')
    if 'FINISHED' not in result:
        raise ValueError('Blender gagal mengimpor model sumber.')
    bpy.context.view_layer.update()
    custom_shapes={bone.custom_shape for arm in bpy.data.objects if arm.type=='ARMATURE' for bone in arm.pose.bones if bone.custom_shape is not None}
    objects = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.polygons) and o not in custom_shapes]
    if not objects:
        raise ValueError('Model sumber tidak memiliki mesh berisi face.')
    return objects


def audit_source(bpy, objects, image_node):
    from mathutils import Vector
    result = dict(meshes=len(objects), vertices=0, triangles=0, armatures=0,
                  missingUV=[], missingTextures=[], solidMaterials=[], unappliedTransforms=[],
                  negativeScale=[], degenerateTriangles=0)
    minimum, maximum = [math.inf] * 3, [-math.inf] * 3
    missing, solid, arms = set(), set(), set()
    for obj in objects:
        mesh = obj.data
        result['vertices'] += len(mesh.vertices)
        if result['vertices'] > 2000000:
            raise ValueError('Pemeriksaan sumber maksimum 2 juta vertex.')
        if not mesh.uv_layers:
            result['missingUV'].append(obj.name)
        if any(abs(v - 1) > 1e-4 for v in obj.scale) or obj.rotation_euler.to_matrix().to_quaternion().angle > 1e-4:
            result['unappliedTransforms'].append(obj.name)
        if obj.matrix_world.to_3x3().determinant() < 0:
            result['negativeScale'].append(obj.name)
        arm = armature_for(obj)
        if arm:
            arms.add(arm.name)
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            if not all(math.isfinite(v) for v in point):
                raise ValueError('Koordinat model sumber tidak valid.')
            for axis in range(3):
                minimum[axis] = min(minimum[axis], point[axis])
                maximum[axis] = max(maximum[axis], point[axis])
        mesh.calc_loop_triangles()
        result['triangles'] += len(mesh.loop_triangles)
        result['degenerateTriangles'] += sum(t.area < 1e-12 for t in mesh.loop_triangles)
        if not mesh.materials:
            solid.add(obj.name + ' (tanpa material)')
        for material in mesh.materials:
            node = image_node(material)
            if node and (not node.image or not node.image.has_data):
                missing.add(material.name)
            elif not node:
                solid.add(material.name if material else '(material kosong)')
    result['armatures'] = len(arms)
    result['dimensions'] = [round(maximum[i] - minimum[i], 6) for i in range(3)]
    result['unitScale'] = bpy.context.scene.unit_settings.scale_length
    result['dimensionsMeters'] = [round(v * result['unitScale'], 6) for v in result['dimensions']]
    result['missingTextures'], result['solidMaterials'] = sorted(missing)[:64], sorted(solid)[:64]
    for key in ('missingUV', 'unappliedTransforms', 'negativeScale'):
        result[key] = result[key][:64]
    warnings = []
    for key, text in [('missingUV', 'objek belum memiliki UV'), ('missingTextures', 'material memiliki gambar base color yang tidak dapat dibaca'),
                      ('unappliedTransforms', 'objek memiliki rotation/scale yang belum diterapkan'), ('negativeScale', 'objek memakai transform cermin')]:
        if result[key]:
            warnings.append(f'{len(result[key])} {text}. Periksa di Blender sebelum rig.')
    if result['degenerateTriangles']:
        warnings.append(f"{result['degenerateTriangles']} triangle memiliki area hampir nol.")
    if result['triangles'] > 250000:
        warnings.append('Model melebihi batas preview 250 ribu triangle; kurangi geometri untuk preview.')
    warnings.append('Periksa A/T-pose dan proporsi secara visual; pemeriksaan ini tidak menilai anatomi atau menjamin rig berhasil.')
    result['warnings'] = warnings
    return result


def configure_muto(settings, options):
    """Use the pinned engine's real reference-body/settings API, not a fake rig type."""
    reference = options.get('reference', 'auto')
    height = options.get('height', 0)
    if reference not in ('auto', 'mp_m', 'mp_f') or not isinstance(height, (int, float)) or isinstance(height, bool) or not math.isfinite(height) or (height != 0 and not .5 <= height <= 3):
        raise ValueError('Referensi/tinggi rig tidak valid.')
    mapping = {'fingers': 'detail_fingers', 'face': 'detail_face', 'handTemplate': 'hand_template',
               'faceTemplate': 'face_template', 'headParts': 'head_parts'}
    settings.ref_body = reference
    settings.engine = 'TRANSFER'
    settings.use_votes = True
    settings.export_lods = True
    for key, prop in mapping.items():
        value = options.get(key, True)
        if not isinstance(value, bool):
            raise ValueError('Opsi rig harus aktif/nonaktif.')
        setattr(settings, prop, value)
    return height


def armature_for(obj):
    arm = obj.find_armature()
    if arm is not None:
        return arm
    parent = obj.parent
    while parent is not None:
        if parent.type == 'ARMATURE':
            return parent
        parent = parent.parent
    return None


def run_muto(worker, bpy, arguments, options, progress=None):
    # The pinned batch worker imports the model before reading Scene.mpr. Apply
    # settings after import too, in case a multi-scene GLB changes active scenes.
    height = configure_muto(bpy.context.scene.mpr, options)
    original_import = worker._import
    original_steps = getattr(worker, 'STEPS', None)
    notify = progress or (lambda stage: None)
    class TracedSteps(tuple):
        def __iter__(self):
            for item in super().__iter__():
                notify(item[0])
                yield item
    def configured_import(source):
        notify('import')
        original_import(source)
        # glTF creates mesh objects used only to draw bone controls (Icosphere).
        # Muto joins every mesh in bpy.data.objects, including these controls,
        # which changes body bounds and corrupts automatic joint placement.
        if hasattr(bpy, 'data'):
            bones=[bone for arm in bpy.data.objects if arm.type=='ARMATURE' for bone in arm.pose.bones]
            helpers={bone.custom_shape for bone in bones if bone.custom_shape is not None and bone.custom_shape.type=='MESH'}
            for bone in bones:
                if bone.custom_shape in helpers: bone.custom_shape=None
            for helper in helpers:
                bpy.data.objects.remove(helper,do_unlink=True)
            if helpers: print('DITASHA_PED_IGNORED_BONE_CONTROLS',len(helpers),flush=True)
        configure_muto(bpy.context.scene.mpr, options)
        notify('prepare')
    worker._import = configured_import
    if original_steps is not None:
        worker.STEPS = TracedSteps(original_steps)
    try:
        return worker.run({**arguments, 'height': height})
    finally:
        worker._import = original_import
        if original_steps is not None:
            worker.STEPS = original_steps


def audit_rig(objects, mesh_levels):
    result = dict(vertices=0, unweighted=0, overFour=0, unnormalized=0, invalidWeights=0,
                  missingUV=[], missingTextures=[], missingLOD=[], armatures=0, bones=0)
    arms, missing_textures = {}, set()
    for obj in objects:
        arm = armature_for(obj)
        names = set(b.name for b in arm.data.bones) if arm else set()
        if arm:
            arms[arm.name] = arm
        groups = {g.index: g.name for g in obj.vertex_groups}
        levels = list(mesh_levels(obj))
        if not levels:
            continue
        if len(levels) < 3:
            result['missingLOD'].append(obj.name)
        for mesh in levels:
            if not mesh.uv_layers and obj.name not in result['missingUV']:
                result['missingUV'].append(obj.name)
            for material in mesh.materials:
                if not material or not material.node_tree:
                    missing_textures.add(material.name if material else '(material kosong)')
                    continue
                nodes = material.node_tree.nodes
                diffuse = next((nodes.get(n) for n in ('DiffuseSampler', 'TextureSampler', 'DiffuseSampler2') if nodes.get(n)), None)
                if not diffuse or not diffuse.image or not diffuse.image.has_data:
                    missing_textures.add(material.name)
            for vertex in mesh.vertices:
                result['vertices'] += 1
                if result['vertices'] > 2000000:
                    raise ValueError('Audit rig melebihi 2 juta vertex.')
                values = [g.weight for g in vertex.groups if groups.get(g.group) in names]
                invalid = any(not math.isfinite(w) or w < 0 or w > 1 for w in values)
                positive = [w for w in values if math.isfinite(w) and w > 1e-6]
                result['invalidWeights'] += int(invalid)
                result['unweighted'] += int(not positive)
                result['overFour'] += int(len(positive) > 4)
                result['unnormalized'] += int(bool(positive) and abs(sum(positive) - 1) > .02)
    result['armatures'] = len(arms)
    result['bones'] = sum(len(a.data.bones) for a in arms.values())
    result['missingTextures'] = sorted(missing_textures)[:64]
    result['missingUV'] = result['missingUV'][:64]
    result['missingLOD'] = result['missingLOD'][:64]
    warnings = []
    for key, label in [('unweighted', 'vertex tanpa bobot tulang'), ('overFour', 'vertex dengan lebih dari 4 pengaruh'),
                       ('unnormalized', 'vertex dengan total bobot di luar toleransi'), ('invalidWeights', 'vertex dengan bobot tidak valid')]:
        if result[key]:
            warnings.append(f"{result[key]} {label}; koreksi weights di Blender.")
    for key, label in [('missingUV', 'objek tanpa UV'), ('missingTextures', 'material tanpa diffuse texture yang dapat dibaca'),
                       ('missingLOD', 'objek dengan kurang dari 3 mesh LOD')]:
        if result[key]:
            warnings.append(f"{len(result[key])} {label}; periksa .blend hasil.")
    result['warnings'] = warnings
    return result


def create_pose_previews(bpy, objects, output, preview_scene):
    """Bake static evaluated poses into separate bounded files; restore every bone."""
    from mathutils import Euler
    from types import SimpleNamespace
    root = SimpleNamespace(children_recursive=objects)
    arms = {a.name: a for o in objects if (a := armature_for(o)) is not None}
    cache = {'ids': {}, 'textures': []}
    available, warnings = [], []
    for pose_id, label, rotations in POSES:
        saved = []
        pose_positions = {id(a.data): (a.data, a.data.pose_position) for a in arms.values()}
        try:
            if rotations and not arms:
                raise ValueError('Armature hasil tidak tersedia.')
            changed = 0
            for arm in arms.values():
                animation = arm.animation_data
                if rotations and animation and (animation.action or len(animation.nla_tracks)):
                    raise ValueError('Armature memiliki animasi aktif; periksa pose di Blender.')
                saved.append([(b, b.matrix_basis.copy()) for b in arm.pose.bones])
                arm.data.pose_position = 'POSE'
                for name, rotation in rotations.items():
                    bone = arm.pose.bones.get(name)
                    if bone:
                        bone.matrix_basis = bone.matrix_basis @ Euler(rotation, 'XYZ').to_matrix().to_4x4()
                        changed += 1
            if rotations and not changed:
                raise ValueError('Tulang humanoid untuk pose ini tidak tersedia.')
            bpy.context.view_layer.update()
            filename = 'preview.json' if pose_id == 'rest' else 'preview-' + pose_id + '.json'
            summary = preview_scene(bpy, root, output, filename=filename, evaluated=True, texture_cache=cache)
            available.append({'id': pose_id, 'label': label})
        except Exception as exc:
            if pose_id == 'rest':
                raise
            warnings.append(label + ': ' + str(exc))
            (Path(output) / ('preview-' + pose_id + '.json')).unlink(missing_ok=True)
        finally:
            for bones in saved:
                for bone, matrix in bones:
                    bone.matrix_basis = matrix
            for data, pose_position in pose_positions.values():
                data.pose_position = pose_position
            bpy.context.view_layer.update()
    # Each file stays self-contained. IPC only accepts these fixed pose identifiers.
    for pose in available:
        filename = 'preview.json' if pose['id'] == 'rest' else 'preview-' + pose['id'] + '.json'
        file = Path(output) / filename
        data = json.loads(file.read_text(encoding='utf-8'))
        data['poses'], data['pose'] = available, pose['id']
        text = json.dumps(data, separators=(',', ':'))
        if len(text.encode('utf-8')) > 48 * 1024 * 1024:
            raise ValueError('Preview pose melebihi 48 MB.')
        file.write_text(text, encoding='utf-8')
    return {**summary, 'poses': available, 'warnings': warnings}


def add_walk_preview(bpy, objects, output, preview_scene):
    """Evaluate a procedural skeleton walk test; keep exported rig and actions untouched."""
    import base64
    import sys
    from array import array
    from mathutils import Euler
    from types import SimpleNamespace
    rest_file = Path(output) / 'preview.json'
    data = json.loads(rest_file.read_text(encoding='utf-8'))
    count = sum(len(mesh['positions']) for mesh in data['meshes'])
    frames_count = min(16, (16 * 1024 * 1024) // max(count * 4, 1))
    if frames_count < 4:
        raise ValueError('Walk preview memerlukan model lebih ringan (buffer animasi maksimal 16 MB).')
    arms = {a.name: a for obj in objects if (a := armature_for(obj)) is not None}
    if not arms:
        raise ValueError('Armature tidak tersedia untuk walk test.')
    if any(a.animation_data and (a.animation_data.action or len(a.animation_data.nla_tracks)) for a in arms.values()):
        raise ValueError('Rig memiliki animasi aktif; walk test tidak menimpa action sumber.')
    saved = [(bone, bone.matrix_basis.copy()) for arm in arms.values() for bone in arm.pose.bones]
    pose_positions = [(a.data, a.data.pose_position) for a in arms.values()]
    frames = []
    temp = Path(output) / 'preview-motion-tmp.json'
    cache = {'ids': {}, 'textures': []}
    try:
        for frame in range(frames_count):
            for bone, matrix in saved:
                bone.matrix_basis = matrix
            changed = 0
            phase = frame / frames_count * math.tau
            rotations = {}
            for side, shift in [('L', 0), ('R', math.pi)]:
                swing = math.sin(phase + shift)
                rotations['SKEL_' + side + '_Thigh'] = (.42 * swing, 0, 0)
                rotations['SKEL_' + side + '_Calf'] = (.65 * max(0, -swing), 0, 0)
                rotations['SKEL_' + side + '_UpperArm'] = (-.3 * swing, 0, 0)
                rotations['SKEL_' + side + '_Forearm'] = (.2, 0, 0)
            for arm in arms.values():
                arm.data.pose_position = 'POSE'
                for name, rotation in rotations.items():
                    bone = arm.pose.bones.get(name)
                    if bone:
                        bone.matrix_basis = bone.matrix_basis @ Euler(rotation, 'XYZ').to_matrix().to_4x4()
                        changed += 1
            if not changed:
                raise ValueError('Tulang GTA humanoid tidak ditemukan untuk walk test.')
            bpy.context.view_layer.update()
            preview_scene(bpy, SimpleNamespace(children_recursive=objects), output,
                          filename=temp.name, evaluated=True, texture_cache=cache)
            sample = json.loads(temp.read_text(encoding='utf-8'))
            if len(sample['meshes']) != len(data['meshes']) or any(a['name'] != b['name'] or len(a['positions']) != len(b['positions']) for a, b in zip(sample['meshes'], data['meshes'])):
                raise ValueError('Topologi preview berubah selama animasi.')
            values = array('f', (v for mesh in sample['meshes'] for v in mesh['positions']))
            if sys.byteorder != 'little':
                values.byteswap()
            frames.append(base64.b64encode(values.tobytes()).decode('ascii'))
        data['motion'] = {'version': 1, 'label': 'Walk · procedural weight test', 'fps': frames_count / 1.4,
                          'frames': frames, 'floatCount': count}
        text = json.dumps(data, separators=(',', ':'))
        if len(text.encode('utf-8')) > 48 * 1024 * 1024:
            raise ValueError('Preview dengan animasi melebihi 48 MB.')
        rest_file.write_text(text, encoding='utf-8')
        return {'frames': frames_count, 'duration': 1.4, 'kind': 'procedural-weight-test'}
    finally:
        temp.unlink(missing_ok=True)
        for bone, matrix in saved:
            bone.matrix_basis = matrix
        for arm, position in pose_positions:
            arm.pose_position = position
        bpy.context.view_layer.update()
