'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const input=path.join(root,'assets','mp_freemode.zip');
const output=path.join(root,'assets','freemode-reference');
fs.mkdirSync(output,{recursive:true});
const target=path.join(output,'mp_freemode');
const ready=()=>fs.existsSync(path.join(target,'mp_m_freemode_01','head_000_r.ydd')) &&
 fs.existsSync(path.join(target,'mp_f_freemode_01','head_000_r.ydd'));
if(ready()){
 console.log('[freemode] Both head references already prepared.');
 process.exit(0);
}
if(!fs.existsSync(input)){
 console.warn('::warning::No freemode ZIP provided. Windows EXE will NOT contain built-in freemode character models.');
 process.exit(0);
}
if(process.platform!=='win32'){
 console.error('[freemode] Pre-extract assets/mp_freemode.zip to assets/freemode-reference on non-Windows builds.');
 process.exit(1);
}
const script='$ErrorActionPreference = \'Stop\'; Expand-Archive -LiteralPath '+JSON.stringify(input)+
 ' -DestinationPath '+JSON.stringify(output)+' -Force';
const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],
 {encoding:'utf8',stdio:'inherit',timeout:300000});
if(result.status!==0)throw Error('Could not extract bundled freemode archive: '+(result.error?.message||result.status));
if(!ready())
 throw Error('Expected male and female mp_freemode folders in ZIP');
console.log('[freemode] Both freemode models prepared for EXE packaging.');
