import * as THREE from 'three/webgpu';
import { ink, shadowMaterial } from './materials';
const sphere = new THREE.IcosahedronGeometry(1, 1);
const lowSphere = new THREE.IcosahedronGeometry(1, 0);
const box = new THREE.BoxGeometry(1, 1, 1);
export function blob(parent: THREE.Object3D, color: string, p: number[], scale: number[], low = false): THREE.Mesh {
  const mesh = new THREE.Mesh(low ? lowSphere : sphere, ink(color));
  mesh.position.set(p[0], p[1], p[2]); mesh.scale.set(scale[0], scale[1], scale[2]); parent.add(mesh); return mesh;
}
export function cube(parent: THREE.Object3D, color: string, p: number[], scale: number[]): THREE.Mesh {
  const mesh = new THREE.Mesh(box, ink(color)); mesh.position.set(p[0], p[1], p[2]); mesh.scale.set(scale[0], scale[1], scale[2]); parent.add(mesh); return mesh;
}
export function limb(parent: THREE.Object3D, color: string, from: number[], to: number[], radius: number): THREE.Mesh {
  const a = new THREE.Vector3(...from as [number,number,number]); const b = new THREE.Vector3(...to as [number,number,number]);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * .72, radius, a.distanceTo(b), 5), ink(color));
  mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), b.sub(a).normalize()); parent.add(mesh); return mesh;
}
const shadowGeo = new THREE.CircleGeometry(1, 24); const shadowMat = shadowMaterial();
export function shadow(parent: THREE.Object3D, x: number, y: number, z: number, sx: number, sz: number): void {
  const mesh = new THREE.Mesh(shadowGeo, shadowMat); mesh.rotation.x = -Math.PI/2; mesh.scale.set(sx,sz,1); mesh.position.set(x,y+.015,z); parent.add(mesh);
}
export function child(): { group: THREE.Group; legs: THREE.Group[]; arms: THREE.Group[] } {
  const group = new THREE.Group();
  blob(group, '#b5563e', [0,.65,0], [.23,.31,.17]); // 陶红色外套
  blob(group, '#e3b887', [0,1.06,.01], [.23,.25,.21]);
  blob(group, '#353c32', [0,1.18,-.04], [.24,.17,.2]);
  blob(group, '#313c34', [-.085,1.07,.205], [.019,.025,.015]); blob(group, '#313c34', [.085,1.07,.205], [.019,.025,.015]);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.4,.42,.045,12), ink('#dcc18b')); brim.position.y=1.29; group.add(brim);
  blob(group, '#e4c992', [0,1.34,0], [.28,.15,.26]);
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(.255,.27,.045,12), ink('#7d6950')); ribbon.position.y=1.32; group.add(ribbon);
  const legs: THREE.Group[]=[]; const arms: THREE.Group[]=[];
  for(const side of [-1,1]) {
    const leg = new THREE.Group(); leg.position.set(side*.115,.46,0); group.add(leg); legs.push(leg);
    cube(leg,'#43564b',[0,-.12,0],[.14,.25,.15]); limb(leg,'#d6b08a',[0,-.18,0],[0,-.36,.01],.045); blob(leg,'#544d3e',[0,-.39,.045],[.09,.065,.13]);
    const arm = new THREE.Group(); arm.position.set(side*.2,.8,0); group.add(arm); arms.push(arm);
    limb(arm,'#b85d43',[0,0,0],[side*.07,-.22,0],.078); blob(arm,'#dfb68a',[side*.08,-.25,0],[.06,.07,.06]);
  }
  cube(group,'#d1ad71',[0,.7,-.2],[.28,.3,.12]);
  return {group,legs,arms};
}
export type Species = 'rabbit'|'fox'|'gull'|'bird'|'butterfly'|'crab'|'isopod';
export const speciesNames: Record<Species,string> = {rabbit:'兔子',fox:'狐狸',gull:'海鸥',bird:'小鸟',butterfly:'蝴蝶',crab:'螃蟹',isopod:'海蟑螂'};
export function animal(kind: Species): {group: THREE.Group; wings: THREE.Object3D[]} {
  const group=new THREE.Group(); const wings: THREE.Object3D[]=[];
  if(kind==='rabbit') {
    blob(group,'#f1edda',[0,.22,0],[.19,.23,.3]); blob(group,'#f8f2df',[0,.43,.2],[.17,.17,.16]);
    for(const s of [-1,1]) {blob(group,'#f0ead7',[s*.075,.66,.18],[.049,.22,.053]);blob(group,'#c4a99a',[s*.075,.67,.224],[.023,.14,.013]);blob(group,'#333f34',[s*.11,.45,.31],[.022,.023,.018]);blob(group,'#eee7d3',[s*.13,.06,.16],[.09,.06,.15]);}
    blob(group,'#f8f4e6',[0,.22,-.29],[.1,.1,.1]);
  } else if(kind==='fox') {
    blob(group,'#c17d44',[0,.28,0],[.22,.23,.47]);blob(group,'#ce894d',[0,.55,.35],[.24,.23,.24]);blob(group,'#eed8b0',[0,.46,.55],[.18,.13,.19]);blob(group,'#3c3b2d',[0,.49,.7],[.055,.04,.05]);
    for(const s of [-1,1]) { const ear=new THREE.Mesh(new THREE.ConeGeometry(.12,.28,3),ink('#b9723c'));ear.position.set(s*.16,.78,.3);group.add(ear);blob(group,'#343b2f',[s*.125,.59,.53],[.025,.025,.022]);for(const z of [-.27,.27])limb(group,'#5c4c37',[s*.14,.24,z],[s*.15,.04,z+.02],.055); }
    const tail=blob(group,'#c78449',[.04,.3,-.6],[.17,.17,.4]);tail.rotation.x=-.35;blob(group,'#efddba',[.04,.39,-.89],[.13,.13,.18]);
  } else if(kind==='bird'||kind==='gull') {
    const c=kind==='gull'?'#f2f0dd':'#72928c';
    blob(group,c,[0,.14,0],[.14,.15,.27]);blob(group,c,[0,.25,.2],[.12,.12,.12]);blob(group,'#c19553',[0,.24,.34],[.045,.035,.1]);
    for(const s of [-1,1]){blob(group,'#354039',[s*.082,.27,.26],[.017,.017,.014]);const pivot=new THREE.Group();group.add(pivot);const wing=blob(pivot,kind==='gull'?'#d9e0d2':'#526f68',[s*.29,.16,-.035],[.34,.045,.15]);wing.rotation.z=s*.1;wings.push(pivot);}
  } else if(kind==='butterfly') {
    blob(group,'#585240',[0,0,0],[.018,.045,.09]);
    for(const s of [-1,1]){const pivot=new THREE.Group();group.add(pivot);blob(pivot,'#e2ba64',[s*.12,0,.04],[.14,.016,.14]);blob(pivot,'#d8a358',[s*.095,0,-.1],[.095,.014,.08]);wings.push(pivot);}
  } else if(kind==='crab') {
    blob(group,'#b9775c',[0,.095,0],[.15,.08,.11]);
    for(const s of [-1,1]){for(let j=0;j<3;j++)limb(group,'#ad7359',[s*.1,.09,j*.075-.09],[s*.24,.02,j*.105-.12],.016);limb(group,'#ac634b',[s*.1,.1,.06],[s*.2,.17,.19],.02);blob(group,'#bb7557',[s*.21,.19,.21],[.06,.05,.055]);blob(group,'#353d30',[s*.058,.17,.072],[.016,.022,.016]);}
  } else {
    blob(group,'#687067',[0,.065,0],[.09,.05,.2]);
    for(let j=0;j<6;j++){const z=j*.055-.14;blob(group,'#7c8275',[0,.088,z],[.087,.024,.012]);for(const s of [-1,1])limb(group,'#606b60',[s*.05,.045,z],[s*.13,.012,z-.025],.009);}
    for(const s of [-1,1])limb(group,'#606b60',[s*.035,.06,.15],[s*.1,.04,.32],.008);
  }
  return {group,wings};
}
