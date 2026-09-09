import * as THREE from 'three/webgpu';
import type { Creature } from './island';
import type { Simulation } from '../simulation';
import { CAVE, floorHeight, pushOutside, validPosition, type Obstacle, type Point } from './spatial';
import { ISLAND_X } from '../../shared/terrain';
export type VisibilityQuery = (point: THREE.Vector3) => boolean;
export class CreatureSystem {
  private seed = 7719;
  constructor(readonly creatures: Creature[], private obstacles: Obstacle[], private sim: Simulation) {}
  private random() { this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;return (this.seed>>>0)/4294967296; }
  update(dt: number, elapsed: number, player: Point | undefined, visible: VisibilityQuery) {
    dt=Math.min(dt,.05);
    for (const c of this.creatures) {
      const p=c.group.position, previous=c.state;
      const bird=c.kind==='bird'||c.kind==='gull';
      const proximity=player?Math.hypot(p.x-player.x,p.z-player.z):Infinity;
      if(proximity>2.6)c.cooldown=Math.max(0,c.cooldown-dt);
      c.reactionTime=Math.max(0,c.reactionTime-dt);
      const reachable=player&&p.y-floorHeight(player.x,player.z,this.sim)<1.8;
      if(reachable&&c.cooldown===0&&proximity<(bird?1.55:c.kind==='fox'?1.05:1.25)){
        c.state=bird?'takeoff':c.kind==='fox'?'startled':'flee';
        c.reactionTime=bird?4:c.kind==='fox'?1.8:2.7;c.cooldown=2.5;c.reactions++;
        this.escape(c,player!);
      }
      const reacting=c.reactionTime>0;
      const foxRest=c.kind==='fox'&&elapsed%160>80&&elapsed%160<133;
      const birdRest=c.kind==='bird'&&(elapsed+c.phase*2)%85>25&&(elapsed+c.phase*2)%85<60;
      if(!reacting){
        if(foxRest){
          c.state=Math.hypot(p.x-CAVE.bed.x,p.z-CAVE.bed.z)<.2?'sleep':'returning';
          const gate=p.z>CAVE.mouthZ+1&&Math.abs(p.x-CAVE.x)>.5?{x:CAVE.x,z:3.3}:p.z>CAVE.mouthZ-1?{x:CAVE.x,z:CAVE.mouthZ-1.5}:CAVE.bed;
          c.target.set(gate.x,0,gate.z);
        }else if(c.kind==='fox'&&p.z<3&&Math.abs(p.x-CAVE.x)<4){
          c.state='returning';c.target.set(CAVE.x,0,3.6);
        }else if(birdRest){
          const offset=this.creatures.filter(a=>a.kind==='bird').indexOf(c)*1.6;
          c.target.set(CAVE.perch.x-offset,this.sim.height(CAVE.x,CAVE.z)+CAVE.roofHeight+.13,CAVE.perch.z);
          c.state=p.distanceTo(c.target)<.15?'perched':'perching';
        }else if(bird&&(['perched','perching','takeoff','returning'].includes(previous))&&Math.hypot(p.x-c.home.x,p.z-c.home.z)>.3){
          c.state='returning';c.target.copy(c.home);
        }else{
          c.state='roam';if(previous!=='roam')c.decisionIn=0;
          c.decisionIn-=dt;
          if(c.decisionIn<=0){
            c.hiddenFor=visible(p.clone().add(new THREE.Vector3(0,.3,0)))?0:c.hiddenFor+1;
            this.pickTarget(c,player,visible);c.decisionIn=1+this.random()*1.6;
          }
        }
      }
      const airborne=(bird&&c.state==='returning')||c.kind==='butterfly'||c.state==='takeoff'||c.state==='perching'||c.state==='perched';
      const dx=c.target.x-p.x,dz=c.target.z-p.z,distance=Math.hypot(dx,dz);
      let rate=c.kind==='fox'?1.35:c.kind==='rabbit'?.65:bird?.65:c.kind==='butterfly'?.8:.35;
      if(c.state==='flee')rate=c.kind==='rabbit'?3.5:1.5;
      if(c.state==='takeoff'||c.state==='perching'||(bird&&c.state==='returning'))rate=3.8;
      if(c.state==='startled')rate=c.reactionTime>1.15?.7:1.6;
      const amount=Math.min(distance,rate*dt);
      if(distance>.06&&c.state!=='sleep'&&c.state!=='perched'){
        const direction=Math.atan2(dx,dz);
        // Choose a free step around trunks; separation is only the final contact constraint.
        for(const turn of [0,.7,-.7,1.4,-1.4]){
          const next={x:p.x+Math.sin(direction+turn)*amount,z:p.z+Math.cos(direction+turn)*amount};
          if(this.sim.radius(next.x,next.z)>.94-c.radius/ISLAND_X)continue;
          if(!airborne&&!validPosition(next,c.radius,this.obstacles,this.sim))continue;
          if(!airborne&&player&&Math.hypot(next.x-player.x,next.z-player.z)<c.radius+.25)continue;
          p.x=next.x;p.z=next.z;break;
        }
        const delta=Math.atan2(Math.sin(direction-c.group.rotation.y),Math.cos(direction-c.group.rotation.y));
        c.group.rotation.y+=delta*Math.min(1,dt*(reacting?10:5));
      }
      const floor=floorHeight(p.x,p.z,this.sim);
      const overCave=Math.abs(p.x-CAVE.x)<5.3&&Math.abs(p.z-CAVE.z)<5.7;
      const flightFloor=overCave?this.sim.height(CAVE.x,CAVE.z)+CAVE.roofHeight+1:floor+2.7;
      const targetY=c.state==='perching'||c.state==='perched'?c.target.y:(c.state==='takeoff'||(bird&&c.state==='returning'))?flightFloor:floor+(c.kind==='butterfly'?.85+Math.sin(elapsed*2+c.phase)*.12:0);
      if(bird||c.kind==='butterfly')p.y+=(targetY-p.y)*(1-Math.exp(-dt*(c.state==='takeoff'?7:3)));
      else p.y=targetY;
      c.group.rotation.z=c.state==='startled'?Math.sin((1.8-c.reactionTime)*19)*.28*Math.min(1,c.reactionTime):0;
      if(c.kind==='rabbit'&&c.state==='flee')p.y+=Math.abs(Math.sin(elapsed*15+c.phase))*.24;
      c.group.scale.y+=((c.state==='sleep'?.52:1)-c.group.scale.y)*Math.min(1,dt*3);
      c.wings.forEach((w,i)=>{const folded=bird&&!airborne;w.rotation.z=folded?(i===0?.1:-.1):Math.sin(elapsed*(c.state==='takeoff'?18:c.kind==='butterfly'?11:8)+c.phase)*.8*(i===0?1:-1);w.scale.x+=((folded?.3:1)-w.scale.x)*Math.min(1,dt*8);});
    }
    for(let iteration=0;iteration<6;iteration++){
      for(let i=0;i<this.creatures.length;i++)for(let j=i+1;j<this.creatures.length;j++){
        const a=this.creatures[i],b=this.creatures[j],ap=a.group.position,bp=b.group.position;
        if(Math.abs(ap.y-bp.y)>a.radius+b.radius+.15)continue;
        let dx=bp.x-ap.x,dz=bp.z-ap.z,d=Math.hypot(dx,dz),minimum=a.radius+b.radius+.06;
        if(d>=minimum)continue;
        if(d<1e-6){dx=1;dz=0;d=1;}
        const correction=(minimum-Math.hypot(bp.x-ap.x,bp.z-ap.z))*.5;
        ap.x-=dx/d*correction;ap.z-=dz/d*correction;bp.x+=dx/d*correction;bp.z+=dz/d*correction;
      }
      for(const c of this.creatures){
        if(c.kind==='bird'||c.kind==='butterfly'||c.state==='takeoff')continue;
        const p=c.group.position;
        for(const obstacle of this.obstacles)pushOutside(p,c.radius,obstacle);
        const r=this.sim.radius(p.x,p.z),limit=.94-c.radius/ISLAND_X;
        if(r>limit){p.x*=limit/r;p.z*=limit/r;}
      }
    }
  }
  private escape(c:Creature,player:Point){
    const p=c.group.position,away=Math.atan2(p.x-player.x,p.z-player.z);
    const length=c.kind==='fox'?2.2:c.kind==='bird'||c.kind==='gull'?5:4;
    for(const turn of [0,.5,-.5,1,-1,1.6,-1.6,Math.PI]){
      const x=p.x+Math.sin(away+turn)*length,z=p.z+Math.cos(away+turn)*length;
      if(validPosition({x,z},c.radius,this.obstacles,this.sim)){c.target.set(x,p.y,z);return;}
    }
    c.target.set(p.x+Math.sin(away),p.y,p.z+Math.cos(away));
  }
  private pickTarget(c: Creature, player: Point|undefined, visible: VisibilityQuery){
    let score=-Infinity,best:THREE.Vector3|undefined;
    for(let i=0;i<16;i++){
      const angle=this.random()*Math.PI*2,radius=.5+this.random()*(c.roaming+1.1);
      const point=new THREE.Vector3(c.home.x+Math.cos(angle)*radius,0,c.home.z+Math.sin(angle)*radius);
      if(!validPosition(point,c.radius+.1,this.obstacles,this.sim))continue;
      if(c.kind==='fox'&&point.z<3.4)continue;
      if((c.kind==='crab'||c.kind==='isopod'||c.kind==='gull')&&this.sim.radius(point.x,point.z)<.65)continue;
      if(player&&Math.hypot(point.x-player.x,point.z-player.z)<1.7)continue;
      point.y=floorHeight(point.x,point.z,this.sim)+.35;
      // Favor clear sightlines only when the player is exploring this habitat.
      const nearby=player&&Math.hypot(player.x-c.home.x,player.z-c.home.z)<9;
      const view=nearby?(visible(point)?3:-2):0;
      const clearance=Math.min(...this.creatures.filter(other=>other!==c).map(other=>Math.hypot(point.x-other.group.position.x,point.z-other.group.position.z)-other.radius));
      const value=view+Math.min(clearance,2)-point.distanceTo(c.group.position)*.2+this.random();
      if(value>score){score=value;best=point;}
    }
    if(best)c.target.copy(best);
  }
}
