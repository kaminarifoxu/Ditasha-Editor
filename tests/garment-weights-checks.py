from pathlib import Path
import importlib.util
import math
spec = importlib.util.spec_from_file_location('garment_skin', Path(__file__).resolve().parents[1] / 'electron/garment_skin.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
weights = m.normalize_weights({'weak': .01, 'arm': .4, 'spine': .3, 'neck': .2, 'clavicle': .09})
assert len(weights) == 4 and 'weak' not in weights
assert abs(sum(weights.values()) - 1) < 1e-8
assert weights['arm'] > weights['spine'] > weights['neck'] > weights['clavicle']
assert m.normalize_weights({'a': 0, 'b': 2}) == {'b': 1}
for values in ({}, {'a': 0}, {'a': math.nan}, {'a': -1}):
    try: m.normalize_weights(values)
    except ValueError: pass
    else: raise AssertionError('Weightless reference accepted')
print('PASS_GARMENT_WEIGHT_BUDGET')
