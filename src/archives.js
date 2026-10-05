// Native archive support. Binary layout references: CodeWalker RpfFile.cs;
// OIV containers: OpenIV-Team/OpenIV-PackageFormat specification/versions/2.2.md.
import {Inflate} from 'pako';
import {safePath,crc32,MAX_EXPORT} from './asset-tools.js';
const text=new TextDecoder('utf-8',{fatal:true}),encoder=new TextEncoder();
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
const u24=(b,p)=>b[p]+b[p+1]*256+b[p+2]*65536;
const align=n=>Math.ceil(n/512)*512;
function check(ok,message){if(!ok)throw Error(message);}
async function bytes(blob,start,length){check(Number.isSafeInteger(start)&&Number.isSafeInteger(length)&&start>=0&&length>=0&&start+length<=blob.size,'Archive data is truncated.');return new Uint8Array(await blob.slice(start,start+length).arrayBuffer());}
function inflate(data,expected){check(expected<=MAX_EXPORT,'Extracted file exceeds 128 MB.');const chunks=[];let length=0;const z=new Inflate({raw:true,chunkSize:65536});z.onData=chunk=>{length+=chunk.length;check(length<=expected,'Compressed file exceeds its declared size.');chunks.push(chunk);};z.push(data,true);check(!z.err&&z.ended&&length===expected,'Invalid compressed archive data.');const out=new Uint8Array(length);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return out;}
function unique(entries){const seen=new Set();for(const e of entries){const key=e.name.toLowerCase();check(!seen.has(key),'Duplicate archive path: '+e.name);seen.add(key);}return entries;}
export async function openArchive(blob,name=blob.name||'archive.rpf'){
 const magic=await bytes(blob,0,Math.min(4,blob.size));check(magic.length===4,'Archive is empty or truncated.');
 if(view(magic).getUint32(0,true)===0x52504637)return readRpf(blob,name);
 if(view(magic).getUint32(0,true)===0x04034b50||view(magic).getUint32(0,true)===0x06054b50)return readZip(blob,name);
 throw Error('Supported archives: GTA V RPF7, OIV and ZIP.');
}
async function readRpf(blob,name){
 const header=view(await bytes(blob,0,16)),count=header.getUint32(4,true),namesLength=header.getUint32(8,true),encryption=header.getUint32(12,true);
 check(encryption===0||encryption===0x4e45504f,'Encrypted RPF archives need GTA V encryption keys. Open an unencrypted OPEN RPF instead.');
 check(count>0&&count<=65535&&namesLength>0&&namesLength<=1048576,'Invalid RPF directory size.');
 const table=await bytes(blob,16,count*16+namesLength),v=view(table),names=table.subarray(count*16),raw=[];
 const getName=offset=>{check(offset<names.length,'Invalid RPF name offset.');let end=offset;while(end<names.length&&names[end]!==0)end++;check(end<names.length&&end-offset<=240,'Invalid RPF entry name.');return text.decode(names.subarray(offset,end));};
 for(let i=0;i<count;i++){const p=i*16,h2=v.getUint32(p+4,true),directory=h2===0x7fffff00,resource=!directory&&!!(h2&0x80000000);const e={name:getName(directory?v.getUint32(p,true):v.getUint16(p,true)),directory,resource,index:i};
  if(directory){e.start=v.getUint32(p+8,true);e.count=v.getUint32(p+12,true);check(e.start+e.count<=count,'Invalid RPF folder range.');}
  else{e.offset=(u24(table,p+5)&0x7fffff)*512;e.packed=u24(table,p+2);e.size=resource?e.packed:v.getUint32(p+8,true);e.encrypted=resource?/\.ysc$/i.test(e.name):v.getUint32(p+12,true)!==0;e.sys=v.getUint32(p+8,true);e.gfx=v.getUint32(p+12,true);
   if(resource&&e.packed===0xffffff){const big=await bytes(blob,e.offset,16);e.packed=(big[7]+big[14]*256+big[5]*65536+big[2]*16777216);e.size=e.packed;}
   check(e.offset>=align(16+table.length)&&e.offset+(e.packed||e.size)<=blob.size,'Invalid RPF file range.');check(!resource||e.packed>=16,'Invalid RPF resource size.');}
  raw.push(e);
 }
 check(raw[0].directory,'RPF root is not a directory.');const entries=[],visited=new Set([0]),queue=[{e:raw[0],path:'',depth:0}];
 for(let q=0;q<queue.length;q++){const {e,path,depth}=queue[q];check(depth<=32,'RPF folder nesting is too deep.');for(let i=e.start;i<e.start+e.count;i++){check(!visited.has(i),'Cyclic or overlapping RPF directory.');visited.add(i);const child=raw[i];check(child.name&&!child.name.includes('/'),'Invalid RPF filename.');child.name=safePath(path+child.name);entries.push(child);if(child.directory)queue.push({e:child,path:child.name+'/',depth:depth+1});}}
 check(visited.size===count,'RPF contains unreachable entries.');unique(entries);
 return {name,kind:'RPF7',entries,async extract(e){check(entries.includes(e)&&!e.directory,'Select an archive file.');check(!e.encrypted,'Encrypted archive entry is not supported.');const size=e.packed||e.size;check(size<=MAX_EXPORT&&e.size<=MAX_EXPORT,'File exceeds extraction limit of 128 MB.');const data=await bytes(blob,e.offset,size);if(e.resource){const out=data.slice(),h=view(out);h.setUint32(0,0x37435352,true);h.setUint32(4,((e.sys>>>28)<<4)+(e.gfx>>>28),true);h.setUint32(8,e.sys,true);h.setUint32(12,e.gfx,true);return out;}return e.packed?inflate(data,e.size):data;}};
}
async function readZip(blob,name){
 const tail=await bytes(blob,Math.max(0,blob.size-65557),Math.min(65557,blob.size)),t=view(tail);let end=-1;
 for(let i=tail.length-22;i>=0;i--)if(t.getUint32(i,true)===0x06054b50&&i+22+t.getUint16(i+20,true)===tail.length){end=i;break;}
 check(end>=0,'ZIP end record was not found.');const count=t.getUint16(end+10,true),size=t.getUint32(end+12,true),offset=t.getUint32(end+16,true),eocd=blob.size-tail.length+end;
 check(t.getUint16(end+4,true)===0&&t.getUint16(end+6,true)===0&&t.getUint16(end+8,true)===count&&count!==65535&&offset!==0xffffffff&&size<=16*1024*1024&&offset+size<=eocd,'Multi-part, ZIP64 or oversized ZIP directory is not supported.');
 const table=await bytes(blob,offset,size),v=view(table),entries=[];let p=0;
 for(let i=0;i<count;i++){check(p+46<=size&&v.getUint32(p,true)===0x02014b50,'Invalid ZIP directory entry.');const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),n=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true);check(p+46+n+extra+comment<=size&&n>0,'Invalid ZIP entry length.');check(v.getUint16(p+34,true)===0,'Multi-part ZIP entries are not supported.');const encoded=table.subarray(p+46,p+46+n);check((flags&0x800)||encoded.every(b=>b<128),'ZIP filenames must use UTF-8 or ASCII.');let filename=text.decode(encoded),directory=filename.endsWith('/');if(directory)filename=filename.slice(0,-1);safePath(filename);const e={name:filename,directory,encrypted:!!(flags&1),method,flags,crc:v.getUint32(p+16,true),packed:v.getUint32(p+20,true),size:v.getUint32(p+24,true),offset:v.getUint32(p+42,true)};check(e.packed!==0xffffffff&&e.size!==0xffffffff&&e.offset<offset,'ZIP64 or invalid file offset.');check(directory||!(v.getUint32(p+38,true)>>>16&0xf000)||((v.getUint32(p+38,true)>>>16&0xf000)===0x8000),'ZIP symbolic links are not supported.');entries.push(e);p+=46+n+extra+comment;}
 check(p===size,'ZIP directory size mismatch.');unique(entries);
 return {name,kind:/\.oiv$/i.test(name)?'OIV':'ZIP',entries,async extract(e){check(entries.includes(e)&&!e.directory,'Select an archive file.');check(!e.encrypted,'Password-protected ZIP files are not supported.');check([0,8].includes(e.method),'ZIP compression method is not supported.');check(e.size<=MAX_EXPORT&&e.packed<=MAX_EXPORT,'File exceeds extraction limit of 128 MB.');const h=view(await bytes(blob,e.offset,30));check(h.getUint32(0,true)===0x04034b50&&h.getUint16(6,true)===e.flags&&h.getUint16(8,true)===e.method,'ZIP local header mismatch.');const n=h.getUint16(26,true),extra=h.getUint16(28,true),localName=text.decode(await bytes(blob,e.offset+30,n));check(localName===e.name,'ZIP filename mismatch.');const start=e.offset+30+n+extra;check(start+e.packed<=offset,'ZIP file overlaps its directory.');const packed=await bytes(blob,start,e.packed),data=e.method===8?inflate(packed,e.size):packed;check(data.length===e.size&&crc32(data)===e.crc,'ZIP checksum mismatch.');return data;}};
}
// Rebuild an OPEN RPF7 with stored binaries and original RSC7 resource payloads.
export function writeRpf(files){
 check(files.length>0&&files.length<=65534,'Select 1–65534 files for RPF.');unique(files);const root={name:'',directory:true,children:new Map()},all=[root];let total=0;
 for(const file of files){safePath(file.name);check(file.data instanceof Uint8Array,'Invalid RPF file data.');total+=file.data.length;check(total<=MAX_EXPORT,'RPF exceeds 128 MB.');const parts=file.name.split('/');let dir=root;for(const part of parts.slice(0,-1)){let child=dir.children.get(part.toLowerCase());if(!child){child={name:part,directory:true,children:new Map()};dir.children.set(part.toLowerCase(),child);}check(child.directory,'File/folder path collision.');dir=child;}const part=parts.at(-1);check(!dir.children.has(part.toLowerCase()),'File/folder path collision.');const data=file.data,h=data.length>=16?view(data):null,resource=h?.getUint32(0,true)===0x37435352;check(!resource||(!/\.ysc$/i.test(part)&&data.length<0xffffff),'Encrypted scripts / resources over 16 MB cannot be rebuilt.');dir.children.set(part.toLowerCase(),{name:part,data,resource});}
 for(let i=0;i<all.length;i++){const e=all[i];if(!e.directory)continue;e.start=all.length;const children=[...e.children.values()].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);e.count=children.length;all.push(...children);}
 check(all.length<=65535,'Too many RPF directory entries.');const names=[];let namesLength=0;for(const e of all){e.nameOffset=namesLength;const n=encoder.encode(e.name+'\0');names.push(n);namesLength+=n.length;}check(namesLength<=65535,'RPF filename table exceeds 64 KB.');let cursor=align(16+all.length*16+align(namesLength));for(const e of all)if(!e.directory){e.offset=cursor;cursor+=align(e.data.length);}check(cursor<=MAX_EXPORT,'RPF output exceeds 128 MB.');const out=new Uint8Array(cursor),v=view(out);v.setUint32(0,0x52504637,true);v.setUint32(4,all.length,true);v.setUint32(8,align(namesLength),true);v.setUint32(12,0x4e45504f,true);let npos=16+all.length*16;for(const n of names){out.set(n,npos);npos+=n.length;}
 for(let i=0;i<all.length;i++){const e=all[i],p=16+i*16;if(e.directory){v.setUint32(p,e.nameOffset,true);v.setUint32(p+4,0x7fffff00,true);v.setUint32(p+8,e.start,true);v.setUint32(p+12,e.count,true);}else{v.setUint16(p,e.nameOffset,true);const packed=e.resource?e.data.length:0,sector=e.offset/512;out.set([packed&255,(packed>>>8)&255,(packed>>>16)&255,sector&255,(sector>>>8)&255,((sector>>>16)&127)|(e.resource?128:0)],p+2);if(e.resource){const h=view(e.data);v.setUint32(p+8,h.getUint32(8,true),true);v.setUint32(p+12,h.getUint32(12,true),true);}else v.setUint32(p+8,e.data.length,true);out.set(e.data,e.offset);}}
 return out;
}
