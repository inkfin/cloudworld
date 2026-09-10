import { activityNames } from './world/routines';
import { locationAt } from './world/trails';
import { sunsetStrength } from './world/materials';
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { loadSimulation } from './simulation';
import { buildIsland, type Creature } from './world/island';
import { child, shadow, speciesNames, type Species } from './world/models';
import { Soundscape, type AudioBus } from './audio';
import { Environment, periods, type TimeOfDay } from './environment';
import { CreatureSystem } from './world/creatures';
import { VisibilitySystem } from './world/visibility';
import { caveAmount, floorHeight, pushOutside, surfaceAt } from './world/spatial';
const $ = <T extends HTMLElement = HTMLElement>(id:string)=>document.getElementById(id) as T;
const enter=$<HTMLButtonElement>('enter-button');
const dialog=$<HTMLDialogElement>('info-dialog');
const sound=new Soundscape();
const mixDialog=$<HTMLDialogElement>('mix-dialog');
$('mix-button').onclick=()=>mixDialog.showModal();$('close-mix').onclick=()=>mixDialog.close();
try {
  const saved=JSON.parse(localStorage.getItem('cloudworld-audio-mix')||'{}');
  for(const bus of ['music','sea','wind','steps'] as AudioBus[])if(typeof saved[bus]==='number'&&Number.isFinite(saved[bus]))sound.setMix(bus,saved[bus]);
}catch{ /* 浏览器禁用存储时保留默认混音。 */ }
document.querySelectorAll<HTMLInputElement>('[data-bus]').forEach(input=>{
  const bus=input.dataset.bus as AudioBus;input.value=String(Math.round(sound.state.mix[bus]*100));input.nextElementSibling!.textContent=`${input.value}%`;
  input.oninput=()=>{sound.setMix(bus,Number(input.value)/100);input.nextElementSibling!.textContent=`${input.value}%`;try{localStorage.setItem('cloudworld-audio-mix',JSON.stringify(sound.state.mix));}catch{}};
});
$('about-button').onclick=$('help-button').onclick=()=>dialog.showModal();
dialog.querySelector('button')!.onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('sound-button').onclick=async()=>{
  const button=$<HTMLButtonElement>('sound-button');button.disabled=true;$('sound-label').textContent='准备声音…';
  try{const on=await sound.toggle();button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-label',on?'关闭海浪与钢琴':'开启海浪与钢琴');$('sound-label').textContent=on?'聆听小岛':'声音关';}
  catch{$('sound-label').textContent='声音暂不可用';}finally{button.disabled=false;}
};
const messages:Record<Species,string>={rabbit:'兔子停下来嗅了嗅。它把这一小片阳光分给了你。',fox:'狐狸回过头，安静地陪你站了一会儿。',gull:'海鸥说，今天的风很适合什么也不做。',bird:'小鸟唱了两句，又把旋律留给了树叶。',butterfly:'蝴蝶绕过你的草帽，像一封没有署名的信。',crab:'小螃蟹横着走过，认真巡视它的海岸线。',isopod:'石缝里的海蟑螂探出触角，又悄悄藏好。'};
async function start(){
  if(!navigator.gpu)throw new Error('这座岛需要 WebGPU。请使用支持 WebGPU 的浏览器，并通过 localhost 或 HTTPS 打开。');
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('没有可用的 WebGPU 设备。请检查浏览器的图形加速设置。');
  const sim=await loadSimulation();
  const renderer=new THREE.WebGPURenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#eeeade');
  await renderer.init();
  if(!(renderer.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend)throw new Error('WebGPU 初始化失败，请启用浏览器图形加速后重试。');
  $('scene').appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eeeade');scene.fog=new THREE.Fog('#eeeade',55,125);
  const aspect=innerWidth/innerHeight;
  const camera=new THREE.OrthographicCamera(-20*aspect,20*aspect,20,-20,.1,250);
  const mobile=()=>innerWidth<760;
  camera.position.set(26,29,36);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minPolarAngle=.35;controls.maxPolarAngle=1.13;controls.minZoom=.3;controls.maxZoom=3;controls.target.set(0,0,0);
  const world=buildIsland(scene,sim),player=child();scene.add(player.group);
  const {loadCaveModel}=await import('./world/cave-model');
  const caveAsset=await loadCaveModel(world.cave,world.caveRoof,sim);
  const environment=new Environment(scene,camera),animals=new CreatureSystem(world.creatures,world.obstacles,sim);
  const visibility=new VisibilitySystem(camera,world.canopies,world.caveRoof);
  const playerShadow=new THREE.Group();shadow(playerShadow,0,0,0,.33,.22);scene.add(playerShadow);
  const keys=new Set<string>();let exploring=false,overview=false,nearest:Creature|undefined,toastTimer=0,echoTimer=0;
  const found=new Set<Species>();
  const kinds=Object.keys(speciesNames) as Species[];
  $('journal-dots').innerHTML=kinds.map(k=>`<i title="${speciesNames[k]}" data-kind="${k}"></i>`).join('');
  function toast(text:string){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').hidden=true,5200);}
  function greet(){
    if(!exploring||!nearest||dialog.open||mixDialog.open)return;
    found.add(nearest.kind);toast(nearest.state==='sleep'?`${speciesNames[nearest.kind]}正在休息，身体随着呼吸轻轻起伏。`:nearest.state==='perched'?'小鸟收起翅膀，在洞顶的苔石上歇脚。':messages[nearest.kind]);
    $('journal-count').textContent=`${found.size} / 7`;$('journal-dots').querySelector(`[data-kind="${nearest.kind}"]`)?.classList.add('found');
  }
  function shout(){
    if(!exploring||dialog.open)return;
    if(!sound.enabled){toast('先点右下角开启声音，再喊一声听听。');return;}
    if(!sound.shout(caveAmount(sim.x(),sim.z())))return;
    const caption=$('echo-caption');caption.hidden=false;caption.textContent=caveAmount(sim.x(),sim.z())>.2?'喂—— ··· 喂——':'喂——';
    caption.style.animation='none';void caption.offsetWidth;caption.style.animation='';clearTimeout(echoTimer);echoTimer=window.setTimeout(()=>caption.hidden=true,2450);
  }
  $('interact-button').onclick=greet;$('shout-button').onclick=shout;
  document.querySelectorAll<HTMLButtonElement>('[data-period]').forEach(button=>button.onclick=()=>{environment.set(button.dataset.period as TimeOfDay);updateTimeUI();});
  $('time-auto').onclick=()=>{environment.automatic=!environment.automatic;environment.clock=environment.period==='day'?0:environment.period==='sunset'?150:220;updateTimeUI();};
  let lastPeriod='';
  function updateTimeUI(){
    const p=environment.period;document.body.dataset.time=p;
    $('sound-theme').textContent=p==='day'?'白昼：轻盈分解和弦 · 近岸潮声 · 微风':p==='sunset'?'夕阳：温暖低音和弦 · 拉长的退潮 · 轻风': '夜晚：稀疏柔音 · 更远更慢的海潮 · 极轻的风';
    $('weather-icon').textContent=periods[p].icon;$('weather-label').textContent=`${periods[p].label} · ${p==='night'?'晚风拂岸':p==='sunset'?'风渐渐轻了':'海风轻拂'}`;
    $('weather-note').textContent=p==='day'?'THE ISLAND IS AWAKE':p==='sunset'?'THE LIGHT LINGERS':'UNDER THE SAME MOON';
    document.querySelectorAll<HTMLButtonElement>('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===p)));
    $('time-auto').setAttribute('aria-pressed',String(environment.automatic));lastPeriod=p;
  }
  updateTimeUI();
  const moveCodes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'];
  window.addEventListener('keydown',e=>{if(dialog.open||mixDialog.open)return;if(moveCodes.includes(e.code)){keys.add(e.code);if(exploring)e.preventDefault();}if(!e.repeat){if(e.code==='KeyE')greet();if(e.code==='KeyQ')shout();}});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
  document.addEventListener('visibilitychange',()=>{keys.clear();sound.update(0,{period:environment.period,cave:exploring?caveAmount(sim.x(),sim.z()):0,wind:environment.wind,distance:0,surface:surfaceAt(sim.x(),sim.z(),sim),running:false,paused:document.hidden});});
  const touchMap:Record<string,string>={up:'KeyW',left:'KeyA',down:'KeyS',right:'KeyD'};
  document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(b=>{
    b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys.add(touchMap[b.dataset.move!]);};
    const release=()=>keys.delete(touchMap[b.dataset.move!]);b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;
  });
  enter.onclick=()=>{exploring=true;overview=false;document.body.classList.add('exploring');$('walking-hint').hidden=false;$('journal').hidden=false;$('touch-controls').hidden=false;toast('帐篷就在身后。沿木牌去花原、望海坡和岩洞，环路会带你回到营地。');};
  let userZoom=false;
  $('view-button').onclick=()=>{if(!exploring){controls.reset();layout();return;}overview=!overview;userZoom=false;$('view-button').setAttribute('aria-label',overview?'跟随角色':'切换远景');};
  function layout(){
    const a=innerWidth/innerHeight,half=mobile()?23:18;camera.left=-half*a;camera.right=half*a;camera.top=half;camera.bottom=-half;
    if(!exploring){controls.target.set(mobile()?0:-15,mobile()?5:0,mobile()?0:3);camera.position.copy(controls.target).add(new THREE.Vector3(26,29,36));camera.zoom=mobile()?.37:.53;}
    camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
  }
  window.addEventListener('resize',layout);layout();controls.update();controls.saveState();
  renderer.domElement.addEventListener('wheel',()=>{userZoom=true;},{passive:true});
  renderer.domElement.addEventListener('touchstart',e=>{if(e.touches.length>1)userZoom=true;},{passive:true});
  let previous=performance.now(),elapsed=0,statusTime=0,frames=0,fps=0,skyBirdRange=32;
  const forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 开发验收入口不进入生产构建，跳转仍调用实际 WASM 与场景循环。
  if(import.meta.env.DEV)(window as any).__islandTest={warp:(x:number,z:number)=>{sim.resolve(x,z);},time:(seconds:number)=>{elapsed=seconds;}};
  await renderer.compileAsync(scene,camera);
  $('enter-label').textContent='走进小岛';enter.disabled=false;$('load-status').textContent='无需行李，带上好奇心就好。';$('engine-status').textContent='WEBGPU · WASM';
  renderer.setAnimationLoop(()=>{
    const now=performance.now(),dt=Math.min((now-previous)/1000,.05);previous=now;
    if(document.hidden)return;
    elapsed+=dt;environment.update(dt);if(lastPeriod!==environment.period)updateTimeUI();
    let ix=0,iz=0;
    if(exploring&&!dialog.open&&!mixDialog.open){ix=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));iz=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));}
    const running=keys.has('ShiftLeft')||keys.has('ShiftRight'),oldX=sim.x(),oldZ=sim.z();
    camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,up).normalize();
    sim.step(right.x*ix+forward.x*iz,right.z*ix+forward.z*iz,dt,Number(running));
    const position={x:sim.x(),z:sim.z()};
    for(let i=0;i<3;i++){
      for(const obstacle of world.obstacles)pushOutside(position,.25,obstacle);
      // A resting animal blocks the child; the animal moves through its reaction, not a player shove.
      if(exploring)for(const c of world.creatures){if(c.group.position.y-floorHeight(position.x,position.z,sim)<1.3)pushOutside(position,.25,{x:c.group.position.x,z:c.group.position.z,radius:c.radius});}
    }
    sim.resolve(position.x,position.z);
    const px=sim.x(),pz=sim.z(),py=floorHeight(px,pz,sim),distance=Math.hypot(px-oldX,pz-oldZ),speed=distance/dt;
    player.group.position.set(px,py,pz);playerShadow.position.set(px,py,pz);
    if(Math.hypot(ix,iz)>0){const angle=Math.atan2(right.x*ix+forward.x*iz,right.z*ix+forward.z*iz),delta=Math.atan2(Math.sin(angle-player.group.rotation.y),Math.cos(angle-player.group.rotation.y));player.group.rotation.y+=delta*Math.min(1,dt*12);}
    player.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(elapsed*11+i*Math.PI)*Math.min(speed*.15,.65));
    player.arms.forEach((arm,i)=>arm.rotation.x=Math.sin(elapsed*11+(i+1)*Math.PI)*Math.min(speed*.1,.4));player.group.position.y+=Math.abs(Math.sin(elapsed*11))*.035*Math.min(speed,1);
    const cave=caveAmount(px,pz);
    if(exploring){
      const target=overview?new THREE.Vector3(0,0,0):new THREE.Vector3(px,py,pz),delta=target.sub(controls.target).multiplyScalar(1-Math.exp(-dt*2));
      controls.target.add(delta);camera.position.add(delta);
      const zoomTarget=overview?(mobile()?.37:.55):(mobile()?1.75:1.65);
      if(!userZoom){camera.zoom+=(zoomTarget-camera.zoom)*(1-Math.exp(-dt*2));camera.updateProjectionMatrix();}
    }
    controls.update();scene.updateMatrixWorld(true);camera.updateMatrixWorld();
    animals.update(dt,elapsed,exploring?{x:px,z:pz}:undefined,visibility.isVisible,environment.period);
    const subjects=world.creatures.filter(c=>!exploring||c.group.position.distanceTo(player.group.position)<11).map(c=>c.group.position.clone().add(new THREE.Vector3(0,.35,0)));
    if(exploring)subjects.push(player.group.position.clone().add(new THREE.Vector3(0,.9,0)));
    visibility.update(dt,subjects,exploring&&cave>.15);
    skyBirdRange+=((environment.period==='day'?32:environment.period==='sunset'?52:85)-skyBirdRange)*(1-Math.exp(-dt*.1));
    world.skyBirds.forEach((bird,i)=>{const t=elapsed*.075+i*1.3;bird.position.set(Math.sin(t)*skyBirdRange,9+i*.55,Math.cos(t)*skyBirdRange*.78-3);bird.rotation.y=t+Math.PI/2;bird.rotation.z=Math.sin(t)*.1;});
    world.flames.forEach((flame,i)=>{flame.scale.set(1+Math.sin(elapsed*7+i)*.12,1+Math.sin(elapsed*9+i*2)*.2,1);});
    (world.fireGlow.material as THREE.MeshBasicMaterial).opacity=(environment.period==='night'?.24:.08)*(1+Math.sin(elapsed*5)*.08);
    world.longShadows.forEach(({mesh})=>{(mesh.material as THREE.MeshBasicMaterial).opacity=sunsetStrength.value*.19;});
    if(!reduceMotion)world.treeTops.forEach((tree,i)=>tree.rotation.z=Math.sin(elapsed*.6+i)*.012*environment.wind);
    if(exploring){
      nearest=undefined;let best=2.2;
      for(const c of world.creatures){const d=Math.hypot(c.group.position.x-px,c.group.position.z-pz);if(d<best&&Math.abs(c.group.position.y-py)<2.3){best=d;nearest=c;}}
      $('interaction').hidden=!nearest||dialog.open||mixDialog.open;
      if(nearest)$('interact-button').querySelector('span')!.textContent=nearest.state==='sleep'?`轻轻看看休息的${speciesNames[nearest.kind]}`:`${speciesNames[nearest.kind]} · ${activityNames[nearest.activity]} · 打个招呼`;
      const surface=surfaceAt(px,pz,sim),sign=world.signs.find(s=>Math.hypot(px-s.x,pz-s.z)<2.5),location=sign?sign.label:cave>.15?'回声岩洞':surface==='wood'?'听风木台':locationAt(px,pz);
      $('location').innerHTML=`<span>⌁</span> ${location}`;$('cave-actions').hidden=cave<.08||dialog.open||mixDialog.open;
    }
    sound.update(dt,{period:environment.period,cave:exploring?cave:0,wind:environment.wind,distance:exploring&&!dialog.open&&!mixDialog.open?distance:0,surface:surfaceAt(px,pz,sim),running,paused:document.hidden});
    renderer.render(scene,camera);
    frames++;statusTime+=dt;if(statusTime>1){fps=Math.round(frames/statusTime);frames=0;statusTime=0;}
    (window as any).__island={ready:true,caveAsset,backend:'webgpu',wasm:true,exploring,elapsed,period:environment.period,autoTime:environment.automatic,cave,surface:surfaceAt(px,pz,sim),position:{x:px,y:py,z:pz},found:[...found],nearest:nearest?.kind,fps,audio:sound.state,creatures:world.creatures.map(c=>({kind:c.kind,x:c.group.position.x,y:c.group.position.y,z:c.group.position.z,radius:c.radius,state:c.state,reactions:c.reactions,period:c.period,activity:c.activity})),trees:world.treeTops.length,drawCalls:renderer.info.render.drawCalls};
  });
}
start().catch(error=>{console.error(error);$('enter-label').textContent='小岛暂未抵达';$('load-status').textContent=error instanceof Error?error.message:String(error);$('load-status').style.maxWidth='310px';$('load-status').style.lineHeight='1.8';$('engine-status').textContent='WEBGPU UNAVAILABLE';});
