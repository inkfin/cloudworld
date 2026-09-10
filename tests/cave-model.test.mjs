import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
test('Blender cave fits gameplay clearance and retains detachable roof and perch anchors',async()=>{
 const bytes=await readFile('public/models/cave.glb');assert.ok(bytes.length<150000);
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const dir=await mkdtemp(resolve('.playwright/cave-test-'));
 try{
  await build({stdin:{contents:`export {installCaveModel} from './src/world/cave-model';export {VisibilitySystem} from './src/world/visibility';export {CAVE,floorHeight} from './src/world/spatial';`,resolveDir:process.cwd(),loader:'ts'},outfile:resolve(dir,'cave.mjs'),bundle:true,platform:'node',format:'esm',packages:'external'});
  const {installCaveModel,CAVE,floorHeight,VisibilitySystem}=await import(pathToFileURL(resolve(dir,'cave.mjs')));
  const {instance}=await WebAssembly.instantiate(await readFile('public/world.wasm'),{env:{abort(){throw Error('WASM abort')}}});const sim=instance.exports;
  gltf.scene.updateMatrixWorld(true);
  for(const id of [0,1]){
   const anchor=gltf.scene.getObjectByName(`Anchor_Bird_${id}`);assert.ok(anchor);
   const p=anchor.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(p.y-CAVE.roofHeight-.13)<.001);
  }
  const cave=new THREE.Group(),roof=new THREE.Group();cave.position.set(CAVE.x,sim.height(CAVE.x,CAVE.z),CAVE.z);
  const stats=installCaveModel(gltf.scene,cave,roof,sim);cave.updateMatrixWorld(true);
  assert.ok(stats.triangles<1500);assert.ok(roof.children.length>3);
  const ray=new THREE.Raycaster();
  for(let z=CAVE.mouthZ+.5;z>CAVE.backZ+.7;z-=.4){
   const y=floorHeight(CAVE.x,z,sim)+1.45;
   ray.set(new THREE.Vector3(CAVE.x,y,z),new THREE.Vector3(0,0,-1));
   const hit=ray.intersectObject(cave,true)[0];assert.ok(hit&&hit.point.z<CAVE.backZ+.1,'the passage must reach the back wall');
   for(const side of [-1,1]){
    ray.set(new THREE.Vector3(CAVE.x,y,z),new THREE.Vector3(side,0,0));
    const wall=ray.intersectObject(cave,true)[0];if(wall)assert.ok(wall.distance>3.2,'wall must not cut into the playable corridor');
   }
  }
  for(const x of [CAVE.perch.x,CAVE.perch.x-1.6]){
   ray.set(new THREE.Vector3(x,sim.height(CAVE.x,CAVE.z)+7,CAVE.perch.z),new THREE.Vector3(0,-1,0));
   const hit=ray.intersectObject(roof,true)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-(sim.height(CAVE.x,CAVE.z)+CAVE.roofHeight+.13))<.05,'both birds need a physical ledge');
  }
  const visibility=new VisibilitySystem(new THREE.PerspectiveCamera(),[],roof);
  for(let i=0;i<60;i++)visibility.update(1/30,[],true);
  assert.ok(roof.children.every(m=>m.material.opacity<.2));assert.ok(cave.children.filter(m=>m.isMesh).every(m=>m.material.opacity===1));
  console.log({caveAssetBytes:bytes.length,...stats});
 }finally{await rm(dir,{recursive:true,force:true});}
});
