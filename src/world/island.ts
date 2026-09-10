import type { TimeOfDay } from '../environment';
import type { Activity } from './routines';
import { ISLAND_X, ISLAND_Z } from '../../shared/terrain';
import { TRAILS, CAMP, MEADOW, pathDistance } from './trails';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three/webgpu';
import type { Simulation } from '../simulation';
import { ink } from './materials';
import { OceanSystem } from './ocean';
import { positionWorld, smoothstep, mix, color, texture, vec3 } from 'three/tsl';
import { CAVE, type Obstacle } from './spatial';
export type { Obstacle } from './spatial';
import { animal, blob, cube, limb, shadow, type Species } from './models';
export interface Creature {kind: Species; group: THREE.Group; wings: THREE.Object3D[]; home: THREE.Vector3; phase: number; roaming: number; radius: number; state: 'roam'|'returning'|'sleep'|'perching'|'perched'|'flee'|'startled'|'takeoff'; period: TimeOfDay; scheduleIn: number; activity: Activity; pace: number; rest: THREE.Vector3; reactionTime: number; cooldown: number; reactions: number; target: THREE.Vector3; hiddenFor: number; decisionIn: number;}

export function buildIsland(scene: THREE.Scene, sim: Simulation) {
  let seed=314159;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  const creatures: Creature[]=[]; const obstacles: Obstacle[]=[];
  const ocean=new OceanSystem(sim);scene.add(ocean.mesh);
  // 同一张连续网格，沙滩与内陆使用顶点色过渡，避免层叠地表和碰撞不一致。
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const segments=224,rings=100;
  for(let r=0;r<=rings;r++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2;const fraction=r/rings*1.35;const shape=1+.045*Math.sin(a*5)+.025*Math.cos(a*3);
    const x=Math.cos(a)*ISLAND_X*fraction*shape,z=Math.sin(a)*ISLAND_Z*fraction*shape;
    positions.push(x,sim.height(x,z),z);
    const path=pathDistance(x,z);
    const grassLimit=.76+.035*Math.sin(a*7);
    const isPath=path<.65;
    const c=new THREE.Color(fraction>grassLimit||isPath?'#e7d8ad':fraction>grassLimit-.045?'#bec391':'#92a77c');
    c.multiplyScalar(.97+random()*.06);colors.push(c.r,c.g,c.b);
    if(r<rings&&i<segments){const k=r*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const groundMaterial=ink('#ffffff').clone();groundMaterial.vertexColors=true;
  const wet=texture(ocean.bed,positionWorld.xz.div(128).add(.5));
  groundMaterial.colorNode=mix(vec3(groundMaterial.colorNode!).mul(mix(color('#ffffff'),color('#8f9b97'),wet.b)),color('#eef6f1'),wet.g.mul(.65));
  const ground=new THREE.Mesh(geo,groundMaterial);scene.add(ground);
  const scenery=new THREE.Group();scene.add(scenery);
  const treeTops: THREE.Object3D[]=[];
  const longShadows: {mesh:THREE.Mesh;x:number;z:number;height:number}[]=[];
  const canopies: THREE.Mesh[]=[];
  function tree(x:number,z:number,size:number,pine:boolean){
    const y=sim.height(x,z); const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(size);scene.add(g);obstacles.push({x,z,radius:.28*size});
    shadow(scenery,x,y,z,1.5*size,.95*size);
    const sm=new THREE.MeshBasicMaterial({color:'#374d68',transparent:true,opacity:0,depthWrite:false});
    const shade=new THREE.Mesh(new THREE.PlaneGeometry(1,1,1,8),sm);const vertices=shade.geometry.getAttribute('position');
    for(let v=0;v<vertices.count;v++){const t=vertices.getY(v)+.5,width=(1-t)*.7*size+.12,across=vertices.getX(v)*2*width,xx=x+t*7*size+across*.68,zz=z+t*6.5*size-across*.73;vertices.setXYZ(v,xx,sim.height(xx,zz)+.025,zz);}
    shade.geometry.computeVertexNormals();shade.material.side=THREE.DoubleSide;scene.add(shade);longShadows.push({mesh:shade,x,z,height:3.5*size});
    limb(g,'#536050',[0,0,0],[.08,2.6,0],.13);
    if(pine){
      for(let j=0;j<4;j++){const crown=new THREE.Mesh(new THREE.ConeGeometry(1.22-j*.22,1.65,7),ink(['#385c4c','#416a55','#54765b','#75916c'][j]));crown.position.set(j*.025,1.65+j*.65,0);crown.rotation.y=j*.8;g.add(crown);canopies.push(crown);}
    }else{
      limb(g,'#55604b',[0,1.15,0],[-.8,2.7,.1],.085);limb(g,'#55604b',[0,1.2,0],[.65,2.6,-.2],.07);
      const palettes=['#355b4b','#456e55','#648465','#81986e'];
      for(let j=0;j<5;j++){const angle=j*2.4;const crown=blob(g,palettes[j%4],[Math.cos(angle)*.65,2.7+(j%3)*.38,Math.sin(angle)*.55],[1.05,.68,.95]);crown.rotation.y=random()*3;canopies.push(crown);}
    }
    treeTops.push(g);
  }
  // 树丛之间留出两条环路，花原和营地保持开阔。
  for(let i=0;i<700;i++){
    const x=(random()-.5)*ISLAND_X*1.65,z=(random()-.55)*ISLAND_Z*1.65;
    if(sim.radius(x,z)>.73||pathDistance(x,z)<1.9||Math.hypot(x-MEADOW.x,z-MEADOW.z)<4.5||(x>8.5&&z<3.5)||(z>13&&x>-8&&x<5))continue;
    if(obstacles.some(o=>Math.hypot(o.x-x,o.z-z)<2.4))continue;
    tree(x,z,.8+random()*.55,random()>.45);
  }
  // 宽阔的入口、可进入的内部空间，侧墙碰撞不封住洞口。
  const caveY=sim.height(CAVE.x,CAVE.z);
  const cave=new THREE.Group();cave.position.set(CAVE.x,caveY,CAVE.z);scene.add(cave);
  for(const side of [-1,1]){
    obstacles.push({x:CAVE.x+side*4.3,z:CAVE.z,radius:.5,halfX:.7,halfZ:4.9});
  }
  const caveRoof=new THREE.Group();cave.add(caveRoof);
  obstacles.push({x:CAVE.x,z:CAVE.backZ-.6,radius:.5,halfX:5,halfZ:.45});
  // 石地沿真实地形贴合，避免脚悬空；木平台使用同一个地表查询。
  const stoneGeometry=new THREE.PlaneGeometry(7.3,9.8,32,40);
  stoneGeometry.rotateX(-Math.PI/2);
  const stonePositions=stoneGeometry.getAttribute('position');
  for(let i=0;i<stonePositions.count;i++){
    const x=stonePositions.getX(i)+CAVE.x,z=stonePositions.getZ(i)+CAVE.z;
    stonePositions.setXYZ(i,x,sim.height(x,z)+.035,z);
  }
  stoneGeometry.computeVertexNormals();scene.add(new THREE.Mesh(stoneGeometry,ink('#75877b')));
  for(let z=CAVE.mouthZ+.1;z<2.3;z+=.25){
    for(let x=CAVE.x-3.1;x<CAVE.x+3.5;x+=.8)cube(scenery,z>.5?'#a99a76':'#91886e',[x,sim.height(x,z)+.055,z],[.8,.11,.21]);
  }
  const bedY=sim.height(CAVE.bed.x,CAVE.bed.z);
  blob(scene,'#a29b6e',[CAVE.bed.x,bedY+.04,CAVE.bed.z],[.85,.08,.65]);
  shadow(scenery,CAVE.x,sim.height(CAVE.x,CAVE.z),CAVE.z,3.5,4.3);
  // 岩壳和鸟的落脚石由 Blender GLB 提供；地面细节仍贴合 WASM 地形。
  for(let i=0;i<8;i++){
    const x=CAVE.x+(i%2?2.65:-2.65),z=CAVE.z-3+(i>>1)*1.6,y=sim.height(x,z);
    blob(scenery,i%2?'#82958a':'#637a75',[x,y+.25,z],[.32,.48,.35],true);
    obstacles.push({x,z,radius:.38});
  }
  const tidePool=new THREE.Mesh(new THREE.CircleGeometry(1,32),ink('#639898'));tidePool.rotation.x=-Math.PI/2;tidePool.scale.set(.85,1.5,1);tidePool.position.set(CAVE.x+2,sim.height(CAVE.x+2,CAVE.z-2)+.045,CAVE.z-2);scene.add(tidePool);
  // 海岸石块、小草和花丛。
  for(let i=0;i<70;i++){
    const a=random()*Math.PI*2,r=.78+random()*.24,x=Math.cos(a)*ISLAND_X*r,z=Math.sin(a)*ISLAND_Z*r;
    const s=.15+random()*.55,y=sim.height(x,z);
    if(sim.radius(x,z)>1||pathDistance(x,z)<1.2||(x>8&&z<3))continue;
    const rock=blob(scenery,['#879386','#a3aa94','#677d70'][i%3],[x,y+s*.26,z],[s,s*.65,s*.8],true);rock.rotation.y=random()*6;
    if(s>.4)obstacles.push({x,z,radius:s*.7});
  }
  function flower(x:number,z:number,h:number,tone:string){
    const y=sim.height(x,z);limb(scenery,'#728763',[x,y,z],[x+.025,y+h,z],.014);
    blob(scenery,tone,[x+.025,y+h,z],[.095,.047,.095]);blob(scenery,'#d9b764',[x+.025,y+h+.035,z],[.026,.02,.026]);
  }
  for(let i=0;i<340;i++){
    const x=(random()-.5)*48,z=(random()-.5)*38;
    if(sim.radius(x,z)>.74||pathDistance(x,z)<1||(x>8.4&&z<3))continue;
    if(i%3===0){
      blob(scenery,i%2?'#718862':'#81996b',[x,sim.height(x,z)+.25,z],[.55,.42,.5]);
      obstacles.push({x,z,radius:.35});
    }else flower(x,z,.14+random()*.2,i%4?'#eee4c3':'#cfa3a0');
  }
  for(let i=0;i<260;i++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*4.2,x=MEADOW.x+Math.cos(a)*r,z=MEADOW.z+Math.sin(a)*r;
    if(pathDistance(x,z)>.9)flower(x,z,.22+random()*.3,['#eee4ca','#dbaab1','#c5b4ce','#e4c06f'][i%4]);
  }
  for(const trail of TRAILS)for(let i=3;i<trail.length-2;i+=3){
    const p=trail[i],next=trail[i+1],dx=next.x-p.x,dz=next.z-p.z,d=Math.hypot(dx,dz);
    for(const side of [-1,1]){
      const x=p.x-dz/d*(.95+random()*.25)*side,z=p.z+dx/d*(.95+random()*.25)*side;
      if(sim.radius(x,z)<.75&&!(x>8.5&&z<3))flower(x,z,.2+random()*.15,side<0?'#f1e8ce':'#d9afa8');
    }
  }
  // 棉布 A 字帐篷，开口朝海。营火留有不可穿过的石圈。
  const camp=new THREE.Group();camp.position.set(CAMP.x,sim.height(CAMP.x,CAMP.z),CAMP.z);scenery.add(camp);
  const tentGeo=new THREE.BufferGeometry();tentGeo.setAttribute('position',new THREE.Float32BufferAttribute([
    -1.35,0,-1.25, 0,1.9,-1.25, -1.35,0,1.25, 0,1.9,-1.25, 0,1.9,1.25, -1.35,0,1.25,
    0,1.9,-1.25, 1.35,0,-1.25, 0,1.9,1.25, 1.35,0,-1.25, 1.35,0,1.25, 0,1.9,1.25,
    -1.35,0,-1.25, 1.35,0,-1.25, 0,1.9,-1.25],3));tentGeo.computeVertexNormals();
  const canvas=ink('#ddbc84').clone();canvas.side=THREE.DoubleSide;camp.add(new THREE.Mesh(tentGeo,canvas));
  cube(camp,'#635c48',[0,.035,0],[2.4,.07,2.3]);
  for(const z of [-1.28,1.28]){limb(camp,'#7a6550',[0,0,z],[0,1.98,z],.045);limb(camp,'#ede1b7',[0,1.8,z],[0,0,z*1.8],.013);}
  obstacles.push({x:CAMP.x,z:CAMP.z,radius:1.35,halfX:1.4,halfZ:1.4});
  const fire=new THREE.Group();fire.position.set(1.8,sim.height(1.8,19),19);scene.add(fire);
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2;blob(fire,'#8b8d78',[Math.cos(a)*.65,.1,Math.sin(a)*.65],[.2,.15,.17],true);}
  for(const a of [-.65,.65]){const log=limb(fire,'#665444',[-.4,.15,a*.3],[.4,.15,-a*.3],.095);log.rotation.y=a;}
  const flames:THREE.Mesh[]=[];
  for(let i=0;i<3;i++){const flame=new THREE.Mesh(new THREE.ConeGeometry(.18-i*.035,.65-i*.12,5),new THREE.MeshBasicMaterial({color:['#e88843','#f9bd66','#ffe5a2'][i]}));flame.position.set((i-1)*.13,.43,i*.04);fire.add(flame);flames.push(flame);}
  const fireGlow=new THREE.Mesh(new THREE.CircleGeometry(2.1,32),new THREE.MeshBasicMaterial({color:'#eeae60',transparent:true,opacity:.1,depthWrite:false}));fireGlow.rotation.x=-Math.PI/2;fireGlow.position.y=.025;fire.add(fireGlow);
  obstacles.push({x:1.8,z:19,radius:.82});
  const signs=[{x:-1.8,z:13,label:'野花原 ← · 岩洞 →'}, {x:-8.9,z:2.5,label:'← 野花原 · 营地 ↓'}, {x:-12.9,z:-10.5,label:'望海坡 ↑ · 岩洞 →'}, {x:7,z:3,label:'回声岩洞 ↑ · 东岸 →'}];
  for(const point of signs){const g=new THREE.Group();g.position.set(point.x,sim.height(point.x,point.z),point.z);scenery.add(g);limb(g,'#806e52',[0,0,0],[0,1.25,0],.075);cube(g,'#c5ac7e',[0,1.12,0],[1.55,.34,.1]);
    // 箭头镶在木牌上；靠近后由界面显示对应地名。
    limb(g,'#62644d',[-.55,1.12,.06],[.55,1.12,.06],.02);limb(g,'#62644d',[.55,1.12,.06],[.35,1.24,.06],.02);limb(g,'#62644d',[.55,1.12,.06],[.35,1,.06],.02);
    obstacles.push({x:point.x,z:point.z,radius:.14});
  }
  // 东侧旧木桩、沙滩漂流木和一盏石灯。
  const wood=new THREE.Group();wood.position.set(-5,sim.height(-5,6.7)+.12,6.7);wood.rotation.y=.45;scene.add(wood);
  limb(wood,'#98896a',[-.85,0,0],[.85,.03,.08],.16);limb(wood,'#a99a78',[.25,0,0],[.5,.24,-.34],.06);
  const sign=new THREE.Group();sign.position.set(.9,sim.height(.9,5.2),5.2);scene.add(sign);limb(sign,'#857a5e',[0,0,0],[0,.8,0],.05);cube(sign,'#b3a27d',[0,.73,0],[.6,.23,.06]);
  for(let i=0;i<3;i++)cube(sign,'#6f7961',[-.16+i*.14,.74,.033],[.06,.012,.007]);
  const lantern=new THREE.Group();lantern.position.set(3.3,sim.height(3.3,-1.5),-1.5);scene.add(lantern);
  blob(lantern,'#919981',[0,.1,0],[.35,.12,.3],true);cube(lantern,'#9ca28b',[0,.35,0],[.18,.5,.18]);cube(lantern,'#c6c4a2',[0,.66,0],[.35,.28,.35]);cube(lantern,'#6d806c',[0,.66,.177],[.16,.16,.009]);const roof=new THREE.Mesh(new THREE.ConeGeometry(.36,.23,4),ink('#7e8c78'));roof.position.y=.92;roof.rotation.y=Math.PI/4;lantern.add(roof);
  const habitats:[Species,number,number,number][]=[['rabbit',-14,2.7,1.2],['rabbit',-10,-9,1],['fox',10,4.5,1.7],['gull',13,17,1.2],['bird',-5,6,1],['bird',2,-10,1],['butterfly',-16,0,1.1],['butterfly',-13,-1,1],['crab',-7,19,.8],['isopod',23,3,.55]];
  for(const [kind,x,z,roaming] of habitats){const {group,wings}=animal(kind);group.position.set(x,sim.height(x,z),z);scene.add(group);creatures.push({kind,group,wings,home:group.position.clone(),phase:random()*6.28,roaming,radius:kind==='fox'?.62:kind==='rabbit'?.33:kind==='gull'?.43:kind==='bird'?.33:kind==='butterfly'?.21:.27,state:'roam',period:'day',scheduleIn:0,activity:'forage',pace:1,rest:group.position.clone(),reactionTime:0,cooldown:0,reactions:0,target:group.position.clone(),hiddenFor:0,decisionIn:0});}
  // 空中海鸥只作环境，不占用地面动物的交互记录。
  const skyBirds: THREE.Group[]=[];
  for(let i=0;i<3;i++){const {group}=animal('gull');scene.add(group);skyBirds.push(group);}
  // Static flowers, timber and stones share draw calls by material.
  scenery.updateMatrixWorld(true);
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  scenery.traverse(object=>{if(object instanceof THREE.Mesh){const material=object.material as THREE.Material;const geo=object.geometry.clone().applyMatrix4(object.matrixWorld);const list=batches.get(material)||[];list.push(geo);batches.set(material,list);}});
  for(const [material,geometries] of batches){const geometry=mergeGeometries(geometries,false);if(geometry)scene.add(new THREE.Mesh(geometry,material));geometries.forEach(g=>g.dispose());}
  scene.remove(scenery);
  return {ocean,creatures,obstacles,treeTops,canopies,skyBirds,cave,caveRoof,longShadows,flames,fireGlow,signs};
}
