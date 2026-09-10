import { WAVES, WATER_F0 } from './waves';
import { ISLAND_X, ISLAND_Z } from '../../shared/terrain';
import * as THREE from 'three/webgpu';
import type { ShaderNodeObject } from 'three/tsl';
import { color, float, mix, normalWorld, positionWorld, positionView, sin, time, vec3, smoothstep, uniform, positionLocal, fwidth, uv, vec2 } from 'three/tsl';
export const worldTint=uniform(new THREE.Color('#ffffff'));
export const skyColor=uniform(new THREE.Color('#eeeade'));
export const waterNear=uniform(new THREE.Color('#a4c9bb'));
export const waterFar=uniform(new THREE.Color('#d4dfd1'));
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
function waveField(x:N,z:N,vertex=false){
 let height: N=float(0),dx:N=float(0),dz:N=float(0);
 for(const w of WAVES){
  if(vertex&&!w.geometry)continue;
  const phase=x.mul(w.x).add(z.mul(w.z)).mul(w.k).sub(time.mul(w.omega)).add(w.phase);
  // Sub-pixel waves become roughness rather than flickering bright lines.
  const resolved=vertex?float(1):float(1).sub(smoothstep(.8,2.8,fwidth(phase)));
  height=height.add(sin(phase).mul(w.amplitude).mul(resolved));
  const slope=phase.cos().mul(w.amplitude*w.k).mul(resolved);
  dx=dx.add(slope.mul(w.x));dz=dz.add(slope.mul(w.z));
 }
 return {height,dx,dz};
}
function shoreRadius(x:N,z:N){
 const a=z.div(ISLAND_Z).atan2(x.div(ISLAND_X));
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
export function oceanMaterial(): THREE.MeshBasicNodeMaterial {
 const m=new THREE.MeshBasicNodeMaterial({fog:false});
 const local=waveField(positionLocal.x,positionLocal.y.negate(),true);
 const localRadius=shoreRadius(positionLocal.x,positionLocal.y.negate());
 m.positionNode=positionLocal.add(vec3(0,0,local.height.mul(smoothstep(1.005,1.18,localRadius))));
 const p=positionWorld,radius=shoreRadius(p.x,p.z),waves=waveField(p.x,p.z);
 const shoal=smoothstep(1.005,1.16,radius);
 const n=vec3(waves.dx.mul(shoal).negate(),1,waves.dz.mul(shoal).negate()).normalize();
 const v=waterView.normalize(),l=sunDirection.normalize();
 const nv=n.dot(v).max(0);
 const fresnel=float(WATER_F0).add(float(1-WATER_F0).mul(float(1).sub(nv).pow(5)));
 const reflected=n.mul(n.dot(v).mul(2)).sub(v);
 const skyReflection=mix(skyColor.mul(.7),skyColor.mul(1.3),smoothstep(-.05,.85,reflected.y));
 const depth=smoothstep(1.02,1.65,radius);
 const body=mix(waterNear,waterFar,depth);
 const base=mix(body,skyReflection,fresnel).mul(n.y.mul(.06).add(.94));
 // Derivative-based specular AA accounts for unresolved wave slopes.
 const variance=fwidth(n).length().mul(.12);
 const alpha=float(.085).add(variance).add(float(1).sub(shoal).mul(.16)).min(.35);
 const spec=waterSpecular(n,v,l,alpha);
 const radiance=mix(color('#fff0cd').mul(.65),color('#d9e6f1').mul(.3),moonStrength);
 const warm=mix(radiance,color('#ffdfac').mul(.65),sunsetStrength);
 // Only shoaling positive crests leave foam, no phase measured around the island.
 const crest=smoothstep(.04,.19,waves.height);
 const foam=crest.mul(float(1).sub(smoothstep(1.025,1.09,radius))).mul(smoothstep(1,1.025,radius));
 const water=mix(base.add(warm.mul(spec)),foamColor,foam.mul(.45));
 const clipWash=float(1).sub(smoothstep(0,20,positionView.z.negate()));
 const haze=smoothstep(2.5,6,radius).max(clipWash);
 m.colorNode=mix(water,skyColor,haze);
 return m;
}
export function shadowMaterial(): THREE.MeshBasicMaterial { return new THREE.MeshBasicMaterial({ color: '#304d3f', transparent: true, opacity: .10, depthWrite: false }); }

export function duskCloudMaterial(): THREE.MeshBasicNodeMaterial {
  const m=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false});
  const p=uv(),wave=sin(p.x.mul(17)).mul(.025).add(sin(p.x.mul(39)).mul(.009));
  const stripe=p.y.add(wave);
  const bank=smoothstep(.08,.28,stripe).mul(float(1).sub(smoothstep(.32,.65,stripe)));
  const wisps=sin(stripe.mul(65).add(sin(p.x.mul(11)))).mul(.2).add(.8);
  const ends=smoothstep(0,.2,p.x).mul(float(1).sub(smoothstep(.78,1,p.x)));
  m.colorNode=mix(color('#e9a381'),color('#b77791'),smoothstep(.12,.7,p.y));
  m.opacityNode=bank.mul(wisps).mul(ends).mul(sunsetStrength).mul(.7);
  return m;
}
