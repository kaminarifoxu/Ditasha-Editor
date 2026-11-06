'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
test('M2c native Blender/Sollumz script parses and requires weapon attachment anchors',()=>{
  const filename=path.resolve(__dirname,'../electron/creators/weapon-native.py');
  const interpreter=process.platform==='win32'?'python':'python3';
  const script='import ast,pathlib,sys; s=pathlib.Path(sys.argv[1]).read_text(); ast.parse(s); assert all(x in s for x in ("WAPClip","WAPSupp","WAPGrip","bpy.ops.sollumz.import_assets","bpy.ops.sollumz.export_assets")); print("OK")';
  const output=execFileSync(interpreter,['-c',script,filename],{encoding:'utf8',timeout:10000});
  assert.match(output,/OK/);
});
test('M2c uses a separate weapon IPC and preload, leaving Prop handlers untouched',async()=>{
  const [main,preload,studio]=await Promise.all([
    fs.readFile(path.resolve(__dirname,'../electron/main.cjs'),'utf8'),
    fs.readFile(path.resolve(__dirname,'../electron/preload.cjs'),'utf8'),
    fs.readFile(path.resolve(__dirname,'../src/weapon-studio.js'),'utf8'),
  ]);
  assert.match(main,/registerWeaponCreator/);
  assert.match(preload,/ditashaWeaponCreator/);
  assert.match(studio,/mountWeaponNativeExport/);
});
