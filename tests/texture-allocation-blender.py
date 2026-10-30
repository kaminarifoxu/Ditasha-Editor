"""Read the JS optimizer's actual RSC output through native szio/PyMateria."""
import bpy
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'release'/'native-qa'
expected=json.loads((root/'expected.json').read_text())
source=root/'native-repacked.ytd';original=source.read_bytes()
before=set(bpy.data.images)
result=bpy.ops.sollumz.import_assets(directory=str(root),files=[{'name':source.name}],use_custom_settings=True,textures_mode='PACK')
assert 'FINISHED' in result
images=[image for image in bpy.data.images if image not in before]
assert len(images)==len(expected['expected']),[image.name for image in images]
for texture in expected['expected']:
    image=next(image for image in images if image.name.startswith(texture['name']))
    color=image.pixels[:4]
    assert image.has_data and image.size[:]==(texture['w'],texture['h']),(image.name,image.size[:],color)
    assert all(abs(value-reference/255)<.06 for value,reference in zip(color,texture['color'])),(texture,color)
assert source.read_bytes()==original
print('PASS_NATIVE_YTD_GPU_REPACK',expected['allocation'],bpy.app.version_string)
