import assert from 'node:assert/strict';
import {deflateRaw} from 'pako';
import {readYtd,writeYtd,readYdd,readYdr,readYft} from './src/resource.js';
const pack=(bytes,ver,sys=512,gfx=512)=>{const header=new Uint8Array(16),h=new DataView(header.buffer);h.setUint32(0,0x37435352,true);h.setUint32(4,ver,true);h.setUint32(8,0x08000000,true);h.setUint32(12,0xd8000000,true);const z=deflateRaw(bytes),out=new Uint8Array(z.length+16);out.set(header);out.set(z,16);return out.buffer;};
function ytdFixture(format=21){const b=new Uint8Array(1024),v=new DataView(b.buffer);const ptr=(p,x)=>v.setBigUint64(p,BigInt(x),true);ptr(48,0x50000040);v.setUint16(56,1,true);ptr(64,0x50000050);ptr(80+40,0x50000100);b.set(new TextEncoder().encode('test_texture'),256);v.setUint16(160,4,true);v.setUint16(162,4,true);v.setUint16(166,16,true);v.setUint32(168,format,true);b[173]=1;ptr(192,0x60000000);if(format===21)for(let i=512;i<576;i+=4)b.set([12,50,240,255],i);else{const c=format===0x31545844?512:520;if(format===0x33545844)b.fill(255,512,520);if(format===0x35545844){b[512]=255;b[513]=255;}v.setUint16(c,0xf800,true);v.setUint16(c+2,0,true);}return pack(b,13);}
for(const fmt of [21,0x31545844,0x33545844,0x35545844]){const r=readYtd(ytdFixture(fmt));assert.equal(r.textures[0].name,'test_texture');assert.equal(r.textures[0].out[0],fmt===21?240:255);assert.equal(r.textures[0].out[3],255);r.textures[0].out.set([77,88,99,128]);r.textures[0].w=8;r.textures[0].h=2;const re=readYtd(writeYtd(r,r.textures).buffer);assert.deepEqual([...re.textures[0].out.slice(0,4)],[77,88,99,128]);assert.equal(re.textures[0].w,8);assert.equal(re.textures[0].h,2);}
// One drawable, one triangle, Float3 positions and Float2 UVs.
const b=new Uint8Array(1024),v=new DataView(b.buffer),ptr=(p,x)=>v.setBigUint64(p,BigInt(x),true),s=x=>0x50000000+x,g=x=>0x60000000+x;
ptr(48,s(64));v.setUint16(56,1,true);ptr(64,s(80));ptr(160,s(240));ptr(240,s(256));v.setUint16(248,1,true);ptr(256,s(272));ptr(280,s(320));v.setUint16(288,1,true);ptr(320,s(336));ptr(360,s(400));ptr(392,s(440));v.setUint16(408,20,true);ptr(416,g(0));v.setUint32(424,3,true);ptr(392,s(464));v.setUint32(472,3,true);ptr(480,g(64));ptr(448,s(496));v.setUint32(496,65,true);v.setUint16(500,20,true);v.setBigUint64(504,6n|(5n<<24n),true);
for(let i=0;i<3;i++){v.setFloat32(512+i*20,i===1?1:0,true);v.setFloat32(516+i*20,0,true);v.setFloat32(520+i*20,i===2?1:0,true);v.setFloat32(524+i*20,i===1?1:0,true);v.setFloat32(528+i*20,i===2?1:0,true);v.setUint16(576+i*2,i,true);}
const dd=readYdd(pack(b,165));assert.equal(dd[0].geometries[0].indices.length,3);assert.deepEqual([...dd[0].geometries[0].positions],[0,0,-0,1,0,-0,0,1,-0]);
assert.deepEqual([...dd[0].geometries[0].uvs],[0,0,1,0,0,1], 'YDD must preserve native UV V, without vertical inversion');
assert.throws(()=>readYtd(new ArrayBuffer(16)),/RSC7/);
console.log('PASS: BGRA and DXT1/3/5 decode, edited YTD round trips, YDD triangle/UV read, invalid input rejection');

// YDR stores its drawable at the resource root; YFT points to FragDrawable at +48.
const ydrBytes=b.slice();new DataView(ydrBytes.buffer).setBigUint64(80,BigInt(s(240)),true);
const dr=readYdr(pack(ydrBytes,165));assert.equal(dr[0].geometries[0].positions.length,9);assert.deepEqual([...dr[0].geometries[0].uvs],[0,0,1,0,0,1]);
const fragment=new Uint8Array(2048),ff=new DataView(fragment.buffer);fragment.set(b.subarray(512),1024);
// Independent fragment fixture with system size 1024, one drawable, geometry and UV data in graphics space.
const fptr=(p,x)=>ff.setBigUint64(p,BigInt(x),true);fptr(48,0x50000140);fptr(320+80,0x50000200);fptr(512,0x50000210);fptr(528,0x50000220);ff.setUint16(520,1,true);fptr(544+8,0x50000250);ff.setUint16(560,1,true);fptr(592,0x50000280);fptr(640+24,0x50000300);fptr(640+56,0x50000340);ff.setUint16(768+8,20,true);fptr(768+16,0x60000000);ff.setUint32(768+24,3,true);fptr(768+48,0x50000380);ff.setUint32(832+8,3,true);fptr(832+16,0x60000040);ff.setUint32(896,65,true);ff.setBigUint64(904,6n|(5n<<24n),true);
const fh=new Uint8Array(16),fhv=new DataView(fh.buffer);fhv.setUint32(0,0x37435352,true);fhv.setUint32(4,162,true);fhv.setUint32(8,0x08000001,true);fhv.setUint32(12,0x08000001,true);const compressed=deflateRaw(fragment),ft=new Uint8Array(16+compressed.length);ft.set(fh);ft.set(compressed,16);
const frag=readYft(ft.buffer);assert.equal(frag[0].geometries[0].indices.length,3);assert.deepEqual([...frag[0].geometries[0].uvs],[0,0,1,0,0,1]);
const noUV=ydrBytes.slice();const nv=new DataView(noUV.buffer);nv.setUint32(496,1,true);nv.setUint16(408,20,true);nv.setBigUint64(504,6n,true);assert.equal(readYdr(pack(noUV,165))[0].geometries[0].uvs,null);
assert.throws(()=>readYft(pack(new Uint8Array(1024),162)),/drawable/);assert.throws(()=>readYdr(pack(b,159)),/Versi/);
console.log('PASS: YDR/YFT Legacy geometry, native UVs, absent UVs and unsupported resource rejection');

export const testYdd=pack(b,165),testYtd=ytdFixture(),testYdr=pack(ydrBytes,165),testYft=ft.buffer;

const arrayFragment=fragment.slice(),av=new DataView(arrayFragment.buffer);av.setBigUint64(56,0x50000130n,true);av.setUint32(72,1,true);av.setBigUint64(304,0x50000140n,true);const ac=deflateRaw(arrayFragment),ao=new Uint8Array(16+ac.length);ao.set(fh);ao.set(ac,16);assert.equal(readYft(ao.buffer).length,1,'Duplicate fragment drawable pointers must be deduplicated');
const fallback=ydrBytes.slice(),lv=new DataView(fallback.buffer);lv.setBigUint64(80,0n,true);lv.setBigUint64(88,BigInt(s(240)),true);assert.equal(readYdr(pack(fallback,165))[0].geometries[0].indices.length,3);
