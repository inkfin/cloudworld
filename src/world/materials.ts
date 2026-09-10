import { ISLAND_X, ISLAND_Z } from '../../shared/terrain';
import * as THREE from 'three/webgpu';
import type { ShaderNodeObject } from 'three/tsl';
import { color, float, mix, normalWorld, positionWorld, positionView, sin, time, vec3, smoothstep, uniform, cameraPosition, uv, vec2 } from 'three/tsl';
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
function waterNoise(p: ShaderNodeObject<THREE.Node>) {
  const cell=p.floor(),f=p.fract(),u=f.mul(f).mul(float(3).sub(f.mul(2)));
  const hash=(q: ShaderNodeObject<THREE.Node>)=>sin(q.dot(vec2(127.1,311.7))).mul(43758.5453).fract();
  return mix(mix(hash(vec2(cell)),hash(vec2(cell.add(vec2(1,0)))),u.x),mix(hash(vec2(cell.add(vec2(0,1)))),hash(vec2(cell.add(1))),u.x),u.y);
}
export function oceanMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: false, fog: false });
  const p = positionWorld;
  const a = p.z.div(ISLAND_Z).atan2(p.x.div(ISLAND_X));
  const radius = p.x.div(ISLAND_X).pow(2).add(p.z.div(ISLAND_Z).pow(2)).sqrt().div(sin(a.mul(5)).mul(.045).add(a.mul(3).cos().mul(.025)).add(1));
  const shore = smoothstep(1.02, 1.64, radius);
  // Feather the near clip edge exposed by very wide orthographic framing.
  const clipWash=float(1).sub(smoothstep(0,20,positionView.z.negate()));
  const far = smoothstep(1.5, 4, radius).max(clipWash);
  const water = mix(waterNear, waterFar, shore);
  const wash = mix(water, skyColor, far);
  // Broken, softly feathered shore wash, confined to the immediate beach.
  const drift=sin(p.x.mul(.43).add(p.z.mul(.31)).sub(time.mul(.32)))
    .add(sin(p.z.mul(.79).sub(p.x.mul(.16)).add(time.mul(.21))).mul(.45));
  const waves=sin(radius.mul(66).sub(time.mul(.8)).add(drift.mul(1.7)));
  const broken=smoothstep(-.45,.6,sin(a.mul(13).add(drift)).add(sin(p.x.mul(.6).sub(p.z.mul(.41))).mul(.6)));
  const foam=smoothstep(.5,.97,waves).mul(broken)
    .mul(float(1).sub(smoothstep(1.035,1.23,radius))).mul(smoothstep(.99,1.045,radius));
  const swell=sin(p.x.mul(.27).add(p.z.mul(.46)).sub(time.mul(.27)))
    .mul(sin(p.z.mul(.18).sub(p.x.mul(.12)).add(time.mul(.13))));
  const grain=sin(p.z.mul(2.9).add(sin(p.x.mul(.72))).sub(time.mul(.5)));
  const ripple=swell.mul(.0025).add(grain.mul(.0015)).mul(float(1).sub(far));
  const n=vec3(sin(p.x.mul(1.2).add(time.mul(.45))).mul(.09),1,sin(p.z.mul(3.1).sub(time.mul(.65))).mul(.16)).normalize();
  const halfVector=cameraPosition.sub(p).normalize().add(sunDirection.normalize()).normalize();
  const glint=n.dot(halfVector).max(0).pow(80).mul(.35);
  const sunsetWater=mix(wash,color('#c89b99'),far.mul(.3).mul(sunsetStrength));
  // A painterly reflection footprint on the sea, not a screen-space lunar disc.
  // The virtual light height controls the length of the silver path.
  const axis=waterView.xz.add(.0001).normalize();
  const delta=p.xz.add(5).add(waterView.xz.div(waterView.y.max(.25)).mul(22));
  const along=delta.dot(axis),across=delta.x.mul(axis.y).sub(delta.y.mul(axis.x));
  const bend=sin(along.mul(.32).sub(time.mul(.3))).mul(.65);
  const width=along.mul(.035).add(3.4).max(1.8);
  const spread=across.add(bend).div(width).pow(2).negate().exp()
    .mul(along.div(23).pow(2).negate().exp());
  const turbulence=waterNoise(vec2(across.mul(.55),along.mul(.37).sub(time.mul(.12))));
  const fragments=waterNoise(vec2(across.mul(1.9).add(time.mul(.06)),along.mul(2.2)));
  const strokes=smoothstep(.1,.92,sin(along.mul(3.8).add(turbulence.mul(8)).sub(time.mul(.55))));
  const gaps=smoothstep(.25,.75,fragments).mul(smoothstep(.15,.65,turbulence));
  const silver=spread.mul(strokes.mul(gaps).mul(.68).add(.028));
  const glow=across.div(8).pow(2).add(along.div(29).pow(2)).negate().exp().mul(.028);
  const lunar=color('#cbdcda').mul(silver.add(glow)).mul(moonStrength)
    .mul(smoothstep(1.015,1.12,radius));
  m.colorNode=mix(sunsetWater,foamColor,foam.mul(.32)).add(ripple)
    .add(color('#ffe0a4').mul(glint).mul(broken).mul(sunsetStrength).mul(smoothstep(1,1.13,radius)).mul(float(1).sub(clipWash)))
    .add(lunar.mul(float(1).sub(clipWash)));
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
