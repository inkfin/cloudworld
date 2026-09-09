import { CatmullRomCurve3, Vector3 } from 'three/webgpu';
export const CAMP = {x:-3,z:18};
export const MEADOW = {x:-15,z:1};
// Shared junctions make two loops, with a short spur to the northern overlook.
const routes = [
  [[0,18],[-1,13],[-6,7],[-8,2],[-15,1]],
  [[-15,1],[-17,-5],[-12,-10],[-5,-12],[2,-11],[5,-6],[6,-1],[9,3.5],[13.2,1.8]],
  [[-8,2],[-2,0],[5,2],[13.2,1.8]],
  [[13.2,1.8],[18,7],[15,13],[7,15],[0,18]],
  [[-12,-10],[-12,-14],[-9,-17]],
];
export const TRAILS=routes.map(points=>new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x,0,z)),false,'centripetal').getPoints(100));
const cells=new Map<string,[Vector3,Vector3][]>();
for(const trail of TRAILS)for(let i=1;i<trail.length;i++){
  const a=trail[i-1],b=trail[i];
  for(let x=Math.floor((Math.min(a.x,b.x)-4)/4);x<=Math.floor((Math.max(a.x,b.x)+4)/4);x++)
    for(let z=Math.floor((Math.min(a.z,b.z)-4)/4);z<=Math.floor((Math.max(a.z,b.z)+4)/4);z++){
      const key=`${x},${z}`,list=cells.get(key)||[];list.push([a,b]);cells.set(key,list);
    }
}
export function pathDistance(x:number,z:number):number {
  let best=16;
  for(const [a,b] of cells.get(`${Math.floor(x/4)},${Math.floor(z/4)}`)||[]){
    const dx=b.x-a.x,dz=b.z-a.z;
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
    best=Math.min(best,(x-a.x-dx*t)**2+(z-a.z-dz*t)**2);
  }
  return Math.sqrt(best);
}
export function locationAt(x:number,z:number):string {
  if(Math.hypot(x-CAMP.x,z-CAMP.z)<5)return '听潮营地';
  if(Math.hypot(x-MEADOW.x,z-MEADOW.z)<5)return '野花原';
  if(z<-13)return '晚霞望海坡';
  if(x>12&&z>5)return '东岸小径';
  return pathDistance(x,z)<.7?'林间小径':'青苔森林';
}
