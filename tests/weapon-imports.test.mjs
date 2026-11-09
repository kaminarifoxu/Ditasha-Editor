import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWeaponImportSelection } from '../src/creators/weapon-imports.js';

const file=(name,size=1024)=>({name,size});
test('Weapon Studio accepts editable GLB and OBJ custom weapon designs',()=>{
  for(const ext of ['glb','obj']) {
    const result=validateWeaponImportSelection([file('weapon.'+ext)],'base');
    assert.equal(result.mode,'base');
    assert.equal(result.isNative,false);
    assert.equal(result.nativeWeaponRigCertified,false);
  }
});
test('Weapon Studio accepts GLB/OBJ custom prop attachments alongside donor weapons',()=>{
  for(const ext of ['glb','obj','ydr','ydd']) {
    const files=ext==='ydr'||ext==='ydd'
      ? [file('scope.'+ext),file('scope.ytd')]:[file('scope.'+ext)];
    const result=validateWeaponImportSelection(files,'part');
    assert.equal(result.mode,'part');
    assert.equal(result.editablePreviewOnly,true);
  }
});
test('Weapon Studio GTA YDR/YTD paired imports require matching model and texture',()=>{
  assert.equal(validateWeaponImportSelection([file('w_pi_pistol.ydr'),file('w_pi_pistol.ytd')],'native').isNative,true);
  for(const bad of [
    [file('gun.glb'),file('gun.ytd')],
    [file('gun.ydr')],
    [file('gun.ydr'),file('other.ytd')],
    [file('gun.ydr'),file('gun.ydr'),file('gun.ytd')],
    [file('gun.ydr'),file('gun.ytd'),file('payload.exe')],
  ]) assert.throws(()=>validateWeaponImportSelection(bad,'native'));
});
test('Weapon Studio rejects unsafe or malformed file selections',()=>{
  assert.throws(()=>validateWeaponImportSelection([],'part'));
  assert.throws(()=>validateWeaponImportSelection([file('foo.glb',0)],'base'));
  assert.throws(()=>validateWeaponImportSelection([file('foo.glb',65*1024*1024)],'base'));
  assert.throws(()=>validateWeaponImportSelection([file('foo.glb')],'invalid'));
});
