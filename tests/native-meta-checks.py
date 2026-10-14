import importlib.util
import tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
spec=importlib.util.spec_from_file_location('native_bridge',Path(__file__).resolve().parents[1]/'electron/native_bridge.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp);out=root/'out';out.mkdir()
    values={
        'carcols':'<CVehicleModelInfoVarGlobal><Sirens><Item><id value="986"/><name>donor</name><sirens><Item><color value="0xFFFF0000"/></Item></sirens></Item></Sirens></CVehicleModelInfoVarGlobal>',
        'variations':'<CVehicleModelInfoVariation><variationData><Item><modelName>other</modelName><sirenSettings value="2"/></Item><Item><modelName>mycar</modelName><sirenSettings value="0"/><lightSettings value="5"/><kits><Item>mykit</Item></kits></Item></variationData></CVehicleModelInfoVariation>',
        'vehicles':'<CVehicleModelInfo__InitDataList><residentTxd>vehshare</residentTxd><InitDatas><Item><modelName>other</modelName></Item><Item><modelName>mycar</modelName><handlingId>MYCAR</handlingId><vehicleClass>VC_SPORT</vehicleClass></Item></InitDatas></CVehicleModelInfo__InitDataList>'}
    job={'sirenId':100,'donorSirenId':986}
    for key,text in values.items():
        file=root/(key+'.meta');file.write_text(text);job[key]=str(file)
    m.prepare_metadata(job,'mycar',out)
    cols=ET.parse(out/'data/carcols.meta');assert cols.find('./Sirens/Item/id').get('value')=='100'
    variations=ET.parse(out/'data/carvariations.meta');assert len(variations.findall('./variationData/Item'))==1
    assert variations.find('./variationData/Item/sirenSettings').get('value')=='100'
    assert variations.findtext('./variationData/Item/kits/Item')=='mykit'
    vehicles=ET.parse(out/'data/vehicles.meta');assert vehicles.findtext('./InitDatas/Item/handlingId')=='MYCAR'
    assert vehicles.findtext('./InitDatas/Item/vehicleClass')=='VC_EMERGENCY'
    assert vehicles.findtext('./InitDatas/Item/audioNameHash')=='POLICE'
    assert 'CARCOLS_FILE' in (out/'fxmanifest.lua').read_text()
    attack=root/'attack.meta';attack.write_text('<!DOCTYPE x [<!ENTITY y "expanded">]><x>&y;</x>')
    try:m.read_xml(attack)
    except ValueError:pass
    else:raise AssertionError('DTD was accepted')
    try:m.prepare_metadata(job,'missing',out)
    except ValueError:pass
    else:raise AssertionError('Missing model accepted')
print('PASS_NATIVE_METADATA')
