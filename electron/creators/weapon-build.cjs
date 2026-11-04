'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { managedEnv } = require('../native-setup.cjs');
const { managedExecutable } = require('./prop-build.cjs'); // Reuse existing read-only native installation verification.
const { runNativeProcess, cleanupStaging } = require('./native-process.cjs');
const { validateArtifacts, commitExport, safeRelative } = require('./export-validation.cjs');
const { createGtaTools, SPECS, digest } = require('../gta-tools.cjs');
const { validateWeaponBuildRequest, inspectWeaponSource, WEAPON_REFERENCES } = require('./weapon-schema.cjs');

const DATA_FILES = Object.freeze({
  'weaponcomponents.meta': 'WEAPONCOMPONENTSINFO_FILE',
  'weaponarchetypes.meta': 'WEAPON_METADATA_FILE',
  'weaponanimations.meta': 'WEAPON_ANIMATIONS_FILE',
  'pedpersonality.meta': 'PED_PERSONALITY_FILE',
  'pickups.meta': 'DLC_WEAPON_PICKUPS',
  'weapons.meta': 'WEAPONINFO_FILE',
});
const MAX_OUTPUT_FILES = 800;
const MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;

function validAnchorSet(report) {
  if (!report || report.schema !== 1 || report.ok !== true || report.nativeRoundTrip !== true ||
      !report.before || !report.after || !Array.isArray(report.artifacts) ||
      report.artifacts.length !== 2) throw Error('Unverified Sollumz weapon round-trip');
  if (!Number.isInteger(report.before.boneCount) || report.before.boneCount < 3 ||
      !Number.isInteger(report.before.meshes) || report.before.meshes < 1 ||
      !Number.isInteger(report.before.textureCount) || report.before.textureCount < 1)
    throw Error('Native weapon is missing verified geometry, bones or textures');
  for (const key of ['muzzle','grip','magazine']) {
    const before = report.before.anchors?.[key], after = report.after.anchors?.[key];
    if (!before || !after || typeof before.name !== 'string' ||
        before.name.toLowerCase() !== after.name?.toLowerCase() ||
        !Array.isArray(before.position) || !Array.isArray(after.position) ||
        before.position.length !== 3 || after.position.length !== 3 ||
        [...before.position, ...after.position].some(x => typeof x !== 'number' || !Number.isFinite(x)))
      throw Error('Missing or mismatched native weapon ' + key + ' anchor');
    const distance = Math.hypot(...before.position.map((v,i) => v - after.position[i]));
    if (distance > 0.002) throw Error('Native weapon ' + key + ' attachment drift exceeded 2 mm');
  }
  return true;
}

async function validateNativeWeaponReport(stage, model) {
  const report = JSON.parse(await fs.readFile(path.join(stage,'weapon-native-report.json'),'utf8'));
  validAnchorSet(report);
  if (report.sourceModel !== model) throw Error('Native weapon donor model mismatch');
  const expected = [model + '.ydr', model + '.ytd'];
  if (report.artifacts.some(a => !expected.includes(a.name)) ||
      new Set(report.artifacts.map(a => a.name)).size !== expected.length)
    throw Error('Native weapon round-trip does not contain precisely YDR and YTD');
  const verified = await validateArtifacts(stage, report.artifacts.map(a => ({
    relativePath: 'native-roundtrip/' + a.name, bytes: a.bytes, sha256: a.sha256,
  })));
  for (const item of verified) {
    const file = path.join(stage,...item.relativePath.split('/'));
    const magic = Buffer.alloc(8);
    const handle = await fs.open(file,'r');
    try { await handle.read(magic,0,8,0); } finally { await handle.close(); }
    if (magic.toString('ascii',0,4) !== 'RSC7' || magic.readUInt32LE(4) !== 13)
      throw Error('Native weapon resource is not GTA V Legacy RSC7');
  }
  return report;
}

async function collectWeaponArtifacts(root, prefix='') {
  let count=0, total=0;
  const files=[];
  async function walk(directory, subpath, depth) {
    if (depth > 7) throw Error('Weapon builder output is too deeply nested');
    for (const entry of await fs.readdir(directory, {withFileTypes:true})) {
      if (!/^[A-Za-z0-9_. -]{1,128}$/.test(entry.name)) throw Error('Unsafe builder output filename');
      const rel = [subpath,entry.name].filter(Boolean).join('/');
      safeRelative([prefix,rel].filter(Boolean).join('/'));
      const physical=path.join(directory,entry.name);
      if (entry.isSymbolicLink()) throw Error('Builder output contains a symbolic link');
      if (entry.isDirectory()) { await walk(physical,rel,depth+1); continue; }
      if (!entry.isFile() || !/\.(rpf|ydr|ytd|meta|xml|txt|json|gxt2)$/i.test(entry.name))
        throw Error('Unsupported weapon builder output: ' + rel);
      const stat=await fs.stat(physical);
      if (stat.size < 1 || stat.size > 256*1024*1024) throw Error('Invalid weapon builder output size');
      if (++count > MAX_OUTPUT_FILES || (total+=stat.size) > MAX_OUTPUT_BYTES)
        throw Error('Weapon builder output exceeds safety limits');
      files.push({ relativePath: [prefix,rel].filter(Boolean).join('/'), bytes: stat.size });
    }
  }
  await walk(root,'',0);
  if (!files.length) throw Error('AddonWeaponsBuilder produced no files');
  if (!files.some(f => /\.(rpf|ydr)$/i.test(f.relativePath)))
    throw Error('AddonWeaponsBuilder produced no weapon DLC or native drawable');
  return files;
}

function generateFiveMManifest(names) {
  if (!names.includes('weapons.meta') || !names.includes('weaponarchetypes.meta') ||
      !names.includes('weaponanimations.meta'))
    throw Error('Complete FiveM weapon metadata is required');
  const ordered=Object.keys(DATA_FILES).filter(name=>names.includes(name));
  return [
    "fx_version 'cerulean'",
    "game 'gta5'",
    '',
    'files {',
    ...ordered.map(name=>"  'meta/"+name+"',"),
    '}',
    ...ordered.map(name=>"data_file '"+DATA_FILES[name]+"' 'meta/"+name+"'"),
    '',
  ].join('\n');
}

async function prepareFiveMPackage(staging, artifactList) {
  // Only create a FiveM resource from a COMPLETE, unambiguous set of loose
  // files. An RPF-only GTA DLC is NOT equivalent to a FiveM stream resource.
  const outputRoot=path.join(staging,'GTA-DLC');
  const files=artifactList.map(a=>a.relativePath.slice('GTA-DLC/'.length));
  const ydr=files.filter(name=>/\.ydr$/i.test(name));
  const ytd=files.filter(name=>/\.ytd$/i.test(name));
  const metaFiles=files.filter(name=>/\.meta$/i.test(name));
  if (!ydr.length || !ytd.length || !metaFiles.length) return {ready:false,reason:'GTA DLC generated; source archive has no complete loose FiveM metas/stream files'};
  const metaIndex=new Map();
  for (const relative of metaFiles) {
    const name=path.posix.basename(relative).toLowerCase();
    if (!Object.hasOwn(DATA_FILES,name)) continue;
    if (metaIndex.has(name)) throw Error('Ambiguous duplicate weapon metadata: '+name);
    metaIndex.set(name,relative);
  }
  if (!['weapons.meta','weaponarchetypes.meta','weaponanimations.meta'].every(name=>metaIndex.has(name)))
    return {ready:false,reason:'GTA DLC generated; essential FiveM weapon metadata is not available as loose files'};
  if (ydr.length>32 || ytd.length>32) throw Error('Too many loose native weapon models for one resource');
  const txdStems=new Set(ytd.map(name=>path.posix.basename(name).toLowerCase().slice(0,-4)));
  if (!ydr.every(name=>txdStems.has(path.posix.basename(name).toLowerCase().slice(0,-4))))
    return {ready:false,reason:'Native YDR/YTD names do not match; FiveM packaging withheld'};
  const dest=path.join(staging,'FiveM-resource');
  await fs.mkdir(path.join(dest,'meta'),{recursive:true});
  await fs.mkdir(path.join(dest,'stream'),{recursive:true});
  const resources=[];
  for (const [name,relative] of metaIndex) {
    const text=await fs.readFile(path.join(outputRoot,...relative.split('/')),'utf8');
    if (!text.trim().startsWith('<') || text.length>2*1024*1024) throw Error('Malformed native weapon metadata: '+name);
    await fs.copyFile(path.join(outputRoot,...relative.split('/')),path.join(dest,'meta',name));
    resources.push({relativePath:'FiveM-resource/meta/'+name});
  }
  for(const relative of [...ydr,...ytd]) {
    const basename=path.posix.basename(relative);
    const file=path.join(outputRoot,...relative.split('/'));
    const head=Buffer.alloc(8),fh=await fs.open(file,'r');
    try {await fh.read(head,0,8,0)} finally {await fh.close()}
    if (head.toString('ascii',0,4)!=='RSC7' || head.readUInt32LE(4)!==13)
      throw Error('Invalid GTA V Legacy native stream resource '+basename);
    await fs.copyFile(file,path.join(dest,'stream',basename));
    resources.push({relativePath:'FiveM-resource/stream/'+basename});
  }
  const manifest=generateFiveMManifest([...metaIndex.keys()]);
  await fs.writeFile(path.join(dest,'fxmanifest.lua'),manifest,{flag:'wx'});
  resources.push({relativePath:'FiveM-resource/fxmanifest.lua'});
  return {ready:true,reason:'Loose FiveM package assembled; in-game verification pending',resources};
}

async function verifyAddonArchives(staging, files, userDataRoot, signal, runner=runNativeProcess) {
  const archives=files.filter(a=>a.relativePath.toLowerCase().endsWith('.rpf'));
  if (!archives.length) throw Error('AddonWeaponsBuilder produced no GTA weapon archive');
  const toolRoot=path.join(userDataRoot,'gta-tools','weapons','current');
  const manifest=JSON.parse(await fs.readFile(path.join(toolRoot,'ready.json'),'utf8'));
  if (manifest.version!==SPECS.weapons.version || manifest.sha256!==SPECS.weapons.sha256)
    throw Error('Unverified AddonWeaponsBuilder installation');
  const base=path.join(toolRoot,SPECS.weapons.folder);
  for(const [name,hash] of Object.entries(SPECS.weapons.files)){
    if(await digest(path.join(base,name))!==hash) throw Error('AddonWeaponsBuilder binary checksum mismatch');
  }
  const exe=path.join(base,SPECS.weapons.cli);
  for(const artifact of archives){
    const file=path.join(staging,...artifact.relativePath.split('/'));
    const magic=Buffer.alloc(4),handle=await fs.open(file,'r');
    try{await handle.read(magic,0,4,0)}finally{await handle.close()}
    if(magic.toString('ascii')!=='RPF7') throw Error('Invalid Legacy RPF archive signature');
    await runner({executable:exe,cwd:base,signal,args:['verify',file],
      timeoutMs:2*60*1000,maxOutputBytes:128*1024});
    signal?.throwIfAborted();
  }
  return archives.length;
}
async function buildNativeWeapon({request,grants,userDataRoot,signal,runner=runNativeProcess,
  makeBuilder=()=>createGtaTools({root:path.join(userDataRoot,'gta-tools')}),
  verifyArchives=verifyAddonArchives}={}) {
  const spec=validateWeaponBuildRequest(request);
  if (!grants?.resolve || typeof userDataRoot!=='string' || !path.isAbsolute(userDataRoot))
    throw Error('Trusted weapon source, output and user data directories required');
  const source=await grants.resolve(spec.sourceToken,'source');
  const output=await grants.resolve(spec.outputToken,'output');
  if (source===output || output.startsWith(source+path.sep))
    throw Error('Weapon output folder must be outside source folder');
  const donor=await inspectWeaponSource(source,spec.reference);
  const {engine,root}=await managedExecutable(path.join(userDataRoot,'native-tools'));
  signal?.throwIfAborted();
  const staging=await fs.mkdtemp(path.join(output,'ditasha-stage-'));
  const destination=path.join(output,spec.modelName+'-weapon-'+randomUUID().slice(0,8));
  let committed=false;
  try {
    const script=path.join(staging,'weapon-native.py');
    await fs.copyFile(path.join(__dirname,'weapon-native.py'),script);
    const jobFile=path.join(staging,'weapon-job.json');
    await fs.writeFile(jobFile,JSON.stringify({schema:1,edition:'legacy',source:donor.folder,
      referenceModel:WEAPON_REFERENCES[spec.reference]}),{flag:'wx',mode:0o600});
    await runner({executable:engine,cwd:root,env:managedEnv(root),signal,
      args:['--background','--disable-autoexec','--python-exit-code','2','--python',script,'--',jobFile],
      timeoutMs:12*60*1000,maxOutputBytes:512*1024});
    signal?.throwIfAborted();
    const nativeReport=await validateNativeWeaponReport(staging,donor.model);
    // The donor remains unmodified; native export is used for verification.
    // AddonWeaponsBuilder expects already prepared GTA-compatible source files.
    const builder=makeBuilder();
    const parent=path.join(staging,'awb-output');
    await fs.mkdir(parent);
    const cancel=()=>builder.cancel();
    signal?.addEventListener('abort',cancel,{once:true});
    let built;
    try {
      built=await builder.run('weapons','build',{
        name:spec.name,model:spec.modelName,edition:'legacy',price:spec.price,
      },source,parent);
    } finally {
      signal?.removeEventListener('abort',cancel);
    }
    signal?.throwIfAborted();
    if (!built?.success || !built.output || !path.resolve(built.output).startsWith(path.resolve(parent)+path.sep))
      throw Error('AddonWeaponsBuilder did not produce an isolated successful output');
    const resultDir=path.join(staging,'GTA-DLC');
    await fs.rename(built.output,resultDir);
    await fs.rm(parent,{recursive:true,force:true});
    const dlcFiles=await collectWeaponArtifacts(resultDir,'GTA-DLC');
    const verifiedArchives=await verifyArchives(staging,dlcFiles,userDataRoot,signal);
    const fiveM=await prepareFiveMPackage(staging,dlcFiles);
    await fs.rm(path.join(staging,'native-roundtrip'),{recursive:true,force:true});
    await fs.rm(script,{force:true}); await fs.rm(jobFile,{force:true});
    const sourceNative={sourceModel:donor.model,anchors:nativeReport.before.anchors,
      boneCount:nativeReport.before.boneCount,textureCount:nativeReport.before.textureCount,
      nativeRoundTripPassed:true,addonWeaponsBuilderPassed:true,verifiedArchives,fiveMReady:fiveM.ready,
      gameTestPassed:null,notes:fiveM.reason};
    await fs.writeFile(path.join(staging,'weapon-validation.json'),JSON.stringify(sourceNative,null,2),{flag:'wx'});
    const files=[...dlcFiles,...(fiveM.resources||[]),
      {relativePath:'weapon-native-report.json'},{relativePath:'weapon-validation.json'}];
    await validateArtifacts(staging,files);
    // Expiring filesystem grants must still exist at commit time.
    await grants.resolve(spec.sourceToken,'source');
    await grants.resolve(spec.outputToken,'output');
    signal?.throwIfAborted();
    const committedResult=await commitExport({stagingRoot:staging,destinationRoot:destination,artifacts:files});
    committed=true;
    return {output:committedResult.output,artifacts:committedResult.artifacts,
      nativeRoundTripPassed:true,addonWeaponsBuilderPassed:true,verifiedArchives,
      fiveMReady:fiveM.ready,gameTestPassed:null,notes:fiveM.reason};
  } finally {
    if (!committed) await cleanupStaging(staging,output);
  }
}
module.exports={validAnchorSet,validateNativeWeaponReport,collectWeaponArtifacts,
  generateFiveMManifest,prepareFiveMPackage,verifyAddonArchives,buildNativeWeapon};
