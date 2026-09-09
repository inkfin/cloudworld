import { ISLAND_X, ISLAND_Z } from '../../shared/terrain';
import * as THREE from 'three/webgpu';
import { color, float, mix, normalWorld, positionWorld, sin, time, vec3, smoothstep, uniform, cameraPosition, uv } from 'three/tsl';
export const worldTint=uniform(new THREE.Color('#ffffff'));
export const skyColor=uniform(new THREE.Color('#eeeade'));
export const waterNear=uniform(new THREE.Color('#a4c9bb'));
export const waterFar=uniform(new THREE.Color('#d4dfd1'));
export const foamColor=uniform(new THREE.Color('#f7f4dc'));
export const sunDirection=uniform(new THREE.Vector3(-.45,.85,.35));
export const sunsetStrength=uniform(0);
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
export function oceanMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: false });
  const p = positionWorld;
  const a = p.z.div(ISLAND_Z).atan2(p.x.div(ISLAND_X));
  const radius = p.x.div(ISLAND_X).pow(2).add(p.z.div(ISLAND_Z).pow(2)).sqrt().div(sin(a.mul(5)).mul(.045).add(a.mul(3).cos().mul(.025)).add(1));
  const shore = smoothstep(1.02, 1.64, radius);
  const far = smoothstep(1.5, 4, radius);
  const water = mix(waterNear, waterFar, shore);
  const wash = mix(water, skyColor, far);
  const waves = sin(radius.mul(49).sub(time.mul(1.35)).add(sin(a.mul(9)).mul(.6)));
  const foam = smoothstep(.91, .995, waves).mul(float(1).sub(smoothstep(1.12, 1.9, radius))).mul(smoothstep(.98, 1.05, radius));
  const ripple = sin(p.x.mul(1.8).add(p.z.mul(3)).add(time.mul(.55))).mul(.0015).mul(float(1).sub(far));
  // Tilted micro-normals break a warm reflection into moving horizontal facets.
  const n=vec3(sin(p.x.mul(2.1).add(time.mul(.8))).mul(.055),1,sin(p.z.mul(5.5).sub(time.mul(1.2))).mul(.14)).normalize();
  const halfVector=cameraPosition.sub(p).normalize().add(sunDirection.normalize()).normalize();
  const glint=n.dot(halfVector).max(0).pow(110).mul(.42).add(n.dot(halfVector).max(0).pow(18).mul(.1));
  const sunsetWater=mix(wash,color('#c89b99'),far.mul(.3).mul(sunsetStrength));
  m.colorNode = mix(sunsetWater, foamColor, foam.mul(.58)).add(ripple).add(color('#ffe0a4').mul(glint).mul(smoothstep(-.65,.55,sin(p.x.mul(1.7).add(sin(p.z.mul(2.3))).add(time.mul(.4))))).mul(sunsetStrength).mul(smoothstep(1,1.13,radius)));
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
