"""Original bounded CPU BC1/BC3 DDS encoder for Blender clothing export."""
import struct


def encode_blocks(rgba, alpha):
    import numpy as np
    h,w,_ = rgba.shape
    padded = np.pad(rgba,((0,(-h)%4),(0,(-w)%4),(0,0)),mode='edge')
    blocks = padded.reshape((h+3)//4,4,(w+3)//4,4,4).transpose(0,2,1,3,4).reshape(-1,16,4)
    result = bytearray()
    for start in range(0,len(blocks),512):
        pixels = blocks[start:start+512].astype(np.float32)
        visible = pixels[:,:,3:4] > 0
        low = np.where(visible,pixels[:,:,:3],255).min(axis=1)
        high = np.where(visible,pixels[:,:,:3],0).max(axis=1)
        empty = ~visible.any(axis=1).ravel()
        low[empty] = pixels[empty,:,:3].min(axis=1)
        high[empty] = pixels[empty,:,:3].max(axis=1)
        def pack(color):
            c=np.floor(color*np.array([31,63,31])/255+.5).astype(np.uint32)
            return (c[:,0]<<11)|(c[:,1]<<5)|c[:,2]
        def unpack(value):
            return np.floor(np.stack([(value>>11)*255/31,((value>>5)&63)*255/63,(value&31)*255/31],axis=1)+.5)
        importance=pixels[:,:,3]/255
        best=np.full(len(pixels),np.inf);best_a=np.zeros(len(pixels),dtype=np.uint32)
        best_b=best_a.copy();best_bits=best_a.copy()
        for iteration in range(3):
            a,b=pack(high),pack(low)
            a,b=np.maximum(a,b),np.minimum(a,b)
            same=a==b
            b=np.where(same & (a==65535),b-1,b)
            a=np.where(same & (a<65535),a+1,a)
            ca,cb=unpack(a),unpack(b)
            palette=np.stack([ca,cb,np.floor((2*ca+cb)/3+.5),np.floor((ca+2*cb)/3+.5)],axis=1)
            error=((pixels[:,:,:3,None]-palette.transpose(0,2,1)[:,None,:,:])**2).sum(axis=2)
            choices=error.argmin(axis=2).astype(np.uint32)
            bits=np.bitwise_or.reduce(choices << (np.arange(16,dtype=np.uint32)*2),axis=1)
            score=(error.min(axis=2)*importance).sum(axis=1)
            better=score<best
            best[better]=score[better];best_a[better]=a[better];best_b[better]=b[better];best_bits[better]=bits[better]
            wa=np.array([1,0,2/3,1/3])[choices];wb=1-wa
            aa=(wa*wa*importance).sum(axis=1);ab=(wa*wb*importance).sum(axis=1);bb=(wb*wb*importance).sum(axis=1)
            ax=(wa[:,:,None]*importance[:,:,None]*pixels[:,:,:3]).sum(axis=1)
            bx=(wb[:,:,None]*importance[:,:,None]*pixels[:,:,:3]).sum(axis=1)
            determinant=aa*bb-ab*ab
            valid=determinant>1e-8
            if not valid.any(): break
            high[valid]=np.clip((ax[valid]*bb[valid,None]-bx[valid]*ab[valid,None])/determinant[valid,None],0,255)
            low[valid]=np.clip((bx[valid]*aa[valid,None]-ax[valid]*ab[valid,None])/determinant[valid,None],0,255)
        a,b,bits=best_a,best_b,best_bits
        out=np.zeros((len(pixels),16 if alpha else 8),dtype=np.uint8)
        offset=8 if alpha else 0
        out[:,offset:offset+2]=a.astype('<u2').view(np.uint8).reshape(-1,2)
        out[:,offset+2:offset+4]=b.astype('<u2').view(np.uint8).reshape(-1,2)
        out[:,offset+4:offset+8]=bits.astype('<u4').view(np.uint8).reshape(-1,4)
        if alpha:
            values=pixels[:,:,3]
            ah,al=values.max(axis=1),values.min(axis=1)
            ap=np.stack([ah,al,*[((7-i)*ah+i*al)/7 for i in range(1,7)]],axis=1)
            equal=ah<=al
            ap[equal,2:6]=np.stack([((5-i)*ah[equal]+i*al[equal])/5 for i in range(1,5)],axis=1)
            ap[equal,6]=0;ap[equal,7]=255
            ai=np.abs(values[:,:,None]-ap[:,None,:]).argmin(axis=2).astype(np.uint64)
            ab=np.bitwise_or.reduce(ai << (np.arange(16,dtype=np.uint64)*3),axis=1)
            out[:,0]=ah;out[:,1]=al
            out[:,2:8]=ab.astype('<u8').view(np.uint8).reshape(-1,8)[:,:6]
        result.extend(out.tobytes())
    return bytes(result)


def next_mip(rgba):
    import numpy as np
    h,w,_=rgba.shape
    nh,nw=max(1,h//2),max(1,w//2)
    value=rgba.astype(np.float32)
    value[:,:,:3] *= value[:,:,3:4]/255
    y=(np.arange(nh)+.5)*h/nh-.5; x=(np.arange(nw)+.5)*w/nw-.5
    y0=np.floor(y).astype(int);x0=np.floor(x).astype(int)
    fy=(y-y0)[:,None,None];fx=(x-x0)[None,:,None]
    y1=np.minimum(y0+1,h-1);x1=np.minimum(x0+1,w-1)
    top=value[y0[:,None],x0[None,:]]*(1-fx)+value[y0[:,None],x1[None,:]]*fx
    bottom=value[y1[:,None],x0[None,:]]*(1-fx)+value[y1[:,None],x1[None,:]]*fx
    out=top*(1-fy)+bottom*fy
    out[:,:,:3]=np.divide(out[:,:,:3]*255,out[:,:,3:4],out=np.zeros_like(out[:,:,:3]),where=out[:,:,3:4]>0)
    return np.floor(np.clip(out,0,255)+.5).astype(np.uint8)


def encode_dds(rgba):
    import numpy as np
    if not isinstance(rgba,np.ndarray) or rgba.dtype!=np.uint8 or rgba.ndim!=3 or rgba.shape[2]!=4:
        raise ValueError('DDS memerlukan RGBA8.')
    h,w,_=rgba.shape
    if not w or not h or w>8192 or h>8192 or w*h>16777216: raise ValueError('DDS maksimal 16 megapixel / sisi 8192.')
    alpha=bool(np.any(rgba[:,:,3]<255))
    chunks=[]; current=rgba
    while True:
        chunks.append(encode_blocks(current,alpha))
        if current.shape[:2]==(1,1): break
        current=next_mip(current)
    header=bytearray(128);header[:4]=b'DDS '
    struct.pack_into('<7I',header,4,124,0xA1007,h,w,len(chunks[0]),0,len(chunks))
    struct.pack_into('<II4s',header,76,32,4,b'DXT5' if alpha else b'DXT1')
    struct.pack_into('<I',header,108,0x1000|(0x400008 if len(chunks)>1 else 0))
    return bytes(header)+b''.join(chunks)


def pack_image(bpy, image, name, output):
    from pathlib import Path
    import numpy as np
    packed=image.packed_file
    if packed and packed.data.startswith(b'DDS '):
        if not image.filepath: image.filepath_raw=str(Path(output)/'.ditasha-textures'/(name+'.dds'))
        return image
    path=Path(bpy.path.abspath(image.filepath)) if image.filepath else None
    if not packed and path and path.suffix.lower()=='.dds' and path.is_file():
        if path.suffix!='.dds':
            data=path.read_bytes();image.filepath_raw=str(Path(output)/'.ditasha-textures'/(name+'.dds'))
            image.pack(data=data,data_len=len(data))
        return image
    w,h=image.size
    if not w or not h or w>8192 or h>8192 or w*h>16777216: raise ValueError('Diffuse maksimal 16 megapixel / sisi 8192 untuk ekspor native.')
    values=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(values)
    if not np.isfinite(values).all(): raise ValueError('Pixel diffuse tidak valid.')
    # Blender's pixel array is bottom-up; DDS scanlines are top-down.
    rgba=np.floor(np.clip(values.reshape(h,w,4)[::-1],0,1)*255+.5).astype(np.uint8)
    data=encode_dds(rgba)
    image.filepath_raw=str(Path(output)/'.ditasha-textures'/(name+'.dds'))
    image.pack(data=data,data_len=len(data))
    return image
