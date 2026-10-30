"""Offline full-ped diagnostic entry point for the existing DITASHA engine."""
import faulthandler
import json
import sys
from pathlib import Path

faulthandler.enable(all_threads=True)
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, 'reconfigure'):
        stream.reconfigure(encoding='utf-8', errors='backslashreplace')
sys.path.insert(0, str(Path(__file__).parent / 'python'))
import native_bridge

spec = Path(sys.argv[sys.argv.index('--') + 1])
job = json.loads(spec.read_text(encoding='utf-8-sig'))
result = native_bridge.run(job)
print('DITASHA_DIAGNOSTIC_RESULT', json.dumps(result, ensure_ascii=True), flush=True)
if not result['ok']:
    sys.exit(2)
