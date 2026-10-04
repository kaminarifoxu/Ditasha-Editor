'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {Readable, Transform} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const REPOSITORY = 'kaminarifoxu/FIVEM-YDD-YTD-EDITOR';
const API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
function versionParts(value) {
 const match=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
 if(!match)throw new Error('Nomor versi rilis harus berbentuk v1.2.3.');
 const parts=match.slice(1).map(Number);if(parts.some(n=>!Number.isSafeInteger(n)))throw Error('Nomor versi tidak valid.');return parts;
}
function isNewer(remote,local){const a=versionParts(remote),b=versionParts(local);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
function trustedURL(value,asset=false){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('Alamat update tidak valid.');
 if(asset){if(u.hostname!=='github.com'||!u.pathname.startsWith(`/${REPOSITORY}/releases/download/`))throw Error('File update harus dari Releases repo DITASHA.');}
 else if(!['github.com','api.github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname))throw Error('Redirect update tidak valid.');
 return u.href;
}
function releaseInfo(release,local){
 if(release.draft||release.prerelease)return null;
 if(!isNewer(release.tag_name,local))return null;
 const version=release.tag_name.replace(/^v/,''),names=['DITASHA-Editor.exe',`GANOMABI-Asset-Studio-${version}-Windows-x64.exe`];
 const asset=names.map(name=>release.assets?.find(a=>a.name===name&&a.state==='uploaded')).find(Boolean);
 const name=asset?.name||names[0];
 if(!asset)throw Error(`Rilis ${version} belum memiliki file ${name}.`);
 if(!Number.isSafeInteger(asset.size)||asset.size<1024||asset.size>512*1024*1024)throw Error('Ukuran file update tidak valid.');
 const checksum=release.assets.find(a=>a.name===`${name}.sha256`&&a.state==='uploaded');
 const digest=/^sha256:([a-f0-9]{64})$/i.exec(asset.digest||'')?.[1]?.toLowerCase();
 if(!digest&&!checksum)throw Error('Rilis belum menyertakan checksum SHA-256.');
 return {version,name,size:asset.size,url:trustedURL(asset.browser_download_url,true),sha256:digest,checksumURL:checksum?trustedURL(checksum.browser_download_url,true):null,notes:String(release.body||'').slice(0,4000)};
}
function createPortableUpdater({version,directory,fetcher,onState=()=>{}}){
 let state={status:'idle',version,availableVersion:null,progress:0,autoDownload:true,message:'Siap memeriksa update.'},release=null,readyPath=null,busy=false;
 const config=path.join(directory,'preferences.json');
 try{state.autoDownload=JSON.parse(fs.readFileSync(config,'utf8')).autoDownload!==false;}catch{}
 function emit(fields){state={...state,...fields};onState({...state});return {...state};}
 async function request(url,{timeout=20000,...options}={}){trustedURL(url);const response=await fetcher(url,{...options,headers:{'User-Agent':`DITASHA-Editor/${version}`,'Accept':'application/vnd.github+json',...options.headers},signal:AbortSignal.timeout(timeout)});if(response.url)trustedURL(response.url);return response;}
 async function download(){
  if(busy||!release||state.status==='ready')return {...state};busy=true;readyPath=null;const partial=path.join(directory,'update.part'),final=path.join(directory,release.name);
  try{
   await fsp.mkdir(directory,{recursive:true});emit({status:'downloading',progress:0,downloadedBytes:0,totalBytes:release.size,message:'Mengunduh update…'});
   let expected=release.sha256;
   if(!expected){const sum=await request(release.checksumURL);if(!sum.ok)throw Error('Checksum tidak dapat diunduh.');const text=await sum.text();if(text.length>4096)throw Error('Checksum tidak valid.');expected=/^([a-f0-9]{64})(?:\s|$)/i.exec(text.trim())?.[1]?.toLowerCase();if(!expected)throw Error('Checksum tidak valid.');}
   const response=await request(release.url,{timeout:15*60*1000,headers:{Accept:'application/octet-stream'}});if(!response.ok||!response.body)throw Error('File update gagal diunduh.');
   let total=0,last=0;const hash=crypto.createHash('sha256');const meter=new Transform({transform(chunk,_encoding,callback){total+=chunk.length;if(total>release.size){callback(Error('Ukuran unduhan melebihi rilis.'));return;}hash.update(chunk);const progress=Math.floor(total/release.size*100);if(progress!==last){last=progress;emit({progress,downloadedBytes:total,message:`Mengunduh update… ${progress}%`});}callback(null,chunk);}});
   const source=typeof response.body.getReader==='function'?Readable.fromWeb(response.body):response.body;
   await pipeline(source,meter,fs.createWriteStream(partial,{flags:'w'}));
   emit({status:'verifying',message:'Memverifikasi SHA-256…'});
   if(total!==release.size||hash.digest('hex')!==expected)throw Error('Verifikasi update gagal. File tidak akan dipasang.');
   const handle=await fsp.open(partial,'r');const magic=Buffer.alloc(2);await handle.read(magic,0,2,0);await handle.close();if(magic.toString()!=='MZ')throw Error('File update bukan aplikasi Windows.');
   await fsp.rename(partial,final);readyPath=final;return emit({status:'ready',progress:100,message:'Update siap dipasang. Ekspor desainmu sebelum memulai ulang.'});
  }catch(error){await fsp.unlink(partial).catch(()=>{});return emit({status:'error',message:error.name==='TimeoutError'?'Unduhan terlalu lama. Coba lagi.':error.message});}finally{busy=false;}
 }
 async function check(){
  if(busy||['ready','downloading','verifying'].includes(state.status))return {...state};busy=true;
  try{emit({status:'checking',message:'Memeriksa GitHub Releases…'});const response=await request(API);
   if(response.status===404){release=null;return emit({status:'no-release',message:'Belum ada rilis update di GitHub.'});}
   if(response.status===403||response.status===429)throw Error('Batas akses GitHub tercapai. Coba lagi nanti.');
   if(!response.ok)throw Error('Tidak dapat memeriksa update. Periksa koneksi internet.');
   release=releaseInfo(await response.json(),version);
   if(!release)return emit({status:'current',message:'Kamu sudah memakai versi terbaru.'});
   emit({status:'available',availableVersion:release.version,notes:release.notes,message:`Versi ${release.version} tersedia.`});
  }catch(error){return emit({status:'error',message:error.name==='TimeoutError'?'Pemeriksaan terlalu lama. Coba lagi.':error.message});}finally{busy=false;}
  if(state.autoDownload)return download();return {...state};
 }
 async function setAutoDownload(enabled){if(typeof enabled!=='boolean')throw Error('Pilihan tidak valid.');await fsp.mkdir(directory,{recursive:true});await fsp.writeFile(config,JSON.stringify({autoDownload:enabled}),{mode:0o600});return emit({autoDownload:enabled});}
 return {check,download,setAutoDownload,getState:()=>({...state}),getReadyPath:()=>readyPath};
}
function replacementScript({target,staged,parentPid,logPath,handshakePath=logPath+'.started',restart=true}){
 const quote=s=>"'"+String(s).replace(/'/g,"''")+"'";
 return `$ErrorActionPreference = 'Stop'
$target = ${quote(target)}
$staged = ${quote(staged)}
$backup = $target + '.previous'
$next = $target + '.incoming'
$log = ${quote(logPath)}
$renamed = $false
$installed = $false
function Report($status, $message) {
 @{status=$status;message=$message;target=$target} | ConvertTo-Json -Compress | Set-Content -LiteralPath $log -Encoding UTF8
}
try {
 'started' | Set-Content -LiteralPath ${quote(handshakePath)} -Encoding UTF8
 Report 'installing' 'Menunggu aplikasi ditutup…'
 # Polling tolerates the parent exiting between process lookup and waiting.
 $deadline = (Get-Date).AddSeconds(90)
 while (Get-Process -Id ${Number(parentPid)} -ErrorAction SilentlyContinue) {
  if ((Get-Date) -gt $deadline) { throw 'Aplikasi belum tertutup setelah 90 detik.' }
  Start-Sleep -Milliseconds 250
 }
 # The portable NSIS wrapper may still be cleaning its extracted directory.
 for ($i=0; $i -lt 60; $i++) {
  try {
   $lock = [System.IO.File]::Open($target, 'Open', 'ReadWrite', 'None')
   $lock.Close()
   break
  } catch { if ($i -eq 59) { throw }; Start-Sleep -Milliseconds 500 }
 }
 Copy-Item -LiteralPath $staged -Destination $next -Force
 if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }
 Move-Item -LiteralPath $target -Destination $backup
 $renamed = $true
 Move-Item -LiteralPath $next -Destination $target
 $installed = $true
 $env:PORTABLE_EXECUTABLE_FILE = $null
 $env:PORTABLE_EXECUTABLE_DIR = $null
 $env:PORTABLE_EXECUTABLE_APP_FILENAME = $null
 if (${restart?'$true':'$false'}) { Start-Process -FilePath $target -WorkingDirectory ([System.IO.Path]::GetDirectoryName($target)) }
 Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue
 Report 'success' 'Update berhasil dipasang.'
} catch {
 $failure = $_.Exception.Message
 Report 'error' $failure
 if ($renamed -and (Test-Path -LiteralPath $backup)) {
  if ($installed -and (Test-Path -LiteralPath $target)) { Remove-Item -LiteralPath $target -Force }
  Move-Item -LiteralPath $backup -Destination $target -Force
 }
 if (${restart?'$true':'$false'} -and (Test-Path -LiteralPath $target)) { Start-Process -FilePath $target }
} finally {
 if (Test-Path -LiteralPath $next) { Remove-Item -LiteralPath $next -Force -ErrorAction SilentlyContinue }
}`;
}
module.exports={REPOSITORY,versionParts,isNewer,trustedURL,releaseInfo,createPortableUpdater,replacementScript};
