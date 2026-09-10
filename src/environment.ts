import * as THREE from 'three/webgpu';
import { skyColor, waterNear, waterFar, worldTint, sunDirection, foamColor, sunsetStrength, moonStrength, waterView } from './world/materials';
export type TimeOfDay = 'day'|'sunset'|'night';
export const periods: Record<TimeOfDay,{label:string;sky:string;near:string;far:string;tint:string;foam:string;wind:number;icon:string}> = {
  day:{label:'白昼',sky:'#eeeade',near:'#258a9e',far:'#0a304f',tint:'#ffffff',foam:'#f7f4dc',wind:.55,icon:'☼'},
  sunset:{label:'夕阳',sky:'#e5c3bb',near:'#30798a',far:'#152d49',tint:'#ffe2ba',foam:'#ffdfae',wind:.35,icon:'◒'},
  night:{label:'夜晚',sky:'#192b3c',near:'#164151',far:'#071a2c',tint:'#91afce',foam:'#7aa4b1',wind:.75,icon:'☾'},
};
export class Environment {
  period:TimeOfDay='day';automatic=false;clock=0;wind=.55;
  private stars:THREE.Points;
  private viewDirection=new THREE.Vector3();
  private starMaterial=new THREE.PointsMaterial({color:'#ede9c9',size:.10,transparent:true,opacity:0,depthWrite:false});
  constructor(private scene:THREE.Scene,private camera:THREE.Camera){
    let seed=801;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
    const positions=[];for(let i=0;i<160;i++)positions.push((rand()-.5)*140,15+rand()*35,(rand()-.7)*100);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.stars=new THREE.Points(geometry,this.starMaterial);scene.add(this.stars);

  }
  set(period:TimeOfDay){this.period=period;this.automatic=false;}
  update(dt:number){
    if(this.automatic){this.clock=(this.clock+dt)%360;this.period=this.clock<150?'day':this.clock<220?'sunset':'night';}
    this.camera.getWorldDirection(this.viewDirection);waterView.value.copy(this.viewDirection).negate();
    const p=periods[this.period],blend=1-Math.exp(-dt*.75);
    skyColor.value.lerp(new THREE.Color(p.sky),blend);waterNear.value.lerp(new THREE.Color(p.near),blend);waterFar.value.lerp(new THREE.Color(p.far),blend);worldTint.value.lerp(new THREE.Color(p.tint),blend);foamColor.value.lerp(new THREE.Color(p.foam),blend);
    sunDirection.value.lerp(this.period==='sunset'?new THREE.Vector3(-.7,.22,-.65):this.period==='night'?new THREE.Vector3(-.68,.66,-.32):new THREE.Vector3(-.45,.85,.35),blend);
    (this.scene.background as THREE.Color).copy(waterFar.value);(this.scene.fog as THREE.Fog).color.copy(skyColor.value);
    this.wind+=(p.wind-this.wind)*blend;
    this.starMaterial.opacity+=((this.period==='night'?.8:0)-this.starMaterial.opacity)*blend;
    sunsetStrength.value+=((this.period==='sunset'?1:0)-sunsetStrength.value)*blend;
    moonStrength.value+=((this.period==='night'?1:0)-moonStrength.value)*blend;
  }
}
