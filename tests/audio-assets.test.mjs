import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
test('all local audio samples decode as PCM, have fades and retain distinct variants',async()=>{
 const names=['sea-0','sea-1',...['stone','grass','wood','sand'].flatMap(surface=>[0,1,2,3].map(i=>`${surface}-${i}`))];
 const hashes=new Set();
 for(const name of names){
  const bytes=await readFile(new URL(`../public/audio/${name}.wav`,import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');let format,data;
  for(let offset=12;offset+8<=bytes.length;){const tag=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4);if(tag==='fmt ')format=bytes.subarray(offset+8,offset+8+length);if(tag==='data')data=bytes.subarray(offset+8,offset+8+length);offset+=8+length+(length%2);}
  assert.ok(format&&data,`${name}: required WAV chunks`);assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(14),16);assert.equal(format.readUInt32LE(4),44100);
  assert.equal(format.readUInt16LE(2),name.startsWith('sea')?2:1);
  assert.ok(Math.abs(data.readInt16LE(0))<350,`${name}: no abrupt start`);
  assert.ok(Math.abs(data.readInt16LE(data.length-2))<350,`${name}: no abrupt ending`);
  hashes.add(createHash('sha256').update(data).digest('hex'));
 }
 assert.equal(hashes.size,names.length,'variants must be different recordings');
});
