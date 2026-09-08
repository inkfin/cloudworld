import * as THREE from 'three/webgpu';
import type { Simulation } from '../simulation';
import { ink, oceanMaterial } from './materials';
import { animal, blob, cube, limb, shadow, type Species } from './models';
export interface Creature {kind: Species; group: THREE.Group; wings: THREE.Object3D[]; home: THREE.Vector3; phase: number; roaming: number;}
export interface Obstacle {x: number; z: number; radius: number;}
export function buildIsland(scene: THREE.Scene, sim: Simulation) {
  let seed=314159;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  const creatures: Creature[]=[]; const obstacles: Obstacle[]=[];
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(500,500),oceanMaterial());ocean.rotation.x=-Math.PI/2;ocean.position.y=.02;scene.add(ocean);
  // 同一张连续网格，沙滩与内陆使用顶点色过渡，避免层叠地表和碰撞不一致。
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const segments=160,rings=48;
  for(let r=0;r<=rings;r++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2;const fraction=r/rings;const shape=1+.045*Math.sin(a*5)+.025*Math.cos(a*3);
    const x=Math.cos(a)*13*fraction*shape,z=Math.sin(a)*10.5*fraction*shape;
    positions.push(x,sim.height(x,z),z);
    const path=Math.abs(x + 1.8*Math.sin(z*.43));
    const grassLimit=.76+.035*Math.sin(a*7);
    const isPath=path<.42 && z>-5;
    const c=new THREE.Color(fraction>grassLimit||isPath?'#e7d8ad':fraction>grassLimit-.045?'#bec391':'#92a77c');
    c.multiplyScalar(.97+random()*.06);colors.push(c.r,c.g,c.b);
    if(r<rings&&i<segments){const k=r*(segments+1)+i;indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const groundMaterial=ink('#ffffff').clone();groundMaterial.vertexColors=true;
  const ground=new THREE.Mesh(geo,groundMaterial);scene.add(ground);
  // 沙岸外沿露出的薄层。
  const edgePositions:number[]=[],edgeIndices:number[]=[];
  for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,shape=1+.045*Math.sin(a*5)+.025*Math.cos(a*3),x=Math.cos(a)*13*shape,z=Math.sin(a)*10.5*shape;edgePositions.push(x,.21,z,x*1.01,-.05,z*1.01);if(i<segments){const k=i*2;edgeIndices.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const edgeGeo=new THREE.BufferGeometry();edgeGeo.setAttribute('position',new THREE.Float32BufferAttribute(edgePositions,3));edgeGeo.setIndex(edgeIndices);edgeGeo.computeVertexNormals();scene.add(new THREE.Mesh(edgeGeo,ink('#cabd95')));
  const treeTops: THREE.Object3D[]=[];
  function tree(x:number,z:number,size:number,pine:boolean){
    const y=sim.height(x,z); const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(size);scene.add(g);obstacles.push({x,z,radius:.28*size});
    shadow(scene,x,y,z,1.5*size,.95*size);
    limb(g,'#536050',[0,0,0],[.08,2.6,0],.13);
    if(pine){
      for(let j=0;j<4;j++){const crown=new THREE.Mesh(new THREE.ConeGeometry(1.22-j*.22,1.65,7),ink(['#385c4c','#416a55','#54765b','#75916c'][j]));crown.position.set(j*.025,1.65+j*.65,0);crown.rotation.y=j*.8;g.add(crown);}
    }else{
      limb(g,'#55604b',[0,1.15,0],[-.8,2.7,.1],.085);limb(g,'#55604b',[0,1.2,0],[.65,2.6,-.2],.07);
      const palettes=['#355b4b','#456e55','#648465','#81986e'];
      for(let j=0;j<7;j++){const angle=j*2.4;const crown=blob(g,palettes[j%4],[Math.cos(angle)*.65,2.7+(j%3)*.38,Math.sin(angle)*.55],[1.05,.68,.95]);crown.rotation.y=random()*3;}
    }
    treeTops.push(g);
  }
  // 留出从海滩到林间与岩洞的通行带。
  for(let i=0;i<70;i++){
    const x=(random()-.5)*22,z=(random()-.68)*16;
    if(sim.radius(x,z)>.72||Math.abs(x+1.8*Math.sin(z*.43))<1.4||(x>3.2&&z<-1.5)||(z>2.5&&x>-3))continue;
    tree(x,z,.73+random()*.45,random()>.53);
  }
  tree(-6.7,2.1,1.04,false);tree(-7.7,-1,1.15,true);tree(1.2,-6.8,1.1,true);
  // 岩洞由侧壁、后壁与拱顶组成，正面通道保持开放。
  const caveX=6,caveZ=-3.8,caveY=sim.height(caveX,caveZ);
  const cave=new THREE.Group();cave.position.set(caveX,caveY,caveZ);scene.add(cave);
  for(const side of [-1,1]){
    const rock=blob(cave,side<0?'#7f8977':'#8e9680',[side*1.25,.9,0],[.85,1.35,1.3],true);rock.rotation.z=side*.15;
    obstacles.push({x:caveX+side*1.25,z:caveZ,radius:.85});
  }
  blob(cave,'#8b947e',[0,2.1,-.05],[1.9,.85,1.4],true);
  blob(cave,'#6a796b',[0,1,-1.2],[1.5,1.3,.55],true);obstacles.push({x:caveX,z:caveZ-1.3,radius:1.2});
  blob(cave,'#9ea487',[-.6,2.67,-.3],[.9,.28,.8],true);blob(cave,'#627856',[.7,2.65,0],[.6,.18,.55]);
  shadow(scene,caveX,caveY,caveZ,1.5,1.15);
  const caveFloor=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color:'#354b44',transparent:true,opacity:.48,depthWrite:false}));caveFloor.rotation.x=-Math.PI/2;caveFloor.scale.set(1.02,1.03,1);caveFloor.position.set(caveX,caveY+.025,caveZ);scene.add(caveFloor);
  // 海岸石块、小草和花丛。
  for(let i=0;i<43;i++){
    const a=random()*Math.PI*2,r=.78+random()*.24,x=Math.cos(a)*13*r,z=Math.sin(a)*10.5*r;
    const s=.15+random()*.55,y=sim.height(x,z);
    if(sim.radius(x,z)>1)continue;
    const rock=blob(scene,['#879386','#a3aa94','#677d70'][i%3],[x,y+s*.26,z],[s,s*.65,s*.8],true);rock.rotation.y=random()*6;
    if(s>.4)obstacles.push({x,z,radius:s*.7});
  }
  for(let i=0;i<180;i++){
    const x=(random()-.5)*23,z=(random()-.5)*17;if(sim.radius(x,z)>.72||Math.abs(x+1.8*Math.sin(z*.43))<.7||(x>4&&z<-2))continue;
    const y=sim.height(x,z);const h=.1+random()*.2;
    for(let j=0;j<2;j++){const grass=new THREE.Mesh(new THREE.ConeGeometry(.055,h,3),ink(i%3?'#738961':'#a8b386'));grass.position.set(x+j*.08,y+h*.5,z);grass.rotation.z=(random()-.5)*.7;scene.add(grass);}
    if(i%9===0)blob(scene,'#ece4b6',[x,y+h,z],[.075,.045,.075]);
  }
  // 东侧旧木桩、沙滩漂流木和一盏石灯。
  const wood=new THREE.Group();wood.position.set(-5,sim.height(-5,6.7)+.12,6.7);wood.rotation.y=.45;scene.add(wood);
  limb(wood,'#98896a',[-.85,0,0],[.85,.03,.08],.16);limb(wood,'#a99a78',[.25,0,0],[.5,.24,-.34],.06);
  const sign=new THREE.Group();sign.position.set(.9,sim.height(.9,5.2),5.2);scene.add(sign);limb(sign,'#857a5e',[0,0,0],[0,.8,0],.05);cube(sign,'#b3a27d',[0,.73,0],[.6,.23,.06]);
  for(let i=0;i<3;i++)cube(sign,'#6f7961',[-.16+i*.14,.74,.033],[.06,.012,.007]);
  const lantern=new THREE.Group();lantern.position.set(3.3,sim.height(3.3,-1.5),-1.5);scene.add(lantern);
  blob(lantern,'#919981',[0,.1,0],[.35,.12,.3],true);cube(lantern,'#9ca28b',[0,.35,0],[.18,.5,.18]);cube(lantern,'#c6c4a2',[0,.66,0],[.35,.28,.35]);cube(lantern,'#6d806c',[0,.66,.177],[.16,.16,.009]);const roof=new THREE.Mesh(new THREE.ConeGeometry(.36,.23,4),ink('#7e8c78'));roof.position.y=.92;roof.rotation.y=Math.PI/4;lantern.add(roof);
  const habitats:[Species,number,number,number][]=[['rabbit',-3,3.7,.8],['rabbit',-4.1,3.1,.55],['fox',2.1,.3,.65],['gull',4.9,7.1,.8],['gull',-2,8.1,.4],['bird',-3.5,-1.6,.8],['bird',-6,-3,.8],['butterfly',-.9,2.4,.7],['butterfly',-2.1,1.6,.7],['butterfly',2.1,3.4,.6],['crab',2.8,8.5,.65],['crab',-4,8.2,.5],['isopod',8.6,3.1,.35],['isopod',8.3,3.6,.35]];
  for(const [kind,x,z,roaming] of habitats){const {group,wings}=animal(kind);group.position.set(x,sim.height(x,z),z);scene.add(group);creatures.push({kind,group,wings,home:group.position.clone(),phase:random()*6.28,roaming});}
  // 空中海鸥只作环境，不占用地面动物的交互记录。
  const skyBirds: THREE.Group[]=[];
  for(let i=0;i<5;i++){const {group}=animal('gull');scene.add(group);skyBirds.push(group);}
  return {creatures,obstacles,treeTops,skyBirds};
}
