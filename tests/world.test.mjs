import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three/webgpu';
await mkdir('.playwright',{recursive:true});
const dir=await mkdtemp(resolve('.playwright/world-test-'));
await build({stdin:{contents:`export { buildIsland } from './src/world/island';export { CreatureSystem } from './src/world/creatures';export { VisibilitySystem } from './src/world/visibility';export * from './src/world/spatial';export { scores } from './src/audio';export { TRAILS, CAMP, MEADOW, pathDistance } from './src/world/trails';export { Environment } from './src/environment';`,resolveDir:process.cwd(),loader:'ts'},outfile:resolve(dir,'runtime.mjs'),bundle:true,platform:'node',format:'esm',packages:'external'});
const {buildIsland,CreatureSystem,VisibilitySystem,caveAmount,surfaceAt,floorHeight,pushOutside,CAVE,scores,Environment,TRAILS,CAMP,MEADOW,pathDistance}=await import(pathToFileURL(resolve(dir,'runtime.mjs')));
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
test('animals keep dispersed habitats; fox visits the enlarged cave and birds perch',async()=>{
 const {world,system}=await setup();let sleep=false,returned=false,perch=false;const landed=new Set();let departures=0;
 assert.equal(world.creatures.length,10);assert.ok(world.treeTops.length>50);
 for(let frame=0;frame<6600;frame++){
  const elapsed=frame/30;const resting=world.creatures.filter(c=>c.kind==='bird'&&c.state==='perched').map(c=>({c,y:c.group.position.y}));system.update(1/30,elapsed,undefined,()=>true,elapsed<80||elapsed>=180?'day':elapsed<140?'sunset':'night');
  for(const {c,y} of resting)if(c.state==='returning'){assert.ok(c.group.position.y>=y-.1,'departure must lift off rather than drop through roof');departures++;}
  for(const c of world.creatures)if(c.kind==='bird'&&c.state==='perched')landed.add(c);
  const fox=world.creatures.find(c=>c.kind==='fox');sleep ||= fox.state==='sleep';returned ||= sleep&&elapsed>133&&fox.state==='roam';perch ||= world.creatures.some(c=>c.state==='perched');
 }
 console.log({sleep,returned,perch});assert.ok(sleep,'fox must reach the bed');assert.ok(returned,'fox must leave the cave');assert.ok(perch,'birds must land');assert.equal(landed.size,2);assert.ok(departures>0);
 const rabbit=world.creatures.find(c=>c.kind==='rabbit');assert.ok(Math.hypot(rabbit.group.position.x-rabbit.home.x,rabbit.group.position.z-rabbit.home.z)<4);
});
test('cave entrance remains traversable and material classification matches the floor',async()=>{
 const {sim,world}=await setup();
 assert.equal(surfaceAt(0,18,sim),'sand');assert.equal(surfaceAt(2,7,sim),'grass');assert.equal(surfaceAt(CAVE.x,.5,sim),'wood');assert.equal(surfaceAt(CAVE.x,CAVE.z,sim),'stone');
 assert.equal(caveAmount(2,-3),0);assert.ok(caveAmount(CAVE.x,CAVE.z)>.99);
 for(let z=2.2;z>CAVE.backZ+.5;z-=.05){const p={x:CAVE.x,z};for(const o of world.obstacles)pushOutside(p,.25,o);assert.ok(Math.abs(p.x-CAVE.x)<.001&&Math.abs(p.z-z)<.001,'center passage must not collide');}
 assert.ok(floorHeight(CAVE.x,.5,sim)>sim.height(CAVE.x,.5));
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

test('contact triggers species reactions and animals move themselves with cooldown',async()=>{
 for(const [kind,state] of [['rabbit','flee'],['bird','takeoff'],['gull','takeoff'],['fox','startled']]){
  const {world,system,sim}=await setup();const c=world.creatures.find(c=>c.kind===kind);
  c.group.position.set(0,sim.height(0,18),18);c.target.copy(c.group.position);c.home.copy(c.group.position);
  const player={x:0,z:18.9},before=c.group.position.clone();
  system.update(1/60,1,player,()=>true);assert.equal(c.state,state);assert.equal(c.reactions,1);
  assert.ok(Math.hypot(c.group.position.x-before.x,c.group.position.z-before.z)<.15&&Math.abs(c.group.position.y-before.y)<.35,'first contact cannot teleport');
  for(let frame=1;frame<60;frame++)system.update(1/60,1+frame/60,player,()=>true);
  if(kind==='bird'||kind==='gull')assert.ok(c.group.position.y-sim.height(c.group.position.x,c.group.position.z)>2,'bird rises into air');
  else assert.ok(c.group.position.distanceTo(before)>.4,'ground animal responds with movement');
  assert.equal(c.reactions,1,'proximity cannot retrigger each frame');
 }
});
test('trail network stays on land and every path has walking clearance',async()=>{
 const {world,sim}=await setup();let length=0;
 for(const trail of TRAILS)for(let i=0;i<trail.length;i++){
  const point=trail[i];assert.ok(sim.radius(point.x,point.z)<.94);
  const p={x:point.x,z:point.z};for(const o of world.obstacles)pushOutside(p,.35,o);
  assert.ok(Math.hypot(p.x-point.x,p.z-point.z)<.01,`blocked trail at ${point.x}, ${point.z}`);
  if(i)length+=point.distanceTo(trail[i-1]);
 }
 assert.ok(length>120);assert.ok(CAVE.halfX*2>7&&CAVE.halfZ*2>9);
 assert.ok(world.obstacles.some(o=>o.x===CAMP.x&&o.z===CAMP.z));
 console.log({trailLength:length,trees:world.treeTops.length});
});

test('complete day sunset night cycle changes actual rest and movement without teleporting',async()=>{
 const {world,system}=await setup();let elapsed=0;
 const run=(period,seconds)=>{for(let i=0;i<seconds*30;i++){elapsed+=1/30;system.update(1/30,elapsed,undefined,()=>true,period);}};
 const of=kind=>world.creatures.filter(c=>c.kind===kind);
 run('day',70);assert.equal(of('fox')[0].state,'sleep');assert.equal(of('isopod')[0].state,'sleep');
 const before=world.creatures.map(c=>c.group.position.clone());run('sunset',1/30);
 world.creatures.forEach((c,i)=>assert.ok(c.group.position.distanceTo(before[i])<.35,'time change cannot teleport'));
 run('sunset',65);assert.ok(of('bird').every(c=>c.state==='perched'));assert.ok(of('butterfly').every(c=>c.state==='sleep'));assert.equal(of('gull')[0].state,'sleep');assert.equal(of('fox')[0].state,'roam');
 run('night',60);assert.ok(of('rabbit').every(c=>c.state==='sleep'));assert.ok(of('bird').every(c=>c.state==='perched'));
 const fox=of('fox')[0],isopod=of('isopod')[0];let foxDistance=0,isopodDistance=0;
 for(let i=0;i<900;i++){const f=fox.group.position.clone(),s=isopod.group.position.clone();run('night',1/30);foxDistance+=f.distanceTo(fox.group.position);isopodDistance+=s.distanceTo(isopod.group.position);}
 assert.ok(foxDistance>5);assert.ok(isopodDistance>1);
 // Dawn wakes resting animals and redirects the fox back through the cave entrance.
 run('day',65);assert.ok(of('rabbit').every(c=>c.state==='roam'));assert.ok(of('butterfly').every(c=>c.state==='roam'));assert.equal(fox.state,'sleep');assert.equal(isopod.state,'sleep');
 console.log({foxNightTravel:foxDistance,isopodNightTravel:isopodDistance});
});
test('sleeping animals still react and resume the schedule after disturbance',async()=>{
 const {world,system}=await setup();let elapsed=0;
 const run=(seconds,player)=>{for(let i=0;i<seconds*30;i++){elapsed+=1/30;system.update(1/30,elapsed,player,()=>true,'night');}};
 run(60);const rabbit=world.creatures.find(c=>c.kind==='rabbit');assert.equal(rabbit.state,'sleep');
 run(1/30,{x:rabbit.group.position.x+.9,z:rabbit.group.position.z});assert.equal(rabbit.state,'flee');
 run(45);assert.equal(rabbit.state,'sleep');
 // Repeated clicks must converge to the last selected period.
 for(let i=0;i<20;i++)system.update(1/30,elapsed,undefined,()=>true,i%2?'night':'day');
 for(let i=0;i<150;i++)system.update(1/30,elapsed,undefined,()=>true,'sunset');
 assert.ok(world.creatures.every(c=>c.period==='sunset'));
});
