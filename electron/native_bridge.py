"""DITASHA's offline Blender job bridge. Third-party addons remain separately installed.
No network access, pip installation, or downloads are performed by this script.
"""
import importlib
import json
import re
import sys
import traceback
from pathlib import Path
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
    result = bpy.ops.sollumz.import_assets(directory=str(file.parent), files=[{'name': file.name}], use_custom_settings=True, split_by_group=True)
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


def transfer_sirens(bpy, target, donor, job):
    """Transfer rigid siren parts; refuse ambiguous/skinned/missing-texture donors."""
    from mathutils import Matrix, Vector
    offset = Matrix.Translation(Vector(job['offset'])) @ Matrix.Scale(job['scale'], 4)
    target_draw = next((o for o in target.children if getattr(o, 'sollum_type', '') == 'sollumz_drawable' and 'damaged' not in o.name.lower()), None)
    if target_draw is None:
        raise ValueError('Drawable kendaraan target tidak ditemukan.')
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
            result = worker.run({'src': job['source'], 'out': str(output), 'ped': job['name'], 'mode': 'ADDON', 'tex': 'YTD', 'rig': 'mp_m'})
            report['rigging'] = result
            if not result.get('ok'):
                raise RuntimeError('Auto rig gagal. Buka .blend untuk memeriksa marker/weights dan lihat batch_report.json.')
            required = {'.yft', '.ydd', '.ytd', '.ymt'}
            present = {f.suffix.lower() for f in output.rglob('*') if f.is_file()}
            if not required.issubset(present) or not list(output.rglob('fxmanifest.lua')):
                raise RuntimeError('Resource ped belum lengkap: YFT/YDD/YTD/YMT/fxmanifest diperlukan.')
        else:
            fragment = import_vehicle(bpy, job['source'])
            report['candidates'] = badge_candidates(fragment)
            if job['mode'] == 'debadge_analyze':
                report['ok'] = True
                return report
            if job['mode'] == 'debadge':
                report['removed_faces'] = debadge(fragment, job['selected'])
                report['files'] = export_vehicle(bpy, fragment, output)
            else:
                donor = import_vehicle(bpy, job['donor'])
                report['transfer'] = transfer_sirens(bpy, fragment, donor, job)
                model = Path(job['source']).name.split('.')[0]
                prepare_metadata(job, model, output)
                report['files'] = export_vehicle(bpy, fragment, output)
                report['warnings'] = ['Patch resource: resource kendaraan asli beserta YTD/handling tetap harus dimuat lebih dahulu.', 'ID siren harus unik pada server. Uji animasi siren, posisi, collision dan LOD di game.']
        bpy.ops.wm.save_as_mainfile(filepath=str(output / 'ditasha-result.blend'), copy=True)
        report['ok'] = True
    except Exception as exc:
        report['error'] = str(exc)
        report['traceback'] = traceback.format_exc()[-5000:]
    finally:
        (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    spec = Path(sys.argv[sys.argv.index('--') + 1])
    result = run(json.loads(spec.read_text(encoding='utf-8')))
    print('DITASHA_NATIVE_RESULT', json.dumps(result))
    if not result['ok']:
        sys.exit(2)
