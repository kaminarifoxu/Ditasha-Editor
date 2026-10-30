"""Fit a separately exported head/hair to a GTA reference; keep source files intact."""
import importlib
import json
import math
from pathlib import Path


def reference_from_engine(bpy, gender):
    import numpy as np
    module=next((n for n in bpy.context.preferences.addons if 'muto_ped_rig' in n.lower()),None)
    if not module: raise ValueError('Siapkan engine Muto dahulu atau pilih template freemode .blend.')
    io=importlib.import_module(module+'.bl.io')
    arm=io.append_template('mp_m','DITASHA_Freemode')
    path=Path(io.DATA)/('ref_'+gender+'.npz')
    data=np.load(path,allow_pickle=False)
    vertices,faces,indices,weights=data['V'],data['F'],data['WI'],data['WV']
    if len(vertices)>50000 or len(faces)>100000 or not np.isfinite(vertices).all() or not np.isfinite(weights).all():
        raise ValueError('Acuan engine tidak valid.')
    names=json.loads((Path(io.DATA)/'template_mp_m.json').read_text())['bones']
    objects=[]
    for part,label in enumerate(data['part_names']):
        mask=data['PART']==part
        selected=np.flatnonzero(mask)
        if not len(selected): continue
        mapping={int(v):i for i,v in enumerate(selected)}
        triangles=[tuple(mapping[int(v)] for v in tri) for tri in faces if all(int(v) in mapping for v in tri)]
        mesh=bpy.data.meshes.new('reference_'+str(label))
        mesh.from_pydata(vertices[selected].tolist(),[],triangles);mesh.update()
        obj=bpy.data.objects.new(mesh.name,mesh);bpy.context.collection.objects.link(obj)
        obj.parent=arm
        groups={i:obj.vertex_groups.new(name=bone['name']) for i,bone in enumerate(names)}
        for target,source in enumerate(selected):
            for index,weight in zip(indices[source],weights[source]):
                if weight>0: groups[int(index)].add([target],float(weight),'REPLACE')
        obj.modifiers.new('Reference skeleton','ARMATURE').object=arm
        material=bpy.data.materials.new('Reference '+str(label));material.diffuse_color=(.28,.32,.4,1)
        obj.data.materials.append(material);objects.append(obj)
    return objects


def uv_svg(objects,path):
    lines=[]
    for obj in objects:
        if not obj.data.uv_layers: continue
        layer=obj.data.uv_layers.active.data
        for poly in obj.data.polygons:
            points=['%.3f,%.3f'%(layer[i].uv.x*1024,(1-layer[i].uv.y)*1024) for i in poly.loop_indices]
            lines.append('<polygon points="'+' '.join(points)+'"/>')
            if len(lines)>100000: raise ValueError('UV melebihi batas 100 ribu face.')
    if not lines:return False
    Path(path).write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g fill="none" stroke="#8b99bb" stroke-width=".6">'+''.join(lines)+'</g></svg>')
    return True


def run(bpy,job,output,review,preview_scene):
    from mathutils import Vector, Matrix, Euler
    from garment_skin import skin_garments
    from native_bridge import source_image_node
    options=job['headOptions'];output=Path(output)
    if job.get('reference'):
        status=bpy.ops.wm.open_mainfile(filepath=job['reference'],load_ui=False,use_scripts=False)
        if 'FINISHED' not in status:raise ValueError('Template .blend tidak dapat dibuka.')
        reference=[o for o in bpy.data.objects if o.type=='MESH' and review.armature_for(o)]
    else:
        for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
        reference=reference_from_engine(bpy,options['gender'])
    heads=[o for o in reference if 'head' in o.name.lower()]
    if not heads: raise ValueError('Template harus memiliki mesh kepala bernama head dengan weights GTA.')
    arms={a.name:a for o in reference if (a:=review.armature_for(o)) is not None}
    if len(arms)!=1:raise ValueError('Template kepala harus memiliki satu armature GTA.')
    arm=next(iter(arms.values()))
    head_bone=arm.data.bones.get('SKEL_Head')
    if head_bone is None:raise ValueError('Template tidak memiliki SKEL_Head.')
    reference_uv=uv_svg(heads,output/'uv-freemode-reference.svg')
    before=set(bpy.data.objects)
    imported=review.import_source(bpy,job['source'])
    source=[o for o in imported if o not in before]
    if not source or sum(len(o.data.vertices) for o in source)>500000:raise ValueError('Kepala sumber kosong atau melebihi 500 ribu vertex.')
    def bounds(objects):
        values=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
        low=Vector(tuple(min(v[i] for v in values) for i in range(3)))
        high=Vector(tuple(max(v[i] for v in values) for i in range(3)))
        return low,high
    low,high=bounds(source);target_low,target_high=bounds(heads)
    if min(high-low)<1e-6:raise ValueError('Kepala sumber harus model 3D dengan ketebalan.')
    center=(low+high)/2;target=(target_low+target_high)/2
    scale=(target_high.z-target_low.z)/(high.z-low.z) if options['fit'] else 1
    scale*=options['scale']
    rotation=Euler(tuple(math.radians(v) for v in options['rotation']),'XYZ').to_matrix().to_4x4()
    transform=Matrix.Translation(target+Vector(options['offset']))@rotation@Matrix.Scale(scale,4)@Matrix.Translation(-center) if options['fit'] else Matrix.Translation(Vector(options['offset']))@rotation@Matrix.Scale(scale,4)
    def place(objects,matrix):
        for obj in objects:
            world=matrix@obj.matrix_world
            obj.parent=None;obj.matrix_world=world
            for modifier in list(obj.modifiers):
                if modifier.type=='ARMATURE':obj.modifiers.remove(modifier)
    place(source,transform)
    def rigid(objects):
        for obj in objects:
            world=obj.matrix_world.copy();obj.vertex_groups.clear()
            obj.vertex_groups.new(name='SKEL_Head').add(list(range(len(obj.data.vertices))),1,'REPLACE')
            obj.parent=arm;obj.matrix_world=world
            obj.modifiers.new('DITASHA head attachment','ARMATURE').object=arm
    if options['weights']=='surface':
        _,quality=skin_garments(bpy,heads,source,job['maxDistance'])
    else:
        rigid(source);quality={'vertices':sum(len(o.data.vertices) for o in source),'influences':1,'rigidHead':True}
    hair=[]
    if job.get('hair'):
        before=set(bpy.data.objects)
        hair=[o for o in review.import_source(bpy,job['hair']) if o not in before]
        if sum(len(o.data.vertices) for o in hair)>250000:raise ValueError('Rambut maksimal 250 ribu vertex.')
        place(hair,transform)
        extra=Matrix.Translation(target+Vector(options['hairOffset']))@Matrix.Scale(options['hairScale'],4)@Matrix.Translation(-target)
        place(hair,extra);rigid(hair)
    source_uv=uv_svg(source,output/'uv-head-source.svg')
    from clothing_workflow import export_native
    native=[]
    if options['native']:
        # Export a private texture canvas and remap UVs per material, preserving the source project UVs.
        import logo_prop
        copies=[]
        for obj in [*source,*hair]:
            clone=obj.copy();clone.data=obj.data.copy();bpy.context.collection.objects.link(clone);copies.append(clone)
            for index,material in enumerate(list(clone.data.materials)):
                if not material:continue
                material=material.copy();clone.data.materials[index]=material
                node=source_image_node(material)
                if node and node.image:
                    node.image.pixels[:4]
                    image=node.image.copy()
                    if max(image.size)>2048:
                        factor=2048/max(image.size);image.scale(max(1,round(image.size[0]*factor)),max(1,round(image.size[1]*factor)))
                    image,uv_scale,uv_offset=logo_prop.prepare_texture(bpy,image,'ditasha_head_diffuse')
                    node.image=image
                    for poly in clone.data.polygons:
                        if poly.material_index==index:
                            for layer in clone.data.uv_layers:
                                for i in poly.loop_indices:
                                    u,v=layer.data[i].uv;layer.data[i].uv=(u*uv_scale[0]+uv_offset[0],v*uv_scale[1]+uv_offset[1])
        prefix='mp_'+('f' if options['gender']=='mp_f' else 'm')+'_freemode_01^'
        native.append(export_native(bpy,arm,copies[:len(source)],output,prefix+options['headSlot'],source_image_node))
        if hair:native.append(export_native(bpy,arm,copies[len(source):],output,prefix+options['hairSlot'],source_image_node,shader_name='ped_hair_cutout_alpha.sps'))
        for obj in copies:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [arm,*source,*hair]:obj.select_set(True)
    bpy.context.view_layer.objects.active=arm
    glb=output/'ditasha-halfped.glb'
    result=bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_animations=False,export_skins=True,export_all_influences=False)
    if 'FINISHED' not in result or not glb.exists() or glb.stat().st_size>64*1024**2:raise ValueError('GLB halfped gagal atau melebihi 64 MB.')
    for obj in heads:obj.hide_render=True;obj.hide_set(True)
    context=[o for o in reference if o not in heads]+source+hair
    def preview_head(*args,**kwargs): return preview_scene(*args,**kwargs,source_materials=True)
    original_poses=review.POSES
    try:
        review.POSES=(*review.POSES,('head','Uji kepala & rahang',{'SKEL_Head':(0,0,.25),'FB_Jaw_000':(.2,0,0)}))
        preview=review.create_pose_previews(bpy,context,output,preview_head)
    finally:review.POSES=original_poses
    try:preview['motion']=review.add_walk_preview(bpy,context,output,preview_head)
    except Exception as exc:preview['warnings'].append(str(exc))
    if job.get('clip'):
        from clip_review import add_clip_preview
        preview['motion']=add_clip_preview(bpy,arm,context,job['clip'],job['clipIndex'],output,preview_head)
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(output/'ditasha-result.blend'),copy=True)
    warnings=['Transfer wajah mengikuti permukaan acuan; periksa mata, rahang dan leher di Blender/FiveM.', 'Rambut rigid mengikuti SKEL_Head; deformasi topi dan physics rambut belum dibuat.', 'YDD mengganti slot yang sudah ada. Collection/YMT dan konfigurasi halfped server tetap diperlukan.']
    if not reference_uv:warnings.append('Acuan engine tidak membawa UV asli freemode. Pilih template .blend dengan kepala dan UV untuk mengekspor UV acuan; UV sumber tetap dipertahankan.')
    files=[glb.name,'ditasha-result.blend']+(['uv-head-source.svg'] if source_uv else [])+(['uv-freemode-reference.svg'] if reference_uv else [])
    return {'halfPed':True,'referenceUvAvailable':reference_uv,'transferQuality':quality,'nativeHead':native,'preview':preview,'files':files,'warnings':warnings+preview['warnings']}
