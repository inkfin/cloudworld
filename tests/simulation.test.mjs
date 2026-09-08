import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
async function world() {const {instance}=await WebAssembly.instantiate(await readFile(new URL('../public/world.wasm',import.meta.url)),{env:{abort(){throw new Error('WASM abort');}}});return instance.exports;}
test('terrain is finite and land stays above sea throughout the island',async()=>{const s=await world();for(let x=-14;x<=14;x+=.4)for(let z=-12;z<=12;z+=.4)if(s.radius(x,z)<=1){assert.ok(Number.isFinite(s.height(x,z)));assert.ok(s.height(x,z)>.19);}});
test('moving for a long time cannot escape the shoreline',async()=>{for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1]]){const s=await world();for(let i=0;i<2000;i++)s.step(dx,dz,1/60,1);assert.ok(s.radius(s.x(),s.z())<.94);}});
test('diagonal movement is normalized, sprint is faster, and input release stops motion',async()=>{const straight=await world(),diagonal=await world(),sprint=await world();straight.resolve(0,0);diagonal.resolve(0,0);sprint.resolve(0,0);for(let i=0;i<60;i++){straight.step(1,0,1/60,0);diagonal.step(1,1,1/60,0);sprint.step(1,0,1/60,1);}assert.ok(Math.abs(straight.x()-Math.hypot(diagonal.x(),diagonal.z()))<.001);assert.ok(sprint.x()>straight.x()*1.6);for(let i=0;i<120;i++)straight.step(0,0,1/60,0);assert.ok(straight.speed()<.0001);});
test('large frame delays are capped and reset returns to beach',async()=>{const s=await world();s.step(1,0,100,1);assert.ok(Math.abs(s.x())<.3);s.reset();assert.equal(s.x(),0);assert.equal(s.z(),7.3);assert.equal(s.speed(),0);});
