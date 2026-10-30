"""Bounded static decorative prop export through the installed native Sollumz provider."""
import base64
import importlib
import math
import re
from pathlib import Path


def prepare_texture(bpy, image, name):
    """Pad a private native texture; map UVs into the unchanged source pixels.

    The GEN8 provider truncates non-block-aligned mip data for NPOT textures.
    A square power-of-two canvas keeps every mip compatible, including tails.
    Blender pixels and UVs both start at the bottom left.
    """
    import numpy as np
    w, h = image.size
    if not image.has_data or min(w,h)<1 or max(w,h)>2048:
        raise ValueError('Tekstur logo tidak terbaca atau melebihi 2048 px.')
    size = max(4, 1 << (max(w,h)-1).bit_length())
    scale, offset = (w/size,h/size), ((size-w)//2/size,(size-h)//2/size)
    if (w,h)!=(size,size):
        values=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(values)
        pixels=np.zeros((size,size,4),dtype=np.float32)
        x,y=(size-w)//2,(size-h)//2
        pixels[y:y+h,x:x+w]=values.reshape(h,w,4)
        padded=bpy.data.images.new(name,width=size,height=size,alpha=True)
        padded.colorspace_settings.name=image.colorspace_settings.name
        padded.pixels.foreach_set(pixels.ravel());padded.update()
        bpy.data.images.remove(image)
        image=padded
    image.name=name
    return image, scale, offset


def run(bpy, job, output):
    name = job['name']
    if not re.fullmatch(r'[a-z][a-z0-9_]{2,47}', name):
        raise ValueError('Nama prop tidak valid.')
    data = job['logo']
    positions, uvs, materials = data['positions'], data['uvs'], data['materials']
    count = len(positions) // 3
    if count < 3 or count > 180000 or count % 3 or len(uvs) != count*2 or len(materials) != count//3:
        raise ValueError('Ukuran mesh logo tidak valid.')
    if any(not math.isfinite(v) or abs(v)>25 for v in positions) or any(not math.isfinite(v) or abs(v)>4 for v in uvs) or any(v not in (0,1) for v in materials):
        raise ValueError('Nilai mesh logo tidak valid.')
    module = next(n for n in bpy.context.preferences.addons.keys() if n.lower().split('.')[-1] in ('sollumz','sollumz_dev'))
    create_shader = importlib.import_module(module+'.ydr.shader_materials').create_shader
    from native_dds import pack_image
    for obj in list(bpy.data.objects): bpy.data.objects.remove(obj,do_unlink=True)
    bpy.context.scene.ytyps.clear()
    output = Path(output); output.mkdir(parents=True,exist_ok=True)
    source = output/'logo-source.png'
    source.write_bytes(base64.b64decode(data['texture'],validate=True))
    image = bpy.data.images.load(str(source),check_existing=False)
    image.pixels[:4]
    if not image.has_data or max(image.size)>2048: raise ValueError('Tekstur logo tidak terbaca.')
    source_size=list(image.size)
    image,uv_scale,uv_offset=prepare_texture(bpy,image,name+'_diffuse')
    native_size=list(image.size)
    side = bpy.data.images.new(name+'_edge',width=4,height=4)
    side.pixels[:] = [*data['sideColor'],1.0]*16
    native_materials=[]
    for label, texture in [('front',image),('edge',side)]:
        material=create_shader('default.sps'); material.name=name+'_'+label
        pack_image(bpy,texture,texture.name,output)
        node=material.node_tree.nodes.get('DiffuseSampler')
        if node is None: raise ValueError('Shader prop tidak memiliki diffuse sampler.')
        node.image=texture; node.texture_properties.embedded=True
        native_materials.append(material)
    drawable=bpy.data.objects.new(name,None);drawable.sollum_type='sollumz_drawable';bpy.context.collection.objects.link(drawable)
    mesh=bpy.data.meshes.new(name+'_mesh')
    mesh.from_pydata([positions[i:i+3] for i in range(0,len(positions),3)],[],[tuple(range(i,i+3)) for i in range(0,count,3)])
    mesh.update()
    model=bpy.data.objects.new(name+'_high',mesh);bpy.context.collection.objects.link(model);model.parent=drawable;model.sollum_type='sollumz_drawable_model'
    layer=mesh.uv_layers.new(name='UVMap 0')
    for loop in mesh.loops:
        u,v=uvs[loop.vertex_index*2:loop.vertex_index*2+2]
        layer.data[loop.index].uv=(u*uv_scale[0]+uv_offset[0],v*uv_scale[1]+uv_offset[1])
    for material in native_materials: mesh.materials.append(material)
    for poly in mesh.polygons: poly.material_index=materials[poly.index]
    color=mesh.color_attributes.new(name='Color 1',type='BYTE_COLOR',domain='CORNER')
    for value in color.data:value.color=(1,1,1,1)
    model.sz_lods.high.mesh=mesh
    for lod in [model.sz_lods.medium,model.sz_lods.low,model.sz_lods.very_low]:lod.mesh=mesh.copy()
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT');drawable.select_set(True);bpy.context.view_layer.objects.active=drawable
    stream=output/'stream';stream.mkdir()
    result=bpy.ops.sollumz.export_assets(directory=str(stream),direct_export=True,use_custom_settings=True,
        target_formats={'NATIVE'},target_versions={'GEN8'},limit_to_selected=True,apply_transforms=False,mesh_domain='FACE_CORNER')
    target=stream/(name+'.ydr')
    if 'FINISHED' not in result or not target.exists() or target.read_bytes()[:4]!=b'RSC7':
        raise RuntimeError('Ekspor tidak menghasilkan YDR native.')
    ytyp=bpy.context.scene.ytyps.add();ytyp.name=name+'_props';bpy.context.scene.ytyp_index=len(bpy.context.scene.ytyps)-1
    archetype=ytyp.new_archetype('sollumz_archetype_base');archetype.name=name;archetype.asset=drawable;archetype.texture_dictionary=name;archetype.lod_dist=200
    result=bpy.ops.sollumz.export_ytyp_io(directory=str(stream),direct_export=True,use_custom_settings=True,target_formats={'NATIVE'},target_versions={'GEN8'},apply_transforms=False)
    ytyp_file=stream/(name+'_props.ytyp')
    if 'FINISHED' not in result or not ytyp_file.exists() or ytyp_file.read_bytes()[:4]!=b'RSC7':
        raise RuntimeError('Ekspor tidak menghasilkan YTYP native.')
    # Round-trip every generated YDR before presenting success. A preview alone
    # must not conceal dropped UVs, materials or embedded textures.
    before=set(bpy.data.objects)
    status=bpy.ops.sollumz.import_assets(directory=str(stream),files=[{'name':target.name}],use_custom_settings=True,textures_mode='PACK')
    imported=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    if 'FINISHED' not in status or not imported:raise RuntimeError('YDR hasil tidak dapat dibaca kembali.')
    verified_textures=set()
    for obj in imported:
        if not obj.data.uv_layers:raise RuntimeError('UV hilang pada hasil native.')
        for material in obj.data.materials:
            node=material.node_tree.nodes.get('DiffuseSampler') if material else None
            if not node or not node.image:raise RuntimeError('Tekstur embedded hilang.')
            node.image.pixels[:4]
            if not node.image.has_data:raise RuntimeError('Tekstur embedded tidak dapat didekode.')
            verified_textures.add(node.image.name)
    # Imported verification copies are removed from the editable project.
    for obj in list(bpy.data.objects):
        if obj not in before:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(output/'ditasha-logo.blend'),copy=True)
    (output/'fxmanifest.lua').write_text("fx_version 'cerulean'\ngame 'gta5'\nauthor 'Ditasha-Workshop'\nfiles { 'stream/*.ytyp' }\ndata_file 'DLC_ITYP_REQUEST' 'stream/"+ytyp_file.name+"'\nclient_script 'preview.lua'\n",encoding='utf8')
    script="""local object
RegisterCommand('%s_spawn', function()
  local model = joaat('%s')
  RequestModel(model)
  local deadline = GetGameTimer() + 10000
  while not HasModelLoaded(model) and GetGameTimer() < deadline do Wait(0) end
  if not HasModelLoaded(model) then print('DITASHA: model belum termuat') return end
  if object then DeleteEntity(object) end
  local ped = PlayerPedId()
  local p = GetOffsetFromEntityInWorldCoords(ped, 0.0, 3.0, 1.0)
  object = CreateObjectNoOffset(model, p.x, p.y, p.z, false, false, false)
  SetEntityHeading(object, GetEntityHeading(ped))
  FreezeEntityPosition(object, true)
  SetEntityCollision(object, false, false)
  SetModelAsNoLongerNeeded(model)
end, false)
AddEventHandler('onResourceStop', function(resource)
  if resource == GetCurrentResourceName() and object then DeleteEntity(object) end
end)
"""%(name,name)
    (output/'preview.lua').write_text(script,encoding='utf8')
    (output/'README.txt').write_text('DITASHA Logo Prop\nCopy this output folder into FiveM resources and ensure its folder name in server.cfg.\nTest: /'+name+'_spawn (local test object in front of the player).\nPlace archetype '+name+' in CodeWalker/YMAP or an existing MLO for permanent placement.\nDecorative static prop, no collision or MLO room/portal generation. Textures are embedded in YDR.\nSource PNG and editable Blender project are included; source images outside this result are unchanged.\n',encoding='utf8')
    return {'files':[target.name,ytyp_file.name,'fxmanifest.lua','preview.lua'],'triangles':count//3,
        'embeddedTextures':len(verified_textures),'roundTrip':True,'decorativeNoCollision':True,
        'sourceTextureSize':source_size,'nativeTextureSize':native_size,
        'modelName':name,'warnings':['Prop dekorasi tanpa collision. Uji spawn dan posisi di GTA V/FiveM.']}
