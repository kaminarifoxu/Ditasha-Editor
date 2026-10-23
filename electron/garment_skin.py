"""Transfer weights from a fitted reference body; never mutate the user's template."""
import math
from pathlib import Path


def normalize_weights(values, limit=4):
    clean = sorted(((name, weight) for name, weight in values.items() if math.isfinite(weight) and weight > 1e-8), key=lambda item: (-item[1], item[0]))[:limit]
    total = sum(weight for _, weight in clean)
    if not total:
        raise ValueError('Referensi tidak memiliki weights tulang yang valid di permukaan terdekat.')
    return {name: weight / total for name, weight in clean}


def skin_garments(bpy, reference, garments, max_distance):
    from mathutils import Vector
    from mathutils.geometry import barycentric_transform
    from mathutils.bvhtree import BVHTree
    def armature_for(obj):
        return obj.find_armature()
    arms = {arm.name: arm for obj in reference if (arm := armature_for(obj)) is not None}
    if len(arms) != 1:
        raise ValueError('Template memerlukan satu armature dengan body mesh yang sudah di-skin.')
    arm = next(iter(arms.values()))
    if arm.animation_data and (arm.animation_data.action or len(arm.animation_data.nla_tracks)):
        raise ValueError('Hapus action/NLA pada template dan gunakan rest pose sebelum transfer.')
    if any(abs(b.matrix_basis[i][j] - (1 if i == j else 0)) > 1e-5 for b in arm.pose.bones for i in range(4) for j in range(4)):
        raise ValueError('Reset seluruh pose bone pada template ke rest pose sebelum transfer.')
    names = {bone.name for bone in arm.data.bones}
    if not any(name.startswith('SKEL_') for name in names):
        raise ValueError('Template harus memakai nama tulang skeleton GTA (SKEL_*).')
    vertices, triangles, weights = [], [], []
    scale = bpy.context.scene.unit_settings.scale_length
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError('Unit template tidak valid.')
    for obj in reference:
        if armature_for(obj) != arm:
            continue
        if obj.modifiers and any(mod.type != 'ARMATURE' and (mod.show_viewport or mod.show_render) for mod in obj.modifiers):
            raise ValueError('Apply modifier non-armature pada body referensi dahulu.')
        base = len(vertices)
        groups = {group.index: group.name for group in obj.vertex_groups if group.name in names}
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            if not all(math.isfinite(v) for v in point):
                raise ValueError('Koordinat referensi tidak valid.')
            vertices.append(point)
            weights.append(normalize_weights({groups[g.group]: g.weight for g in vertex.groups if g.group in groups}))
        if len(vertices) > 1000000:
            raise ValueError('Referensi maksimal satu juta vertex.')
        obj.data.calc_loop_triangles()
        triangles.extend(tuple(base + index for index in tri.vertices) for tri in obj.data.loop_triangles)
        if len(triangles) > 2000000:
            raise ValueError('Referensi maksimal dua juta triangle.')
    if not triangles:
        raise ValueError('Body referensi tidak memiliki triangle.')
    tree = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
    assignments = []
    count = 0
    farthest = 0
    # Validate the complete transfer before changing any garment weights.
    for obj in garments:
        if any(mod.type != 'ARMATURE' and (mod.show_viewport or mod.show_render) for mod in obj.modifiers):
            raise ValueError('Apply modifier pada clothing dahulu.')
        current = []
        for vertex in obj.data.vertices:
            count += 1
            if count > 500000:
                raise ValueError('Clothing maksimal 500 ribu vertex.')
            point = obj.matrix_world @ vertex.co
            if not all(math.isfinite(v) for v in point):
                raise ValueError('Koordinat clothing tidak valid.')
            hit, _, index, distance = tree.find_nearest(point)
            if hit is None or distance * scale > max_distance:
                raise ValueError('Clothing belum pas dengan body. Fit posisi/ukuran pada template; jarak melebihi batas transfer.')
            farthest = max(farthest, distance * scale)
            triangle = triangles[index]
            coeff = barycentric_transform(hit, *(vertices[i] for i in triangle), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
            combined = {}
            for weight, source in zip(coeff, triangle):
                for name, value in weights[source].items():
                    combined[name] = combined.get(name, 0) + max(0, weight) * value
            current.append(normalize_weights(combined))
        assignments.append((obj, current))
    if not count:
        raise ValueError('Clothing tidak memiliki vertex.')
    for obj, current in assignments:
        world = obj.matrix_world.copy()
        for mod in list(obj.modifiers):
            if mod.type == 'ARMATURE': obj.modifiers.remove(mod)
        obj.vertex_groups.clear()
        groups = {name: obj.vertex_groups.new(name=name) for name in sorted({name for value in current for name in value})}
        for index, value in enumerate(current):
            for name, weight in value.items(): groups[name].add([index], weight, 'REPLACE')
        obj.parent = arm
        obj.parent_type = 'OBJECT'
        obj.matrix_world = world
        modifier = obj.modifiers.new('DITASHA garment skin', 'ARMATURE')
        modifier.object = arm
    bpy.context.view_layer.update()
    return arm, {'vertices': count, 'meshes': len(garments), 'maxDistanceMeters': round(farthest, 6), 'influences': 4}


def run(bpy, job, output, review, preview_scene):
    # Automatic execution of embedded Python remains disabled for user .blend files.
    result = bpy.ops.wm.open_mainfile(filepath=job['reference'], load_ui=False, use_scripts=False)
    if 'FINISHED' not in result:
        raise ValueError('Template Blender tidak dapat dibuka.')
    reference = [obj for obj in bpy.data.objects if obj.type == 'MESH' and review.armature_for(obj)]
    if not reference:
        raise ValueError('Template tidak memiliki body yang sudah di-skin.')
    import clothing_workflow
    options = job.get('clothing', {})
    if options.get('source') == 'generate':
        garments = clothing_workflow.generate_shell(bpy, reference, options)
    else:
        before = set(bpy.data.objects)
        imported = review.import_source(bpy, job['source'])
        garments = [obj for obj in imported if obj not in before]
    arm, quality = skin_garments(bpy, reference, garments, job['maxDistance'])
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [arm, *garments]: obj.select_set(True)
    bpy.context.view_layer.objects.active = arm
    destination = Path(output) / 'ditasha-clothing-skinned.glb'
    result = bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', use_selection=True,
                                       export_animations=False, export_skins=True, export_all_influences=False)
    if 'FINISHED' not in result or not destination.is_file() or destination.stat().st_size > 128 * 1024 * 1024 or destination.open('rb').read(4) != b'glTF':
        raise ValueError('Ekspor GLB clothing gagal atau melebihi 128 MB.')
    warnings = []
    native = None
    # Preserve the editable skinned result even if native export validation fails.
    try: bpy.ops.file.pack_all()
    except Exception as exc: warnings.append('Sebagian asset Blender belum ter-pack: ' + str(exc))
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(output) / 'ditasha-result.blend'), copy=True)
    if options.get('native'):
        from native_bridge import source_image_node
        native = clothing_workflow.export_native(bpy, arm, garments, output, options['slot'], source_image_node)
        warnings += ['YDD pengganti slot lama; collection/YMT asli harus tetap terpasang. Tidak mendaftarkan slot baru.',
                     'Shader impor dikonversi ke diffuse sederhana; normal/specular kompleks perlu koreksi Blender. LOD mempertahankan geometri, belum pengurangan polygon.']
    # Preview the actual skinned clothing, using the reference body for context.
    objects = [*reference, *garments]
    def garment_preview(*args, **kwargs):
        return preview_scene(*args, **kwargs, source=True)
    preview = review.create_pose_previews(bpy, objects, output, garment_preview)
    try: preview['motion'] = review.add_walk_preview(bpy, objects, output, garment_preview)
    except Exception as exc: preview['warnings'].append('Walk preview: ' + str(exc))
    if job.get('clip'):
        from clip_review import add_clip_preview
        preview['motion'] = add_clip_preview(bpy, arm, objects, job['clip'], job['clipIndex'], output, garment_preview)
    return {'transferQuality': quality, 'nativeClothing': native, 'generated': options.get('source') == 'generate',
            'preview': preview, 'files': [destination.name, 'ditasha-result.blend'] + ([native['file'], 'fxmanifest.lua'] if native else []),
            'warnings': warnings + preview['warnings'] + ['Weights berasal dari body terdekat; periksa lipatan dan area lengan/paha.'] +
                        (['Generator menghasilkan shell permukaan body dengan tepi terbuka; pola, ketebalan dan fitting lanjutan dapat diedit di Blender.'] if options.get('source') == 'generate' else [])}
