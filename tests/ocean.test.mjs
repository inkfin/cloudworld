import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
test('FFT ocean remains real, bounded and tidal; surf wets the actual beach',async()=>{
 await mkdir('.playwright',{recursive:true});const dir=await mkdtemp(resolve('.playwright/ocean-'));
 try{
  await build({stdin:{contents:"export * from './src/world/ocean-spectrum';export {OceanSystem} from './src/world/ocean';",resolveDir:process.cwd(),loader:'ts'},outfile:resolve(dir,'ocean.mjs'),bundle:true,platform:'node',format:'esm',packages:'external'});
  const {FFT,OceanSpectrum,OceanSystem,tideAt,TIDE_PERIOD,runupAt}=await import(pathToFileURL(resolve(dir,'ocean.mjs')));
  const re=Float64Array.from({length:64},(_,i)=>Math.sin(i*.32)),im=new Float64Array(64),original=re.slice(),fft=new FFT(8);fft.transform(re,im,false);fft.transform(re,im,true);
  assert.ok(re.every((v,i)=>Math.abs(v-original[i])<1e-12));
  const spectrum=new OceanSpectrum(128,173,.43,981,.55);
  const rms=Math.sqrt(spectrum.fields[0].reduce((s,v)=>s+v*v,0)/spectrum.foam.length);assert.ok(Math.abs(rms-.43)<.001);
  const first=spectrum.displacement.slice();
  for(const t of [1,10,50,140]){spectrum.update(t);assert.ok(spectrum.fields[1].every(v=>Math.abs(v)<1e-9),'conjugate symmetry must produce a real sea');assert.ok(spectrum.displacement.every(Number.isFinite));assert.ok(spectrum.foam.every(v=>v>=0&&v<=1));assert.ok(spectrum.normals.every((v,i)=>Number.isFinite(v)&&(i%4!==1||v>0)),'choppy crests must not fold over');assert.ok(spectrum.foam.filter(v=>v>.3).length/spectrum.foam.length<.12,'whitecaps remain sparse rather than covering the sea');}
  assert.ok(first.some((v,i)=>Math.abs(v-spectrum.displacement[i])>.1),'waves evolve rather than slide a static texture');
  assert.ok(spectrum.foam.some(v=>v>.02),'compressed positive crests must generate whitecaps');
  const [heights,,dx]=spectrum.fields,n=spectrum.size,step=spectrum.length/n;
  let correlation=0;for(let y=0;y<n;y++)for(let x=0;x<n;x++)correlation+=heights[y*n+x]*(dx[y*n+(x+1)%n]-dx[y*n+(x+n-1)%n])/(2*step);
  assert.ok(correlation<0,'horizontal displacement compresses wave crests instead of troughs');

  assert.ok(tideAt(TIDE_PERIOD/4)-tideAt(TIDE_PERIOD*3/4)>.22);
  const {instance}=await WebAssembly.instantiate(await readFile('public/world.wasm'),{env:{abort(){throw Error('WASM abort')}}});
  const ocean=new OceanSystem(instance.exports);
  for(let t=45;t<60;t+=1/15)ocean.update(t,1/15);
  assert.ok(ocean.state.level>.30);
  assert.ok(ocean.coast.some(c=>c.bed>.20&&c.wet>.8&&c.foam>.1),'foam and water must advance onto above-zero beach, not just circle offshore');
  ocean.update(157.5,1/15);assert.ok(ocean.state.level<.09);
  assert.ok(ocean.coast.some(c=>c.depth<0&&c.wet>.5),'retreat leaves damp exposed sand');
  assert.ok(instance.exports.height(30,0)<.2,'sand continues below water outside the old island edge');
  console.log({fftRms:rms,lowTide:ocean.state.level,highTide:tideAt(52.5),coastalCells:ocean.coast.length});
 }finally{await rm(dir,{recursive:true,force:true});}
});
