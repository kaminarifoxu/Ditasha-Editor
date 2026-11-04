'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const worker=path.resolve(__dirname,'../electron/ped_native_verify.py');
const python=process.platform==='win32'?'python':'python3';
const run=(code,...args)=>execFileSync(python,['-c',code,...args],{encoding:'utf8',timeout:12000});

test('ped native validation worker parses without Blender and has no external dependencies',()=>{
 const code='import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text()); print("OK")';
 assert.match(run(code,worker),/OK/);
});

test('ped RSC7 inventory validates YDD/YFT/YTD, file hashes and rejects corruption',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ditasha-ped-verify-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const bytes=Buffer.concat([Buffer.from('RSC7'),Buffer.from([13,0,0,0]),Buffer.alloc(128)]);
 for(const ext of ['ydd','yft','ytd'])await fs.writeFile(path.join(root,'ped.'+ext),bytes);
 const code=[
  'import importlib.util,json,pathlib,sys',
  'spec=importlib.util.spec_from_file_location("v",sys.argv[1]);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)',
  'report=v.native_inventory(sys.argv[2])',
  'assert sorted(report)==[".ydd",".yft",".ytd"]',
  'assert all(len(a)==1 for a in report.values())',
  'assert all(a[0]["sha256"] for a in report.values())',
  'print(json.dumps(report))'
 ].join('\n');
 assert.match(run(code,worker,root),/ped\.ydd/);
 await fs.writeFile(path.join(root,'ped.ydd'),Buffer.from('broken file'));
 assert.throws(()=>run(code,worker,root),/Command failed/);
});

test('ped skin verification checks actual normalized bone weights, UV and head bone',()=>{
 const code=[
  'import importlib.util,sys',
  'from types import SimpleNamespace as S',
  'spec=importlib.util.spec_from_file_location("v",sys.argv[1]);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)',
  'class W: ',
  ' def __init__(self,x): self.group=0;self.weight=x',
  'class Arm:',
  ' type="ARMATURE";name="rig";data=S(bones=[S(name="SKEL_Head",matrix_local=S(translation=[0,0,1]))]);matrix_world=None',
  ' def __init__(self): self.matrix_world=self',
  ' def __matmul__(self,b): return b',
  'arm=Arm()',
  'mesh=S(type="MESH",name="head_000",data=S(polygons=[1],uv_layers=[1],vertices=[S(groups=[W(1)])]),vertex_groups=[S(index=0,name="SKEL_Head")],parent=arm,find_armature=lambda:arm)',
  'assert v.inspect_skin([mesh])["weightedVertices"]==1',
  'mesh.data.vertices=[S(groups=[W(0.3)])]',
  'try: v.inspect_skin([mesh]);raise AssertionError("accepted invalid normalization")',
  'except ValueError as ex: assert "normalized" in str(ex)',
  'mesh.data.vertices=[S(groups=[W(1)])];mesh.data.uv_layers=[]',
  'try: v.inspect_skin([mesh]);raise AssertionError("accepted missing UV")',
  'except ValueError as ex: assert "UV maps" in str(ex)',
  'print("SKIN_OK")',
 ].join('\n');
 assert.match(run(code,worker),/SKIN_OK/);
});

test('ped Blender bridge stages and runs native verification after rig previews',async()=>{
 const [native,bridge]=await Promise.all([
  fs.readFile(path.resolve(__dirname,'../electron/native-build.cjs'),'utf8'),
  fs.readFile(path.resolve(__dirname,'../electron/native_bridge.py'),'utf8'),
 ]);
 assert.match(native,/'ped_native_verify\.py'/);
 const q=bridge.indexOf("report['preview'] = review.create_pose_previews");
 const v=bridge.indexOf('ped_native_verify.verify_native_ped');
 assert.ok(q>=0&&v>q);
 assert.match(bridge,/nativeValidation/);
 assert.match(bridge,/invalidWeights/);
});
