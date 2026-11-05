"""Verify Muto stage sidecar and operation sequencing without requiring Blender installation."""
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

root=Path(__file__).resolve().parents[1]
def module(name, filename):
    spec=importlib.util.spec_from_file_location(name, root/'electron'/filename)
    value=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

bridge=module('ditasha_native_stage','native_bridge.py')
review=module('ditasha_review_stage','ped_review.py')
with TemporaryDirectory(prefix='ditasha-stage-test-') as temp:
    bridge._ped_stage_file=Path(temp)/'ped-stage.json'
    bridge.ped_stage('Starting import')
    first=json.loads(bridge._ped_stage_file.read_text(encoding='utf8'))
    assert first['step']=='Starting import'
    assert isinstance(first['timestamp'],float)
    assert not bridge._ped_stage_file.with_suffix('.tmp').exists()

    class Worker:
        STEPS=(('markers','markers_auto'),('fit','fit'),('weights','weights'),('export','sollumz_export'))
        def __init__(self):
            self._import=lambda source: None
        def run(self,args):
            self._import(args['src'])
            for key, operator in self.STEPS:
                assert key in ('markers','fit','weights','export')
            return {'ok':True}
    worker=Worker()
    original=worker.STEPS
    settings=SimpleNamespace()
    context=SimpleNamespace(scene=SimpleNamespace(mpr=settings))
    result=review.run_muto(worker, SimpleNamespace(context=context),
        {'src':'model.glb'}, {'reference':'mp_f'},
        stage_callback=bridge.ped_stage)
    assert result['ok']
    assert worker.STEPS is original
    step=json.loads(bridge._ped_stage_file.read_text(encoding='utf8'))
    assert step['step']=='Muto step: export',step

    def failure(args):
        for step in worker.STEPS:
            if step[0]=='weights':
                raise RuntimeError('test weight failure')
    worker.run=failure
    try:
        review.run_muto(worker, SimpleNamespace(context=context),
            {'src':'model.glb'}, {'reference':'mp_f'},
            stage_callback=bridge.ped_stage)
    except RuntimeError:
        pass
    else:
        raise AssertionError('worker exception swallowed')
    assert worker.STEPS is original
    assert json.loads(bridge._ped_stage_file.read_text(encoding='utf8'))['step']=='Muto step: weights'
print('PASS_PED_STAGE_SIDECAR_AND_WORKER_RESTORE')
