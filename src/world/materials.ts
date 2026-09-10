import type { OceanSystem } from './ocean';
const WATER_F0=((1.333-1)/(1.333+1))**2;
import { ISLAND_X, ISLAND_Z } from '../../shared/terrain';
import * as THREE from 'three/webgpu';
import type { ShaderNodeObject } from 'three/tsl';
import { color, float, mix, normalWorld, positionWorld, positionView, sin, time, vec3, smoothstep, uniform, attribute, texture, fwidth, vec2 } from 'three/tsl';
export const worldTint=uniform(new THREE.Color('#ffffff'));
export const skyColor=uniform(new THREE.Color('#eeeade'));
export const waterNear=uniform(new THREE.Color('#258a9e'));
export const waterFar=uniform(new THREE.Color('#0a304f'));
export const foamColor=uniform(new THREE.Color('#f7f4dc'));
export const sunDirection=uniform(new THREE.Vector3(-.45,.85,.35));
export const sunsetStrength=uniform(0);
export const moonStrength=uniform(0);
// Orthographic rays are parallel: use the camera direction, not eye-to-pixel rays.
export const waterView=uniform(new THREE.Vector3(.48,.55,.68));
const cache = new Map<string, THREE.MeshBasicNodeMaterial>();
// 世界空间明暗分段与细颗粒，着色器通过 TSL 编译到 WGSL。
export function ink(hex: string): THREE.MeshBasicNodeMaterial {
  if (cache.has(hex)) return cache.get(hex)!;
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.FrontSide });
  const light = normalWorld.dot(sunDirection.normalize());
  const band = smoothstep(-0.05, 0.02, light).mul(0.17).add(smoothstep(0.5, 0.56, light).mul(0.13)).add(0.7);
  const pigment = sin(positionWorld.x.mul(53).add(positionWorld.z.mul(71)).add(positionWorld.y.mul(113))).mul(0.018).add(0.985);
  const shade=mix(color('#536b86'),color('#ffda9f'),smoothstep(-.12,.65,light));
  const lighting=mix(vec3(1),shade.mul(1.3),sunsetStrength.mul(.72));
  material.colorNode = color(hex).mul(band).mul(pigment).mul(worldTint).mul(lighting);
  cache.set(hex, material);
  return material;
}
type N=ShaderNodeObject<THREE.Node>;
function shoreRadius(x:N,z:N){
 const a=z.div(ISLAND_Z).atan(x.div(ISLAND_X));
 return x.div(ISLAND_X).pow(2).add(z.div(ISLAND_Z).pow(2)).sqrt()
  .div(sin(a.mul(5)).mul(.045).add(a.mul(3).cos().mul(.025)).add(1));
}
// GGX / Smith correlated visibility / Schlick Fresnel. Radiance is exposure-scaled.
function waterSpecular(n:N,v:N,l:N,alpha:N){
 const h=v.add(l).normalize(),nv=n.dot(v).max(.001),nl=n.dot(l).max(0),nh=n.dot(h).max(0),vh=v.dot(h).max(0);
 const a2=alpha.mul(alpha),denom=nh.mul(nh).mul(a2.sub(1)).add(1);
 const distribution=a2.div(denom.mul(denom).mul(Math.PI));
 const visibility=float(.5).div(nl.mul(nv.mul(nv).mul(float(1).sub(a2)).add(a2).sqrt())
  .add(nv.mul(nl.mul(nl).mul(float(1).sub(a2)).add(a2).sqrt())).max(.0001));
 const fresnel=float(WATER_F0).add(float(1-WATER_F0).mul(float(1).sub(vh).pow(5)));
 return distribution.mul(visibility).mul(fresnel).mul(nl);
}
function oceanNoise(p:N){
 const cell=p.floor(),f=p.fract(),u=f.mul(f).mul(float(3).sub(f.mul(2)));
 const hash=(q:N)=>sin(q.dot(vec2(127.1,311.7))).mul(43758.5453).fract();
 return mix(mix(hash(cell),hash(cell.add(vec2(1,0))),u.x),mix(hash(cell.add(vec2(0,1))),hash(cell.add(1)),u.x),u.y);
}
// Shared shore timing keeps the foam front and the incoming sheet of water together.
function shoreWave(q:N,ocean:OceanSystem){
 const radius=shoreRadius(q.x,q.y);
 const coast=smoothstep(.83,.94,radius).mul(float(1).sub(smoothstep(1.12,1.4,radius)));
 const pulse=sin(ocean.clock.mul(.73).add(radius.mul(24)).add(q.x.mul(.11)).add(q.y.mul(.08)))
  .add(sin(ocean.clock.mul(1.13).add(radius.mul(37)).sub(q.x.mul(.09)).add(q.y.mul(.13))).mul(.4)).max(0).mul(.19).mul(coast);
 return {radius,coast,pulse};
}
function foamGrain(q:N,ocean:OceanSystem){
 const drifting=q.add(vec2(ocean.clock.mul(.025),ocean.clock.mul(-.018)));
 const holes=smoothstep(.18,.65,oceanNoise(drifting.mul(6))).mul(.55).add(.45);
 return holes.mul(oceanNoise(drifting.mul(1.15)).mul(.35).add(.65));
}
export function beachMaterial(ocean:OceanSystem){
 const m=ink('#ffffff').clone(),q=positionWorld.xz;
 const wet=texture(ocean.bed,q.div(128).add(.5));
 const {coast,pulse}=shoreWave(q,ocean),depth=ocean.seaLevel.add(pulse).sub(positionWorld.y);
 const front=smoothstep(-.012,.006,depth).mul(float(1).sub(smoothstep(.025,.085,depth)));
 const foam=front.mul(.98).max(wet.g.mul(.78)).mul(coast).mul(foamGrain(q,ocean));
 // Vertex sand pigment belongs to the ground only; it must not tint white foam.
 const sand=vec3(m.colorNode!).mul(attribute('color','vec3')).mul(mix(vec3(1),color('#d5dddb'),wet.b));
 m.vertexColors=false;m.colorNode=mix(sand,foamColor,foam);
 return m;
}
export function oceanMaterial(ocean:OceanSystem): THREE.MeshBasicNodeMaterial {
 const m=new THREE.MeshBasicNodeMaterial({fog:false,transparent:true,depthWrite:true,side:THREE.DoubleSide,alphaTest:.002});
 const attr=attribute('position','vec3'),q=vec2(attr.x,attr.y.negate());
 const {radius,coast,pulse}=shoreWave(q,ocean);
 const bedSample=texture(ocean.bed,q.div(128).add(.5));
 const offshore=radius.sub(1).max(0).mul(10).negate().add(.2);
 const bed=mix(bedSample.r,offshore,smoothstep(58,64,q.x.abs().max(q.y.abs())));
 const calmDepth=ocean.seaLevel.sub(bed).max(0),shoal=calmDepth.div(calmDepth.add(1.2));
 let displacement:N=vec3(0),normalSlope:N=vec2(0),whitecaps:N=float(0),peak:N=float(0);
 for(const c of ocean.cascades){
  const tc=q.div(c.length).add(.5);
  const d=mix(texture(c.displacement[0],tc),texture(c.displacement[1],tc),ocean.blend);
  const n=mix(texture(c.normals[0],tc),texture(c.normals[1],tc),ocean.blend);
  displacement=displacement.add(d.xyz);normalSlope=normalSlope.add(n.xz.div(n.y.max(.2)));
  whitecaps=whitecaps.max(d.w);peak=peak.max(n.w);
 }
 const level=ocean.seaLevel.add(displacement.y.mul(shoal)).add(pulse);
 m.positionNode=vec3(attr.x.add(displacement.x.mul(shoal)),attr.y.sub(displacement.z.mul(shoal)),level);
 const depth=level.sub(bed).max(0);
 const n=vec3(normalSlope.x.mul(shoal),1,normalSlope.y.mul(shoal)).normalize();
 const v=waterView.normalize(),l=sunDirection.normalize(),nv=n.dot(v).max(0);
 const fresnel=float(WATER_F0).add(float(1-WATER_F0).mul(float(1).sub(nv).pow(5)));
 // Beer-Lambert extinction: thin shoals transmit the rendered sand beneath them.
 const extinction=vec3(.48,.18,.09).mul(depth).negate().exp();
 const shallow=mix(waterFar,waterNear,extinction);
 const subsurface=waterNear.mul(peak).mul(shoal).mul(.17).mul(float(1).sub(moonStrength.mul(.65)));
 const reflected=n.mul(n.dot(v).mul(2)).sub(v);
 // Sample a broad warm region of the sky along the reflected ray.
 // FFT normals break it into glints; no world-space or screen-space light strip.
 const eveningGlow=reflected.normalize().dot(l).max(0).pow(6).mul(sunsetStrength);
 const sky=mix(mix(skyColor.mul(.55),skyColor,smoothstep(.05,.8,reflected.y)),color('#ffc394').mul(1.4),eveningGlow.mul(.8));
 const body=mix(shallow.add(subsurface),sky,fresnel);
 const alpha=float(.14).add(fwidth(n).length().mul(.18)).min(.35);
 const spec=waterSpecular(n,v,l,alpha);
 const radiance=mix(color('#fff1d6').mul(.5),color('#c9ddef').mul(.25),moonStrength);
 const light=mix(radiance,color('#ffbf79').mul(.9),sunsetStrength);
 const breakup=foamGrain(q,ocean);
 const edge=float(1).sub(smoothstep(.025,.10,depth)).mul(smoothstep(0,.035,depth)).mul(coast);
 const offshoreBreakup=oceanNoise(q.mul(2.4).add(ocean.clock.mul(.035))).mul(.45).add(.55);
 const foam=whitecaps.mul(shoal).mul(.55).mul(offshoreBreakup).add(edge.mul(1.25).max(bedSample.g.mul(coast).mul(1.15)).mul(breakup)).min(.95);
 const lit=body.add(light.mul(spec));
 const water=mix(lit,foamColor,foam);
 const nearClip=float(1).sub(smoothstep(0,20,positionView.z.negate()));
 const haze=smoothstep(6,11,radius).max(nearClip);
 m.colorNode=mix(water,waterFar,haze);
 m.opacityNode=mix(smoothstep(0,.035,depth).mul(float(1).sub(depth.mul(-2).exp()).max(foam)),1,haze);
 return m;
}
export function shadowMaterial(): THREE.MeshBasicMaterial { return new THREE.MeshBasicMaterial({ color: '#304d3f', transparent: true, opacity: .10, depthWrite: false }); }
