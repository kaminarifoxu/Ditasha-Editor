'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
// Bundled freemode data lives outside app.asar: extraResources/freemode-reference.
async function ensureBundledFreemode(library, resourcesRoot) {
 const root=path.join(resourcesRoot,'freemode-reference');
 const male=path.join(root,'mp_m_freemode_01');
 const female=path.join(root,'mp_f_freemode_01');
 try { await Promise.all([fs.access(male),fs.access(female)]); }
 catch { return {available:false,reason:'missing-bundled-reference'}; }
 const records=await library.list();
 const marker='DITASHA Built-in Freemode';
 if(records.some(x=>x.pack===marker))return {available:true,imported:false};
 const imported=await library.importDirectory({pack:marker,directory:root});
 return {available:true,imported:true,count:imported.files.length};
}
module.exports={ensureBundledFreemode};
