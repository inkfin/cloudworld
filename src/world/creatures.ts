import * as THREE from 'three/webgpu';
import type { Creature } from './island';
import type { Simulation } from '../simulation';
import { CAVE, floorHeight, pushOutside, validPosition, type Obstacle, type Point } from './spatial';
export type VisibilityQuery = (point: THREE.Vector3) => boolean;
export class CreatureSystem {
  private seed = 7719;
  constructor(readonly creatures: Creature[], private obstacles: Obstacle[], private sim: Simulation) {}
  private random() { this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;return (this.seed>>>0)/4294967296; }
  update(dt: number, elapsed: number, player: Point | undefined, visible: VisibilityQuery) {
    dt=Math.min(dt,.05);
    for (const c of this.creatures) {
      const p=c.group.position;
      const foxRest=c.kind==='fox' && elapsed%100>60 && elapsed%100<87;
      const birdRest=c.kind==='bird' && (elapsed+c.phase*2)%55>13 && (elapsed+c.phase*2)%55<39;
      const previous=c.state;
      if(foxRest){
        c.state=Math.hypot(p.x-CAVE.bed.x,p.z-CAVE.bed.z)<.18?'sleep':'returning';
        // 经木平台进入洞口，避免沿直线穿过洞壁。
        const gate=p.z>1.2&&Math.abs(p.x-CAVE.x)>.4?{x:CAVE.x,z:1.9}:p.z>-.9?{x:CAVE.x,z:-1.4}:CAVE.bed;
        c.target.set(gate.x,0,gate.z);
      } else if(c.kind==='fox' && (previous==='sleep'||(previous==='returning'&&p.z<2.4)||(p.z<1.5&&p.x>4.1))) {
        c.state='returning'; c.target.set(CAVE.x,0,2.5);
      } else if(birdRest) {
        const offset=this.creatures.filter(a=>a.kind==='bird').indexOf(c)*1.15;
        c.target.set(CAVE.perch.x-offset,this.sim.height(CAVE.x,CAVE.z)+CAVE.roofHeight+.13,CAVE.perch.z);
        c.state=p.distanceTo(c.target)<.13?'perched':'perching';
      } else {
        c.state='roam';
        if(previous!=='roam')c.decisionIn=0;
        c.decisionIn-=dt;
        if(c.decisionIn<=0){
          const seen=visible(p.clone().add(new THREE.Vector3(0,.3,0)));
          c.hiddenFor=seen?0:c.hiddenFor+.8;
          this.pickTarget(c,player,visible);c.decisionIn=.8+this.random()*.6;
        }
      }
      const flying=c.kind==='bird'||c.kind==='butterfly';
      const close=player&&Math.hypot(p.x-player.x,p.z-player.z)<1.5;
      let dx=c.target.x-p.x,dz=c.target.z-p.z,distance=Math.hypot(dx,dz);
      const rate=c.kind==='fox'?1.25:c.kind==='rabbit'?.65:flying?.9:.4;
      const amount=Math.min(distance,rate*dt*(close&&c.state==='roam'?.3:1));
      if(distance>.06&&c.state!=='sleep'&&c.state!=='perched'){
        p.x+=dx/distance*amount;p.z+=dz/distance*amount;
        const angle=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(angle-c.group.rotation.y),Math.cos(angle-c.group.rotation.y));
        c.group.rotation.y+=delta*Math.min(1,dt*6);
      }
      const targetY=c.state==='perching'||c.state==='perched'?c.target.y:floorHeight(p.x,p.z,this.sim)+(flying?(c.kind==='bird'?1.45:.85)+Math.sin(elapsed*2+c.phase)*.12:0);
      if(flying)p.y+=(targetY-p.y)*(1-Math.exp(-dt*3));else p.y=targetY;
      c.group.scale.y+=( (c.state==='sleep'?.52:1)-c.group.scale.y)*Math.min(1,dt*3);
      c.wings.forEach((w,i)=>{w.rotation.z=c.state==='perched'?(i===0?.1:-.1):Math.sin(elapsed*(c.kind==='butterfly'?11:5)+c.phase)*.6*(i===0?1:-1);w.scale.x+=( (c.state==='perched'?.3:1)-w.scale.x)*Math.min(1,dt*4);});
    }
    // 先算行为，再统一约束；即使停下来打招呼也要参与碰撞，不能冻结重叠。
    for(let iteration=0;iteration<10;iteration++){
      for(let i=0;i<this.creatures.length;i++){
        const a=this.creatures[i];
        for(let j=i+1;j<this.creatures.length;j++){
          const b=this.creatures[j],ap=a.group.position,bp=b.group.position;
          if(Math.abs(ap.y-bp.y)>a.radius+b.radius+.15)continue;
          let dx=bp.x-ap.x,dz=bp.z-ap.z,d=Math.hypot(dx,dz),minimum=a.radius+b.radius+.06;
          if(d>=minimum)continue;
          if(d<1e-6){dx=1;dz=0;d=1;}
          const correction=(minimum-Math.hypot(bp.x-ap.x,bp.z-ap.z))*.5;
          ap.x-=dx/d*correction;ap.z-=dz/d*correction;bp.x+=dx/d*correction;bp.z+=dz/d*correction;
        }
      }
      for(const c of this.creatures){
        if(c.kind==='bird'||c.kind==='butterfly')continue;
        const p=c.group.position;
        for(const obstacle of this.obstacles)pushOutside(p,c.radius,obstacle);
        if(player)pushOutside(p,c.radius,{...player,radius:.25});
        const r=this.sim.radius(p.x,p.z),limit=.94-c.radius/13;
        if(r>limit){p.x*=limit/r;p.z*=limit/r;}
        p.y=floorHeight(p.x,p.z,this.sim);
      }
    }
  }
  private pickTarget(c: Creature, player: Point|undefined, visible: VisibilityQuery){
    let score=-Infinity,best:THREE.Vector3|undefined;
    for(let i=0;i<16;i++){
      const angle=this.random()*Math.PI*2,radius=.5+this.random()*(c.roaming+1.1);
      // 保留各自栖息地；持续被挡住才扩大寻找范围。
      const origin=c.hiddenFor>1.2?c.group.position:c.home;
      const point=new THREE.Vector3(origin.x+Math.cos(angle)*radius,0,origin.z+Math.sin(angle)*radius);
      if(!validPosition(point,c.radius+.1,this.obstacles,this.sim)||Math.hypot(point.x-c.home.x,point.z-c.home.z)>4.5)continue;
      if(c.kind==='fox'&&point.z<1.7)continue;
      if((c.kind==='crab'||c.kind==='isopod'||c.kind==='gull')&&this.sim.radius(point.x,point.z)<.65)continue;
      if(player&&Math.hypot(point.x-player.x,point.z-player.z)<1)continue;
      point.y=floorHeight(point.x,point.z,this.sim)+.35;
      const view=visible(point)?5:-3;
      const clearance=Math.min(...this.creatures.filter(other=>other!==c).map(other=>Math.hypot(point.x-other.group.position.x,point.z-other.group.position.z)-other.radius));
      const value=view+Math.min(clearance,2)-point.distanceTo(c.group.position)*.2+this.random()*.4;
      if(value>score){score=value;best=point;}
    }
    if(best)c.target.copy(best);
  }
}
