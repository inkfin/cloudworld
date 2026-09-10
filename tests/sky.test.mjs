import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as THREE from 'three/webgpu';
test('moon stays in the backdrop and fades with time independently of camera zoom',async()=>{
 await mkdir('.playwright',{recursive:true});const dir=await mkdtemp(resolve('.playwright/sky-'));
 try{
  await build({stdin:{contents:"export {Environment} from './src/environment';export {moonStrength,skyAspect} from './src/world/materials';",resolveDir:process.cwd(),loader:'ts'},outfile:resolve(dir,'sky.mjs'),bundle:true,platform:'node',format:'esm',packages:'external'});
  const {Environment,moonStrength,skyAspect}=await import(pathToFileURL(resolve(dir,'sky.mjs')));
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,55,125);
  const camera=new THREE.OrthographicCamera(-30,30,20,-20,.1,250);
  const env=new Environment(scene,camera);assert.equal(scene.getObjectByName('Sky backdrop').material.depthWrite,false);
  assert.equal(scene.children.filter(o=>o.geometry?.type==='SphereGeometry').length,0,'no celestial solid can intersect trees or write depth');
  env.set('night');for(let i=0;i<300;i++)env.update(1/30);assert.ok(moonStrength.value>.99);
  for(const zoom of [.3,1,3]){camera.zoom=zoom;camera.position.set(30,40,-20);camera.updateProjectionMatrix();env.update(1/30);assert.ok(Math.abs(skyAspect.value-1.5)<1e-12,'moon remains circular without zoom-dependent scale');}
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,-1,0)));for(let i=0;i<300;i++)env.update(1/30);assert.ok(moonStrength.value<.001,'overhead view must not paste a moon onto the sea');
  for(const period of ['day','sunset']){env.set(period);for(let i=0;i<300;i++)env.update(1/30);assert.ok(moonStrength.value<.001,'no white orb in day or sunset');}
 }finally{await rm(dir,{recursive:true,force:true});}
});
