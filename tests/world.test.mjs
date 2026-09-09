import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three/webgpu';
await mkdir('.playwright',{recursive:true});
const dir=await mkdtemp(resolve('.playwright/world-test-'));
await build({stdin:{contents:`export { buildIsland } from './src/world/island';export { CreatureSystem } from './src/world/creatures';export { VisibilitySystem } from './src/world/visibility';export * from './src/world/spatial';export { scores } from './src/audio';export { Environment } from './src/environment';`,resolveDir:process.cwd(),loader:'ts'},outfile:resolve(dir,'runtime.mjs'),bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildIsland,CreatureSystem,VisibilitySystem,caveAmount,surfaceAt,floorHeight,pushOutside,CAVE,scores,Environment}=await import(pathToFileURL(resolve(dir,'runtime.mjs')));
after(()=>rm(dir,{recursive:true,force:true}));
async function setup(){const {instance}=await WebAssembly.instantiate(await readFile('public/world.wasm'),{env:{abort(){throw Error('WASM abort')}}});const sim=instance.exports,scene=new THREE.Scene(),world=buildIsland(scene,sim);return {sim,scene,world,system:new CreatureSystem(world.creatures,world.obstacles,sim)};}
test('two minute reproduction: animals remain separated while moving and greeting',async()=>{
 const {world,system}=await setup();let minimum=Infinity,overlaps=0;
 for(let frame=0;frame<3600;frame++){
  system.update(1/30,frame/30,frame>1200&&frame<2400?{x:-3,z:3.7}:undefined,()=>true);
  if(frame<30)continue;
  for(let i=0;i<world.creatures.length;i++)for(let j=i+1;j<world.creatures.length;j++){
   const a=world.creatures[i],b=world.creatures[j];if(Math.abs(a.group.position.y-b.group.position.y)>a.radius+b.radius+.15)continue;
   const clearance=Math.hypot(a.group.position.x-b.group.position.x,a.group.position.z-b.group.position.z)-a.radius-b.radius;
   minimum=Math.min(minimum,clearance);if(clearance<-.015)overlaps++;
  }
 }
 console.log({minimumAnimalClearance:minimum,overlappingPairs:overlaps});assert.equal(overlaps,0);
});
test('initial camera sees the fox most of the time; sleeping fox returns and birds perch',async()=>{
 const {world,system,sim,scene}=await setup();
 const camera=new THREE.OrthographicCamera(-30,30,18,-18,.1,250);camera.position.set(18,29,39);camera.lookAt(-8,0,3);camera.updateMatrixWorld();
 const visibility=new VisibilitySystem(camera,world.canopies,world.caveRoof);
 let samples=0,seen=0,sleep=false,returned=false,perch=false;
 for(let frame=0;frame<4200;frame++){
  const elapsed=frame/30;scene.updateMatrixWorld(true);system.update(1/30,elapsed,undefined,visibility.isVisible);
  visibility.update(1/30,world.creatures.map(c=>c.group.position.clone().add(new THREE.Vector3(0,.35,0))),false);
  const fox=world.creatures.find(c=>c.kind==='fox');sleep ||= fox.state==='sleep';returned ||= sleep&&elapsed>87&&fox.state==='roam';perch ||= world.creatures.some(c=>c.state==='perched');
  if(frame%30===0&&elapsed>2&&fox.state==='roam'){samples++;if(visibility.isVisible(fox.group.position.clone().add(new THREE.Vector3(0,.35,0))))seen++;}
 }
 console.log({visibleFoxSamples:seen,samples,sleep,returned,perch});assert.ok(seen/samples>.8);assert.ok(sleep,'fox must actually reach the bed');assert.ok(returned,'fox must leave the cave again');assert.ok(perch,'birds must land');
});
test('cave entrance remains traversable and material classification matches the floor',async()=>{
 const {sim,world}=await setup();
 assert.equal(surfaceAt(0,9,sim),'sand');assert.equal(surfaceAt(2,3,sim),'grass');assert.equal(surfaceAt(6,.5,sim),'wood');assert.equal(surfaceAt(6,-3,sim),'stone');
 assert.equal(caveAmount(2,-3),0);assert.ok(caveAmount(6,-3)>.99);
 for(let z=1.3;z>-4.5;z-=.05){const p={x:6,z};for(const o of world.obstacles)pushOutside(p,.25,o);assert.ok(Math.abs(p.x-6)<.001&&Math.abs(p.z-z)<.001,'center passage must not collide');}
 assert.ok(floorHeight(6,.5,sim)>sim.height(6,.5));
 assert.notDeepEqual(scores.day.notes,scores.sunset.notes);assert.notDeepEqual(scores.sunset.notes,scores.night.notes);assert.ok(scores.night.interval>scores.day.interval);
});
test('exactly overlapping rabbits separate even beside a greeting player',async()=>{
 const {world,system,sim}=await setup();const rabbits=world.creatures.filter(c=>c.kind==='rabbit');
 for(const c of rabbits){c.group.position.set(-2,sim.height(-2,4),4);c.home.copy(c.group.position);c.target.copy(c.group.position);}
 system.update(1/60,0,{x:-2,z:4.8},()=>true);
 const a=rabbits[0],b=rabbits[1];assert.ok(Math.hypot(a.group.position.x-b.group.position.x,a.group.position.z-b.group.position.z)>=a.radius+b.radius-.001);
});

test('automatic day cycle crosses all periods and manual choice freezes it',()=>{
 const scene=new THREE.Scene();scene.background=new THREE.Color('#eeeade');scene.fog=new THREE.Fog('#eeeade',55,125);
 const camera=new THREE.OrthographicCamera(-30,30,18,-18,.1,250),environment=new Environment(scene,camera);
 environment.automatic=true;environment.clock=149.99;environment.update(.02);assert.equal(environment.period,'sunset');
 environment.clock=219.99;environment.update(.02);assert.equal(environment.period,'night');
 environment.clock=359.99;environment.update(.02);assert.equal(environment.period,'day');
 environment.set('night');environment.update(500);assert.equal(environment.period,'night');assert.equal(environment.automatic,false);
});
