"""Install pinned add-ons into DITASHA's isolated Blender profile, then verify them."""
import sys
import json
import zipfile
import importlib
from pathlib import Path
import bpy
import addon_utils

spec = json.loads(Path(sys.argv[sys.argv.index('--') + 1]).read_text(encoding='utf-8'))
root = Path(spec['root'])
repo_dir = root / 'extensions' / 'ditasha'
repo_dir.mkdir(parents=True, exist_ok=True)
for key, folder in [('sollumz', 'sollumz'), ('muto', 'muto_ped_rig')]:
    target = repo_dir / folder
    target.mkdir(exist_ok=True)
    with zipfile.ZipFile(spec['archives'][key]) as archive:
        for item in archive.infolist():
            parts = Path(item.filename).parts
            if item.filename.startswith(('/', '\\')) or '..' in parts or '\\' in item.filename or ':' in item.filename:
                raise ValueError('Unsafe add-on archive path')
            relative = Path(*parts[1:]) if key == 'sollumz' else Path(*parts)
            if not relative.parts or item.is_dir():
                continue
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read(item))

repos = bpy.context.preferences.extensions.repos
repo = next((r for r in repos if r.module == 'ditasha'), None)
if repo is None:
    repo = repos.new(name='DITASHA Local', module='ditasha', custom_directory=str(repo_dir))
repo.use_custom_directory = True
repo.custom_directory = str(repo_dir)
repo.enabled = True
addon_utils.modules_refresh()
# Sollumz pins these packages and their hashes; use its installer to match Blender's Python ABI.
deps = importlib.import_module('bl_ext.ditasha.sollumz.dependencies')
if not deps.install_dependencies(online_access_override=True, optional_dependencies_to_install={'pymateria'}):
    raise RuntimeError('Native dependency download failed. Check internet access and retry setup.')
deps.mount_dependencies()
for module in ['bl_ext.ditasha.sollumz', 'bl_ext.ditasha.muto_ped_rig']:
    if addon_utils.enable(module, default_set=True, persistent=True) is None:
        raise RuntimeError('Could not enable ' + module)
if not deps.IS_SZIO_NATIVE_AVAILABLE:
    raise RuntimeError('Native szio/PyMateria engine is unavailable after setup.')
importlib.import_module('bl_ext.ditasha.muto_ped_rig.bl.batch_worker')
if 'bl_ext.ditasha.muto_ped_rig' not in bpy.context.preferences.addons:
    raise RuntimeError('Muto could not be registered.')
bpy.ops.wm.save_userpref()
print('DITASHA_NATIVE_SETUP_OK', flush=True)
