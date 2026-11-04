"""Small, dependency-free uncompressed DDS encoder for Sollumz image sources.

Sollumz 2.9 requires .dds paths (or packed DDS bytes) and derives the slot
name from image.filepath. Blender's packed PNG and generated images are not
usable texture sources for its YTD writer.
"""
import struct
from pathlib import Path

DDS_HEADER_SIZE = 128
MAX_PIXELS = 4096 * 4096

def encode_dds_rgba(width, height, rgba):
    if not isinstance(width, int) or not isinstance(height, int):
        raise ValueError("DDS dimensions must be integers")
    if width < 1 or height < 1 or width * height > MAX_PIXELS:
        raise ValueError("DDS dimensions exceed safe limit (max 4096² pixels)")
    rgba = bytes(rgba)
    if len(rgba) != width * height * 4:
        raise ValueError("DDS RGBA buffer length does not match dimensions")
    header = bytearray(DDS_HEADER_SIZE)
    header[0:4] = b"DDS "
    values = {
        4: 124,             # DDS_HEADER.dwSize
        8: 0x100F,          # CAPS | HEIGHT | WIDTH | PITCH | PIXELFORMAT
        12: height,
        16: width,
        20: width * 4,      # bytes per scanline
        76: 32,             # DDS_PIXELFORMAT.dwSize
        80: 0x41,           # DDPF_RGB | DDPF_ALPHAPIXELS
        88: 32,             # RGB bit count
        92: 0x00FF0000,     # red mask, BGRA layout
        96: 0x0000FF00,
        100: 0x000000FF,
        104: 0xFF000000,
        108: 0x1000,        # DDSCAPS_TEXTURE
    }
    for offset, value in values.items():
        struct.pack_into("<I", header, offset, value)
    bgra = bytearray(len(rgba))
    bgra[0::4] = rgba[2::4]
    bgra[1::4] = rgba[1::4]
    bgra[2::4] = rgba[0::4]
    bgra[3::4] = rgba[3::4]
    return bytes(header) + bytes(bgra)

def image_to_dds(bpy, image, dest):
    """Copy a Blender image into new temporary DDS, never edit original pixels."""
    from array import array
    width, height = (int(v) for v in image.size[:2])
    if width < 1 or height < 1 or width * height > MAX_PIXELS:
        raise ValueError("Texture too large for native DDS staging (max 4096² pixels)")
    image.update()
    pixels = array("f", [0.0]) * (width * height * 4)
    image.pixels.foreach_get(pixels)
    rgba = bytearray(len(pixels))
    for i, value in enumerate(pixels):
        # Blender provides RGBA floating point values, possibly outside [0, 1].
        if not (float("-inf") < value < float("inf")):
            raise ValueError("Texture has non-finite pixels")
        rgba[i] = max(0, min(255, int(value * 255 + 0.5)))
    output = Path(dest)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(encode_dds_rgba(width, height, rgba))
    # Creating a NEW image from DDS is essential. Merely replacing filepath on
    # an already packed PNG image leaves non-DDS packed_file bytes in place.
    imported = bpy.data.images.load(str(output), check_existing=False)
    if tuple(imported.size[:2]) != (width, height):
        raise ValueError("Staged DDS dimensions differ from source")
    imported.filepath = str(output)
    return imported
