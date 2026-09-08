import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { loadSimulation } from './simulation';
import { buildIsland, type Creature } from './world/island';
import { child, shadow, speciesNames, type Species } from './world/models';
import { Soundscape } from './audio';
const $ = <T extends HTMLElement = HTMLElement>(id:string)=>document.getElementById(id) as T;
const enter=$<HTMLButtonElement>('enter-button');
const dialog=$<HTMLDialogElement>('info-dialog');
$('about-button').onclick=$('help-button').onclick=()=>dialog.showModal();
dialog.querySelector('button')!.onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
const sound=new Soundscape();
$('sound-button').onclick=async()=>{try{const on=await sound.toggle();$('sound-button').setAttribute('aria-pressed',String(on));$('sound-button').setAttribute('aria-label',on?'关闭海浪与钢琴':'开启海浪与钢琴');$('sound-label').textContent=on?'海浪与琴声':'声音关';}catch{$('sound-label').textContent='声音暂不可用';}};
const messages:Record<Species,string>={rabbit:'兔子停下来嗅了嗅。它把这一小片阳光分给了你。',fox:'狐狸回过头，安静地陪你站了一会儿。',gull:'海鸥说，今天的风很适合什么也不做。',bird:'小鸟唱了两句，又把旋律留给了树叶。',butterfly:'蝴蝶绕过你的草帽，像一封没有署名的信。',crab:'小螃蟹横着走过，认真巡视它的海岸线。',isopod:'石缝里的海蟑螂探出触角，又悄悄藏好。'};
async function start(){
  if(!navigator.gpu)throw new Error('这座岛需要 WebGPU。请使用支持 WebGPU 的浏览器，并通过 localhost 或 HTTPS 打开。');
  const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('没有可用的 WebGPU 设备。请检查浏览器的图形加速设置。');
  const sim=await loadSimulation();
  const renderer=new THREE.WebGPURenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#eeeade');
  await renderer.init();
  // Three.js 默认允许 WebGL 回退；此项目要求真实 WebGPU，初始化后再次核验。
  if(!(renderer.backend as unknown as {isWebGPUBackend?:boolean}).isWebGPUBackend)throw new Error('WebGPU 初始化失败，请启用浏览器图形加速后重试。');
  $('scene').appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eeeade');scene.fog=new THREE.Fog('#eeeade',55,125);
  const aspect=innerWidth/innerHeight;
  const camera=new THREE.OrthographicCamera(-20*aspect,20*aspect,20,-20,.1,250);
  const mobile=()=>innerWidth<760;
  camera.position.set(26,29,36);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minPolarAngle=.35;controls.maxPolarAngle=1.13;controls.minZoom=.65;controls.maxZoom=3;controls.target.set(0,0,0);
  const world=buildIsland(scene,sim);const player=child();scene.add(player.group);
  const playerShadow=new THREE.Group();shadow(playerShadow,0,0,0,.33,.22);scene.add(playerShadow);
  const keys=new Set<string>();let exploring=false,overview=false,nearest:Creature|undefined;let toastTimer=0;
  const found=new Set<Species>();
  const kinds=Object.keys(speciesNames) as Species[];
  $('journal-dots').innerHTML=kinds.map(k=>`<i title="${speciesNames[k]}" data-kind="${k}"></i>`).join('');
  function toast(text:string){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>$('toast').hidden=true,5200);}
  function greet(){if(!exploring||!nearest||dialog.open)return;found.add(nearest.kind);toast(messages[nearest.kind]);$('journal-count').textContent=`${found.size} / 7`;$('journal-dots').querySelector(`[data-kind="${nearest.kind}"]`)?.classList.add('found');}
  $('interact-button').onclick=greet;
  window.addEventListener('keydown',e=>{if(dialog.open)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){keys.add(e.code);if(exploring)e.preventDefault();}if(e.code==='KeyE'&&!e.repeat)greet();});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>keys.clear());
  const touchMap:Record<string,string>={up:'KeyW',left:'KeyA',down:'KeyS',right:'KeyD'};
  document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(b=>{b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys.add(touchMap[b.dataset.move!]);};const release=()=>keys.delete(touchMap[b.dataset.move!]);b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;});
  enter.onclick=()=>{exploring=true;overview=false;document.body.classList.add('exploring');$('walking-hint').hidden=false;$('journal').hidden=false;$('touch-controls').hidden=false;toast('你抵达了听潮海滩。沿着小径，去认识岛上的邻居吧。');};
  $('view-button').onclick=()=>{if(!exploring){controls.reset();layout();return;}overview=!overview;userZoom=false;$('view-button').setAttribute('aria-label',overview?'跟随角色':'切换远景');};
  let zoomTarget=1;
  function layout(){const a=innerWidth/innerHeight;const half=mobile()?23:18;camera.left=-half*a;camera.right=half*a;camera.top=half;camera.bottom=-half;
    if(!exploring){controls.target.set(mobile()?0:-8,mobile()?4.5:0,mobile()?0:3);camera.position.copy(controls.target).add(new THREE.Vector3(26,29,36));camera.zoom=mobile()?.78:1;}
    camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
  }
  window.addEventListener('resize',layout);layout();controls.update();controls.saveState();
  let userZoom=false;renderer.domElement.addEventListener('wheel',()=>{userZoom=true;},{passive:true});renderer.domElement.addEventListener('touchstart',e=>{if(e.touches.length>1)userZoom=true;},{passive:true});
  let previous=performance.now();let elapsed=0;const forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  let statusTime=0,frames=0,fps=0;
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  await renderer.compileAsync(scene,camera);
  $('enter-label').textContent='走进小岛';enter.disabled=false;$('load-status').textContent='无需行李，带上好奇心就好。';$('engine-status').textContent='WEBGPU · WASM';
  renderer.setAnimationLoop(()=>{
    const now=performance.now(),dt=Math.min((now-previous)/1000,.05);previous=now;elapsed+=dt;
    let ix=0,iz=0;if(exploring&&!dialog.open){ix=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));iz=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));}
    camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,up).normalize();
    sim.step(right.x*ix+forward.x*iz,right.z*ix+forward.z*iz,dt,Number(keys.has('ShiftLeft')||keys.has('ShiftRight')));
    for(const ob of world.obstacles){const dx=sim.x()-ob.x,dz=sim.z()-ob.z,d=Math.hypot(dx,dz),r=ob.radius+.18;if(d<r&&d>.0001)sim.resolve(ob.x+dx/d*r,ob.z+dz/d*r);}
    const px=sim.x(),pz=sim.z(),py=sim.height(px,pz),speed=sim.speed();player.group.position.set(px,py,pz);playerShadow.position.set(px,py,pz);
    if(Math.hypot(ix,iz)>0){const angle=Math.atan2(right.x*ix+forward.x*iz,right.z*ix+forward.z*iz);let delta=angle-player.group.rotation.y;delta=Math.atan2(Math.sin(delta),Math.cos(delta));player.group.rotation.y+=delta*Math.min(1,dt*12);}
    player.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(elapsed*11+i*Math.PI)*Math.min(speed*.15,.65));player.arms.forEach((arm,i)=>arm.rotation.x=Math.sin(elapsed*11+(i+1)*Math.PI)*Math.min(speed*.1,.4));
    player.group.position.y+=Math.abs(Math.sin(elapsed*11))*.035*Math.min(speed,1);
    for(const c of world.creatures){const t=elapsed*.38+c.phase;const close=exploring&&c.group.position.distanceTo(player.group.position)<2.4;
      const cx=c.home.x+Math.sin(t)*c.roaming,cz=c.home.z+Math.cos(t*.73)*c.roaming*.6;
      if(!close){c.group.position.x=cx;c.group.position.z=cz;c.group.rotation.y=Math.atan2(Math.cos(t),-Math.sin(t*.73)*.44);}
      else c.group.rotation.y=Math.atan2(px-c.group.position.x,pz-c.group.position.z);
      const ground=sim.height(c.group.position.x,c.group.position.z);
      const flying=c.kind==='butterfly'||c.kind==='bird';
      c.group.position.y=ground+(flying?(c.kind==='bird'?1.5:.8)+Math.sin(elapsed*2+c.phase)*.18: c.kind==='rabbit'&&!close?Math.max(0,Math.sin(elapsed*4+c.phase))*.08:0);
      c.wings.forEach((w,i)=>w.rotation.z=Math.sin(elapsed*(c.kind==='butterfly'?11:4)+c.phase)*.6*(i===0?1:-1));
    }
    world.skyBirds.forEach((bird,i)=>{const t=elapsed*.075+i*1.3;bird.position.set(Math.sin(t)*15,8+i*.55,Math.cos(t)*11-3);bird.rotation.y=t+Math.PI/2;bird.rotation.z=Math.sin(t)*.1;});
    if(!reduceMotion)world.treeTops.forEach((tree,i)=>tree.rotation.z=Math.sin(elapsed*.6+i)*.008);
    if(exploring){
      const target=overview?new THREE.Vector3(0,0,0):new THREE.Vector3(px,py,pz);
      const delta=target.sub(controls.target).multiplyScalar(1-Math.exp(-dt*2));controls.target.add(delta);camera.position.add(delta);
      zoomTarget=overview?(mobile()?.72:1.05):(mobile()?1.75:1.65);
      if(!userZoom){camera.zoom+=(zoomTarget-camera.zoom)*(1-Math.exp(-dt*2));camera.updateProjectionMatrix();}
      nearest=undefined;let distance=2.2;
      for(const c of world.creatures){const d=Math.hypot(c.group.position.x-px,c.group.position.z-pz);if(d<distance){distance=d;nearest=c;}}
      $('interaction').hidden=!nearest||dialog.open;if(nearest)$('interact-button').querySelector('span')!.textContent=`和${speciesNames[nearest.kind]}打个招呼`;
      const location=px>4&&pz<-2?'回声岩洞':sim.radius(px,pz)>.72?'听潮海滩':'青苔森林';$('location').innerHTML=`<span>⌁</span> ${location}`;
    }
    controls.update();renderer.render(scene,camera);
    frames++;statusTime+=dt;if(statusTime>1){fps=Math.round(frames/statusTime);frames=0;statusTime=0;}
    // 只暴露只读状态，供浏览器验收和性能排查使用。
    (window as unknown as {__island:unknown}).__island={ready:true,backend:'webgpu',wasm:true,exploring,position:{x:px,y:py,z:pz},found:[...found],nearest:nearest?.kind,fps,drawCalls:renderer.info.render.calls};
  });
}
start().catch(error=>{console.error(error);$('enter-label').textContent='小岛暂未抵达';$('load-status').textContent=error instanceof Error?error.message:String(error);$('load-status').style.maxWidth='310px';$('load-status').style.lineHeight='1.8';$('engine-status').textContent='WEBGPU UNAVAILABLE';});
