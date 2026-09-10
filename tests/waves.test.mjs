import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
test('wave spectrum has consistent slopes, dispersion and no short spatial tile',async()=>{
 await mkdir('.playwright',{recursive:true});const dir=await mkdtemp(resolve('.playwright/waves-'));
 try{
  await build({entryPoints:['src/world/waves.ts'],outfile:resolve(dir,'waves.mjs'),bundle:true,platform:'node',format:'esm'});
  const {WAVES,WATER_F0,sampleWaves}=await import(pathToFileURL(resolve(dir,'waves.mjs')));
  assert.ok(WATER_F0>.02&&WATER_F0<.021);
  for(const w of WAVES){assert.ok(Math.abs(w.omega*w.omega-(9.81*w.k+.000074*w.k**3))<1e-9);assert.ok(Math.abs(Math.hypot(w.x,w.z)-1)<1e-12);}
  for(let i=0;i<60;i++){
   const x=i*.793,z=i*1.273,t=i*.113,e=1e-5,s=sampleWaves(x,z,t);
   assert.ok(Math.abs((sampleWaves(x+e,z,t).height-sampleWaves(x-e,z,t).height)/(2*e)-s.dx)<1e-6);
   assert.ok(Math.abs((sampleWaves(x,z+e,t).height-sampleWaves(x,z-e,t).height)/(2*e)-s.dz)<1e-6);
  }
  for(const shift of [8,16,32,64]){
   let energy=0,error=0;
   for(let i=0;i<200;i++){const a=sampleWaves(i*.81,i*.29,3),b=sampleWaves(i*.81+shift,i*.29,3);energy+=a.dx*a.dx+a.dz*a.dz;error+=(a.dx-b.dx)**2+(a.dz-b.dz)**2;}
   assert.ok(error/energy>.4,`wave normals should not tile every ${shift} metres`);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
