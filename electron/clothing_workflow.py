"""Offline body-shell construction and conservative existing-slot native export."""
import importlib
import math
import re
from pathlib import Path


def generate_shell(bpy, reference, options):
    """Copy a bounded surface region, retaining UVs and per-vertex skin weights."""
    import bmesh
    from mathutils import Matrix
    lower, upper = options['lower'], options['upper']
    units = bpy.context.scene.unit_settings.scale_length
    if not math.isfinite(units) or units <= 0: raise ValueError('Unit body tidak valid.')
    gap = options['gap'] / units
    selected = reference if not options['body'] and len(reference)==1 else [obj for obj in reference if obj.name == options['body']]
    if len(selected) != 1:
        raise ValueError('Pilih satu nama body skinned, bukan rambut/sepatu. Mesh tersedia: ' + ', '.join(obj.name for obj in reference[:32]))
    source = selected[0]
    if not source.data.uv_layers:
        raise ValueError('Body generator memerlukan UV asli pada template.')
    if any(m.type != 'ARMATURE' and (m.show_viewport or m.show_render) for m in source.modifiers):
        raise ValueError('Apply modifier non-armature pada body sebelum membuat shell.')
    if len(source.data.vertices) > 500000:
        raise ValueError('Body generator maksimal 500 ribu vertex.')
    points = [source.matrix_world @ v.co for v in source.data.vertices]
    zmin, zmax = min(p.z for p in points), max(p.z for p in points)
    if zmax - zmin < 1e-6:
        raise ValueError('Body tidak memiliki tinggi pada sumbu Z; gunakan template GTA Z-up.')
    low, high = zmin + (zmax-zmin)*lower, zmin + (zmax-zmin)*upper
    clone = source.copy()
    clone.data = source.data.copy()
    clone.name = 'DITASHA_generated_clothing'
    bpy.context.collection.objects.link(clone)
    clone.matrix_world = source.matrix_world.copy()
    bm = bmesh.new()
    try:
        bm.from_mesh(clone.data)
        # Retain entire faces inside the chosen band: no stretched UVs or invented caps.
        outside = [v for v in bm.verts if not low <= (source.matrix_world @ v.co).z <= high]
        bmesh.ops.delete(bm, geom=outside, context='VERTS')
        if not bm.faces:
            raise ValueError('Rentang tinggi tidak menyisakan face; perluas batas bawah/atas.')
        bm.normal_update()
        normal_matrix = source.matrix_world.to_3x3().inverted().transposed()
        inverse = source.matrix_world.inverted()
        for vertex in bm.verts:
            normal = (normal_matrix @ vertex.normal).normalized()
            vertex.co = inverse @ (source.matrix_world @ vertex.co + normal * gap)
        bm.to_mesh(clone.data)
    except Exception:
        bpy.data.objects.remove(clone, do_unlink=True)
        raise
    finally:
        bm.free()
    # Plain fabric, independent of the skin image; generated geometry keeps the original UV.
    fabric = bpy.data.materials.new('DITASHA_fabric')
    fabric.use_nodes = True
    fabric.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (*options['color'], 1)
    clone.data.materials.clear()
    clone.data.materials.append(fabric)
    for face in clone.data.polygons: face.material_index = 0
    clone.data.update()
    return [clone]


def export_native(bpy, arm, garments, output, slot, image_node, shader_name='ped_default.sps'):
    """Export a replacement YDD. Never invent collection YMT slot registrations."""
    from mathutils import Matrix
    module = next((n for n in bpy.context.preferences.addons.keys() if n.lower().split('.')[-1] in ('sollumz', 'sollumz_dev')), None)
    if not module:
        raise ValueError('Ekspor YDD memerlukan Sollumz aktif.')
    if not re.fullmatch(r'(?:[a-z0-9_]+\^)?(?:head|jbib|uppr|lowr|feet|hand|accs|task|decl|hair|berd|teef)_\d{3}_[ur]', slot):
        raise ValueError('Nama slot pengganti tidak valid, contoh mp_m_freemode_01^jbib_000_u.')
    create_shader = importlib.import_module(module + '.ydr.shader_materials').create_shader
    helper = importlib.import_module(module + '.tools.drawablehelper')
    dictionary = bpy.data.objects.new(slot, None)
    dictionary.sollum_type = 'sollumz_drawable_dictionary'
    bpy.context.collection.objects.link(dictionary)
    drawable = arm.copy()
    drawable.data = arm.data.copy()
    bpy.context.collection.objects.link(drawable)
    drawable.name = slot.split('^')[-1]
    drawable.sollum_type = 'sollumz_drawable'
    drawable.parent = dictionary
    drawable.animation_data_clear()
    drawable.data.pose_position = 'REST'
    for bone in drawable.data.bones: helper.set_recommended_bone_properties(bone)
    clones = []
    texture_pixels, texture_images = 0, set()
    try:
        for source in garments:
            if not source.data.uv_layers:
                raise ValueError('Clothing native memerlukan UV pada setiap mesh.')
            clone = source.copy(); clone.data = source.data.copy()
            bpy.context.collection.objects.link(clone); clones.append(clone)
            clone.parent = drawable
            clone.matrix_parent_inverse = Matrix.Identity(4)
            clone.matrix_world = source.matrix_world.copy()
            clone.sollum_type = 'sollumz_drawable_model'
            clone.constraints.clear()
            # Sollumz binds shader UV indices by canonical names, not Blender's
            # active UV layer. GLB/FBX/OBJ names such as UVMap otherwise export no UVs.
            for index, layer in enumerate(clone.data.uv_layers): layer.name = f'DITASHA_UV_{index}'
            for index, layer in enumerate(clone.data.uv_layers): layer.name = f'UVMap {index}'
            for mod in clone.modifiers:
                if mod.type == 'ARMATURE': mod.object = drawable
            converted = []
            for index, material in enumerate(list(clone.data.materials) or [None]):
                if material and material.sollum_type == 'sollumz_material_shader':
                    native = material.copy()
                else:
                    # Simple diffuse only. Never guess a normal/specular channel conversion.
                    native = create_shader(shader_name)
                    node = image_node(material) if material else None
                    if node and (not node.image or not node.image.has_data):
                        raise ValueError('Diffuse image hilang pada ' + source.name)
                    image = node.image.copy() if node else None
                    if image is not None:
                        # Generated padding/painted pixels are not copied by Image.copy().
                        import numpy as np
                        values=np.empty(node.image.size[0]*node.image.size[1]*4,dtype=np.float32)
                        node.image.pixels.foreach_get(values);image.pixels.foreach_set(values);image.update()
                    if image is None:
                        image = bpy.data.images.new(f'ditasha_fabric_{len(clones)}_{index}', width=4, height=4)
                        bsdf = material.node_tree.nodes.get('Principled BSDF') if material and material.node_tree else None
                        color = tuple(bsdf.inputs['Base Color'].default_value) if bsdf else tuple(material.diffuse_color) if material else (.5,.5,.5,1)
                        encoded=[12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055 for v in color[:3]]+[color[3]]
                        image.pixels[:] = encoded * 16
                    image.name = f'ditasha_cloth_{len(clones)}_{index}'
                    native.node_tree.nodes['DiffuseSampler'].image = image
                for node in native.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image:
                        # Image loading is lazy in background Blender. Touch a
                        # pixel before interpreting has_data as an actual failure.
                        node.image.pixels[:4]
                        if not node.image.has_data: raise ValueError('Gambar shader native tidak terbaca.')
                        from native_dds import pack_image
                        if node.image.as_pointer() not in texture_images:
                            texture_images.add(node.image.as_pointer())
                            texture_pixels += node.image.size[0]*node.image.size[1]
                            if texture_pixels > 64*1024*1024: raise ValueError('Total gambar ekspor clothing maksimal 64 megapixel.')
                        pack_image(bpy,node.image,f'ditasha_{len(clones)}_{index}_{len(converted)}_'+node.name,output)
                        node.texture_properties.embedded = True
                converted.append(native)
            clone.data.materials.clear()
            for material in converted: clone.data.materials.append(material)
            # Byte colors are required by ped shaders; explicit neutral values avoid black clothing.
            if not clone.data.color_attributes:
                color = clone.data.color_attributes.new(name='Color 1', type='BYTE_COLOR', domain='CORNER')
                for value in color.data: value.color = (1,1,1,1)
            if not clone.data.color_attributes.get('Color 2'):
                wind = clone.data.color_attributes.new(name='Color 2', type='BYTE_COLOR', domain='CORNER')
                for value in wind.data: value.color = (0,0,0,0)
            clone.sz_lods.high.mesh = clone.data
            # Conservative copies retain UVs and weights at every distance; no blind decimation.
            clone.sz_lods.medium.mesh = clone.data.copy()
            clone.sz_lods.low.mesh = clone.data.copy()
            clone.sz_lods.very_low.mesh = clone.data.copy()
        stream = Path(output) / 'stream'; stream.mkdir(exist_ok=True)
        bpy.ops.object.select_all(action='DESELECT')
        dictionary.select_set(True); bpy.context.view_layer.objects.active = dictionary
        result = bpy.ops.sollumz.export_assets(directory=str(stream), direct_export=True, use_custom_settings=True,
                    target_formats={'NATIVE'}, target_versions={'GEN8'}, limit_to_selected=True,
                    exclude_skeleton=False, apply_transforms=False, mesh_domain='FACE_CORNER')
        target = stream / (slot + '.ydd')
        if 'FINISHED' not in result or not target.is_file() or target.stat().st_size > 128*1024*1024 or target.open('rb').read(4) != b'RSC7':
            raise ValueError('Ekspor tidak menghasilkan YDD native yang valid.')
        # Verify each user's actual output, not only our fixtures. A source preview
        # must not hide an exporter dropping UVs, skin data or embedded images.
        before = set(bpy.data.objects)
        verified = {'meshes':0, 'vertices':0, 'lodMeshes':0}
        try:
            status = bpy.ops.sollumz.import_assets(directory=str(stream), files=[{'name':target.name}],
                         use_custom_settings=True, textures_mode='PACK', dwd_import_external_skeleton='NO')
            imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == 'MESH']
            if 'FINISHED' not in status or not imported: raise ValueError('YDD hasil tidak dapat diimpor ulang.')
            from native_bridge import mesh_levels
            for obj in imported:
                if obj.find_armature() is None: raise ValueError('YDD hasil kehilangan armature binding.')
                verified['meshes'] += 1
                for mesh in mesh_levels(obj):
                    if not len(mesh.vertices): continue
                    verified['lodMeshes'] += 1
                    if not mesh.uv_layers: raise ValueError('YDD hasil kehilangan UV pada salah satu LOD.')
                    for vertex in mesh.vertices:
                        weights = [g.weight for g in vertex.groups if g.weight > 1e-6]
                        if not weights or len(weights) > 4 or abs(sum(weights)-1) > .02:
                            raise ValueError('Weights YDD hasil tidak lolos pemeriksaan ulang.')
                        verified['vertices'] += 1
                    for material in mesh.materials:
                        diffuse = material.node_tree.nodes.get('DiffuseSampler') if material and material.node_tree else None
                        if diffuse and diffuse.image: diffuse.image.pixels[:4]
                        if not diffuse or not diffuse.image or not diffuse.image.has_data:
                            raise ValueError('YDD hasil kehilangan diffuse image embedded.')
        finally:
            for obj in list(bpy.data.objects):
                if obj not in before: bpy.data.objects.remove(obj, do_unlink=True)
        (Path(output)/'fxmanifest.lua').write_text("fx_version 'cerulean'\ngame 'gta5'\nauthor 'Ditasha-Workshop'\n", encoding='utf-8')
        return {'file': 'stream/' + target.name, 'slot': slot, 'kind': 'existing-slot-replacement',
                'textures': 'embedded', 'lods': 'geometry-preserving copies', 'verified':verified, 'ymt': 'unchanged; existing collection required'}
    finally:
        for obj in [*clones, drawable, dictionary]: bpy.data.objects.remove(obj, do_unlink=True)
