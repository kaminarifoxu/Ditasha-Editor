"""DITASHA's offline Blender job bridge. Third-party addons remain separately installed.
No network access, pip installation, or downloads are performed by this script.
"""
import importlib
import importlib.util
import json
import math
import re
import sys
import traceback
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import xml.etree.ElementTree as ET


def read_xml(path):
    if Path(path).stat().st_size > 8 * 1024 * 1024:
        raise ValueError('Metadata maksimum 8 MB.')
    data = Path(path).read_bytes()
    text = data.decode('utf-8-sig')
    if len(data) > 8 * 1024 * 1024 or re.search(r'<!\s*(?:DOCTYPE|ENTITY)', text, re.I):
        raise ValueError('Metadata XML terlalu besar atau memakai DTD/entity.')
    return ET.fromstring(text)


def prepare_metadata(job, model, output):
    cols = read_xml(job['carcols'])
    items = cols.findall('./Sirens/Item')
    selected = job.get('donorSirenId', 0)
    if selected:
        items = [i for i in items if i.find('id') is not None and i.find('id').get('value') == str(selected)]
    if len(items) != 1:
        raise ValueError('Donor carcols harus memiliki satu setting siren, atau tentukan ID donor yang benar.')
    root = ET.Element('CVehicleModelInfoVarGlobal')
    sirens = ET.SubElement(root, 'Sirens')
    item = items[0]
    item.find('id').set('value', str(job['sirenId']))
    sirens.append(item)
    variations = read_xml(job['variations'])
    matches = [i for i in variations.findall('./variationData/Item') if (i.findtext('modelName') or '').lower() == model.lower()]
    if len(matches) != 1:
        raise ValueError('carvariations target tidak memiliki satu modelName yang cocok: ' + model)
    entry = matches[0]
    settings = entry.find('sirenSettings')
    if settings is None:
        settings = ET.SubElement(entry, 'sirenSettings')
    settings.set('value', str(job['sirenId']))
    variation_root = ET.Element('CVehicleModelInfoVariation')
    ET.SubElement(variation_root, 'variationData').append(entry)
    vehicles = read_xml(job['vehicles'])
    matches = [i for i in vehicles.findall('./InitDatas/Item') if (i.findtext('modelName') or '').lower() == model.lower()]
    if len(matches) != 1:
        raise ValueError('vehicles.meta target tidak cocok dengan model.')
    for other in list(vehicles.find('InitDatas')):
        if other is not matches[0]:
            vehicles.find('InitDatas').remove(other)
    for tag, value in [('vehicleClass', 'VC_EMERGENCY'), ('audioNameHash', 'POLICE')]:
        element = matches[0].find(tag)
        if element is None:
            element = ET.SubElement(matches[0], tag)
        element.text = value
    data = output / 'data'
    data.mkdir(exist_ok=True)
    for name, tree in [('carcols.meta', root), ('carvariations.meta', variation_root), ('vehicles.meta', vehicles)]:
        ET.indent(tree)
        ET.ElementTree(tree).write(data / name, encoding='utf-8', xml_declaration=True)
    (output / 'fxmanifest.lua').write_text("fx_version 'cerulean'\ngame 'gta5'\nauthor 'Ditasha-Workshop'\nfiles { 'data/*.meta' }\ndata_file 'CARCOLS_FILE' 'data/carcols.meta'\ndata_file 'VEHICLE_VARIATION_FILE' 'data/carvariations.meta'\ndata_file 'VEHICLE_METADATA_FILE' 'data/vehicles.meta'\n", encoding='utf-8')


def engine_info(bpy):
    enabled = list(bpy.context.preferences.addons.keys())
    sollumz = next((n for n in enabled if n.lower().split('.')[-1] in ('sollumz', 'sollumz_dev')), None)
    muto = next((n for n in enabled if 'muto_ped_rig' in n.lower()), None)
    native = False
    if sollumz:
        try:
            native = bool(importlib.import_module(sollumz + '.dependencies').IS_SZIO_NATIVE_AVAILABLE)
        except Exception:
            pass
    return {'blender': bpy.app.version_string, 'sollumz': sollumz, 'muto': muto, 'native': native}


def import_vehicle(bpy, filename):
    before = set(bpy.data.objects)
    file = Path(filename)
    if file.name.lower().endswith('_hi.yft') or file.name.lower().endswith('_hi.yft.xml'):
        raise ValueError('Pilih YFT dasar, dengan _hi.YFT di folder yang sama.')
    result = bpy.ops.sollumz.import_assets(directory=str(file.parent), files=[{'name': file.name}], use_custom_settings=True, split_by_group=True, textures_mode='PACK')
    roots = [o for o in bpy.data.objects if o not in before and getattr(o, 'sollum_type', '') == 'sollumz_fragment' and o.type == 'ARMATURE']
    if 'FINISHED' not in result or len(roots) != 1:
        raise RuntimeError('Sollumz gagal mengimpor satu fragment kendaraan.')
    return roots[0]


def mesh_levels(obj):
    seen = set()
    levels = getattr(obj, 'sz_lods', None)
    if levels:
        for key in ('very_high', 'high', 'medium', 'low', 'very_low'):
            mesh = getattr(levels, key).mesh
            if mesh and mesh.as_pointer() not in seen:
                seen.add(mesh.as_pointer())
                yield mesh
    if obj.data and obj.data.as_pointer() not in seen:
        yield obj.data


def badge_candidates(fragment):
    result = []
    for obj in fragment.children_recursive:
        if obj.type != 'MESH' or getattr(obj, 'sollum_type', '') != 'sollumz_drawable_model':
            continue
        count = 0
        for mesh in mesh_levels(obj):
            for face in mesh.polygons:
                material = mesh.materials[face.material_index] if face.material_index < len(mesh.materials) else None
                shader = getattr(getattr(material, 'shader_properties', None), 'filename', '')
                names = ' '.join([obj.name, material.name if material else '', shader]).lower()
                if re.search(r'badge|emblem', names):
                    count += 1
        if 0 < count <= 10000:
            result.append({'name': obj.name, 'faces': count})
    return result


def detach_mesh_levels(obj):
    """Copy selected LOD datablocks before deleting faces shared with other objects."""
    levels = getattr(obj, 'sz_lods', None)
    copies = {}
    if levels:
        for key in ('very_high', 'high', 'medium', 'low', 'very_low'):
            level = getattr(levels, key)
            mesh = level.mesh
            if mesh:
                pointer = mesh.as_pointer()
                if pointer not in copies:
                    copies[pointer] = mesh.copy()
                level.mesh = copies[pointer]
    if obj.data and obj.data not in copies.values():
        obj.data = obj.data.copy()


def debadge(fragment, selected):
    import bmesh
    candidates = {r['name'] for r in badge_candidates(fragment)}
    if not selected or not set(selected).issubset(candidates):
        raise ValueError('Analisis dan pilih kandidat badge sebelum ekspor.')
    count = 0
    seen = set()
    for obj in fragment.children_recursive:
        if obj.name not in selected:
            continue
        detach_mesh_levels(obj)
        for mesh in mesh_levels(obj):
            if mesh.as_pointer() in seen:
                continue
            seen.add(mesh.as_pointer())
            ids = {i for i, material in enumerate(mesh.materials) if re.search(r'badge|emblem', ' '.join([obj.name, material.name if material else '', getattr(getattr(material, 'shader_properties', None), 'filename', '')]).lower())}
            bm = bmesh.new()
            try:
                bm.from_mesh(mesh)
                faces = [f for f in bm.faces if f.material_index in ids]
                count += len(faces)
                bmesh.ops.delete(bm, geom=faces, context='FACES')
                bm.to_mesh(mesh)
                mesh.update()
            finally:
                bm.free()
    if not count:
        raise ValueError('Tidak ada face badge yang dihapus.')
    import bpy
    for obj in list(fragment.children_recursive):
        if obj.type == 'MESH' and obj.name in selected and not any(len(mesh.polygons) for mesh in mesh_levels(obj)):
            bpy.data.objects.remove(obj, do_unlink=True)
    if not any(obj.type == 'MESH' and getattr(obj, 'sollum_type', '') == 'sollumz_drawable_model' and any(len(mesh.polygons) for mesh in mesh_levels(obj)) for obj in fragment.children_recursive):
        raise ValueError('Debadge akan mengosongkan semua geometri visual; ekspor dibatalkan.')
    return count


def siren_parts(donor):
    candidates = []
    names = set()
    for obj in donor.children_recursive:
        if obj.type != 'MESH' or getattr(obj, 'sollum_type', '') != 'sollumz_drawable_model':
            continue
        links = [c for c in obj.constraints if getattr(c, 'target', None) == donor and re.fullmatch(r'siren(?:[1-9]|1[0-9]|20)', getattr(c, 'subtarget', ''), re.I)]
        if not links:
            continue
        if any(m.type == 'ARMATURE' for m in obj.modifiers):
            raise ValueError('Donor memakai skinning pada lampu; pilih donor siren rigid.')
        for mesh in mesh_levels(obj):
            for material in mesh.materials:
                if material and material.node_tree:
                    for node in material.node_tree.nodes:
                        if node.type == 'TEX_IMAGE' and node.image and not node.texture_properties.embedded:
                            raise ValueError('Lampu donor membutuhkan tekstur eksternal. Embed tekstur lampu donor di Sollumz sebelum transfer.')
        candidates.append(obj)
        names.update(c.subtarget for c in links)
    if not candidates:
        raise ValueError('Donor tidak memiliki mesh rigid yang terikat ke siren1–siren20.')
    return candidates, names


def transfer_sirens(bpy, target, donor, job):
    """Transfer rigid siren parts; refuse ambiguous/skinned/missing-texture donors."""
    from mathutils import Matrix, Vector
    offset = Matrix.Translation(Vector(job['offset'])) @ Matrix.Scale(job['scale'], 4)
    target_draw = next((o for o in target.children if getattr(o, 'sollum_type', '') == 'sollumz_drawable' and 'damaged' not in o.name.lower()), None)
    if target_draw is None:
        raise ValueError('Drawable kendaraan target tidak ditemukan.')
    candidates, names = siren_parts(donor)
    if any(name in target.data.bones for name in names):
        raise ValueError('Target sudah memiliki bone siren yang sama. Gunakan target tanpa siren, atau edit manual di Blender.')
    tags = {b.bone_properties.tag for b in target.data.bones}
    if any(donor.data.bones[n].bone_properties.tag in tags for n in names):
        raise ValueError('Tag bone donor berbenturan dengan target; transfer dibatalkan.')
    bpy.ops.object.select_all(action='DESELECT')
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.mode_set(mode='EDIT')
    try:
        root = next(b for b in target.data.edit_bones if b.parent is None)
        for name in sorted(names):
            src = donor.data.bones[name]
            bone = target.data.edit_bones.new(name)
            matrix = target.matrix_world.inverted() @ offset @ donor.matrix_world @ src.matrix_local
            bone.head = matrix.translation
            bone.tail = matrix @ Vector((0, max(src.length, .01), 0))
            bone.matrix = matrix
            bone.parent = root
    finally:
        bpy.ops.object.mode_set(mode='OBJECT')
    for name in names:
        src = donor.data.bones[name].bone_properties
        dst = target.data.bones[name].bone_properties
        dst.use_manual_tag = True
        dst.manual_tag = src.tag
        dst.flags_enum = src.flags_enum
    for obj in candidates:
        clone = obj.copy()
        bpy.context.collection.objects.link(clone)
        clone.parent = target_draw
        detach_mesh_levels(clone)
        for mesh in mesh_levels(clone):
            mesh.transform(Matrix.Scale(job['scale'], 4))
        for c in clone.constraints:
            if getattr(c, 'target', None) == donor:
                c.target = target
        for level in mesh_levels(clone):
            level.use_fake_user = True
    return {'parts': len(candidates), 'bones': sorted(names)}


def rigid_part_candidates(donor):
    """Only native rigid drawable meshes are eligible; never silently re-rig moving parts."""
    result = []
    for obj in donor.children_recursive:
        if obj.type != 'MESH' or getattr(obj, 'sollum_type', '') != 'sollumz_drawable_model' or 'damaged' in obj.name.lower():
            continue
        reason = None
        if obj.vertex_groups or any(mod.show_viewport or mod.show_render for mod in obj.modifiers):
            reason = 'Skinned mesh/modifier; gunakan part rigid yang sudah di-apply.'
        links = [c for c in obj.constraints if getattr(c, 'target', None) == donor and getattr(c, 'subtarget', '')]
        if any(re.match(r'(siren|wheel|door|bonnet|boot|suspension|steer)', c.subtarget, re.I) for c in links):
            reason = 'Part memakai bone bergerak/siren; gunakan workflow khusus.'
        faces = 0
        for mesh in mesh_levels(obj):
            faces += len(mesh.polygons)
            if not mesh.uv_layers:
                reason = 'UV tidak tersedia.'
            if not mesh.materials:
                reason = 'Material native tidak tersedia.'
            for material in mesh.materials:
                if not material or getattr(material, 'sollum_type', '') != 'sollumz_material_shader':
                    reason = 'Material bukan shader native Sollumz.'
                    continue
                for node in material.node_tree.nodes if material.node_tree else []:
                    if node.type == 'TEX_IMAGE' and node.image and (not node.image.has_data or not node.texture_properties.embedded):
                        reason = 'Embed seluruh gambar material donor terlebih dahulu.'
        if faces:
            result.append({'name': obj.name, 'faces': faces, 'eligible': reason is None, 'reason': reason})
    return result


def part_images(root):
    result = {}
    for obj in root.children_recursive:
        if obj.type != 'MESH':
            continue
        for mesh in mesh_levels(obj):
            for material in mesh.materials:
                for node in material.node_tree.nodes if material and material.node_tree else []:
                    if node.type == 'TEX_IMAGE' and node.image:
                        name = re.sub(r'\.\d{3}$', '', node.image.name).lower()
                        name = re.sub(r'\.(dds|png|jpe?g|webp)$', '', name)
                        result.setdefault(name, set()).add(node.image.as_pointer())
    return result


def transfer_rigid_parts(bpy, target, donor, job):
    from mathutils import Matrix, Vector
    valid = {entry['name']: entry for entry in rigid_part_candidates(donor)}
    selected = job.get('selected', [])
    if not selected or len(set(selected)) != len(selected) or any(name not in valid or not valid[name]['eligible'] for name in selected):
        raise ValueError('Pilih part rigid yang eligible dari analisis donor terbaru.')
    bone = job.get('targetBone', 'chassis')
    if bone not in target.data.bones:
        raise ValueError('Bone target tidak ditemukan: ' + bone)
    if (target.data.bones[bone].parent is not None and bone.lower() != 'chassis') or re.match(r'(siren|wheel|door|bonnet|boot|suspension|steer)', bone, re.I):
        raise ValueError('Transfer ini hanya mendukung attachment statis pada chassis/root.')
    draw = next((o for o in target.children if getattr(o, 'sollum_type', '') == 'sollumz_drawable' and 'damaged' not in o.name.lower()), None)
    if draw is None:
        raise ValueError('Drawable target tidak tersedia.')
    objects = {obj.name: obj for obj in donor.children_recursive}
    target_images = part_images(target)
    source_images = part_images(type('Root', (), {'children_recursive': [objects[name] for name in selected]})())
    if any(name in target_images and pointers != target_images[name] for name, pointers in source_images.items()):
        raise ValueError('Nama tekstur donor berbenturan dengan target. Rename gambar donor dan embed ulang di Blender.')
    angles = [math.radians(v) for v in job.get('rotation', [0, 0, 0])]
    rotation = Matrix.Rotation(angles[0], 4, 'X') @ Matrix.Rotation(angles[1], 4, 'Y') @ Matrix.Rotation(angles[2], 4, 'Z')
    transform = Matrix.Translation(Vector(job['offset'])) @ rotation @ Matrix.Scale(job['scale'], 4)
    helper = importlib.import_module(engine_info(bpy)['sollumz'] + '.tools.blenderhelper')
    bpy.context.view_layer.update()
    clones = []
    try:
        for name in selected:
            source = objects[name]
            world = transform @ source.matrix_world
            clone = source.copy()
            clone.name = 'ditasha_mod_' + source.name
            bpy.context.collection.objects.link(clone)
            clones.append(clone)
            clone.parent = draw
            clone.parent_type = 'OBJECT'
            clone.matrix_parent_inverse = Matrix.Identity(4)
            clone.matrix_basis = Matrix.Identity(4)
            clone.constraints.clear()
            helper.add_child_of_bone_constraint(clone, target, bone)
            detach_mesh_levels(clone)
            bpy.context.view_layer.update()
            local = clone.matrix_world.inverted() @ world
            for mesh in mesh_levels(clone):
                mesh.transform(local)
                mesh.update()
                mesh.use_fake_user = True
        bpy.context.view_layer.update()
    except Exception:
        for clone in clones:
            bpy.data.objects.remove(clone, do_unlink=True)
        raise
    return {'parts': len(clones), 'names': [clone.name for clone in clones], 'bone': bone,
            'warnings': ['Attachment statis; collision/damage, modkit dan animasi part tidak ditambahkan.']}


def source_image_node(material):
    if not material or not material.node_tree:
        return None
    output = next((n for n in material.node_tree.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
    surface = output.inputs.get('Surface') if output else None
    shader = surface.links[0].from_node if surface and surface.links else None
    color = shader.inputs.get('Base Color') if shader and shader.type == 'BSDF_PRINCIPLED' else None
    node = color.links[0].from_node if color and color.links else None
    if node and node.type == 'TEX_IMAGE' and node.image and not node.image.has_data:
        # Blender importers can defer decoding valid packed/external images.
        # Access the pixel view without copying its full buffer into Python.
        try:
            len(node.image.pixels)
        except RuntimeError:
            pass
    return node if node and node.type == 'TEX_IMAGE' else None


def source_color(material):
    if not material:
        return [.7, .7, .7]
    output = next((n for n in material.node_tree.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None) if material.node_tree else None
    surface = output.inputs.get('Surface') if output else None
    shader = surface.links[0].from_node if surface and surface.links else None
    color = shader.inputs.get('Base Color') if shader and shader.type == 'BSDF_PRINCIPLED' else None
    values = list(color.default_value[:3] if color else material.diffuse_color[:3])
    return [max(0, min(1, v)) if math.isfinite(v) else .7 for v in values]


def preview_scene(bpy, fragment, output, donor=None, filename='preview.json', evaluated=False, texture_cache=None, source=False, donor_parts=None, source_materials=False):
    """Bounded world-space geometry from the exact imported native objects/LOD materials."""
    import base64
    from array import array
    bpy.context.view_layer.update()
    cache = texture_cache if texture_cache is not None else {'ids': {}, 'textures': []}
    result = {'version': 1, 'meshes': [], 'textures': cache['textures'], 'basis': 'gta-z-up', 'triangles': 0, 'source': source}
    images = cache['ids']
    def texture(material):
        if not material or not material.node_tree:
            return None
        node = (source_image_node(material) if source or source_materials else None) or next((material.node_tree.nodes.get(n) for n in ('DiffuseSampler', 'TextureSampler', 'DiffuseSampler2') if material.node_tree.nodes.get(n)), None)
        image = getattr(node, 'image', None)
        if not image or not image.has_data:
            return None
        key = image.as_pointer()
        if key in images:
            return images[key]
        if len(images) >= 32:
            return None
        index = len(images)
        w, h = image.size
        if w < 1 or h < 1:
            return None
        ratio = min(1, 512 / max(w, h))
        width, height = max(1, int(w * ratio)), max(1, int(h * ratio))
        copy = bpy.data.images.new('ditasha_preview_map', width=width, height=height, alpha=True)
        try:
            # Image.copy() does not copy generated/packed pixel edits. Sample the original
            # buffer into a bounded thumbnail without modifying it or allocating a full 4K copy.
            pixels = image.pixels
            sample = array('f')
            for y in range(height):
                sy = min(h - 1, int((y + .5) * h / height))
                for x in range(width):
                    sx = min(w - 1, int((x + .5) * w / width))
                    at = (sy * w + sx) * 4
                    sample.extend(pixels[at:at + 4])
            copy.colorspace_settings.name = image.colorspace_settings.name
            copy.pixels.foreach_set(sample)
            copy.update()
            image_file = Path(output) / ('preview-map-' + str(index) + '.png')
            copy.filepath_raw = str(image_file)
            copy.file_format = 'PNG'
            copy.save()
            data = image_file.read_bytes()
            image_file.unlink()
            if len(data) > 2 * 1024 * 1024:
                return None
            images[key] = index
            result['textures'].append(base64.b64encode(data).decode('ascii'))
            return index
        finally:
            bpy.data.images.remove(copy)
    def append_mesh(obj, mesh, kind, world):
        mesh.calc_loop_triangles()
        groups = {}
        for tri in mesh.loop_triangles:
            material = mesh.materials[tri.material_index] if tri.material_index < len(mesh.materials) else None
            shader = getattr(getattr(material, 'shader_properties', None), 'filename', '')
            badge = kind == 'base' and bool(re.search(r'badge|emblem', ' '.join([obj.name, material.name if material else '', shader]).lower()))
            key = (tri.material_index, badge)
            if key not in groups:
                alpha = 'blend' if any(n in shader.lower() for n in ('glass', 'badge', 'decal', 'lightsemissive', 'alpha')) else 'opaque'
                if (source or source_materials) and material and material.node_tree:
                    bsdf=material.node_tree.nodes.get('Principled BSDF')
                    opacity=bsdf.inputs.get('Alpha') if bsdf else None
                    if opacity and (opacity.is_linked or opacity.default_value<.999):alpha='blend'
                groups[key] = {'name': obj.name, 'kind': kind, 'candidate': obj.name if badge else None, 'positions': [], 'uvs': [], 'texture': texture(material), 'alpha': alpha}
                if source or source_materials:
                    groups[key]['color'] = source_color(material)
            item = groups[key]
            uv_layer = mesh.uv_layers.active
            if material and material.node_tree:
                image_node = (source_image_node(material) if source or source_materials else None) or next((material.node_tree.nodes.get(n) for n in ('DiffuseSampler', 'TextureSampler', 'DiffuseSampler2') if material.node_tree.nodes.get(n)), None)
                vector = image_node.inputs.get('Vector') if image_node else None
                if vector and vector.links:
                    uv_node = vector.links[0].from_node
                    if uv_node.type == 'UVMAP':
                        uv_layer = mesh.uv_layers.get(uv_node.uv_map) or uv_layer
            # Sollumz UV values are Blender-oriented here; Three texture loader flips PNG by default.
            for loop in tri.loops:
                point = world @ mesh.vertices[mesh.loops[loop].vertex_index].co
                if not all(math.isfinite(v) for v in point):
                    raise ValueError('Koordinat preview hasil deformasi tidak valid.')
                item['positions'].extend(round(v, 6) for v in point)
                item['uvs'].extend(round(v, 6) for v in (uv_layer.data[loop].uv if uv_layer else (0, 0)))
            result['triangles'] += 1
            if result['triangles'] > 250000:
                raise ValueError('Preview melebihi 250 ribu triangle. Pilih kendaraan lebih ringan; build tidak diubah.')
        result['meshes'].extend(groups.values())
    def append(obj, kind):
        # Evaluate the actual armature modifier for ped pose tests. Temporary
        # objects/meshes are released even when a preview exceeds its budget.
        mesh = next((m for m in mesh_levels(obj) if len(m.polygons)), None)
        if mesh is None:
            return
        clone = evaluated_obj = None
        try:
            if evaluated:
                clone = obj.copy()
                clone.data = mesh
                bpy.context.collection.objects.link(clone)
                bpy.context.view_layer.update()
                graph = bpy.context.evaluated_depsgraph_get()
                evaluated_obj = clone.evaluated_get(graph)
                mesh = evaluated_obj.to_mesh(preserve_all_data_layers=True, depsgraph=graph)
                append_mesh(obj, mesh, kind, evaluated_obj.matrix_world)
            else:
                append_mesh(obj, mesh, kind, obj.matrix_world)
        finally:
            if evaluated_obj is not None:
                evaluated_obj.to_mesh_clear()
            if clone is not None:
                bpy.data.objects.remove(clone, do_unlink=True)
    for obj in fragment.children_recursive:
        if obj.type == 'MESH' and (source or source_materials or (getattr(obj, 'sollum_type', '') == 'sollumz_drawable_model' and 'damaged' not in obj.name.lower())):
            append(obj, 'base')
    if donor:
        parts = donor_parts if donor_parts is not None else siren_parts(donor)[0]
        for obj in parts:
            append(obj, 'donor')
    if not result['meshes']:
        raise ValueError('Geometri preview tidak tersedia.')
    data = json.dumps(result, separators=(',', ':'))
    if len(data.encode('utf-8')) > 48 * 1024 * 1024:
        raise ValueError('Preview melebihi batas 48 MB.')
    (Path(output) / filename).write_text(data, encoding='utf-8')
    return {'triangles': result['triangles'], 'meshes': len(result['meshes'])}


def export_vehicle(bpy, fragment, output):
    stream = output / 'stream'
    stream.mkdir(exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    fragment.select_set(True)
    bpy.context.view_layer.objects.active = fragment
    result = bpy.ops.sollumz.export_assets(directory=str(stream), direct_export=True, use_custom_settings=True, target_formats={'NATIVE'}, target_versions={'GEN8'}, limit_to_selected=True, exclude_skeleton=False, apply_transforms=False, mesh_domain='FACE_CORNER')
    if 'FINISHED' not in result:
        raise RuntimeError('Sollumz tidak menyelesaikan ekspor native.')
    files = list(stream.glob('*.yft'))
    if not files or any(f.read_bytes()[:4] != b'RSC7' for f in files):
        raise RuntimeError('Ekspor tidak menghasilkan YFT native yang valid.')
    return [f.name for f in files]


def run(job):
    import bpy
    output = Path(job['output'])
    report = {'ok': False, 'mode': job['mode'], 'engine': engine_info(bpy)}
    try:
        if job['mode'] == 'probe':
            report['ok'] = True
            return report
        if job['mode'] == 'ped_preview':
            from types import SimpleNamespace
            spec = importlib.util.spec_from_file_location('ditasha_ped_review', Path(__file__).with_name('ped_review.py'))
            review = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(review)
            for obj in list(bpy.data.objects):
                bpy.data.objects.remove(obj, do_unlink=True)
            objects = review.import_source(bpy, job['source'])
            report['sourceQuality'] = review.audit_source(bpy, objects, source_image_node)
            report['warnings'] = report['sourceQuality']['warnings']
            report['preview'] = preview_scene(bpy, SimpleNamespace(children_recursive=objects), output, evaluated=True, source=True)
            report['ok'] = True
            return report
        if job['mode'] == 'garment':
            import ped_review as review
            import garment_skin
            if job.get('headOptions', {}).get('enabled'):
                import half_ped
                report.update(half_ped.run(bpy, job, output, review, preview_scene))
                report['ok'] = True
                return report
            result = garment_skin.run(bpy, job, output, review, preview_scene)
            report.update(result)
            report['ok'] = True
            return report
        if job['mode'] == 'logo':
            if not report['engine']['sollumz'] or not report['engine']['native']:
                raise RuntimeError('Ekspor prop memerlukan Sollumz native aktif di Blender Windows.')
            import logo_prop
            report.update(logo_prop.run(bpy, job, output))
            report['ok'] = True
            return report
        if not report['engine']['sollumz'] or not report['engine']['native']:
            raise RuntimeError('Aktifkan Sollumz 2.9 dengan szio/PyMateria native di Blender terlebih dahulu (Windows).')
        for obj in list(bpy.data.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        if job['mode'] == 'ped':
            if bpy.app.version < (5, 0, 0):
                raise RuntimeError('Template Muto saat ini memerlukan Blender 5.x. Gunakan Blender 5.2 untuk rigging ped.')
            module = report['engine']['muto']
            if not module:
                raise RuntimeError('Muto Ped Rig belum aktif pada Blender ini.')
            worker = importlib.import_module(module + '.bl.batch_worker')
            review_spec = importlib.util.spec_from_file_location('ditasha_ped_review', Path(__file__).with_name('ped_review.py'))
            review = importlib.util.module_from_spec(review_spec)
            review_spec.loader.exec_module(review)
            options = job.get('pedOptions', {})
            def progress(stage):
                report['stage'] = stage
                (output / 'progress.json').write_text(json.dumps({'stage': stage}), encoding='utf-8')
                print('DITASHA_PED_STAGE ' + stage, flush=True)
                if stage == 'export':
                    # The native writer can terminate Blender without a Python
                    # exception. Preserve the finished rig before entering it.
                    try:
                        bpy.ops.file.pack_all()
                    except RuntimeError as exc:
                        report.setdefault('warnings', []).append('Sebagian file belum dapat di-pack ke cadangan rig: ' + str(exc))
                    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'ditasha-result.blend'), copy=True)
            result = review.run_muto(worker, bpy, {'src': job['source'], 'out': str(output), 'ped': job['name'], 'mode': 'ADDON', 'tex': 'YTD', 'rig': 'mp_m'}, options, progress)
            report['pedOptions'] = options
            report['rigging'] = result
            # A self-contained correction project remains available even when
            # marker fitting/weights fail before native export completes.
            try:
                bpy.ops.file.pack_all()
            except Exception as exc:
                report.setdefault('warnings', []).append('Sebagian file belum dapat di-pack ke proyek: ' + str(exc))
            try:
                bpy.ops.wm.save_as_mainfile(filepath=str(output / 'ditasha-result.blend'), copy=True)
            except Exception as exc:
                report.setdefault('warnings', []).append('Proyek koreksi: ' + str(exc))
            if not result.get('ok'):
                failed = next(((key, value) for key,value in result.get('steps', {}).items() if value not in ('FINISHED','SKIPPED')), None)
                detail = (failed[0] + ': ' + str(failed[1])) if failed else result.get('error', 'Engine tidak menyelesaikan seluruh tahap rig.')
                raise RuntimeError('Auto rig gagal: ' + detail + '. Periksa log dan proyek Blender hasil koreksi.')
            required = {'.yft', '.ydd', '.ytd', '.ymt'}
            present = {f.suffix.lower() for f in output.rglob('*') if f.is_file()}
            if not required.issubset(present) or not list(output.rglob('fxmanifest.lua')):
                raise RuntimeError('Resource ped belum lengkap: YFT/YDD/YTD/YMT/fxmanifest diperlukan.')
            rigged = [obj for obj in bpy.data.objects if obj.type == 'MESH' and getattr(obj, 'sollum_type', '') == 'sollumz_drawable_model']
            report['quality'] = review.audit_rig(rigged, mesh_levels)
            report['preview'] = review.create_pose_previews(bpy, rigged, output, preview_scene)
            try:
                report['preview']['motion'] = review.add_walk_preview(bpy, rigged, output, preview_scene)
            except Exception as exc:
                report['preview']['warnings'].append('Walk preview: ' + str(exc))
            if job.get('clip'):
                from clip_review import add_clip_preview
                arms = {a.name:a for obj in rigged if (a := review.armature_for(obj)) is not None}
                if len(arms) != 1:
                    raise ValueError('Clip GTA memerlukan satu armature hasil rig.')
                report['preview']['motion'] = add_clip_preview(bpy, next(iter(arms.values())), rigged, job['clip'], job['clipIndex'], output, preview_scene)
            report['warnings'] = report.get('warnings', []) + result.get('warnings', []) + report['quality']['warnings'] + report['preview']['warnings']
        else:
            fragment = import_vehicle(bpy, job['source'])
            report['candidates'] = badge_candidates(fragment)
            if job['mode'] in ('debadge_analyze', 'strobo_preview', 'parts_preview'):
                donor = import_vehicle(bpy, job['donor']) if job['mode'] in ('strobo_preview', 'parts_preview') else None
                parts = None
                if job['mode'] == 'parts_preview':
                    report['candidates'] = rigid_part_candidates(donor)
                    eligible = {e['name'] for e in report['candidates'] if e['eligible']}
                    parts = [o for o in donor.children_recursive if o.name in eligible]
                    report['targetBones'] = [b.name for b in fragment.data.bones if b.parent is None or b.name.lower() == 'chassis']
                report['preview'] = preview_scene(bpy, fragment, output, donor, donor_parts=parts)
                report['ok'] = True
                return report
            if job['mode'] == 'debadge':
                report['removed_faces'] = debadge(fragment, job['selected'])
                report['files'] = export_vehicle(bpy, fragment, output)
            elif job['mode'] == 'parts':
                donor = import_vehicle(bpy, job['donor'])
                report['transfer'] = transfer_rigid_parts(bpy, fragment, donor, job)
                report['files'] = export_vehicle(bpy, fragment, output)
                (output / 'fxmanifest.lua').write_text("fx_version 'cerulean'\ngame 'gta5'\nauthor 'Ditasha-Workshop'\n", encoding='utf-8')
                report['warnings'] = report['transfer']['warnings'] + ['Patch YFT: resource kendaraan asli/YTD harus tetap dimuat lebih dahulu. Uji semua LOD di FiveM.']
            else:
                donor = import_vehicle(bpy, job['donor'])
                report['transfer'] = transfer_sirens(bpy, fragment, donor, job)
                model = Path(job['source']).name.split('.')[0]
                prepare_metadata(job, model, output)
                report['files'] = export_vehicle(bpy, fragment, output)
                report['warnings'] = ['Patch resource: resource kendaraan asli beserta YTD/handling tetap harus dimuat lebih dahulu.', 'ID siren harus unik pada server. Uji animasi siren, posisi, collision dan LOD di game.']
        bpy.ops.wm.save_as_mainfile(filepath=str(output / 'ditasha-result.blend'), copy=True)
        report['ok'] = True
    except (Exception, SystemExit) as exc:
        report['error'] = str(exc)
        report['traceback'] = traceback.format_exc()[-5000:]
        print(report['traceback'], file=sys.stderr, flush=True)
    finally:
        (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    spec = Path(sys.argv[sys.argv.index('--') + 1])
    result = run(json.loads(spec.read_text(encoding='utf-8')))
    print('DITASHA_NATIVE_RESULT', json.dumps(result))
    if not result['ok']:
        sys.exit(2)
