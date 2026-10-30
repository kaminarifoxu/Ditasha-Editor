"""Package our diagnostic sources; no engine, user model or uploaded file is included."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / 'release' / 'DITASHA-Rig-Diagnostic.zip'
target.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in ('Run-Rig-Diagnostic.cmd', 'Run-Rig-Diagnostic.ps1', 'rig-diagnostic.py'):
        archive.write(root / 'scripts' / name, name)
    archive.write(root / 'docs' / 'RIG_DIAGNOSTIC.md', 'BACA-DULU.md')
    for name in ('native_bridge.py', 'ped_review.py', 'garment_skin.py', 'clothing_workflow.py', 'clip_review.py', 'native_dds.py', 'logo_prop.py', 'half_ped.py'):
        archive.write(root / 'electron' / name, 'python/' + name)
print(target)
