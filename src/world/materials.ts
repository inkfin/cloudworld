import * as THREE from 'three/webgpu';
import { color, float, mix, normalWorld, positionWorld, sin, time, vec3, smoothstep, uniform } from 'three/tsl';
export const worldTint=uniform(new THREE.Color('#ffffff'));
export const skyColor=uniform(new THREE.Color('#eeeade'));
export const waterNear=uniform(new THREE.Color('#a4c9bb'));
export const waterFar=uniform(new THREE.Color('#d4dfd1'));
export const foamColor=uniform(new THREE.Color('#f7f4dc'));
export const sunDirection=uniform(new THREE.Vector3(-.45,.85,.35));
const cache = new Map<string, THREE.MeshBasicNodeMaterial>();
// 世界空间明暗分段与细颗粒，着色器通过 TSL 编译到 WGSL。
export function ink(hex: string): THREE.MeshBasicNodeMaterial {
  if (cache.has(hex)) return cache.get(hex)!;
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.FrontSide });
  const light = normalWorld.dot(sunDirection.normalize());
  const band = smoothstep(-0.05, 0.02, light).mul(0.17).add(smoothstep(0.5, 0.56, light).mul(0.13)).add(0.7);
  const pigment = sin(positionWorld.x.mul(53).add(positionWorld.z.mul(71)).add(positionWorld.y.mul(113))).mul(0.018).add(0.985);
  material.colorNode = color(hex).mul(band).mul(pigment).mul(worldTint);
  cache.set(hex, material);
  return material;
}
export function oceanMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: false });
  const p = positionWorld;
  const a = p.z.div(10.5).atan2(p.x.div(13));
  const radius = p.x.div(13).pow(2).add(p.z.div(10.5).pow(2)).sqrt().div(sin(a.mul(5)).mul(.045).add(a.mul(3).cos().mul(.025)).add(1));
  const shore = smoothstep(1.02, 1.64, radius);
  const far = smoothstep(1.5, 4, radius);
  const water = mix(waterNear, waterFar, shore);
  const wash = mix(water, skyColor, far);
  const waves = sin(radius.mul(49).sub(time.mul(1.35)).add(sin(a.mul(9)).mul(.6)));
  const foam = smoothstep(.91, .995, waves).mul(float(1).sub(smoothstep(1.12, 1.9, radius))).mul(smoothstep(.98, 1.05, radius));
  const ripple = sin(p.x.mul(1.8).add(p.z.mul(3)).add(time.mul(.55))).mul(.0015).mul(float(1).sub(far));
  m.colorNode = mix(wash, foamColor, foam.mul(.58)).add(ripple);
  return m;
}
export function shadowMaterial(): THREE.MeshBasicMaterial { return new THREE.MeshBasicMaterial({ color: '#304d3f', transparent: true, opacity: .10, depthWrite: false }); }
