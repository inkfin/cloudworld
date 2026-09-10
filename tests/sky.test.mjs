import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as THREE from 'three/webgpu';
test('moonlight follows viewing direction and time without a celestial solid',async()=>{
 await mkdir('.playwright',{recursive:true});const dir=await mkdtemp(resolve('.playwright/sky-'));
 try{
  await build({stdin:{contents:"export {Environment} from './src/environment';export {moonStrength,waterView} from './src/world/materials';",resolveDir:process.cwd(),loader:'ts'},outfile:resolve(dir,'sky.mjs'),bundle:true,platform:'node',format:'esm',packages:'external'});
  const {Environment,moonStrength,waterView}=await import(pathToFileURL(resolve(dir,'sky.mjs')));
  const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,55,125);
  const camera=new THREE.OrthographicCamera(-30,30,20,-20,.1,250);
  const env=new Environment(scene,camera);assert.equal(scene.getObjectByName('Sky backdrop'),undefined,'no fixed screen moon');
  assert.equal(scene.children.filter(o=>o.geometry?.type==='SphereGeometry').length,0,'no celestial solid can intersect trees or write depth');
  assert.equal(scene.children.filter(o=>o.isMesh).length,0,'sunset must not add a floating cloud or reflection plane');
  env.set('night');for(let i=0;i<300;i++)env.update(1/30);assert.ok(moonStrength.value>.99);
  camera.position.set(30,40,-20);camera.lookAt(0,0,0);camera.updateMatrixWorld();env.update(1/30);
  const view=waterView.value.clone();
  for(const zoom of [.3,1,3]){camera.zoom=zoom;camera.updateProjectionMatrix();env.update(1/30);assert.ok(waterView.value.distanceTo(view)<1e-12,'zoom must not change the water reflection direction');}
  camera.position.set(-30,40,20);camera.lookAt(0,0,0);camera.updateMatrixWorld();env.update(1/30);assert.ok(waterView.value.distanceTo(view)>1,'orbit must change reflection direction');
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(0,-1,0)));for(let i=0;i<300;i++)env.update(1/30);assert.ok(moonStrength.value>.99,'overhead water still receives moonlight');
  for(const period of ['day','sunset']){env.set(period);for(let i=0;i<300;i++)env.update(1/30);assert.ok(moonStrength.value<.001,'no white orb in day or sunset');}
 }finally{await rm(dir,{recursive:true,force:true});}
});
