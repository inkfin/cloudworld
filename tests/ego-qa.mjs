// Run with npm run test:ego; the local wrapper passes repository context.
const {root,space,keep}=globalThis.cloudworldQA;
if(!root)throw Error('Set CLOUDWORLD_QA_ROOT to the repository path');
const task=await taskSpace(space??'Cloudworld regression QA');
const page=task.page('p1');
const fs=await import('node:fs/promises');
const assert=(condition,message)=>{if(!condition)throw Error(message);};
await page.cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
// Keep the test page active when the host desktop switches to another application.
await page.cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:"window.__qaErrors=[];window.addEventListener('error',e=>window.__qaErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__qaErrors.push(String(e.reason)));"});
await page.goto('http://localhost:5173/');
await page.waitForFunction(()=>window.__island?.ready,undefined,{timeout:20000});
console.log(await page.snapshot());
assert(await page.evaluate(()=>window.__island.backend==='webgpu'),'real WebGPU required');
assert(await page.evaluate(()=>window.__island.caveAsset?.source==='blender-glb'),'Blender cave must load');
const source=await fs.readFile(`${root}/tests/audio.qa.js`,'utf8');
console.log({acoustics:await page.evaluate(`(async()=>{${source};return await checkAudio();})()`)});
const quality=await fs.readFile(`${root}/tests/audio-quality.qa.js`,'utf8');
console.log({audioQuality:await page.evaluate(`(async()=>{${quality};return await checkAudioQuality();})()`)});
for(const period of ['sunset','night']){
 await page.click(`loc=css:[data-period="${period}"]`);
 const start=await page.evaluate(()=>window.__island.elapsed);
 await page.waitForFunction(t=>window.__island.elapsed>t+5,start);
 assert(await page.evaluate(p=>window.__island.period===p,period),`period ${period}`);
 await page.screenshot({path:`${root}/.playwright/${period}-v2.png`});
}
await page.click('loc=css:#time-auto');
assert(await page.evaluate(()=>window.__island.autoTime),'automatic cycle');
await page.click('loc=css:[data-period="day"]');
assert(await page.evaluate(()=>!window.__island.autoTime),'manual selection stops cycle');
await page.click('loc=css:#mix-button');
await page.focus('loc=css:#volume-wind');await page.keyboard.press('Home');
assert(await page.evaluate(()=>window.__island.audio.mix.wind===0),'wind slider independently mutes wind');
await page.evaluate(()=>{const input=document.querySelector('#volume-wind');input.value='15';input.dispatchEvent(new Event('input',{bubbles:true}));});
await page.click('loc=css:#close-mix');
await page.click('loc=css:#enter-button');await page.click('loc=css:#sound-button');
await page.waitForFunction(()=>window.__island.audio.enabled);
for(const [surface,x,z,key] of [['sand',0,18,'a'],['grass',2,7,'d'],['wood',13.2,.75,'w'],['stone',13.2,-5,'w']]){
 await page.evaluate(({x,z})=>window.__islandTest.warp(x,z),{x,z});
 await page.keyboard.down(key);
 try{await page.waitForFunction(s=>window.__island.audio.events.steps[s]>0,surface,{timeout:5000});}finally{await page.keyboard.up(key);}
}
await page.waitForFunction(()=>window.__island.cave>.8);
await page.click('loc=css:#shout-button');
await page.waitForFunction(()=>window.__island.audio.events.echoes===1);
await page.screenshot({path:`${root}/.playwright/cave-v2.png`});
await page.click('loc=css:[data-period="sunset"]');
await page.waitForFunction(()=>window.__island.audio.period==='sunset');
console.log({audio:await page.evaluate(()=>window.__island.audio)});
await page.click('loc=css:#sound-button');
await page.waitForFunction(()=>!window.__island.audio.enabled);
await page.click('loc=css:[data-period="day"]');
// Approach actual roaming animals; do not reposition the animals or inject their state.
for(const [kind,state] of [['rabbit','flee'],['bird','takeoff'],['fox','startled']]){
 await page.evaluate(()=>window.__islandTest.time(1));
 if(kind==='bird')await page.waitForFunction(()=>window.__island.creatures.find(c=>c.kind==='bird').state==='roam',undefined,{timeout:20000});
 const count=await page.evaluate(kind=>{const c=window.__island.creatures.find(c=>c.kind===kind);window.__islandTest.warp(c.x+.96,c.z);return c.reactions;},kind);
 await page.waitForFunction(({kind,state,count})=>{const c=window.__island.creatures.find(c=>c.kind===kind);return c.state===state&&c.reactions>count;},{kind,state,count},{timeout:5000});
 if(kind==='bird')await page.waitForFunction(()=>{const c=window.__island.creatures.find(c=>c.kind==='bird');return c.y>window.__island.position.y+1.8;});
 console.log({reaction:kind,state:await page.evaluate(kind=>window.__island.creatures.find(c=>c.kind===kind),kind)});
}
await page.evaluate(()=>window.__islandTest.warp(0,18));
await page.click('loc=css:[data-period="night"]');
await page.waitForFunction(()=>window.__island.creatures.every(c=>c.period==='night'&&(['rabbit','gull','butterfly'].includes(c.kind)?c.state==='sleep':c.kind==='bird'?c.state==='perched':true)),undefined,{timeout:35000});
assert(await page.evaluate(()=>window.__island.creatures.find(c=>c.kind==='fox').activity==='patrol'),'fox patrols at night');
console.log({nightRoutines:await page.evaluate(()=>window.__island.creatures.map(({kind,state,activity})=>({kind,state,activity})))});
await page.click('loc=css:[data-period="day"]');
await page.waitForFunction(()=>window.__island.creatures.find(c=>c.kind==='fox').state==='sleep'&&window.__island.creatures.filter(c=>c.kind==='rabbit').every(c=>c.state==='roam'),undefined,{timeout:35000});
await page.click('loc=css:#help-button');
assert(await page.evaluate(()=>document.querySelector('#info-dialog').open),'help opens');await page.keyboard.press('Escape');
assert(await page.evaluate(()=>!document.querySelector('#info-dialog').open),'help closes');
assert((await page.evaluate(()=>window.__qaErrors)).length===0,'desktop runtime errors');
await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await page.reload();await page.waitForFunction(()=>window.__island?.ready);
console.log(await page.snapshot());
await page.click('loc=css:#enter-button');
const button=await page.evaluate(()=>{const r=document.querySelector('[data-move="up"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
const before=await page.evaluate(()=>window.__island.position);
await page.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[button]});
try{await page.waitForFunction(p=>Math.hypot(window.__island.position.x-p.x,window.__island.position.z-p.z)>.6,before,{timeout:4000});}finally{await page.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
await page.evaluate(()=>window.__islandTest.warp(13.2,-5));
await page.waitForFunction(()=>window.__island.cave>.8);
const settle=await page.evaluate(()=>window.__island.elapsed);await page.waitForFunction(t=>window.__island.elapsed>t+4,settle);
await page.screenshot({path:`${root}/.playwright/mobile-cave-v2.png`});
assert(await page.evaluate(()=>document.documentElement.scrollWidth===390),'no mobile overflow');
assert((await page.evaluate(()=>window.__qaErrors)).length===0,'mobile runtime errors');
console.log('PASS: WebGPU, time controls, four surfaces, cave echo, animal contact reactions and day/night routines, audio changes, mute, help, touch movement, mobile layout.');
if(!keep)await task.finish({keep:[]});
