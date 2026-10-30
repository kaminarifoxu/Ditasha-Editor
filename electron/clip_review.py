"""Read CodeWalker YCD XML and evaluate a real skeletal clip for bounded preview."""
import base64
import importlib
import json
import math
import sys
from array import array
from pathlib import Path
from types import SimpleNamespace


def add_clip_preview(bpy, arm, objects, filename, clip_index, output, preview_scene):
    from native_bridge import read_xml
    root = read_xml(filename)
    if root.tag != 'ClipDictionary':
        raise ValueError('Pilih CodeWalker .ycd.xml dengan root ClipDictionary.')
    # Reject huge declared frame counts before the add-on expands channels into keyframes.
    animations = root.findall('./Animations/Item')
    if not animations or len(animations) > 64:
        raise ValueError('Kamus animasi memerlukan 1–64 animation.')
    total = 0
    for animation in animations:
        frames = int(animation.find('FrameCount').get('value'))
        bones = len(animation.findall('./BoneIds/Item'))
        sequences = animation.findall('./Sequences/Item')
        if not 1 <= bones <= 512 or not sequences or len(sequences) > 256 or any(len(s.findall('./SequenceData/Item')) != bones for s in sequences):
            raise ValueError('Struktur bone/channel animasi tidak valid atau terlalu besar.')
        total += frames * max(1, bones)
        if not 2 <= frames <= 10000 or total > 250000:
            raise ValueError('Kamus animasi terlalu besar untuk preview; ekspor satu clip dahulu.')
    module = next((n for n in bpy.context.preferences.addons.keys() if n.lower().split('.')[-1] in ('sollumz', 'sollumz_dev')), None)
    if not module: raise ValueError('YCD XML memerlukan Sollumz aktif.')
    importer = importlib.import_module(module + '.ycd.ycdimport')
    helper = importlib.import_module(module + '.tools.drawablehelper')
    for bone in arm.data.bones: helper.set_recommended_bone_properties(bone)
    dictionary = importer.import_ycd(filename)
    clips = sorted((obj for obj in dictionary.children_recursive if obj.sollum_type == 'sollumz_clip'), key=lambda obj: obj.name)
    if clip_index >= len(clips):
        raise ValueError('Nomor clip di luar kamus: ' + ', '.join(f'{i}: {c.name}' for i,c in enumerate(clips)))
    clip = clips[clip_index]
    tracks = clip.clip_properties.animations
    if len(tracks) != 1 or tracks[0].animation is None:
        raise ValueError('Preview saat ini memerlukan clip skeletal tunggal, bukan animation-list blend.')
    duration = clip.clip_properties.duration
    if not math.isfinite(duration) or not .1 <= duration <= 16:
        raise ValueError('Durasi clip harus 0,1–16 detik untuk buffer preview.')
    props = tracks[0].animation.animation_properties
    props.target_id_type = 'ARMATURE'; props.target_id = arm.data
    action = props.action
    arm.animation_data_create()
    if arm.animation_data.action or len(arm.animation_data.nla_tracks):
        raise ValueError('Rig sudah memiliki action/NLA; reset template dahulu.')
    rest_file = Path(output)/'preview.json'
    data = json.loads(rest_file.read_text(encoding='utf-8'))
    count = sum(len(mesh['positions']) for mesh in data['meshes'])
    samples = min(16, math.floor(duration*60), (16*1024*1024)//max(1,count*4))
    if samples < max(4, math.ceil(duration)):
        raise ValueError('Clip memerlukan model lebih ringan atau durasi lebih pendek.')
    saved = [(bone, bone.matrix_basis.copy()) for bone in arm.pose.bones]
    position, frame = arm.data.pose_position, bpy.context.scene.frame_current
    temp = Path(output)/'preview-clip-tmp.json'
    frames = []
    try:
        arm.animation_data.action = action
        if bpy.app.version >= (5,0,0) and len(action.slots): arm.animation_data.action_slot = action.slots[0]
        arm.data.pose_position = 'POSE'
        cache = {'ids':{}, 'textures':[]}
        for index in range(samples):
            at = tracks[0].start_frame + (tracks[0].end_frame-tracks[0].start_frame)*index/samples
            bpy.context.scene.frame_set(math.floor(at), subframe=at-math.floor(at))
            bpy.context.view_layer.update()
            preview_scene(bpy, SimpleNamespace(children_recursive=objects), output, filename=temp.name, evaluated=True, texture_cache=cache)
            sample = json.loads(temp.read_text(encoding='utf-8'))
            if len(sample['meshes']) != len(data['meshes']) or any(a['name'] != b['name'] or len(a['positions']) != len(b['positions']) for a,b in zip(sample['meshes'],data['meshes'])):
                raise ValueError('Topologi berubah selama animasi.')
            values = array('f', (v for mesh in sample['meshes'] for v in mesh['positions']))
            if sys.byteorder != 'little': values.byteswap()
            frames.append(base64.b64encode(values.tobytes()).decode('ascii'))
        data['motion'] = {'version':1,'kind':'gta-ycd-xml','label':clip.name,'fps':samples/duration,'frames':frames,'floatCount':count}
        text = json.dumps(data,separators=(',',':'))
        if len(text.encode('utf-8')) > 48*1024*1024: raise ValueError('Preview animasi melebihi 48 MB.')
        rest_file.write_text(text,encoding='utf-8')
        return {'kind':'gta-ycd-xml','clip':clip.name,'clips':[c.name for c in clips],'duration':duration,'frames':samples}
    finally:
        arm.animation_data.action = None
        bpy.context.scene.frame_set(frame)
        arm.data.pose_position = position
        for bone,matrix in saved: bone.matrix_basis = matrix
        bpy.context.view_layer.update()
        temp.unlink(missing_ok=True)
