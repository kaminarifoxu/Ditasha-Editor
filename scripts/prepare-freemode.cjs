'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const input=path.join(root,'assets','mp_freemode.zip');
const output=path.join(root,'assets','freemode-reference');
fs.mkdirSync(output,{recursive:true});
if(!fs.existsSync(input)){
 console.log('[freemode] No assets/mp_freemode.zip; building app without optional built-in GTA reference files.');
 process.exit(0);
}
if(process.platform!=='win32'){
 console.error('[freemode] Extract assets/mp_freemode.zip into assets/freemode-reference before packaging on this OS.');
 process.exit(1);
}
const target=path.join(output,'mp_freemode');
if(fs.existsSync(path.join(target,'mp_m_freemode_01')) &&
   fs.existsSync(path.join(target,'mp_f_freemode_01'))){
 console.log('[freemode] Male/female sources already prepared.');
 process.exit(0);
}
const script='$ErrorActionPreference = \'Stop\'; Expand-Archive -LiteralPath '+JSON.stringify(input)+
 ' -DestinationPath '+JSON.stringify(output)+' -Force';
const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],
 {encoding:'utf8',stdio:'inherit',timeout:300000});
if(result.status!==0)throw Error('Could not extract bundled freemode archive: '+(result.error?.message||result.status));
if(!fs.existsSync(path.join(target,'mp_m_freemode_01')) ||
   !fs.existsSync(path.join(target,'mp_f_freemode_01')))
 throw Error('Expected male and female mp_freemode folders in ZIP');
console.log('[freemode] Both freemode models prepared for EXE packaging.');
